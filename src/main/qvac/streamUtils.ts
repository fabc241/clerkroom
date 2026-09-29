import { cancel, completion } from '@qvac/sdk'

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export interface GenerationParams {
  temp: number
  top_p: number
  top_k: number
  predict: number
}

/** MedPsy model-card recommended sampling for conversation. */
export const PATIENT_PARAMS: GenerationParams = { temp: 0.6, top_p: 0.95, top_k: 20, predict: 1536 }
/** Lower temperature for more consistent grading. */
export const EXAMINER_PARAMS: GenerationParams = { temp: 0.3, top_p: 0.95, top_k: 20, predict: 4096 }

export interface RunResult {
  content: string
  thinkingChars: number
  stopReason?: string
  cancelled: boolean
  firstTokenMs: number | null
  promptTokens?: number
  cacheTokens?: number
}

export interface RunOptions {
  modelId: string
  history: ChatMessage[]
  params: GenerationParams
  /** Named KV cache key for multi-turn sessions, or false for none. */
  kvCache?: string | false
  onDelta?: (text: string) => void
  onThinking?: () => void
  /** Key used to cancel the run from elsewhere (e.g. station timer). */
  key?: string
}

const active = new Map<string, string>() // key -> requestId

export async function runCompletion(opts: RunOptions): Promise<RunResult> {
  const started = Date.now()
  const run = completion({
    modelId: opts.modelId,
    history: opts.history,
    stream: true,
    captureThinking: true,
    kvCache: opts.kvCache ?? false,
    generationParams: opts.params
  })
  if (opts.key) active.set(opts.key, run.requestId)

  let thinkingChars = 0
  let firstTokenMs: number | null = null
  let sawThinking = false
  let cancelled = false
  try {
    for await (const ev of run.events) {
      if (ev.type === 'thinkingDelta') {
        thinkingChars += ev.text.length
        if (!sawThinking) {
          sawThinking = true
          opts.onThinking?.()
        }
      } else if (ev.type === 'contentDelta') {
        if (firstTokenMs === null) firstTokenMs = Date.now() - started
        opts.onDelta?.(ev.text)
      }
    }
    const final = await run.final
    return {
      content: stripThink(final.contentText).trim(),
      thinkingChars,
      stopReason: final.stopReason,
      cancelled: false,
      firstTokenMs,
      promptTokens: final.stats?.promptTokens,
      cacheTokens: final.stats?.cacheTokens
    }
  } catch (err) {
    if (err instanceof Error && /cancel/i.test(err.name + err.message)) cancelled = true
    else throw err
    return { content: '', thinkingChars, cancelled, firstTokenMs }
  } finally {
    if (opts.key && active.get(opts.key) === run.requestId) active.delete(opts.key)
  }
}

export async function cancelRun(key: string): Promise<void> {
  const requestId = active.get(key)
  if (requestId) await cancel({ requestId }).catch(() => {})
}

/** Defensive: captureThinking is best-effort, so strip any residual reasoning markup. */
export function stripThink(text: string): string {
  return text
    .replace(/<think>[\s\S]*?(<\/think>|$)/g, '')
    .replace(/^[\s\S]*?<\/think>/, '')
}
