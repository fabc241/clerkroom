import { DOMAINS, GLOBAL_RATINGS, type GlobalRating } from './constants'
import type { RubricItem } from './stationSchema'
import type {
  AnswerResult,
  DomainScore,
  Feedback,
  ItemResult,
  ItemVerdict,
  SessionResult,
  TranscriptEntry
} from './sessionTypes'

const VERDICT_CREDIT: Record<ItemVerdict, number> = { yes: 1, partial: 0.5, no: 0 }

/** Minimum final score to pass a station. Matches the start of the "Pass" rating band. */
export const PASS_MARK = 55
/** Share of the final score that comes from the examiner questions, when the station has any. */
export const ANSWERS_SHARE = 0.2

/** Domain scores are computed in code from item weights, never by the model. */
export function computeDomainScores(items: ItemResult[]): DomainScore[] {
  return DOMAINS.map((domain) => {
    const inDomain = items.filter((i) => i.domain === domain)
    const possible = inDomain.reduce((s, i) => s + i.weight, 0)
    const earned = inDomain.reduce((s, i) => s + i.weight * VERDICT_CREDIT[i.met], 0)
    return {
      domain,
      earned,
      possible,
      percent: possible === 0 ? 0 : Math.round((earned / possible) * 100)
    }
  }).filter((d) => d.possible > 0)
}

/** Weighted checklist score, 0–100 (unrounded when `exact` is set). */
export function overallPercent(items: ItemResult[], exact = false): number {
  const possible = items.reduce((s, i) => s + i.weight, 0)
  const earned = items.reduce((s, i) => s + i.weight * VERDICT_CREDIT[i.met], 0)
  const p = possible === 0 ? 0 : (earned / possible) * 100
  return exact ? p : Math.round(p)
}

/** Examiner-question score: each question counts equally, by the share of its key points covered. */
export function answersPercent(answers: AnswerResult[], exact = false): number | null {
  const scored = answers.filter((a) => a.keyPointsHit.length + a.keyPointsMissed.length > 0)
  if (scored.length === 0) return null
  const p =
    (scored.reduce((s, a) => s + a.keyPointsHit.length / (a.keyPointsHit.length + a.keyPointsMissed.length), 0) /
      scored.length) *
    100
  return exact ? p : Math.round(p)
}

/** Final score: the checklist, plus the examiner questions at ANSWERS_SHARE when there are any. */
export function finalPercent(items: ItemResult[], answers: AnswerResult[]): number {
  const checklist = overallPercent(items, true)
  const qs = answersPercent(answers, true)
  return Math.round(qs === null ? checklist : checklist * (1 - ANSWERS_SHARE) + qs * ANSWERS_SHARE)
}

/** Rating from the final score alone, so it is the same every time the same marks are given. */
export function bandRating(percent: number): GlobalRating {
  if (percent < 40) return 'Fail'
  if (percent < PASS_MARK) return 'Borderline'
  if (percent < 70) return 'Pass'
  if (percent < 85) return 'Good'
  return 'Excellent'
}

/** Rating consistent with the result: a failed station is never rated above Borderline. */
export function ratingFor(percent: number, result: SessionResult): GlobalRating {
  const band = bandRating(percent)
  if (result !== 'fail') return band
  return GLOBAL_RATINGS[Math.min(GLOBAL_RATINGS.indexOf(band), GLOBAL_RATINGS.indexOf('Borderline'))]
}

/** Why a set of marks fails the station; empty when it passes. */
function failReasons(items: ItemResult[], answers: AnswerResult[]): string[] {
  const reasons: string[] = []
  const percent = finalPercent(items, answers)
  if (percent < PASS_MARK) reasons.push(`Your score of ${percent}% is below the pass mark of ${PASS_MARK}%.`)
  // A must-pass item has to be done in full: half-asking about suicidal intent is not enough.
  for (const i of items) {
    if (i.critical && i.met === 'no') reasons.push(`Must-pass item not done: ${i.text}`)
    else if (i.critical && i.met === 'partial') reasons.push(`Must-pass item only partly done: ${i.text}`)
  }
  return reasons
}

