import { TTS_MULTILINGUAL_SUPERTONIC3_Q8_0, cancel, loadModel, textToSpeech, unloadModel } from '@qvac/sdk'
import type { PatientVoice } from '@shared/stationSchema'
import { speakableText, speechParts } from '@shared/speech'
import { OptionalModel } from './optionalModel'

/**
 * Supertonic 3 (Q8_0, 44.1 kHz). On Apple Silicon it runs on Metal at about 35x real time, so a
 * sentence is ready in well under a second; loading it takes under a second once downloaded.
 */
const SPEECH_MODEL = TTS_MULTILINGUAL_SUPERTONIC3_Q8_0

/** Used until the first station is spoken. */
const DEFAULT_VOICE: PatientVoice = { voice: 'F1' }

const voiceKey = (v: PatientVoice): string => `${v.voice}/${v.pace ?? 'moderate'}`

/** Reads patient replies aloud for the optional spoken-replies setting (~127 MB). */
class SpeechManager extends OptionalModel {
  private requestId: string | null = null
  /** Bumped on every new reply or stop, so audio from a superseded reply is never forwarded. */
  private turn = 0
  /** The voice the next load uses, and the one the loaded model speaks in. */
  private voice = DEFAULT_VOICE
  private loadedVoice = ''
  /** Voice switches run one at a time, so two quick replies cannot load two models. */
  private switching: Promise<void> = Promise.resolve()

  constructor() {
    super(SPEECH_MODEL, 'Supertonic 3 (Q8_0)')
  }

  private loadVoice(voice: PatientVoice): Promise<string> {
    return loadModel({
      modelSrc: SPEECH_MODEL,
      modelConfig: {
        ttsEngine: 'supertonic',
        language: 'en',
        voice: voice.voice,
        ...(voice.pace ? { pace: voice.pace } : {}),
        useGPU: process.arch === 'arm64'
      }
    })
  }

  protected async load(): Promise<string> {
    const voice = this.voice
    const id = await this.loadVoice(voice)
    this.loadedVoice = voiceKey(voice)
    return id
  }

  /**
   * Supertonic fixes the voice and pace when the model is loaded, so a station with a different voice
   * loads a second copy and then frees the first.
   */
  private useVoice(voice: PatientVoice): Promise<void> {
    this.voice = voice
    const next = this.switching.then(async () => {
      const old = this.modelId
      if (!this.ready || !old || voiceKey(voice) === this.loadedVoice) return
      const id = await this.loadVoice(voice)
      if (this.modelId !== old) {
        // Unloaded (spoken replies turned off) while this one was loading.
        await unloadModel({ modelId: id }).catch(() => {})
        return
      }
      this.modelId = id
      this.loadedVoice = voiceKey(voice)
      await unloadModel({ modelId: old }).catch(() => {})
    })
    this.switching = next.catch(() => {})
    return next
  }

  /**
   * Speaks a patient reply in the station's voice, one sentence at a time, handing over s16le mono PCM
   * as each is synthesised. Stops whatever was being spoken before. Resolves when done or stopped.
   */
  async speak(reply: string, voice: PatientVoice, onAudio: (pcm: Uint8Array, sampleRate: number) => void): Promise<void> {
    // Read the turn before awaiting, so a reply that starts meanwhile supersedes this one.
    const stopped = this.stop()
    const turn = this.turn
    await stopped
    if (turn !== this.turn) return
    await this.useVoice(voice)
    for (const part of speechParts(speakableText(reply))) {
      if (turn !== this.turn || !this.ready) return
      const run = textToSpeech({ modelId: this.modelId!, text: part, inputType: 'text', stream: false })
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
    await this.switching
    await super.unload()
  }
}

export const speechManager = new SpeechManager()
