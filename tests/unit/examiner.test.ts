import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionRecord, TranscriptEntry } from '../../src/shared/sessionTypes'
import { loadBundledStations } from './helpers'

// The examiner model is replaced by a stub that invents credit for every item, which is what
// MedPsy did on empty transcripts (it made up a whole consultation and quoted it).
const { runCompletion } = vi.hoisted(() => ({ runCompletion: vi.fn() }))
vi.mock('../../src/main/qvac/streamUtils', () => ({ EXAMINER_PARAMS: {}, runCompletion }))

const { generateFeedback } = await import('../../src/main/qvac/examinerEngine')

const station = loadBundledStations().find((s) => s.id === 'comm-breaking-bad-news-ms')!

function hallucinatingModel(met: 'yes' | 'partial'): void {
  runCompletion.mockImplementation(async ({ history }: { history: { content: string }[] }) => {
    const prompt = history[1].content
    let json: unknown
    if (prompt.includes('Mark each checklist item')) {
      const ids = [...prompt.matchAll(/- id "([^"]+)"/g)].map((m) => m[1])
      json = {
        results: ids.map((id) => ({
          itemId: id,
          met,
          evidenceQuote: "Hello, I'm Dr Smith, the junior doctor looking after you today",
          comment: 'You did this well.'
        }))
      }
    } else if (prompt.includes('post-station questions')) {
      json = {
        answers: station.postEncounterQuestions.map((q, i) => ({
          index: i + 1,
          keyPointsHit: q.keyPoints,
          keyPointsMissed: [],
          comment: 'Good answer.'
        }))
      }
    } else {
      json = { summary: 'Great job.', missedPoints: [], practiseNext: [], globalRating: 'Excellent' }
    }
    return { content: JSON.stringify(json), cancelled: false, thinkingChars: 0 }
  })
}

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
    expect(fb.items.every((i) => i.met === 'no' && i.downgraded)).toBe(true)
    expect(fb.answers.every((a) => a.keyPointsHit.length === 0 && a.comment === 'No answer given.')).toBe(true)
  })

  it('keeps credit when the quote is really in the transcript', async () => {
    hallucinatingModel('yes')
    const fb = await feedbackFor(
      record([{ kind: 'candidate', text: "Hello, I'm Dr Smith, the junior doctor looking after you today.", at: 1 }], 'MS')
    )
    expect(fb.overallPercent).toBe(100)
    expect(fb.items.every((i) => i.met === 'yes' && i.evidenceTurn === 0)).toBe(true)
    expect(fb.answers.every((a) => a.keyPointsMissed.length === 0)).toBe(true)
  })
})
