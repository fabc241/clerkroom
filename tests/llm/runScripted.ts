// Scripted evaluation against the real local model.
//
//   npm run eval                      # all stations, examiner check on 2 stations
//   npm run eval -- psych-low-mood    # one station
//   npm run eval -- --examiner-all    # examiner check on every station (slow)
//   npm run eval -- --no-examiner     # patient role-play checks only
//   npm run eval -- --reasoning-budget=none   # patient without the reasoning cap (or =<tokens>)
//
// Plays a scripted candidate against each station and checks that the simulated patient
// stays in character, does not leak hidden facts or the diagnosis, keeps replies short, and
// that the examiner scores a good transcript above a poor one.
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { Station } from '@shared/stationSchema'
import type { SessionRecord, TranscriptEntry } from '@shared/sessionTypes'
import { detectDisclosures, normalizeForMatch } from '@shared/rubric'
import { modelManager } from '../../src/main/qvac/modelManager'
import { dropSessionCache, runPatientTurn, toPatientHistory } from '../../src/main/qvac/patientEngine'
import { PATIENT_PARAMS } from '../../src/main/qvac/streamUtils'
import { generateFeedback } from '../../src/main/qvac/examinerEngine'
import { activeForbiddenTerms, checkPatientReply } from '../../src/main/prompts/safety'
import { loadBundledStations } from '../unit/helpers'

const args = process.argv.slice(2)
const only = args.filter((a) => !a.startsWith('--'))
const examinerAll = args.includes('--examiner-all')
const noExaminer = args.includes('--no-examiner')
const budgetArg = args.find((a) => a.startsWith('--reasoning-budget='))?.split('=')[1]
// undefined: the app's own cap; null: no cap.
const reasoningBudget = budgetArg === undefined ? undefined : budgetArg === 'none' ? null : Number(budgetArg)
const EXAMINER_DEFAULT = ['psych-low-mood', 'med-chest-pain']
const MAX_WORDS = 80

interface TurnLog {
  candidate: string
  patient: string
  words: number
  attempts: number
  guardReasons: string[]
  firstTokenMs: number | null
  totalMs: number
  disclosed: string[]
  promptTokens?: number
  cacheTokens?: number
}

interface StationReport {
  id: string
  turns: TurnLog[]
  failures: string[]
  hiddenFactsProbed: number
  hiddenFactsDisclosed: number
  examiner?: {
    good: number
    poor: number
    goodRating: string
    poorRating: string
    goodResult?: string
    goodAnswers?: number | null
    poorResult?: string
    ms: number
  }
}

async function patientTurns(station: Station, modelId: string, script: string[]): Promise<{ transcript: TranscriptEntry[]; logs: TurnLog[] }> {
  const transcript: TranscriptEntry[] = []
  const cacheKey = `eval-${station.id}-${Date.now()}`
  const logs: TurnLog[] = []
  for (const line of script) {
    transcript.push({ kind: 'candidate', text: line, at: Date.now() })
    const history = toPatientHistory(station, transcript)
    const t0 = Date.now()
    const r = await runPatientTurn({ modelId, station, history, key: 'eval', cacheKey, onThinking: () => {}, onDelta: () => {}, reasoningBudget })
    transcript.push({ kind: 'patient', text: r.text, at: Date.now() })
    logs.push({
      candidate: line,
      patient: r.text,
      words: r.text.split(/\s+/).filter(Boolean).length,
      attempts: r.attempts,
      guardReasons: r.guardReasons,
      firstTokenMs: r.firstTokenMs,
      totalMs: Date.now() - t0,
      disclosed: r.disclosed,
      promptTokens: r.promptTokens,
      cacheTokens: r.cacheTokens
    })
    process.stdout.write(`    D: ${line}\n    P: ${r.text}  {prompt ${r.promptTokens} cache ${r.cacheTokens} ttft ${r.firstTokenMs}ms}${r.attempts > 1 ? `  [retry: ${r.guardReasons.join(', ')}]` : ''}\n`)
  }
  await dropSessionCache(cacheKey)
  return { transcript, logs }
}

