// Voice input helpers shared by the renderer (capture) and main process (validation).
// Plain functions only (no zod, no Node APIs) so the renderer bundle stays small.

/** Parakeet expects 16 kHz mono signed 16-bit little-endian PCM. */
export const VOICE_SAMPLE_RATE = 16_000
const BYTES_PER_SAMPLE = 2

/** One dictation is capped so a forgotten recording can't grow without bound. */
export const MAX_RECORDING_SEC = 90
/** Anything shorter is almost certainly an accidental click. */
export const MIN_RECORDING_SEC = 0.3

export const MAX_PCM_BYTES = VOICE_SAMPLE_RATE * BYTES_PER_SAMPLE * MAX_RECORDING_SEC
const MIN_PCM_BYTES = Math.round(VOICE_SAMPLE_RATE * BYTES_PER_SAMPLE * MIN_RECORDING_SEC)

/** Returns a user-facing reason the PCM buffer can't be transcribed, or null if it is fine. */
export function pcmError(pcm: unknown): string | null {
  if (!(pcm instanceof Uint8Array)) return 'Invalid audio data.'
  if (pcm.byteLength % BYTES_PER_SAMPLE !== 0) return 'Invalid audio data.'
  if (pcm.byteLength < MIN_PCM_BYTES) return 'The recording was too short.'
  if (pcm.byteLength > MAX_PCM_BYTES) return `Recordings are limited to ${MAX_RECORDING_SEC} seconds.`
  return null
}

/** Averages channels to mono. */
export function downmix(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0]
  const out = new Float32Array(channels[0]?.length ?? 0)
  for (const ch of channels) for (let i = 0; i < out.length; i++) out[i] += ch[i] / channels.length
  return out
}

/** Converts [-1, 1] float samples to s16le bytes. */
export function encodePcm16(samples: Float32Array): Uint8Array {
  const out = new Uint8Array(samples.length * BYTES_PER_SAMPLE)
  const view = new DataView(out.buffer)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(i * BYTES_PER_SAMPLE, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return out
}

/** Parakeet's marker for silent input. */
const NO_SPEECH = /\[\s*no speech detected\s*\]/gi

/** Removes engine markers and normalises whitespace. Returns '' when nothing was said. */
export function cleanTranscript(text: string): string {
  return text.replace(NO_SPEECH, ' ').replace(/\s+/g, ' ').trim()
}

/** Appends dictated text to what is already in a text box, keeping one space between them. */
export function appendDictation(existing: string, dictated: string): string {
  if (!dictated) return existing
  if (!existing.trim()) return dictated
  return /\s$/.test(existing) ? existing + dictated : `${existing} ${dictated}`
}
