import type { Domain, GlobalRating } from './stationSchema'

export type TranscriptEntry =
  | { kind: 'candidate'; text: string; at: number }
  | { kind: 'patient'; text: string; at: number }
  | { kind: 'exam'; system: string; finding: string; at: number }
  | { kind: 'investigation'; test: string; result: string; at: number }
  | { kind: 'system'; text: string; at: number }

export type ItemVerdict = 'yes' | 'partial' | 'no'

export interface ItemResult {
  itemId: string
  domain: Domain
  text: string
  weight: number
  met: ItemVerdict
  evidenceQuote: string
  /** Index into the transcript where the evidence was found, if verified. */
  evidenceTurn: number | null
  comment: string
  /** True when the model claimed "yes" but the quote could not be found in the transcript. */
  downgraded: boolean
}

export interface AnswerResult {
  question: string
  answer: string
  modelAnswer: string
  keyPointsHit: string[]
  keyPointsMissed: string[]
  comment: string
}

export interface DomainScore {
  domain: Domain
  earned: number
  possible: number
  percent: number
}

export interface Feedback {
  items: ItemResult[]
  answers: AnswerResult[]
  domainScores: DomainScore[]
  overallPercent: number
  globalRating: GlobalRating
  summary: string
  missedPoints: string[]
  practiseNext: string[]
  generatedAt: number
  modelName: string
}

export interface SessionRecord {
  id: string
  stationId: string
  stationTitle: string
  stationVersion: number
  startedAt: number
  endedAt: number | null
  transcript: TranscriptEntry[]
  disclosedTopics: string[]
  postAnswers: { question: string; answer: string }[]
  feedback: Feedback | null
}

export interface SessionListItem {
  id: string
  stationId: string
  stationTitle: string
  startedAt: number
  overallPercent: number | null
  globalRating: GlobalRating | null
  domainScores: DomainScore[] | null
}
