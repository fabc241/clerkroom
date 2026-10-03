import { PARAKEET_UNIFIED_0_6B_Q8_0, loadModel, transcribe } from '@qvac/sdk'
import { cleanTranscript, pcmError } from '@shared/voice'
import { OptionalModel } from './optionalModel'

/**
 * Parakeet Unified (English, 0.6B, Q8_0): one GGUF that the SDK's parakeet-transcription plugin
 * runs on the CPU, so it does not compete with MedPsy for Metal memory.
 */
const VOICE_MODEL = PARAKEET_UNIFIED_0_6B_Q8_0

type AudioChunk = Parameters<typeof transcribe>[0]['audioChunk']

/** Downloads, loads and runs the speech-to-text model used for optional dictation (~0.8 GB). */
class VoiceManager extends OptionalModel {
  constructor() {
    super(VOICE_MODEL, 'Parakeet Unified 0.6B (English, Q8_0)')
  }

  protected load(): Promise<string> {
    return loadModel({ modelSrc: VOICE_MODEL })
  }

  async transcribe(pcm: unknown): Promise<string> {
    const invalid = pcmError(pcm)
    if (invalid) throw new Error(invalid)
    if (!this.ready) throw new Error('The voice model is not loaded.')
    const audio = pcm as Uint8Array
    const text = await transcribe({
      modelId: this.modelId!,
      // Raw s16le PCM (no container), sent to the worker as base64. The SDK types this as bare-buffer's
      // Buffer, but the Node client only calls toString('base64') on it, which a Node Buffer supports.
      audioChunk: Buffer.from(audio.buffer, audio.byteOffset, audio.byteLength) as unknown as AudioChunk
    })
    return cleanTranscript(text)
  }
}

export const voiceManager = new VoiceManager()
