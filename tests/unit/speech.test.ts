import { describe, expect, it } from 'vitest'
import { SPEECH_VOICES } from '../../src/shared/constants'
import { MAX_SPOKEN_CHARS, patientVoice, speakableText, speechParts } from '../../src/shared/speech'
import { loadBundledStations } from './helpers'

describe('patientVoice', () => {
  it("uses the station's voice when it sets one", () => {
    const voice = { voice: 'M5', pace: 'slow' } as const
    expect(patientVoice({ sex: 'male', voice })).toBe(voice)
  })

  it('falls back to one voice per sex, so the voice stays the same all station', () => {
    for (const sex of ['female', 'male', 'other'] as const) {
      const { voice } = patientVoice({ sex })
      expect(SPEECH_VOICES).toContain(voice)
      expect(patientVoice({ sex })).toEqual({ voice })
    }
  })

  it('gives every bundled station a valid voice', () => {
    for (const s of loadBundledStations()) expect(SPEECH_VOICES).toContain(patientVoice(s.patient).voice)
  })
})

describe('speakableText', () => {
  it('drops stage directions and notes that should not be read out', () => {
    expect(speakableText('*sighs* I just feel flat. [pause]  That’s all.')).toBe('I just feel flat. That’s all.')
  })

  it("returns '' when nothing is left to say", () => {
    expect(speakableText('  *nods*  ')).toBe('')
  })

  it('caps very long replies', () => {
    expect(speakableText('word '.repeat(1000))).toHaveLength(MAX_SPOKEN_CHARS)
  })
})

describe('speechParts', () => {
  it('splits a reply into sentences so the first can play while the rest is made', () => {
    expect(speechParts('I wake up at about 4 every morning. I can’t get back to sleep! Is that normal?')).toEqual([
      'I wake up at about 4 every morning.',
      'I can’t get back to sleep! Is that normal?'
    ])
  })

  it('keeps a long sentence whole rather than pausing at a comma', () => {
    expect(speechParts('I’ve just been feeling really flat lately, and my partner said I should come and talk to someone.')).toEqual([
      'I’ve just been feeling really flat lately, and my partner said I should come and talk to someone.'
    ])
  })

  it('keeps short fragments with a neighbour', () => {
    expect(speechParts('No. I haven’t really been eating much at all.')).toEqual(['No. I haven’t really been eating much at all.'])
    expect(speechParts('I haven’t been eating much at all. Not really.')).toEqual(['I haven’t been eating much at all. Not really.'])
    expect(speechParts('Yes.')).toEqual(['Yes.'])
  })

  it('keeps closing quotes and text without a final full stop', () => {
    expect(speechParts('My partner said “you need to see someone.” So I booked in for today')).toEqual([
      'My partner said “you need to see someone.”',
      'So I booked in for today'
    ])
  })
})