/**
 * Decides pass or fail in code. Items the model could not mark make the result "incomplete",
 * unless the outcome is the same whether they would have been marked done or not done.
 */
export function decideResult(
  items: ItemResult[],
  answers: AnswerResult[],
  studentActed: boolean
): { result: SessionResult; reasons: string[] } {
  if (!studentActed) {
    return { result: 'fail', reasons: ['You did not ask the patient anything or take any action in this station.'] }
  }
  const worst = failReasons(items, answers)
  const unassessed = items.filter((i) => i.notAssessed).length + answers.filter((a) => a.notAssessed).length
  if (unassessed > 0) {
    const best = failReasons(
      items.map((i) => (i.notAssessed ? { ...i, met: 'yes' as const } : i)),
      answers.map((a) =>
        a.notAssessed ? { ...a, keyPointsHit: [...a.keyPointsHit, ...a.keyPointsMissed], keyPointsMissed: [] } : a
      )
    )
    if (best.length > 0) return { result: 'fail', reasons: best }
    if (worst.length > 0) {
      return {
        result: 'incomplete',
        reasons: [
          `${unassessed} part${unassessed === 1 ? '' : 's'} of this attempt could not be marked automatically, and the result depends on ${unassessed === 1 ? 'it' : 'them'}. Mark it again.`
        ]
      }
    }
  }
  if (worst.length > 0) return { result: 'fail', reasons: worst }
  const critical = items.some((i) => i.critical)
  return {
    result: 'pass',
    reasons: [
      `Your score of ${finalPercent(items, answers)}% meets the pass mark of ${PASS_MARK}%${critical ? ' and you did every must-pass item' : ''}.`
    ]
  }
}

/** Result of saved feedback, including feedback saved before results were stored. */
export function feedbackResult(fb: Pick<Feedback, 'result' | 'globalRating'>): SessionResult {
  if (fb.result) return fb.result
  return GLOBAL_RATINGS.indexOf(fb.globalRating) >= GLOBAL_RATINGS.indexOf('Pass') ? 'pass' : 'fail'
}

export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * True when the quote is really in the text. The whole quote must appear as a phrase (on word
 * boundaries), or, to allow light trimming or paraphrase at the edges, at least 3 of its words
 * and >= 80% of them must appear in the text. Quotes under 3 words must match the whole text,
 * so a stray "you" or "ok" cannot count as consultation evidence; `allowShort` accepts short
 * phrases anywhere, for written answers where a single term ("SPIKES") can be the key point.
 */
export function quoteMatches(quote: string, text: string, allowShort = false): boolean {
  const q = normalizeForMatch(quote)
  const t = normalizeForMatch(text)
  if (q.length < 3) return false
  const qWords = q.split(' ')
  if (` ${t} `.includes(` ${q} `)) return allowShort || qWords.length >= 3 || q === t
  if (qWords.length < 3) return false
  const tWords = new Set(t.split(' '))
  const hits = qWords.filter((w) => tWords.has(w)).length
  return hits >= 3 && hits / qWords.length >= 0.8
}

/**
 * Finds the student turn (speech, examination or investigation) that contains the quote. The model
 * sometimes joins several turns into one quote, with the transcript's "[6] STUDENT:" labels or
 * an ellipsis; then every part must be found in a student turn, and the first one is returned.
 */
export function findEvidenceTurn(quote: string, transcript: TranscriptEntry[]): number | null {
  const whole = findQuotedTurn(quote, transcript)
  if (whole !== null) return whole
  const parts = quote
    .split(/\[\d+\]\s*(?:STUDENT ACTION|STUDENT|PATIENT|NOTE):|\.{3,}|…/)
    .map((p) => p.trim())
    .filter(Boolean)
  const turns = parts.map((p) => findQuotedTurn(p, transcript))
  return turns.length > 0 && !turns.includes(null) ? turns[0] : null
}

