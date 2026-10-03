import { describe, expect, it } from 'vitest'
import {
  PASS_MARK,
  answersPercent,
  bandRating,
  computeDomainScores,
  decideResult,
  detectDisclosures,
  feedbackResult,
  finalPercent,
  findEvidenceTurn,
  overallPercent,
  quoteMatches,
  ratingFor,
  verifyAnswer,
  keyPointInAnswer
} from '../../src/shared/rubric'
import type { AnswerResult, ItemResult, TranscriptEntry } from '../../src/shared/sessionTypes'

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

  it('never rates a failed station above Borderline', () => {
    expect(ratingFor(80, 'fail')).toBe('Borderline')
    expect(ratingFor(20, 'fail')).toBe('Fail')
    expect(ratingFor(80, 'pass')).toBe('Good')
  })
})

const answer = (hit: number, missed: number, p: Partial<AnswerResult> = {}): AnswerResult => ({
  question: 'q',
  answer: 'a',
  modelAnswer: '',
  keyPointsHit: Array.from({ length: hit }, (_, i) => `hit${i}`),
  keyPointsMissed: Array.from({ length: missed }, (_, i) => `miss${i}`),
  comment: '',
  ...p
})

describe('final score and result', () => {
  it('weights each examiner question equally and adds them at 20%', () => {
    expect(answersPercent([answer(1, 1), answer(4, 0)])).toBe(75)
    expect(answersPercent([])).toBeNull()
    const items = [item({ met: 'yes' })]
    expect(finalPercent(items, [])).toBe(100)
    expect(finalPercent(items, [answer(0, 3)])).toBe(80)
  })

  it('fails when the student did nothing', () => {
    expect(decideResult([item({ met: 'yes' })], [], false).result).toBe('fail')
  })

  it('passes at the pass mark and fails below it', () => {
    const items = (yes: number, total: number): ItemResult[] =>
      Array.from({ length: total }, (_, i) => item({ itemId: `i${i}`, met: i < yes ? 'yes' : 'no' }))
    expect(decideResult(items(11, 20), [], true).result).toBe('pass') // 55%
    const below = decideResult(items(10, 20), [], true) // 50%
    expect(below.result).toBe('fail')
    expect(below.reasons[0]).toContain(`pass mark of ${PASS_MARK}%`)
  })

  it('fails when a must-pass item is not done, whatever the score', () => {
    const items = [
      item({ itemId: 'a', met: 'yes', weight: 3 }),
      item({ itemId: 'b', met: 'yes', weight: 3 }),
      item({ itemId: 'risk', text: 'Asks about suicide', met: 'no', critical: true })
    ]
    const r = decideResult(items, [], true)
    expect(r.result).toBe('fail')
    expect(r.reasons).toEqual(['Must-pass item not done: Asks about suicide'])
    expect(decideResult([...items.slice(0, 2), { ...items[2], met: 'partial' }], [], true).result).toBe('pass')
  })

  it('is incomplete only when unmarked items could change the result', () => {
    const unmarked = item({ itemId: 'u', met: 'no', notAssessed: true, weight: 3 })
    // 1 of 4 weight done; if the unmarked item were done it would be 4/4 → pass, else 1/4 → fail.
    expect(decideResult([item({ met: 'yes' }), unmarked], [], true).result).toBe('incomplete')
    // Already 3 of 4 weight done: passes either way.
    expect(decideResult([item({ met: 'yes', weight: 3 }), { ...unmarked, weight: 1 }], [], true).result).toBe('pass')
    // Nothing else done: fails either way.
    const many = Array.from({ length: 10 }, (_, i) => item({ itemId: `n${i}`, met: 'no' }))
    expect(decideResult([...many, { ...unmarked, weight: 1 }], [], true).result).toBe('fail')
    // An unmarked must-pass item always leaves the result open if the score passes.
    expect(decideResult([item({ met: 'yes', weight: 3 }), { ...unmarked, weight: 1, critical: true }], [], true).result).toBe(
      'incomplete'
    )
  })

  it('reads the result of feedback saved before results existed', () => {
    expect(feedbackResult({ globalRating: 'Pass' })).toBe('pass')
    expect(feedbackResult({ globalRating: 'Borderline' })).toBe('fail')
    expect(feedbackResult({ globalRating: 'Good', result: 'incomplete' })).toBe('incomplete')
  })
})

