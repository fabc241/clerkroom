import { describe, expect, it } from 'vitest'
import { TTS_PACES } from '@qvac/sdk'
import {
  formatIssues,
  stationSchema,
  SPECIALTIES,
  SPEECH_PACES
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

  it('accepts a rubric item tied to a hidden fact or an investigation, and rejects an unknown name', () => {
    const s = rawStation('med-chest-pain') as { rubric: { items: { critical?: boolean; requires?: string[] }[] } }
    const item = s.rubric.items.find((i) => i.critical)!
    item.requires = ['Radiation', '12-lead ECG']
    expect(stationSchema.safeParse(s).success).toBe(true)
    item.requires = ['ECG please']
    const r = stationSchema.safeParse(s)
    expect(r.success).toBe(false)
    expect(formatIssues(r.error!)[0]).toContain('"ECG please" is not a hidden fact topic, examination or investigation')
  })

  it('ties every bundled must-pass item that can be asked about or done to a fact or action', () => {
    for (const st of stations) {
      for (const item of st.rubric.items.filter((i) => i.critical)) {
        // Explaining the diagnosis is something the doctor says, so there is nothing to tie it to.
        if (st.id === 'comm-breaking-bad-news-ms') expect(item.requires).toEqual([])
        else expect(item.requires.length, `${st.id}/${item.id}`).toBeGreaterThan(0)
      }
    }
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

  it('gives each bundled patient a voice that fits their sex, and no two the same voice and pace', () => {
    for (const s of stations) {
      const voice = s.patient.voice?.voice
      expect(voice, s.id).toBeTruthy()
      if (s.patient.sex !== 'other') expect(voice![0], s.id).toBe(s.patient.sex === 'female' ? 'F' : 'M')
    }
    const voices = stations.map((s) => `${s.patient.voice?.voice}/${s.patient.voice?.pace ?? 'moderate'}`)
    expect(new Set(voices).size).toBe(stations.length)
  })

  it('accepts a Supertonic voice with a pace', () => {
    expect(stationSchema.parse(withVoice({ voice: 'M2', pace: 'slow' })).patient.voice).toEqual({ voice: 'M2', pace: 'slow' })
    expect(stationSchema.parse(withVoice({ voice: 'F5' })).patient.voice).toEqual({ voice: 'F5' })
  })

  it('needs a voice so replies keep the same voice', () => {
    expect(stationSchema.safeParse(withVoice({ pace: 'slow' })).success).toBe(false)
    expect(stationSchema.safeParse(withVoice({ voice: 'm1' })).success).toBe(false)
    expect(stationSchema.safeParse(withVoice({ voice: 'F6' })).success).toBe(false)
  })

  it("rejects a pace the engine doesn't accept", () => {
    const res = stationSchema.safeParse(withVoice({ voice: 'M1', pace: 'quick' }))
    expect(res.success).toBe(false)
    expect(formatIssues(res.error!).join('\n')).toContain('patient.voice.pace')
  })

  it('rejects keys Supertonic has no control for instead of dropping them', () => {
    for (const extra of [{ pich: 'low' }, { pitch: 'low' }, { emotion: 'sad' }, { expressivity: 'monotone' }]) {
      expect(stationSchema.safeParse(withVoice({ voice: 'M1', ...extra })).success, JSON.stringify(extra)).toBe(false)
    }
  })

  it('matches the paces the QVAC SDK accepts', () => {
    expect([...SPEECH_PACES]).toEqual([...TTS_PACES])
  })
})