function findQuotedTurn(quote: string, transcript: TranscriptEntry[]): number | null {
  let fuzzy: number | null = null
  for (const [idx, entry] of transcript.entries()) {
    if (entry.kind !== 'candidate' && entry.kind !== 'exam' && entry.kind !== 'investigation') continue
    // Must mirror formatTranscript() in examinerPrompt.ts, which is what the model quotes from.
    const label =
      entry.kind === 'candidate' ? null : entry.kind === 'exam' ? `examined ${entry.system}` : `requested ${entry.test}`
    const text =
      entry.kind === 'candidate'
        ? entry.text
        : entry.kind === 'exam'
          ? `${label} ${entry.finding}`
          : `${label} ${entry.result}`
    // An action is identified by its label, which can be shorter than 3 words ("examined Abdomen").
    const namesAction = label !== null && ` ${normalizeForMatch(quote)} `.includes(` ${normalizeForMatch(label)} `)
    if (!quoteMatches(quote, text, namesAction)) continue
    const q = normalizeForMatch(quote)
    if (` ${normalizeForMatch(text)} `.includes(` ${q} `)) return idx
    fuzzy ??= idx
  }
  return fuzzy
}

/** True if the student said or did anything in the station that could earn checklist credit. */
export function hasStudentActivity(transcript: TranscriptEntry[]): boolean {
  return transcript.some((e) => e.kind === 'candidate' || e.kind === 'exam' || e.kind === 'investigation')
}

export const NO_ACTIVITY_COMMENT = 'Not done: you did not ask the patient anything or take any action in this station.'

function itemResult(item: RubricItem, fields: Pick<ItemResult, 'met' | 'comment'> & Partial<ItemResult>): ItemResult {
  return {
    itemId: item.id,
    domain: item.domain,
    text: item.text,
    weight: item.weight,
    critical: item.critical,
    evidenceQuote: '',
    evidenceTurn: null,
    downgraded: false,
    ...fields
  }
}

/** Result for an item the student cannot have met, e.g. because they never spoke. */
export function unmetItem(item: RubricItem, comment: string): ItemResult {
  return itemResult(item, { met: 'no', comment })
}

/**
 * Turns the examiner model's verdict into a scored item. Any credit ("yes" or "partial") must be
 * backed by a quote found in a student turn; otherwise the model invented it and the item scores 0.
 */
export function verifyVerdict(
  item: RubricItem,
  verdict: { met: ItemVerdict; evidenceQuote: string; comment: string } | undefined,
  transcript: TranscriptEntry[]
): ItemResult {
  if (!verdict) {
    return itemResult(item, {
      met: 'no',
      comment: 'Could not be assessed automatically — mark this attempt again.',
      notAssessed: true
    })
  }
  if (verdict.met === 'no') return itemResult(item, { met: 'no', comment: verdict.comment })
  const evidenceTurn = findEvidenceTurn(verdict.evidenceQuote, transcript)
  if (evidenceTurn === null) {
    return itemResult(item, {
      met: 'no',
      evidenceQuote: verdict.evidenceQuote,
      comment: 'Not credited: the examiner could not point to anything you said or did for this item.',
      downgraded: true
    })
  }
  return itemResult(item, {
    met: verdict.met,
    evidenceQuote: verdict.evidenceQuote,
    evidenceTurn,
    comment: verdict.comment
  })
}

const KEY_POINT_STOPWORDS = new Set(
  'and the for with from his her their its any are was has have had into use using via all can may per this that then than'.split(' ')
)
const NEGATORS = new Set(['not', 'no', 'never', 'without', 'avoid', 'nor', "don't", "wouldn't", "shouldn't", "won't", "isn't"])
const stem = (w: string): string => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w)

