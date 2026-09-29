import type { Domain, GlobalRating } from './stationSchema'

export type TranscriptEntry =
  | { kind: 'candidate'; text: string; at: number }
  | { kind: 'patient'; text: string; at: number }
  | { kind: 'exam'; system: string; finding: string; at: number }
  | { kind: 'investigation'; test: string; result: string; at: number }
  | { kind: 'system'; text: string; at: number }

export type ItemVerdict = 'yes' | 'partial' | 'no'

/** Pass or fail is decided in code; "incomplete" means the model could not mark enough to decide. */
export type SessionResult = 'pass' | 'fail' | 'incomplete'

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
  /** True when the model gave credit but its quote could not be found in the transcript. */
  downgraded: boolean
  /** Must-pass item: the station is failed if it is not done. */
  critical?: boolean
  /** True when the model's reply could not be parsed, so the item was never really marked. */
  notAssessed?: boolean
}

export interface AnswerResult {
  question: string
  answer: string
  modelAnswer: string
  keyPointsHit: string[]
  keyPointsMissed: string[]
  comment: string
  /** True when a non-blank answer could not be marked because the model's reply could not be parsed. */
  notAssessed?: boolean
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
  /** Final score: checklist plus examiner questions (checklist only in feedback saved before results existed). */
  overallPercent: number
  checklistPercent?: number
  /** Share of expected key points covered in the examiner answers; null when the station has no questions. */
  answersPercent?: number | null
  result?: SessionResult
  /** Plain-language reasons for the result, shown to the student. */
  resultReasons?: string[]
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
  result: SessionResult | null
  globalRating: GlobalRating | null
  domainScores: DomainScore[] | null
}