describe('examiner answer verification', () => {
  const expected = { modelAnswer: 'SPIKES...', keyPoints: ['SPIKES', 'Setting', 'Perception'] }
  const verdict = (hits: { keyPoint: string; quote: string }[]) => ({ keyPointsHit: hits, comment: 'ok' })

  it('gives blank answers nothing, whatever the model says', () => {
    const r = verifyAnswer(expected, { question: 'q', answer: '  ' }, verdict([{ keyPoint: 'SPIKES', quote: 'SPIKES' }]))
    expect(r.keyPointsHit).toEqual([])
    expect(r.comment).toBe('No answer given.')
  })

  it('credits key points only with a quote from the answer', () => {
    const r = verifyAnswer(
      expected,
      { question: 'q', answer: 'I would use SPIKES, starting with a private setting.' },
      verdict([
        { keyPoint: 'spikes', quote: 'SPIKES' },
        { keyPoint: 'Setting', quote: 'a private setting' },
        { keyPoint: 'Perception', quote: 'ask what they understand' },
        { keyPoint: 'Invented point', quote: 'SPIKES' }
      ])
    )
    expect(r.keyPointsHit).toEqual(['SPIKES', 'Setting'])
    expect(r.keyPointsMissed).toEqual(['Perception'])
  })

  it('flags an answer the model could not mark', () => {
    const r = verifyAnswer(expected, { question: 'q', answer: 'I would arrange a meeting.' }, undefined)
    expect(r.notAssessed).toBe(true)
    expect(r.keyPointsHit).toEqual([])
  })

  // Seen in an end-to-end run: the model left this key point out although the answer states it.
  const overdose = {
    modelAnswer: '...',
    keyPoints: ['Not safe for discharge', 'Liaison psychiatry referral', 'Consider capacity/legal framework if he tries to leave']
  }
  const overdoseAnswer =
    'He is not safe for discharge. Refer to the liaison psychiatry team for a full assessment, and consider capacity and the legal framework if he tries to leave.'

  it('credits a key point the answer states word for word, even when the model misses it', () => {
    const r = verifyAnswer(overdose, { question: 'q', answer: overdoseAnswer }, verdict([{ keyPoint: 'Not safe for discharge', quote: 'He is not safe for discharge' }]))
    expect(r.keyPointsHit).toEqual(['Not safe for discharge', 'Consider capacity/legal framework if he tries to leave'])
    expect(r.keyPointsMissed).toEqual(['Liaison psychiatry referral'])
    // The model's comment described its own marks, so it is replaced.
    expect(r.comment).toBe('You covered 2 of 3 key points. Not covered: Liaison psychiatry referral.')
  })

  it('keeps the model comment when it agrees with the marks', () => {
    const r = verifyAnswer(expected, { question: 'q', answer: 'SPIKES' }, verdict([{ keyPoint: 'SPIKES', quote: 'SPIKES' }]))
    expect(r.keyPointsHit).toEqual(['SPIKES'])
    expect(r.comment).toBe('ok')
  })

  it('still credits word-for-word key points when the model output could not be read', () => {
    const r = verifyAnswer(expected, { question: 'q', answer: 'SPIKES: setting, perception.' }, undefined)
    expect(r.keyPointsHit).toEqual(['SPIKES', 'Setting', 'Perception'])
    expect(r.notAssessed).toBe(false)
  })

  it.each([
    ['Nimodipine', 'Start nimodipine and neuro observations.', true],
    ['Neuro observations', 'Start nimodipine and neuro observations.', true],
    ['Lumbar puncture if CT negative', 'If the CT had been negative after 6 hours I would do a lumbar puncture.', true],
    ['Risk factors: smoking, hypertension, family history', 'Risk factors are smoking, hypertension and a family history of a bleed.', true],
    ['Follow-up appointment', 'Arrange a follow up appointment with the consultant.', true],
    ['Not safe for discharge', 'He is not safe for discharge.', true],
    // Words spread over different sentences, a negation, or a paraphrase are left to the examiner.
    ['Lumbar puncture if CT negative', 'I would do a lumbar puncture. The CT was negative.', false],
    ['Nimodipine', 'I would not give nimodipine.', false],
    ['Neurosurgical referral', 'Refer to the neurosurgeons.', false],
    ['Lumbar puncture if CT negative', 'Lumbar puncture if negative.', false]
  ])('key point "%s" in "%s": %s', (keyPoint, answer, found) => {
    expect(keyPointInAnswer(keyPoint, answer)).toBe(found)
  })
})

