import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionRecord, TranscriptEntry } from '../../src/shared/sessionTypes'
import { loadBundledStations } from './helpers'

// The examiner model is replaced by a stub that invents credit for every item, which is what
// MedPsy did on empty transcripts (it made up a whole consultation and quoted it).
const { runCompletion } = vi.hoisted(() => ({ runCompletion: vi.fn() }))
vi.mock('../../src/main/qvac/streamUtils', () => ({ EXAMINER_PARAMS: {}, runCompletion }))

const { generateFeedback, partlyDone, tidySuggestions } = await import('../../src/main/qvac/examinerEngine')

const station = loadBundledStations().find((s) => s.id === 'comm-breaking-bad-news-ms')!

const QUOTE = "Hello, I'm Dr Smith, the junior doctor looking after you today"

/** Stub examiner: gives `met` to every item except `skip`, and claims every key point with `answerQuote`. */
function hallucinatingModel(met: 'yes' | 'partial', opts: { skip?: string[]; answerQuote?: string } = {}): void {
  runCompletion.mockImplementation(async ({ history }: { history: { content: string }[] }) => {
    const prompt = history[1].content
    let json: unknown
    if (prompt.includes('Mark each checklist item')) {
      const ids = [...prompt.matchAll(/- id "([^"]+)"/g)].map((m) => m[1])
      json = {
        results: ids.map((id) =>
          opts.skip?.includes(id)
            ? { itemId: id, met: 'no', evidenceQuote: '', comment: 'Not done.' }
            : { itemId: id, met, evidenceQuote: QUOTE, comment: 'You did this well.' }
        )
      }
    } else if (prompt.includes('post-station questions')) {
      json = {
        answers: station.postEncounterQuestions.map((q, i) => ({
          index: i + 1,
          keyPointsHit: q.keyPoints.map((keyPoint) => ({ keyPoint, quote: opts.answerQuote ?? keyPoint })),
          comment: 'Good answer.'
        }))
      }
    } else {
      json = { summary: 'Great job.', missedPoints: ['An invented weakness'], practiseNext: [] }
    }
    return { content: JSON.stringify(json), cancelled: false, thinkingChars: 0 }
  })
}

const spoke: TranscriptEntry[] = [{ kind: 'candidate', text: `${QUOTE}.`, at: 1 }]

function record(transcript: TranscriptEntry[], answer = ''): SessionRecord {
  return {
    id: 's1',
    stationId: station.id,
    stationTitle: station.title,
    stationVersion: station.version,
    startedAt: 0,
    endedAt: 1,
    transcript,
    disclosedTopics: [],
    postAnswers: station.postEncounterQuestions.map((q) => ({ question: q.q, answer })),
    feedback: null
  }
}

const feedbackFor = (r: SessionRecord) =>
  generateFeedback({ modelId: 'm', modelName: 'stub', station, record: r, key: 'k', onProgress: () => {} })

