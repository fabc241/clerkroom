import { describe, expect, it } from 'vitest'
import {
  bandRating,
  clampRating,
  computeDomainScores,
  detectDisclosures,
  findEvidenceTurn,
  overallPercent
} from '../../src/shared/rubric'
import type { ItemResult, TranscriptEntry } from '../../src/shared/sessionTypes'

const item = (p: Partial<ItemResult>): ItemResult => ({
  itemId: 'x',
  domain: 'dataGathering',
  text: 't',
  weight: 1,
  met: 'no',
  evidenceQuote: '',
  evidenceTurn: null,
  comment: '',
  downgraded: false,
  ...p
})

describe('scoring', () => {
  it('computes weighted domain scores with half credit for partial', () => {
    const items = [
      item({ domain: 'dataGathering', weight: 2, met: 'yes' }),
      item({ domain: 'dataGathering', weight: 2, met: 'partial' }),
      item({ domain: 'interpersonal', weight: 1, met: 'no' })
    ]
    const scores = computeDomainScores(items)
    expect(scores).toEqual([
      { domain: 'dataGathering', earned: 3, possible: 4, percent: 75 },
      { domain: 'interpersonal', earned: 0, possible: 1, percent: 0 }
    ])
    expect(overallPercent(items)).toBe(60)
  })

  it('maps percent to rating bands', () => {
    expect(bandRating(10)).toBe('Fail')
    expect(bandRating(50)).toBe('Borderline')
    expect(bandRating(65)).toBe('Pass')
    expect(bandRating(80)).toBe('Good')
    expect(bandRating(95)).toBe('Excellent')
  })

  it('lets the model move the rating by at most one band', () => {
    expect(clampRating('Excellent', 'Pass')).toBe('Good')
    expect(clampRating('Fail', 'Good')).toBe('Pass')
    expect(clampRating('Borderline', 'Pass')).toBe('Borderline')
    expect(clampRating('nonsense', 'Pass')).toBe('Pass')
    expect(clampRating(undefined, 'Fail')).toBe('Fail')
  })
})

describe('evidence verification', () => {
  const transcript: TranscriptEntry[] = [
    { kind: 'candidate', text: "Hello, I'm Dr Rossi, one of the junior doctors. Can I confirm your name?", at: 0 },
    { kind: 'patient', text: 'Jamie Clarke.', at: 1 },
    { kind: 'candidate', text: 'Have you had any thoughts of harming yourself or ending your life?', at: 2 },
    { kind: 'patient', text: 'Sometimes.', at: 3 },
    { kind: 'exam', system: 'General appearance', finding: 'Restless', at: 4 }
  ]

  it('finds exact and lightly trimmed quotes in candidate turns', () => {
    expect(findEvidenceTurn('thoughts of harming yourself or ending your life', transcript)).toBe(2)
    expect(findEvidenceTurn('"Can I confirm your name"', transcript)).toBe(0)
  })

  it('matches quotes from exam actions as formatted for the examiner', () => {
    expect(findEvidenceTurn('examined General appearance', transcript)).toBe(4)
  })

  it('does not accept quotes from the patient or invented quotes', () => {
    expect(findEvidenceTurn('Jamie Clarke', transcript)).toBeNull()
    expect(findEvidenceTurn('Do you drink alcohol regularly at home', transcript)).toBeNull()
    expect(findEvidenceTurn('', transcript)).toBeNull()
  })
})

describe('disclosure detection', () => {
  it('detects hidden facts by keyword', () => {
    const facts = [
      { topic: 'Sleep', keywords: ['4 every morning'] },
      { topic: 'Alcohol', keywords: ['glasses of wine'] }
    ]
    expect(detectDisclosures('I wake at 4 every morning.', facts)).toEqual(['Sleep'])
    expect(detectDisclosures('Nothing much.', facts)).toEqual([])
  })
})