describe('evidence verification', () => {
  const transcript: TranscriptEntry[] = [
    { kind: 'candidate', text: "Hello, I'm Dr Rossi, one of the junior doctors. Can I confirm your name?", at: 0 },
    { kind: 'patient', text: 'Jamie Clarke.', at: 1 },
    { kind: 'candidate', text: 'Have you had any thoughts of harming yourself or ending your life?', at: 2 },
    { kind: 'patient', text: 'Sometimes.', at: 3 },
    { kind: 'exam', system: 'General appearance', finding: 'Restless', at: 4 },
    { kind: 'exam', system: 'Observations', finding: 'HR 96 regular', at: 5 },
    { kind: 'candidate', text: 'Well... how have you been sleeping lately?', at: 6 }
  ]

  it('finds exact and lightly trimmed quotes in candidate turns', () => {
    expect(findEvidenceTurn('thoughts of harming yourself or ending your life', transcript)).toBe(2)
    expect(findEvidenceTurn('"Can I confirm your name"', transcript)).toBe(0)
  })

  it('matches quotes from exam actions as formatted for the examiner', () => {
    expect(findEvidenceTurn('examined General appearance', transcript)).toBe(4)
  })

  it('matches an action named by a one-word label', () => {
    expect(findEvidenceTurn('examined Observations', transcript)).toBe(5)
    expect(findEvidenceTurn('examined Abdomen', transcript)).toBeNull()
  })

  it('accepts a quote joining several labelled student turns, but not one that includes the patient', () => {
    const joined = '[0] STUDENT: Can I confirm your name? [2] STUDENT: Have you had any thoughts of harming yourself'
    expect(findEvidenceTurn(joined, transcript)).toBe(0)
    expect(findEvidenceTurn('[5] STUDENT ACTION: examined Observations -> HR 96 regular', transcript)).toBe(5)
    expect(findEvidenceTurn('[0] STUDENT: Can I confirm your name? [1] PATIENT: Jamie Clarke.', transcript)).toBeNull()
    expect(findEvidenceTurn('Can I confirm your name?... thoughts of harming yourself', transcript)).toBe(0)
    expect(findEvidenceTurn('Can I confirm your name? … Do you drink alcohol regularly at home', transcript)).toBeNull()
    expect(findEvidenceTurn('Well... how have you been sleeping', transcript)).toBe(6)
  })

  it('rejects short quotes that only match part of a turn, and matches whole words only', () => {
    expect(quoteMatches('you', 'Have you had any thoughts?')).toBe(false)
    expect(quoteMatches('any questions', 'Do you have any questions?')).toBe(false)
    expect(quoteMatches('Any questions?', 'any questions')).toBe(true)
    expect(quoteMatches('the rest of it', 'there restless offering')).toBe(false)
    expect(quoteMatches('SPIKES', 'I would use SPIKES.', true)).toBe(true)
    expect(quoteMatches('spike', 'I would use SPIKES.', true)).toBe(false)
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