/**
 * True when one sentence of the answer contains every content word of the key point, e.g.
 * "consider capacity and the legal framework if he tries to leave" for "Consider capacity/legal
 * framework if he tries to leave". Acronyms such as "CT" count as content words. A sentence with a
 * negation the key point does not have ("I would not give nimodipine") is left to the examiner.
 */
export function keyPointInAnswer(keyPoint: string, answer: string): boolean {
  const words = keyPoint
    .split(/[^A-Za-z0-9']+/)
    .filter((w) => /^[A-Z]{2,}$/.test(w) || (w.length >= 3 && !KEY_POINT_STOPWORDS.has(w.toLowerCase())))
    .map((w) => stem(normalizeForMatch(w)))
    .filter((w) => w && !NEGATORS.has(w))
  if (words.length === 0) return false
  const keyNegated = normalizeForMatch(keyPoint).split(' ').some((w) => NEGATORS.has(w))
  return answer
    .split(/(?<=[.!?;])\s+|\n+/)
    .map((s) => normalizeForMatch(s).split(' '))
    .some((sentence) => {
      if (!keyNegated && sentence.some((w) => NEGATORS.has(w))) return false
      const have = new Set(sentence.map(stem))
      return words.every((w) => have.has(w))
    })
}

/**
 * Turns the examiner model's marking of one post-station answer into a scored result. A key point
 * counts if the answer states it almost word for word (decided in code, so the same answer always
 * earns it), or if the model credited it with a quote found in the answer. Blank answers and
 * invented credit score nothing.
 */
export function verifyAnswer(
  expected: { modelAnswer: string; keyPoints: string[] } | undefined,
  answer: { question: string; answer: string },
  verdict: { keyPointsHit: { keyPoint: string; quote: string }[]; comment: string } | undefined
): AnswerResult {
  const keyPoints = expected?.keyPoints ?? []
  const base = { question: answer.question, answer: answer.answer, modelAnswer: expected?.modelAnswer ?? '' }
  if (!answer.answer.trim()) return { ...base, keyPointsHit: [], keyPointsMissed: keyPoints, comment: 'No answer given.' }
  const literal = keyPoints.filter((k) => keyPointInAnswer(k, answer.answer))
  if (!verdict) {
    const missed = keyPoints.filter((k) => !literal.includes(k))
    return {
      ...base,
      keyPointsHit: literal,
      keyPointsMissed: missed,
      comment: missed.length ? 'Could not be assessed automatically — mark this attempt again.' : 'You covered every key point.',
      notAssessed: missed.length > 0
    }
  }
  const same = (a: string, b: string): boolean => normalizeForMatch(a) === normalizeForMatch(b)
  const byModel = keyPoints.filter((k) =>
    verdict.keyPointsHit.some((h) => same(h.keyPoint, k) && quoteMatches(h.quote, answer.answer, true))
  )
  const hit = keyPoints.filter((k) => literal.includes(k) || byModel.includes(k))
  const missed = keyPoints.filter((k) => !hit.includes(k))
  // The model's comment was written about its own marks; if code credited more, it may call a covered point missing.
  const comment =
    hit.length === byModel.length
      ? verdict.comment
      : missed.length
        ? `You covered ${hit.length} of ${keyPoints.length} key points. Not covered: ${missed.join('; ')}.`
        : 'You covered every key point.'
  return { ...base, keyPointsHit: hit, keyPointsMissed: missed, comment }
}

/** Detects which hidden facts the patient has disclosed, by keyword match on patient replies. */
export function detectDisclosures(
  patientText: string,
  facts: { topic: string; keywords: string[] }[]
): string[] {
  const t = normalizeForMatch(patientText)
  return facts
    .filter((f) => f.keywords.some((k) => t.includes(normalizeForMatch(k))))
    .map((f) => f.topic)
}
