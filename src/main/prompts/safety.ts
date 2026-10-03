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
  /\b(differential diagnosis|management plan|recommend(ed)? (investigations|tests))\b/i,
  // The model's own reasoning written into the reply, which can happen when the reasoning cap
  // stops it mid-thought ("</think> Okay, I need to stay in character… The user is asking…").
  /<\/?think>/i,
  /\bthe user\b/i,
  /\bin character\b/i,
  /\bpatient note\b/i,
  /\b(1|one) ?(-|to) ?(4|four) sentences\b/i,
  // Reasoning about how to reply ("The doctor is being gentle, so I should match that tone").
  /\bI should (match|mirror|keep|respond|reply|answer|stay|sound)\b/i,
  /\bkeep(ing)? (it|this|my (reply|answer|response)s?) (short|brief|natural|simple|concise)\b/i,
  /\bmatch (that|the|his|her|their) tone\b/i,
  // The model speaking as the doctor.
  /\byou('re|’re| are) in safe hands\b/i,
  /\bI('ll|’ll| will) check (in )?on you\b/i
]

/**
 * Signs that the model is talking about the patient instead of as the patient: narrating them in
 * the third person ("Tom is sitting quietly") or, as the doctor, addressing them by name ("I'm
 * sorry, Tom."). Naming themselves ("I'm Tom", "it's just me, Tom, ...") is allowed.
 */
function namePatterns(patientName: string): RegExp[] {
  const first = patientName.trim().split(/\s+/)[0]?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!first) return []
  return [
    new RegExp(`\\b${first}(?:'s|’s|\\s+(?:is|was|has|had|seems|looks|sits|feels|says|said|mentioned|might|would|will|wants|needs|does|doesn't))\\b`),
    new RegExp(`(?<!\\b(?:I'm|I’m|am|me|it's|it’s|name's|name’s|is)),\\s*${first}\\s*[.,!?]|(?:^|[.!?]\\s+)${first},`)
  ]
}

export interface GuardResult {
  ok: boolean
  reasons: string[]
}

export function checkPatientReply(text: string, forbiddenTerms: string[], patientName = ''): GuardResult {
  const reasons: string[] = []
  for (const re of [...BREAK_PATTERNS, ...namePatterns(patientName)]) if (re.test(text)) reasons.push(`pattern:${re.source}`)
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
export function sanitizePatientReply(text: string, forbiddenTerms: string[], patientName = ''): string {
  const cleaned = text
    .replace(/\*[^*]{1,80}\*/g, ' ') // *sighs*
    .replace(/\([^)]{1,80}\)/g, ' ') // (looks away)
    .replace(/^\s*(#+\s|[-*]\s|\d+\.\s)/gm, '')
    .replace(/\*\*/g, '')
  const sentences = cleaned.match(/[^.!?]+[.!?]*/g) ?? []
  const kept = sentences.filter((s) => checkPatientReply(s.trim(), forbiddenTerms, patientName).ok)
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
    // Patients speak; anything in brackets is a stage direction ("(voice cracks)"), and spoken
    // replies would otherwise read it aloud.
    .replace(/\([^()]{1,160}\)/g, ' ')
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
