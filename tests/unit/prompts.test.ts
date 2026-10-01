import { describe, expect, it } from 'vitest'
import { buildPatientSystemPrompt } from '../../src/main/prompts/patientPrompt'
import {
  activeForbiddenTerms,
  checkPatientReply,
  sanitizePatientReply,
  tidyPatientReply
} from '../../src/main/prompts/safety'
import {
  buildChecklistPrompt,
  checklistResponseSchema,
  extractJsonObject,
  formatTranscript
} from '../../src/main/prompts/examinerPrompt'
import { loadBundledStations } from './helpers'

const station = loadBundledStations().find((s) => s.id === 'psych-low-mood')!

describe('patient prompt', () => {
  const prompt = buildPatientSystemPrompt(station)

  it('overrides the MedPsy assistant persona', () => {
    expect(prompt).toMatch(/NOT an assistant and NOT MedPsy/)
    expect(prompt).toContain('Jamie Clarke')
  })

  it('explains private-detail notes and includes the cue, but not the hidden facts themselves', () => {
    expect(prompt).toContain('[Patient note]')
    expect(prompt).toContain(station.patient.cue!)
    for (const f of station.patient.revealOnlyIfAsked) expect(prompt).not.toContain(f.answer)
  })

  it('matches snapshot', () => {
    expect(prompt).toMatchSnapshot()
  })
})

describe('character guard', () => {
  it('accepts an in-character reply', () => {
    expect(checkPatientReply("I just haven't been myself, doctor. Everything feels like hard work.", ['depression']).ok).toBe(true)
  })

  it.each([
    'As an AI, I cannot feel emotions.',
    'I am MedPsy, a medical assistant.',
    'You should consult a healthcare professional.',
    '**Symptoms:** low mood',
    '- I feel tired',
    'It sounds like I have depression.'
  ])('flags "%s"', (text) => {
    expect(checkPatientReply(text, ['depression']).ok).toBe(false)
  })

  it('does not match forbidden terms inside other words', () => {
    expect(checkPatientReply('My mum has a mschool friend.', ['MS']).ok).toBe(true)
    expect(checkPatientReply('Is it MS?', ['MS']).ok).toBe(false)
  })

  it('lifts a forbidden term once the student has said it', () => {
    const history = [
      { role: 'system', content: 'x' },
      { role: 'user', content: 'The scan shows multiple sclerosis.' }
    ]
    expect(activeForbiddenTerms(['multiple sclerosis', 'demyelination'], history)).toEqual(['demyelination'])
  })

  it('sanitises by dropping offending sentences and stage directions', () => {
    const out = sanitizePatientReply('*sighs* I feel awful. As an AI I cannot say more. I sleep badly.', [])
    expect(out).toBe('I feel awful. I sleep badly.')
    expect(sanitizePatientReply('As an AI model.', [])).toMatch(/not sure/)
  })
})

describe('reply tidying', () => {
  it('strips stage directions and markdown emphasis', () => {
    expect(tidyPatientReply("It's a gift, really. *(He grins, adjusting his tie)* No time for tests!")).toBe(
      "It's a gift, really. No time for tests!"
    )
    expect(tidyPatientReply('I feel **awful**. (She looks away) Sorry.')).toBe('I feel awful. Sorry.')
  })

  it('trims long replies at a sentence boundary but keeps the first sentence', () => {
    const long = Array.from({ length: 12 }, (_, i) => `This is sentence number ${i + 1} of a long reply.`).join(' ')
    const out = tidyPatientReply(long)
    expect(out.split(' ').length).toBeLessThanOrEqual(75)
    expect(out.endsWith('.')).toBe(true)
    const oneLong = 'word '.repeat(100).trim()
    expect(tidyPatientReply(oneLong)).toBe(oneLong)
  })

  it('leaves ordinary replies untouched', () => {
    expect(tidyPatientReply("I've been sick twice. I don't want to eat.")).toBe("I've been sick twice. I don't want to eat.")
  })
})

describe('examiner prompt + JSON extraction', () => {
  it('numbers transcript turns', () => {
    const t = formatTranscript([
      { kind: 'candidate', text: 'Hi', at: 0 },
      { kind: 'patient', text: 'Hello', at: 1 },
      { kind: 'investigation', test: 'ECG', result: 'normal', at: 2 }
    ])
    expect(t).toBe('[0] STUDENT: Hi\n[1] PATIENT: Hello\n[2] STUDENT ACTION: requested ECG -> normal')
  })

  it('lists the batch items in the checklist prompt', () => {
    const p = buildChecklistPrompt(station, [], station.rubric.items.slice(0, 2))
    expect(p).toContain('id "intro"')
    expect(p).toContain('id "open-q"')
    expect(p).not.toContain('id "risk"')
  })

  it('extracts the final JSON object after reasoning and prose', () => {
    const text = `<think>maybe {"results": []}</think>Here is my marking:\n\`\`\`json\n{"results":[{"itemId":"intro","met":"yes","evidenceQuote":"Hi {there}","comment":"Good."}]}\n\`\`\``
    const parsed = checklistResponseSchema.parse(extractJsonObject(text))
    expect(parsed.results[0]).toMatchObject({ itemId: 'intro', met: 'yes', evidenceQuote: 'Hi {there}' })
  })

  it('returns the last top-level object, not a nested one', () => {
    expect(extractJsonObject('a {"x":1} b {"y":{"z":2}}')).toEqual({ y: { z: 2 } })
  })

  it('closes an object the model left without its final brackets', () => {
    const text = '{"answers":[{"index":1,"keyPointsHit":[{"keyPoint":"CBT","quote":"offer CBT"}],"comment":"Good."}'
    expect(extractJsonObject(text)).toEqual({
      answers: [{ index: 1, keyPointsHit: [{ keyPoint: 'CBT', quote: 'offer CBT' }], comment: 'Good.' }]
    })
    expect(() => extractJsonObject('{"answers":[{"comment":"cut off mid')).toThrow()
  })

  it('throws when there is no JSON', () => {
    expect(() => extractJsonObject('no json here')).toThrow()
  })
})