describe('examiner feedback', () => {
  beforeEach(() => {
    runCompletion.mockReset()
  })

  it('scores 0 and Fail when the student said nothing and left the answers blank', async () => {
    hallucinatingModel('yes')
    const fb = await feedbackFor(record([{ kind: 'system', text: 'Candidate ended the station.', at: 1 }]))
    expect(fb.overallPercent).toBe(0)
    expect(fb.globalRating).toBe('Fail')
    expect(fb.result).toBe('fail')
    expect(fb.domainScores.every((d) => d.percent === 0)).toBe(true)
    expect(fb.items.every((i) => i.met === 'no')).toBe(true)
    expect(fb.answers.every((a) => a.keyPointsHit.length === 0)).toBe(true)
    expect(runCompletion).not.toHaveBeenCalled()
  })

  it.each(['yes', 'partial'] as const)('gives no credit for "%s" verdicts backed by invented quotes', async (met) => {
    hallucinatingModel(met)
    const fb = await feedbackFor(
      record([
        { kind: 'candidate', text: 'Hi.', at: 1 },
        { kind: 'patient', text: 'Hello doctor.', at: 2 }
      ])
    )
    expect(fb.overallPercent).toBe(0)
    expect(fb.globalRating).toBe('Fail')
    expect(fb.result).toBe('fail')
    expect(fb.items.every((i) => i.met === 'no' && i.downgraded)).toBe(true)
    expect(fb.answers.every((a) => a.keyPointsHit.length === 0 && a.comment === 'No answer given.')).toBe(true)
  })

  it('passes with credit when the quotes are really in the transcript and the answers', async () => {
    hallucinatingModel('yes', { answerQuote: 'multiple sclerosis' })
    const fb = await feedbackFor(record(spoke, 'Multiple sclerosis, and I would use SPIKES.'))
    expect(fb.checklistPercent).toBe(100)
    expect(fb.answersPercent).toBe(100)
    expect(fb.overallPercent).toBe(100)
    expect(fb.result).toBe('pass')
    expect(fb.globalRating).toBe('Excellent')
    expect(fb.items.every((i) => i.met === 'yes' && i.evidenceTurn === 0)).toBe(true)
  })

  it('does not credit key points the answer does not contain', async () => {
    hallucinatingModel('yes', { answerQuote: 'SPIKES framework with six steps' })
    const fb = await feedbackFor(record(spoke, 'I am not sure.'))
    expect(fb.answersPercent).toBe(0)
    expect(fb.overallPercent).toBe(80)
    expect(fb.result).toBe('pass')
  })

  it('fails a high score when a must-pass item is missed', async () => {
    hallucinatingModel('yes', { skip: ['clear-news'] })
    const fb = await feedbackFor(record(spoke))
    expect(fb.overallPercent).toBeGreaterThanOrEqual(55)
    expect(fb.result).toBe('fail')
    expect(fb.globalRating).toBe('Borderline')
    expect(fb.resultReasons).toEqual([expect.stringContaining('Must-pass item not done')])
    expect(fb.items.find((i) => i.itemId === 'clear-news')?.critical).toBe(true)
  })

  it('reports an incomplete result, not a fail, when the model output cannot be read', async () => {
    runCompletion.mockResolvedValue({ content: 'I cannot mark this.', cancelled: false, thinkingChars: 0 })
    const fb = await feedbackFor(record(spoke, 'SPIKES'))
    expect(fb.result).toBe('incomplete')
    expect(fb.items.every((i) => i.notAssessed)).toBe(true)
  })

  it('lists only partly done items as things to improve, never what the model invents', async () => {
    hallucinatingModel('yes')
    const all = await feedbackFor(record(spoke))
    expect(all.missedPoints).toEqual([])
    hallucinatingModel('partial')
    const partial = await feedbackFor(record(spoke))
    // Must-pass first, then by weight.
    expect(partial.missedPoints).toEqual(['Explains the diagnosis clearly and simply, without jargon', 'Allows silence and responds to emotion with empathy', 'Establishes what he knows and understands so far'])
  })
})

