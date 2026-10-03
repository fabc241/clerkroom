import type { z } from 'zod'
import type { RubricItem, Station } from '@shared/stationSchema'
import { DOMAIN_LABELS } from '@shared/stationSchema'
import type { AnswerResult, Feedback, ItemResult, SessionRecord } from '@shared/sessionTypes'
import type { FeedbackProgress } from '@shared/ipcTypes'
import {
  answersPercent,
  computeDomainScores,
  decideResult,
  finalPercent,
  hasStudentActivity,
  NO_ACTIVITY_COMMENT,
  overallPercent,
  ratingFor,
  unmetItem,
  verifyAnswer,
  verifyVerdict
} from '@shared/rubric'
import {
  EXAMINER_SYSTEM,
  answersResponseSchema,
  buildAnswersPrompt,
  buildChecklistPrompt,
  buildSummaryPrompt,
  checklistResponseSchema,
  extractJsonObject,
  summaryResponseSchema
} from '../prompts/examinerPrompt'
import { EXAMINER_PARAMS, runCompletion } from './streamUtils'
import { askedOrDone } from '@shared/disclosure'

const BATCH_SIZE = 6

type Ask = (prompt: string) => Promise<string>

/** Asks the model and parses a JSON object that matches the schema, with one retry. */
async function askJson<T extends z.ZodTypeAny>(ask: Ask, prompt: string, schema: T): Promise<z.infer<T> | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await ask(
      attempt === 0
        ? prompt
        : `${prompt}\n\nYour previous reply could not be parsed. Keep your reasoning brief and end with the JSON object only.`
    )
    try {
      const parsed = schema.safeParse(extractJsonObject(text))
      if (parsed.success) return parsed.data
    } catch {
      /* retry */
    }
  }
  return null
}

export async function gradeChecklist(
  ask: Ask,
  station: Station,
  record: SessionRecord,
  onProgress: (p: FeedbackProgress) => void,
  totalSteps: number
): Promise<ItemResult[]> {
  const items = station.rubric.items
  // With nothing said or done there is nothing to mark, and the model tends to invent a consultation.
  if (!hasStudentActivity(record.transcript)) return items.map((item) => unmetItem(item, NO_ACTIVITY_COMMENT))
  const results: ItemResult[] = []
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE)
    onProgress({ step: `Marking checklist items ${i + 1}–${i + batch.length}`, done: i / BATCH_SIZE, total: totalSteps })
    results.push(...(await markItems(ask, station, record, batch)))
  }
  // An item tied to hidden facts or actions can't be done without asking about one or doing one,
  // whatever the model says. This also settles such an item when the model's reply couldn't be read.
  const asked = askedOrDone(station, record.transcript)
  items.forEach((item, idx) => {
    if (item.requires.length > 0 && !item.requires.some((r) => asked.has(r))) {
      results[idx] = unmetItem(item, `Not done: nothing you asked or did covered ${orList(item.requires)}.`)
    }
  })
  // A must-pass item decides the result on its own, and the model sometimes credits one with a
  // student line on another topic. So each one credited is marked again on its own, and keeps the
  // lower of the two marks. If the second marking can't be read, the first one stands.
  const credited = items.flatMap((item, idx) => (item.critical && results[idx].met === 'yes' ? [idx] : []))
  if (credited.length > 0) {
    onProgress({ step: 'Double-checking must-pass items', done: Math.ceil(items.length / BATCH_SIZE), total: totalSteps })
    for (const idx of credited) {
      const [second] = await markItems(ask, station, record, [items[idx]])
      if (!second.notAssessed && second.met !== 'yes') results[idx] = second
    }
  }
  return results
}

/**
 * Marks a group of items. The model often quotes the patient's answer instead of the student's
 * question, so a done item loses its credit; those items are asked about once more, told why.
 */
async function markItems(ask: Ask, station: Station, record: SessionRecord, items: RubricItem[]): Promise<ItemResult[]> {
  const mark = async (group: RubricItem[], rejected: { itemId: string; quote: string }[] = []) => {
    const parsed = await askJson(ask, buildChecklistPrompt(station, record.transcript, group, rejected), checklistResponseSchema)
    return group.map((item) => verifyVerdict(item, parsed?.results.find((x) => x.itemId === item.id), record.transcript))
  }
  const results = await mark(items)
  const retry = items.filter((_, i) => results[i].downgraded)
  if (retry.length === 0) return results
  const again = await mark(
    retry,
    retry.map((item) => ({ itemId: item.id, quote: results[items.indexOf(item)].evidenceQuote }))
  )
  retry.forEach((item, j) => {
    // If the second answer can't be read, the first (uncredited) mark stands.
    if (!again[j].notAssessed) results[items.indexOf(item)] = again[j]
  })
  return results
}

/** "a", "a or b", "a, b or c", in lower case unless a word is an acronym. */
function orList(names: string[]): string {
  const lower = names.map((n) => n.replace(/\b(?![A-Z]{2,}\b)\w+/g, (w) => w.toLowerCase()))
  return lower.length < 2 ? lower.join('') : `${lower.slice(0, -1).join(', ')} or ${lower[lower.length - 1]}`
}

/** Progress steps for checklist marking: one per batch, plus one to double-check must-pass items. */
function checklistStepCount(station: Station): number {
  return Math.ceil(station.rubric.items.length / BATCH_SIZE) + (station.rubric.items.some((i) => i.critical) ? 1 : 0)
}

