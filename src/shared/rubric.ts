import { DOMAINS, GLOBAL_RATINGS, type GlobalRating } from './constants'
import type { RubricItem } from './stationSchema'
import type { DomainScore, ItemResult, ItemVerdict, TranscriptEntry } from './sessionTypes'

const VERDICT_CREDIT: Record<ItemVerdict, number> = { yes: 1, partial: 0.5, no: 0 }

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

export function overallPercent(items: ItemResult[]): number {
  const possible = items.reduce((s, i) => s + i.weight, 0)
  const earned = items.reduce((s, i) => s + i.weight * VERDICT_CREDIT[i.met], 0)
  return possible === 0 ? 0 : Math.round((earned / possible) * 100)
}

/** Score-band rating used as an anchor; the examiner model may move it by at most one band. */
export function bandRating(percent: number): GlobalRating {
  if (percent < 40) return 'Fail'
  if (percent < 55) return 'Borderline'
  if (percent < 70) return 'Pass'
  if (percent < 85) return 'Good'
  return 'Excellent'
}

export function clampRating(proposed: string | undefined, anchor: GlobalRating): GlobalRating {
  const a = GLOBAL_RATINGS.indexOf(anchor)
  const p = GLOBAL_RATINGS.indexOf(proposed as GlobalRating)
  if (p < 0) return anchor
  return GLOBAL_RATINGS[Math.max(a - 1, Math.min(a + 1, p))]
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
 * Finds the candidate turn that contains the quote. Allows the model to have trimmed or
 * lightly paraphrased the edges: we accept a match if >= 80% of the quote's words appear
 * in order-insensitive form within a single candidate turn and at least 3 words match.
 */
export function findEvidenceTurn(quote: string, transcript: TranscriptEntry[]): number | null {
  const q = normalizeForMatch(quote)
  if (q.length < 3) return null
  const qWords = q.split(' ').filter(Boolean)
  let best: { idx: number; ratio: number } | null = null
  transcript.forEach((entry, idx) => {
    if (entry.kind !== 'candidate' && entry.kind !== 'exam' && entry.kind !== 'investigation') return
    // Must mirror formatTranscript() in examinerPrompt.ts, which is what the model quotes from.
    const text =
      entry.kind === 'candidate'
        ? entry.text
        : entry.kind === 'exam'
          ? `examined ${entry.system} ${entry.finding}`
          : `requested ${entry.test} ${entry.result}`
    const t = normalizeForMatch(text)
    if (t.includes(q)) {
      best = { idx, ratio: 1 }
      return
    }
    const tWords = new Set(t.split(' '))
    const hits = qWords.filter((w) => tWords.has(w)).length
    const ratio = hits / qWords.length
    if (hits >= 3 && ratio >= 0.8 && (!best || ratio > best.ratio)) best = { idx, ratio }
  })
  return best === null ? null : (best as { idx: number }).idx
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
  if (!verdict) return unmetItem(item, 'Could not be assessed automatically — review the transcript yourself.')
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