describe('must-pass double-check', () => {
  beforeEach(() => {
    runCompletion.mockReset()
  })

  /** Credits every item; the second, single-item look at a must-pass item answers `second`. */
  function secondLook(second: 'yes' | 'partial' | 'no' | 'unreadable'): void {
    runCompletion.mockImplementation(async ({ history }: { history: { content: string }[] }) => {
      const prompt = history[1].content
      const ids = [...prompt.matchAll(/- id "([^"]+)"/g)].map((m) => m[1])
      let json: unknown = { summary: 'Fine.', practiseNext: [] }
      if (ids.length === 1) {
        if (second === 'unreadable') return { content: 'Hmm.', cancelled: false, thinkingChars: 0 }
        json = { results: [{ itemId: ids[0], met: second, evidenceQuote: second === 'no' ? '' : QUOTE, comment: 'Second look.' }] }
      } else if (ids.length > 1) {
        json = { results: ids.map((id) => ({ itemId: id, met: 'yes', evidenceQuote: QUOTE, comment: 'Done.' })) }
      } else if (prompt.includes('post-station questions')) {
        json = { answers: [] }
      }
      return { content: JSON.stringify(json), cancelled: false, thinkingChars: 0 }
    })
  }
  const critical = (fb: Awaited<ReturnType<typeof feedbackFor>>) => fb.items.find((i) => i.critical)!

  it('keeps the credit when the second look agrees, asking again only about the must-pass item', async () => {
    secondLook('yes')
    const fb = await feedbackFor(record(spoke))
    expect(critical(fb).met).toBe('yes')
    expect(fb.result).toBe('pass')
    const singleItemCalls = runCompletion.mock.calls.filter(([o]) => [...o.history[1].content.matchAll(/- id "/g)].length === 1)
    expect(singleItemCalls).toHaveLength(1)
  })

  it('fails the station when the second look finds the must-pass item not done', async () => {
    secondLook('no')
    const fb = await feedbackFor(record(spoke))
    expect(critical(fb).met).toBe('no')
    expect(critical(fb).comment).toBe('Second look.')
    expect(fb.result).toBe('fail')
  })

  it('fails the station when the second look finds it only partly done', async () => {
    secondLook('partial')
    const fb = await feedbackFor(record(spoke))
    expect(critical(fb).met).toBe('partial')
    expect(fb.result).toBe('fail')
    expect(fb.resultReasons).toEqual([expect.stringContaining('Must-pass item only partly done')])
  })

  it('keeps the first mark when the second look cannot be read', async () => {
    secondLook('unreadable')
    const fb = await feedbackFor(record(spoke))
    expect(critical(fb).met).toBe('yes')
    expect(fb.result).toBe('pass')
  })
})

describe('asking again about rejected evidence', () => {
  beforeEach(() => {
    runCompletion.mockReset()
  })

  const consultation: TranscriptEntry[] = [
    { kind: 'candidate', text: `${QUOTE}.`, at: 1 },
    { kind: 'patient', text: 'Hi. I am here for my scan results.', at: 2 }
  ]

  /** First marking quotes the patient for every item; a re-ask quotes `secondQuote`. */
  function patientQuoter(secondQuote: string): void {
    runCompletion.mockImplementation(async ({ history }: { history: { content: string }[] }) => {
      const prompt = history[1].content
      const ids = [...prompt.matchAll(/- id "([^"]+)"/g)].map((m) => m[1])
      const retry = prompt.includes('a PATIENT line is never evidence')
      const json = ids.length
        ? { results: ids.map((id) => ({ itemId: id, met: 'yes', evidenceQuote: retry ? secondQuote : 'I am here for my scan results', comment: 'Done.' })) }
        : prompt.includes('post-station questions')
          ? { answers: [] }
          : { summary: 'Fine.', practiseNext: [] }
      return { content: JSON.stringify(json), cancelled: false, thinkingChars: 0 }
    })
  }

  it('credits an item once the model points to the student instead of the patient', async () => {
    patientQuoter(QUOTE)
    const fb = await feedbackFor(record(consultation))
    expect(fb.items.every((i) => i.met === 'yes' && i.evidenceTurn === 0)).toBe(true)
    const retries = runCompletion.mock.calls.map(([o]) => o.history[1].content).filter((p: string) => p.includes('never evidence'))
    expect(retries[0]).toContain('you quoted "I am here for my scan results"')
  })

  it('gives no credit when the second answer still has no student evidence', async () => {
    patientQuoter('I am here for my scan results')
    const fb = await feedbackFor(record(consultation))
    expect(fb.items.every((i) => i.met === 'no' && i.downgraded)).toBe(true)
    expect(fb.result).toBe('fail')
  })
})

describe('feedback tidying', () => {
  const item = (text: string, met: 'yes' | 'partial' | 'no', weight = 1, critical = false) =>
    ({ itemId: text, domain: 'dataGathering', text, weight, critical, met, evidenceQuote: '', evidenceTurn: null, downgraded: false, comment: '' }) as const

  it('orders partly done items must-pass first, then by weight, and leaves out the rest', () => {
    expect(partlyDone([item('a', 'partial'), item('b', 'no', 3), item('c', 'partial', 2), item('d', 'partial', 1, true), item('e', 'yes')])).toEqual(['d', 'c', 'a'])
  })

  it('splits suggestions the model ran together, and keeps quoted phrases intact', () => {
    expect(
      tidySuggestions([
        "Role-play asking 'How do you feel about being here alive?','Review suicide risk assessment protocols",
        "Practise phrases like 'take your time', 'I can see this is hard'"
      ])
    ).toEqual([
      "Role-play asking 'How do you feel about being here alive?'",
      'Review suicide risk assessment protocols',
      "Practise phrases like 'take your time', 'I can see this is hard'"
    ])
  })
})
