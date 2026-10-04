// Spoken patient replies (Supertonic 3), shared by the main process and the smoke script.
// Plain functions only (no zod, no Node APIs; types are erased) so the renderer bundle stays small.

import type { PatientVoice } from './stationSchema'

/** Voices used when a station has no `patient.voice`; `other` gets a lower-pitched voice than `female`. */
const DEFAULT_VOICES = { female: 'F1', male: 'M1', other: 'F3' } as const

export function patientVoice(patient: { sex: 'female' | 'male' | 'other'; voice?: PatientVoice }): PatientVoice {
  return patient.voice ?? { voice: DEFAULT_VOICES[patient.sex] }
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

/** Sentences shorter than this are spoken together with a neighbour, so "No." is not followed by a pause. */
const MIN_PART_CHARS = 24

/**
 * Splits a reply into sentences to synthesise one after another, so the first can play while the
 * rest is still being made and a stopped reply stops at the next sentence.
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
  return parts
}
