import { describe, expect, it } from 'vitest'
import { TTS_PACES, TTS_PARLER_EMOTIONS } from '@qvac/sdk'
import {
  formatIssues,
  stationSchema,
  PARLER_EMOTIONS,
  PARLER_PACES,
  SPECIALTIES
} from '../../src/shared/stationSchema'
import { normalizeForMatch } from '../../src/shared/rubric'
import { buildPatientSystemPrompt } from '../../src/main/prompts/patientPrompt'
import { loadBundledStations, rawStation } from './helpers'

const stations = loadBundledStations()

describe('bundled stations', () => {
  it('ships 12 stations with unique ids', () => {
    expect(stations).toHaveLength(12)
    expect(new Set(stations.map((s) => s.id)).size).toBe(12)
  })

  it('covers psychiatry, medicine and communication', () => {
    for (const sp of SPECIALTIES) expect(stations.some((s) => s.specialty === sp)).toBe(true)
    expect(stations.filter((s) => s.specialty === 'psychiatry')).toHaveLength(6)
  })

  it.each(stations.map((s) => [s.id, s] as const))('%s: patient prompt does not leak the diagnosis', (_id, s) => {
    const prompt = ` ${normalizeForMatch(buildPatientSystemPrompt(s))} `
    for (const term of s.forbiddenTerms) {
      expect(prompt, `prompt for ${s.id} contains "${term}"`).not.toContain(` ${normalizeForMatch(term)} `)
    }
  })

  it.each(stations.map((s) => [s.id, s] as const))('%s: every hidden fact answer contains one of its keywords', (_id, s) => {
    for (const f of s.patient.revealOnlyIfAsked) {
      const answer = normalizeForMatch(f.answer)
      expect(
        f.keywords.some((k) => answer.includes(normalizeForMatch(k))),
        `${s.id} / ${f.topic}`
      ).toBe(true)
    }
  })

  it('all stations are marked fictional', () => {
    for (const s of stations) expect(s.authoring.source).toBe('fictional')
  })
})

describe('station schema', () => {
  it('rejects duplicate rubric ids', () => {
    const s = rawStation('psych-low-mood') as { rubric: { items: { id: string }[] } }
    s.rubric.items[1].id = s.rubric.items[0].id
    expect(stationSchema.safeParse(s).success).toBe(false)
  })

  it('rejects invalid ids and missing brief', () => {
    const s = rawStation('med-chest-pain')
    expect(stationSchema.safeParse({ ...s, id: 'Bad Id!' }).success).toBe(false)
    expect(stationSchema.safeParse({ ...s, candidateBrief: '  ' }).success).toBe(false)
  })

  it('applies defaults for optional fields', () => {
    const s = rawStation('med-chest-pain')
    delete s.timing
    delete s.examFindings
    const parsed = stationSchema.parse(s)
    expect(parsed.timing).toEqual({ readingSec: 120, stationSec: 480 })
    expect(parsed.examFindings).toEqual([])
  })
})

describe('patient voice', () => {
  const withVoice = (voice: unknown): unknown => {
    const s = rawStation('psych-low-mood') as { patient: Record<string, unknown> }
    return { ...s, patient: { ...s.patient, voice } }
  }

  it('is optional', () => {
    const s = rawStation('psych-low-mood') as { patient: Record<string, unknown> }
    delete s.patient.voice
    expect(stationSchema.parse(s).patient.voice).toBeUndefined()
  })

  it('gives each bundled patient a speaker of their own', () => {
    const speakers = stations.map((s) => s.patient.voice?.voice)
    expect(speakers.every(Boolean)).toBe(true)
    expect(new Set(speakers).size).toBe(stations.length)
  })

  it('accepts a speaker with Parler voice controls', () => {
    const voice = { voice: 'Jon', pace: 'slow', pitch: 'low', expressivity: 'monotone', emotion: 'sad' }
    expect(stationSchema.parse(withVoice(voice)).patient.voice).toEqual(voice)
    expect(stationSchema.parse(withVoice({ voice: 'Laura' })).patient.voice).toEqual({ voice: 'Laura' })
  })

  it('needs a speaker so replies keep the same voice', () => {
    expect(stationSchema.safeParse(withVoice({ emotion: 'sad' })).success).toBe(false)
    expect(stationSchema.safeParse(withVoice({ voice: 'jon' })).success).toBe(false)
  })

  it("rejects wording the Parler engine doesn't accept", () => {
    for (const bad of [{ pitch: 'low-pitched' }, { expressivity: 'very expressive' }, { emotion: 'angry' }, { pace: 'quick' }]) {
      const res = stationSchema.safeParse(withVoice({ voice: 'Jon', ...bad }))
      expect(res.success, JSON.stringify(bad)).toBe(false)
      expect(formatIssues(res.error!).join('\n')).toContain(`patient.voice.${Object.keys(bad)[0]}`)
    }
  })

  it('rejects misspelt keys instead of dropping them', () => {
    expect(stationSchema.safeParse(withVoice({ voice: 'Jon', pich: 'low' })).success).toBe(false)
  })

  it('matches the emotions and paces the QVAC SDK accepts', () => {
    expect([...PARLER_EMOTIONS]).toEqual([...TTS_PARLER_EMOTIONS])
    expect([...PARLER_PACES]).toEqual([...TTS_PACES])
  })
})