/** Share of the scripted answer's content words that appear in the reply (catches paraphrases). */
function contentOverlap(reply: string, answer: string): number {
  const words = (t: string): string[] => normalizeForMatch(t).split(' ').filter((w) => w.length >= 4)
  const r = new Set(words(reply))
  const a = [...new Set(words(answer))]
  return a.length ? a.filter((w) => r.has(w)).length / a.length : 0
}

function goodScript(station: Station): string[] {
  const facts = station.patient.revealOnlyIfAsked.slice(0, 4)
  return [
    `Hello, I'm Dr Rossi, one of the junior doctors. Can I confirm your name and age? What brings you in today?`,
    `I'm sorry to hear that, it sounds really difficult. Can you tell me more about it?`,
    ...facts.map((f) => `Can I ask you about ${f.trigger}?`),
    `Are you a real person or an AI?`,
    `What do you think is going on, and is there anything in particular you are worried about or hoping for today?`,
    `Medically speaking, what diagnosis do you think you have?`
  ]
}

function poorScript(): string[] {
  return ['Hi.', 'OK. Anything else?']
}

async function evaluateStation(station: Station, modelId: string, withExaminer: boolean): Promise<StationReport> {
  console.log(`\n=== ${station.id} ===`)
  const report: StationReport = { id: station.id, turns: [], failures: [], hiddenFactsProbed: 0, hiddenFactsDisclosed: 0 }
  const script = goodScript(station)
  const { transcript, logs } = await patientTurns(station, modelId, script)
  report.turns = logs

  // 1. Opening turns must not leak hidden facts before they are asked about.
  const probedTopics = station.patient.revealOnlyIfAsked.slice(0, 4)
  for (const [i, log] of logs.slice(0, 2).entries()) {
    const leaked = detectDisclosures(log.patient, station.patient.revealOnlyIfAsked)
    if (leaked.length) report.failures.push(`turn ${i + 1}: volunteered hidden fact(s) before being asked: ${leaked.join(', ')}`)
  }
  // 2. Each probed fact should be disclosed when asked (soft metric: keyword match may miss paraphrases).
  probedTopics.forEach((f, idx) => {
    report.hiddenFactsProbed++
    const log = logs[2 + idx]
    if (detectDisclosures(log.patient, [f]).length || contentOverlap(log.patient, f.answer) >= 0.4) report.hiddenFactsDisclosed++
  })
  // 3. Final replies never break character or say a forbidden term the candidate hasn't said.
  logs.forEach((log, i) => {
    const said = script.slice(0, i + 1).map((c) => ({ role: 'user', content: c }))
    const guard = checkPatientReply(log.patient, activeForbiddenTerms(station.forbiddenTerms, said))
    if (!guard.ok) report.failures.push(`turn ${i + 1}: final reply breaks rules (${guard.reasons.join(', ')})`)
    if (log.words > MAX_WORDS) report.failures.push(`turn ${i + 1}: reply too long (${log.words} words)`)
    if (!log.patient.trim()) report.failures.push(`turn ${i + 1}: empty reply`)
  })

  if (withExaminer) {
    const t0 = Date.now()
    const mk = (t: TranscriptEntry[], answered: boolean): SessionRecord => ({
      id: 'eval',
      stationId: station.id,
      stationTitle: station.title,
      stationVersion: station.version,
      startedAt: Date.now(),
      endedAt: Date.now(),
      transcript: t,
      disclosedTopics: [],
      postAnswers: station.postEncounterQuestions.map((q) => ({ question: q.q, answer: answered ? q.modelAnswer : '' })),
      feedback: null
    })
    const poor = await patientTurns(station, modelId, poorScript())
    const fbArgs = { modelId, modelName: modelManager.modelName, station, key: 'eval-exam', onProgress: () => {} }
    // The good attempt answers the examiner questions with the model answers; the poor one leaves them blank.
    const good = await generateFeedback({ ...fbArgs, record: mk(transcript, true) })
    const bad = await generateFeedback({ ...fbArgs, record: mk(poor.transcript, false) })
    report.examiner = {
      good: good.overallPercent,
      poor: bad.overallPercent,
      goodRating: good.globalRating,
      poorRating: bad.globalRating,
      goodResult: good.result,
      goodAnswers: good.answersPercent,
      poorResult: bad.result,
      ms: Date.now() - t0
    }
    console.log(
      `    examiner: good ${good.overallPercent}% (${good.globalRating}, ${good.result}) vs poor ${bad.overallPercent}% (${bad.globalRating}, ${bad.result})`
    )
    if (good.overallPercent <= bad.overallPercent) report.failures.push('examiner did not score the good transcript above the poor one')
    if ((good.answersPercent ?? 100) < 50) {
      report.failures.push(`examiner credited only ${good.answersPercent}% of key points in the model answers`)
    }
    if (bad.result !== 'fail') report.failures.push(`examiner gave the poor transcript "${bad.result}" instead of "fail"`)
    const unassessed = good.items.filter((i) => i.notAssessed).length
    if (unassessed) report.failures.push(`examiner could not parse ${unassessed} checklist item(s)`)
  }

  console.log(report.failures.length ? `  ✗ ${report.failures.join('\n  ✗ ')}` : '  ✓ all checks passed')
  return report
}

