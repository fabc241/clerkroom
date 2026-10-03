// Spoken patient replies (Parler TTS mini), shared by the main process and the smoke script.
// Plain functions only (no zod, no Node APIs; types are erased) so the renderer bundle stays small.

import type { PatientVoice } from './stationSchema'

/**
 * Speakers used when a station has no `patient.voice`. They are among the voices the Parler authors
 * list as most consistent between generations, so a patient keeps one voice for the whole station.
 */
const DEFAULT_SPEAKERS = { female: 'Lea', male: 'Jon', other: 'Jenna' } as const

export function patientVoice(patient: { sex: 'female' | 'male' | 'other'; voice?: PatientVoice }): PatientVoice {
  return patient.voice ?? { voice: DEFAULT_SPEAKERS[patient.sex] }
}

/** A reply is never longer than this when spoken; the patient is told to keep to 1-4 sentences. */
export const MAX_SPOKEN_CHARS = 1_200

/** Removes anything that is not meant to be said out loud (e.g. "*sighs*" or "[pause]"). Returns '' if nothing is left. */
export function speakableText(reply: string): string {
  return reply
    .replace(/\*[^*]*\*/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SPOKEN_CHARS)
}

/** Sentences shorter than this are spoken together with the next one; Parler handles fragments badly. */
const MIN_PART_CHARS = 24

/** A first part longer than this is cut at its first comma, so the voice starts sooner. */
const MAX_FIRST_PART_CHARS = 60

/**
 * Splits a reply into parts to synthesise one after another, so the first part can play while the
 * rest is still being made. Parler takes about as long to make a part as to play it, so the first
 * part is kept short; later parts are ready before the one playing ends.
 */
export function speechParts(text: string): string[] {
  const sentences = text.match(/[^.!?…]+(?:[.!?…]+["'’”)]*|$)/g)?.map((s) => s.trim()).filter(Boolean) ?? []
  const parts: string[] = []
  let carry = ''
  for (const s of sentences) {
    const part = carry ? `${carry} ${s}` : s
    if (part.length < MIN_PART_CHARS) carry = part
    else {
      parts.push(part)
      carry = ''
    }
  }
  if (carry) {
    if (parts.length) parts[parts.length - 1] += ` ${carry}`
    else parts.push(carry)
  }
  const first = parts[0]
  const comma = first ? first.indexOf(', ', MIN_PART_CHARS) : -1
  if (first && first.length > MAX_FIRST_PART_CHARS && comma > 0 && first.length - comma > MIN_PART_CHARS) {
    parts.splice(0, 1, first.slice(0, comma + 1), first.slice(comma + 2))
  }
  return parts
}