export async function gradeAnswers(ask: Ask, station: Station, record: SessionRecord): Promise<AnswerResult[]> {
  const answers = record.postAnswers
  if (answers.length === 0) return []
  const anyAnswered = answers.some((a) => a.answer.trim())
  const parsed = anyAnswered ? await askJson(ask, buildAnswersPrompt(station, answers), answersResponseSchema) : null
  return answers.map((a, idx) =>
    verifyAnswer(
      station.postEncounterQuestions.find((p) => p.q === a.question),
      a,
      parsed?.answers.find((x) => x.index === idx + 1)
    )
  )
}

export async function generateFeedback(opts: {
  modelId: string
  modelName: string
  station: Station
  record: SessionRecord
  key: string
  onProgress: (p: FeedbackProgress) => void
}): Promise<Feedback> {
  const { station, record, onProgress } = opts
  const ask: Ask = async (prompt) => {
    const r = await runCompletion({
      modelId: opts.modelId,
      history: [
        { role: 'system', content: EXAMINER_SYSTEM },
        { role: 'user', content: prompt }
      ],
      params: EXAMINER_PARAMS,
      key: opts.key
    })
    if (r.cancelled) throw new Error('Feedback generation cancelled')
    return r.content
  }

  const checklistSteps = checklistStepCount(station)
  const totalSteps = checklistSteps + 2

  const items = await gradeChecklist(ask, station, record, onProgress, totalSteps)

  onProgress({ step: 'Marking post-station answers', done: checklistSteps, total: totalSteps })
  const answers = await gradeAnswers(ask, station, record)

  // Scores, pass/fail and rating are all decided here in code; the model only writes the prose.
  const domainScores = computeDomainScores(items)
  const checklistPercent = overallPercent(items)
  const questionsPercent = answersPercent(answers)
  const percent = finalPercent(items, answers)
  const studentActed = hasStudentActivity(record.transcript)
  const { result, reasons } = decideResult(items, answers, studentActed)
  const globalRating = ratingFor(percent, result)
  const scores = {
    domainScores,
    overallPercent: percent,
    checklistPercent,
    answersPercent: questionsPercent,
    result,
    resultReasons: reasons,
    globalRating
  }
  const achieved = items.filter((i) => i.met === 'yes').map((i) => i.text)
  const missed = items.filter((i) => i.met !== 'yes').map((i) => i.text)
  // Chosen in code from the marks, so the feedback never calls a credited item a weakness.
  // Items not done at all are listed separately, as key learning points.
  const missedPoints = partlyDone(items)

  onProgress({ step: 'Writing summary', done: checklistSteps + 1, total: totalSteps })
  if (!studentActed) {
    onProgress({ step: 'Done', done: totalSteps, total: totalSteps })
    return {
      items,
      answers,
      ...scores,
      summary: 'You ended the station without speaking to the patient or taking any action, so no checklist items could be credited.',
      missedPoints,
      practiseNext: ['Start with an introduction and an open question, then work through the task in the brief.'],
      generatedAt: Date.now(),
      modelName: opts.modelName
    }
  }
  const scoreLines = domainScores
    .map((d) => `- ${DOMAIN_LABELS[d.domain]}: ${d.percent}%`)
    .concat(`- Checklist: ${checklistPercent}%`)
    .concat(questionsPercent === null ? [] : [`- Examiner questions: ${questionsPercent}%`])
    .concat(`- Final score: ${percent}%`)
    .join('\n')
  const summary = await askJson(
    ask,
    buildSummaryPrompt(station, scoreLines, achieved, missed, { result, rating: globalRating, reasons }),
    summaryResponseSchema
  )

  onProgress({ step: 'Done', done: totalSteps, total: totalSteps })
  return {
    items,
    answers,
    ...scores,
    summary: summary?.summary ?? `${reasons.join(' ')} Review the items below.`,
    missedPoints,
    practiseNext: tidySuggestions(summary?.practiseNext ?? []),
    generatedAt: Date.now(),
    modelName: opts.modelName
  }
}

/** The most important items done only in part: must-pass first, then by weight. */
export function partlyDone(items: ItemResult[]): string[] {
  return items
    .filter((i) => i.met === 'partial')
    .sort((a, b) => Number(!!b.critical) - Number(!!a.critical) || b.weight - a.weight)
    .slice(0, 3)
    .map((i) => i.text)
}

/**
 * Up to three practice suggestions. The model sometimes runs two into one string
 * ("...alive?','Review the protocols..."), so those are split apart again. An ordinary list of
 * quoted phrases ("'X', 'Y'") has a space after the comma and is left alone.
 */
export function tidySuggestions(suggestions: string[]): string[] {
  const unpaired = (s: string, q: string): boolean => s.split(q).length % 2 === 0
  return suggestions
    .flatMap((s) => s.split(/(?<=['"]),(?=['"])/))
    .map((s) => {
      let t = s.trim()
      if (/^['"]/.test(t) && unpaired(t, t[0])) t = t.slice(1)
      if (/['"]$/.test(t) && unpaired(t, t[t.length - 1])) t = t.slice(0, -1)
      return t.trim()
    })
    .filter(Boolean)
    .slice(0, 3)
}
