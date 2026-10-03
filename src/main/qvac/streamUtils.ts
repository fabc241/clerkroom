import { cancel, completion } from '@qvac/sdk'

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export interface GenerationParams {
  temp: number
  top_p: number
  top_k: number
  predict: number
  /** Caps the hidden reasoning before the reply, in tokens; omitted means no cap. */
  reasoning_budget?: number
}

/**
 * MedPsy model-card recommended sampling for conversation. The reasoning cap is what keeps replies
 * quick: uncapped, MedPsy reasons for ~250-400 tokens (8-10 s on an M-series GPU) before the first
 * word; at 64 the reply starts in ~2.5 s and stays in character. 0 is not an option: MedPsy then
 * writes its reasoning into the reply itself.
 */
export const PATIENT_PARAMS: GenerationParams = { temp: 0.6, top_p: 0.95, top_k: 20, predict: 1536, reasoning_budget: 64 }
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
  // Once a reasoning tag shows up in the reply, stop showing it live: the character guard
  // rejects such a reply and the turn is regenerated.
  let shown = ''
  let leaked = false
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
        shown += ev.text
        leaked ||= /<\/?think>/i.test(shown)
        if (!leaked) opts.onDelta?.(ev.text)
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
