import { describe, expect, it } from 'vitest'
import {
  MAX_PCM_BYTES,
  VOICE_SAMPLE_RATE,
  appendDictation,
  cleanTranscript,
  downmix,
  encodePcm16,
  pcmError
} from '../../src/shared/voice'

const seconds = (s: number): Uint8Array => new Uint8Array(Math.round(VOICE_SAMPLE_RATE * s) * 2)

describe('pcmError', () => {
  it('accepts a normal dictation', () => {
    expect(pcmError(seconds(4))).toBeNull()
  })

  it('rejects non-PCM input, odd lengths, too-short and too-long recordings', () => {
    expect(pcmError('hello')).toMatch(/invalid/i)
    expect(pcmError([1, 2, 3, 4])).toMatch(/invalid/i)
    expect(pcmError(new Uint8Array(32_001))).toMatch(/invalid/i)
    expect(pcmError(seconds(0.1))).toMatch(/too short/i)
    expect(pcmError(new Uint8Array(MAX_PCM_BYTES + 2))).toMatch(/limited/i)
  })
})

describe('encodePcm16', () => {
  it('writes clamped little-endian 16-bit samples', () => {
    const bytes = encodePcm16(new Float32Array([0, 1, -1, 2, -2, 0.5]))
    const view = new DataView(bytes.buffer)
    const samples = Array.from({ length: 6 }, (_, i) => view.getInt16(i * 2, true))
    expect(samples).toEqual([0, 32767, -32768, 32767, -32768, 16383])
  })
})

describe('downmix', () => {
  it('averages channels and passes mono through', () => {
    const mono = new Float32Array([0.1, 0.2])
    expect(downmix([mono])).toBe(mono)
    expect(Array.from(downmix([new Float32Array([1, 0]), new Float32Array([0, -1])]))).toEqual([0.5, -0.5])
  })
})

describe('cleanTranscript', () => {
  it("removes Parakeet's no-speech marker and tidies whitespace", () => {
    expect(cleanTranscript('[No speech detected]')).toBe('')
    expect(cleanTranscript('  Hello,   how are you\n feeling today? ')).toBe('Hello, how are you feeling today?')
    expect(cleanTranscript('Any chest pain? [No speech detected]')).toBe('Any chest pain?')
  })
})

describe('appendDictation', () => {
  it('fills an empty box or appends with a single space', () => {
    expect(appendDictation('', 'Hello')).toBe('Hello')
    expect(appendDictation('   ', 'Hello')).toBe('Hello')
    expect(appendDictation('Hello.', 'How are you?')).toBe('Hello. How are you?')
    expect(appendDictation('Hello.\n', 'How are you?')).toBe('Hello.\nHow are you?')
    expect(appendDictation('Hello.', '')).toBe('Hello.')
  })
})
