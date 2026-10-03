import { TTS_MINI_V1_EN_PARLER_TTS_Q8_0, cancel, loadModel, textToSpeech } from '@qvac/sdk'
import type { PatientVoice } from '@shared/stationSchema'
import { speakableText, speechParts } from '@shared/speech'
import { OptionalModel } from './optionalModel'

/**
 * Parler TTS mini v1 (English, Q8_0, 44.1 kHz). On Apple Silicon it runs on Metal at about real time;
 * on the CPU it takes roughly twice as long as the audio it produces.
 */
const SPEECH_MODEL = TTS_MINI_V1_EN_PARLER_TTS_Q8_0

/** Reads patient replies aloud for the optional spoken-replies setting (~1.2 GB). */
class SpeechManager extends OptionalModel {
  private requestId: string | null = null
  /** Bumped on every new reply or stop, so audio from a superseded reply is never forwarded. */
  private turn = 0

  constructor() {
    super(SPEECH_MODEL, 'Parler TTS mini v1 (English, Q8_0)')
  }

  protected load(): Promise<string> {
    return loadModel({
      modelSrc: SPEECH_MODEL,
      modelConfig: { ttsEngine: 'parler', useGPU: process.arch === 'arm64' }
    })
  }

  /**
   * Speaks a patient reply in the station's voice, one sentence at a time, handing over s16le mono PCM
   * as each is synthesised. Stops whatever was being spoken before. Resolves when done or stopped.
   */
  async speak(reply: string, voice: PatientVoice, onAudio: (pcm: Uint8Array, sampleRate: number) => void): Promise<void> {
    await this.stop()
    const turn = this.turn
    // The SDK's own sentence streaming returns a short reply as one piece, so the first words would
    // wait for the whole reply; splitting here gets the first sentence playing within a few seconds.
    for (const part of speechParts(speakableText(reply))) {
      if (turn !== this.turn || !this.ready) return
      const run = textToSpeech({ modelId: this.modelId!, text: part, inputType: 'text', stream: false, ...voice })
      this.requestId = run.requestId
      try {
        const samples = await run.buffer
        if (turn !== this.turn) return
        if (samples.length) onAudio(new Uint8Array(Int16Array.from(samples).buffer), (await run.sampleRate) ?? 44_100)
      } catch (err) {
        // Stopping a reply cancels its run, which can surface here as an error.
        if (turn === this.turn) throw err
        return
      } finally {
        if (this.requestId === run.requestId) this.requestId = null
      }
    }
  }

  /** Stops the reply being synthesised, if any. */
  async stop(): Promise<void> {
    this.turn++
    const id = this.requestId
    this.requestId = null
    if (id) await cancel({ requestId: id }).catch(() => {})
  }

  override async unload(): Promise<void> {
    await this.stop()
    await super.unload()
  }
}

export const speechManager = new SpeechManager()
