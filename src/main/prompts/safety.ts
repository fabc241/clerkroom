import { normalizeForMatch } from '@shared/rubric'

/** Phrases that indicate the model has dropped the patient role. */
const BREAK_PATTERNS: RegExp[] = [
  /\bas an ai\b/i,
  /\b(language model|ai model|ai assistant|virtual assistant)\b/i,
  /\bmedpsy\b/i,
  /\bqvac\b/i,
  /\bi('m| am) (an? )?(assistant|chatbot|bot)\b/i,
  /\bi (can(not|'t)|am unable to) (provide|give) (medical|a) (advice|diagnosis)\b/i,
  /\b(consult|see|speak to) (a|your) (healthcare|medical) (professional|provider)\b/i,
  /\bthis is (a|an) (simulation|role-?play)\b/i,
  /^\s*(\*\*|#+\s|[-*]\s|\d+\.\s)/m, // markdown structure: patients don't talk in lists/headings
  /\b(differential diagnosis|management plan|recommend(ed)? (investigations|tests))\b/i
]

export interface GuardResult {
  ok: boolean
  reasons: string[]
}

export function checkPatientReply(text: string, forbiddenTerms: string[]): GuardResult {
  const reasons: string[] = []
  for (const re of BREAK_PATTERNS) if (re.test(text)) reasons.push(`pattern:${re.source}`)
  const norm = ` ${normalizeForMatch(text)} `
  for (const term of forbiddenTerms) {
    const t = normalizeForMatch(term)
    if (t && norm.includes(` ${t} `)) reasons.push(`forbidden:${term}`)
  }
  return { ok: reasons.length === 0, reasons }
}

/**
 * Forbidden terms (e.g. the diagnosis) only apply until the student says them: once the
 * doctor has named "multiple sclerosis", the patient may naturally repeat it back.
 */
export function activeForbiddenTerms(
  terms: string[],
  history: { role: string; content: string }[]
): string[] {
  // Only what the student actually said: drop the private [Patient note ...] / reminder annotations.
  const studentText = history
    .filter((m) => m.role === 'user')
    .map((m) => m.content.split('\n\n[')[0])
    .join(' ')
  const said = ` ${normalizeForMatch(studentText)} `
  return terms.filter((t) => !said.includes(` ${normalizeForMatch(t)} `))
}

/**
 * Last-resort cleanup when a regenerated reply still breaks character: drop offending
 * sentences, strip markdown and stage directions. Returns a neutral line if nothing survives.
 */
export function sanitizePatientReply(text: string, forbiddenTerms: string[]): string {
  const cleaned = text
    .replace(/\*[^*]{1,80}\*/g, ' ') // *sighs*
    .replace(/\([^)]{1,80}\)/g, ' ') // (looks away)
    .replace(/^\s*(#+\s|[-*]\s|\d+\.\s)/gm, '')
    .replace(/\*\*/g, '')
  const sentences = cleaned.match(/[^.!?]+[.!?]*/g) ?? []
  const kept = sentences.filter((s) => checkPatientReply(s, forbiddenTerms).ok)
  const out = kept.join(' ').replace(/\s+/g, ' ').trim()
  return out || "Sorry, I'm not sure what you mean, doctor."
}

export const MAX_REPLY_WORDS = 75

/**
 * Applied to every patient reply: removes stage directions and markdown emphasis, and trims
 * over-long replies at a sentence boundary (the first sentence is always kept).
 */
export function tidyPatientReply(text: string, maxWords = MAX_REPLY_WORDS): string {
  const cleaned = text
    .replace(/\*\([^)]*\)\*/g, ' ') // *(He grins)*
    .replace(/\*\*|__/g, '')
    .replace(/\*[^*\n]{1,120}\*/g, (m) => (/^\*\s*[A-Z][a-z]+ (grins|sighs|laughs|pauses|looks|smiles|shrugs|nods|leans|stands|sits|paces|pulls|grabs|adjusts)/.test(m) ? ' ' : m.slice(1, -1)))
    .replace(/(^|\s)\((?:he|she|they|pause|sighs|laughs|looks|smiles)[^)]{0,120}\)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const sentences = cleaned.match(/[^.!?]+[.!?]+["'\u201d\u2019]?|[^.!?]+$/g) ?? [cleaned]
  let out = ''
  for (const sentence of sentences) {
    const next = `${out} ${sentence.trim()}`.trim()
    if (out && next.split(/\s+/).length > maxWords) break
    out = next
  }
  return out
}