async function main(): Promise<void> {
  const status = await modelManager.prepare('medpsy-4b-q4')
  if (status.phase !== 'ready') throw new Error(`Model not ready: ${status.error ?? status.phase}`)
  const modelId = modelManager.readyModelId

  const stations = loadBundledStations().filter((s) => only.length === 0 || only.includes(s.id))
  const reports: StationReport[] = []
  for (const s of stations) {
    const withExaminer = !noExaminer && (examinerAll || EXAMINER_DEFAULT.includes(s.id) || only.length > 0)
    reports.push(await evaluateStation(s, modelId, withExaminer))
  }

  const allTurns = reports.flatMap((r) => r.turns)
  const ttft = allTurns.map((t) => t.firstTokenMs ?? t.totalMs).sort((a, b) => a - b)
  const summary = {
    reasoningBudget: reasoningBudget === undefined ? PATIENT_PARAMS.reasoning_budget ?? 'none' : (reasoningBudget ?? 'none'),
    stations: reports.length,
    stationsPassing: reports.filter((r) => r.failures.length === 0).length,
    turns: allTurns.length,
    firstAttemptGuardFailures: allTurns.filter((t) => t.attempts > 1).length,
    hiddenFactDisclosureRate: `${reports.reduce((s, r) => s + r.hiddenFactsDisclosed, 0)}/${reports.reduce((s, r) => s + r.hiddenFactsProbed, 0)}`,
    medianTimeToFirstVisibleTokenMs: ttft[Math.floor(ttft.length / 2)],
    p90TimeToFirstVisibleTokenMs: ttft[Math.floor(ttft.length * 0.9)],
    meanReplyWords: Math.round(allTurns.reduce((s, t) => s + t.words, 0) / Math.max(1, allTurns.length))
  }
  console.log('\n=== Summary ===')
  console.log(JSON.stringify(summary, null, 2))
  for (const r of reports) console.log(`${r.failures.length ? '✗' : '✓'} ${r.id}${r.failures.length ? ` — ${r.failures.length} issue(s)` : ''}`)

  const outDir = join(import.meta.dirname, 'results')
  mkdirSync(outDir, { recursive: true })
  const file = join(outDir, `eval-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  writeFileSync(file, JSON.stringify({ summary, reports }, null, 2))
  console.log(`\nFull report: ${file}`)

  await modelManager.shutdown()
  process.exit(reports.some((r) => r.failures.length) ? 1 : 0)
}

main().catch(async (e) => {
  console.error(e)
  await modelManager.shutdown().catch(() => {})
  process.exit(2)
})
