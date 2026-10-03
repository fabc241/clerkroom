import { deleteCache } from '@qvac/sdk'
import type { Station } from '@shared/stationSchema'
import type { TranscriptEntry } from '@shared/sessionTypes'
import { detectDisclosures } from '@shared/rubric'
import { unlockSchedule } from '@shared/disclosure'
import { CHARACTER_REMINDER, buildCandidateTurn, buildPatientSystemPrompt } from '../prompts/patientPrompt'
import { activeForbiddenTerms, checkPatientReply, sanitizePatientReply, tidyPatientReply } from '../prompts/safety'
import { PATIENT_PARAMS, runCompletion, type ChatMessage, type GenerationParams, type RunResult } from './streamUtils'

export interface PatientTurnResult {
  text: string
  disclosed: string[]
  cancelled: boolean
  attempts: number
  guardReasons: string[]
  firstTokenMs: number | null
  promptTokens?: number
  cacheTokens?: number
}

/** Prefix for per-session KV cache keys, so stale ones can be found and removed. */
export const CACHE_KEY_PREFIX = 'osce-'

export function sessionCacheKey(sessionId: string): string {
  return `${CACHE_KEY_PREFIX}${sessionId}`
}

/** Deletes only this session's KV cache (never other apps' caches). */
export async function dropSessionCache(cacheKey: string): Promise<void> {
  await deleteCache({ kvCacheKey: cacheKey }).catch(() => {})
}

/**
 * Converts the transcript into chat history. Exam/investigation actions are app-side only.
 * Hidden facts are attached as notes to the doctor turn that first asks about them
 * (progressive disclosure), so the model cannot volunteer what it hasn't been told.
 */
export function toPatientHistory(station: Station, transcript: TranscriptEntry[]): ChatMessage[] {
  const facts = station.patient.revealOnlyIfAsked
  const candidateTexts = transcript.flatMap((e) => (e.kind === 'candidate' ? [e.text] : []))
  const schedule = unlockSchedule(candidateTexts, facts)
  const history: ChatMessage[] = [{ role: 'system', content: buildPatientSystemPrompt(station) }]
  let c = 0
  for (const e of transcript) {
    if (e.kind === 'candidate') {
      const unlocked = schedule[c++].map((i) => facts[i])
      history.push({ role: 'user', content: buildCandidateTurn(e.text, unlocked) })
    } else if (e.kind === 'patient') history.push({ role: 'assistant', content: e.text })
  }
  return history
}

/**
 * Runs one patient turn.
 *
 * The first attempt uses a named KV cache for the session (the SDK then only processes the new
 * doctor message). Whenever the reply we keep differs from what the model generated into the
 * cache — a guard retry, a sanitised reply, an interruption — the session cache is dropped so
 * the next turn is rebuilt from the true transcript.
 */
export async function runPatientTurn(opts: {
  modelId: string
  station: Station
  history: ChatMessage[]
  key: string
  cacheKey: string
  onThinking: () => void
  onDelta: (t: string) => void
  /** Overrides PATIENT_PARAMS' reasoning cap, for evaluation; null removes the cap. */
  reasoningBudget?: number | null
}): Promise<PatientTurnResult> {
  const { station } = opts
  const forbiddenTerms = activeForbiddenTerms(station.forbiddenTerms, opts.history)
  let guardReasons: string[] = []
  let firstTokenMs: number | null = null
  const base: GenerationParams = { ...PATIENT_PARAMS }
  if (opts.reasoningBudget === null) delete base.reasoning_budget
  else if (opts.reasoningBudget !== undefined) base.reasoning_budget = opts.reasoningBudget

  const attemptOnce = async (attempt: 1 | 2): Promise<RunResult> => {
    let history = opts.history
    if (attempt === 2) {
      // Reinforce the role on the retry by annotating the latest doctor turn (not stored).
      const last = history[history.length - 1]
      history = [...history.slice(0, -1), { role: last.role, content: `${last.content}\n\n[${CHARACTER_REMINDER}]` }]
    }
    const run = (kvCache: string | false): Promise<RunResult> =>
      runCompletion({
        modelId: opts.modelId,
        history,
        params: attempt === 1 ? base : { ...base, predict: base.predict * 2 },
        kvCache,
        key: opts.key,
        onThinking: opts.onThinking,
        onDelta: attempt === 1 ? opts.onDelta : undefined
      })
    if (attempt === 2) return run(false)
    try {
      return await run(opts.cacheKey)
    } catch (err) {
      // A cache read/write failure should never lose the turn: retry without the cache.
      if (!/cache/i.test((err as Error).message)) throw err
      await dropSessionCache(opts.cacheKey)
      return run(false)
    }
  }

  for (const attempt of [1, 2] as const) {
    const r = await attemptOnce(attempt)
    firstTokenMs ??= r.firstTokenMs
    const stats = { promptTokens: r.promptTokens, cacheTokens: r.cacheTokens }
    if (r.cancelled) {
      await dropSessionCache(opts.cacheKey)
      return { text: '', disclosed: [], cancelled: true, attempts: attempt, guardReasons, firstTokenMs, ...stats }
    }
    const content = tidyPatientReply(r.content)
    const guard = content ? checkPatientReply(content, forbiddenTerms, station.patient.name) : { ok: false, reasons: ['empty-reply'] }
    if (guard.ok) {
      if (attempt === 2) await dropSessionCache(opts.cacheKey)
      return {
        text: content,
        disclosed: detectDisclosures(content, station.patient.revealOnlyIfAsked),
        cancelled: false,
        attempts: attempt,
        guardReasons,
        firstTokenMs,
        ...stats
      }
    }
    guardReasons = guard.reasons
    if (attempt === 2) {
      await dropSessionCache(opts.cacheKey)
      const text = content ? tidyPatientReply(sanitizePatientReply(content, forbiddenTerms, station.patient.name)) : 'Sorry, doctor, could you say that again?'
      return {
        text,
        disclosed: detectDisclosures(text, station.patient.revealOnlyIfAsked),
        cancelled: false,
        attempts: attempt,
        guardReasons,
        firstTokenMs,
        ...stats
      }
    }
  }
  throw new Error('unreachable')
}
