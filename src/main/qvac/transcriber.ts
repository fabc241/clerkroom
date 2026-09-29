import { EventEmitter } from 'events'
import { unlinkSync } from 'fs'
import { PARAKEET_UNIFIED_0_6B_Q8_0, cancel, downloadAsset, loadModel, transcribe, unloadModel } from '@qvac/sdk'
import type { VoiceStatus } from '@shared/ipcTypes'
import { cleanTranscript, pcmError } from '@shared/voice'
import { findCachedModelFile } from './modelManager'

/**
 * Parakeet Unified (English, 0.6B, Q8_0): one GGUF that the SDK's parakeet-transcription plugin
 * runs on the CPU, so it does not compete with MedPsy for Metal memory.
 */
const VOICE_MODEL = PARAKEET_UNIFIED_0_6B_Q8_0

type AudioChunk = Parameters<typeof transcribe>[0]['audioChunk']

/** Downloads, loads and runs the speech-to-text model used for optional dictation. */
class VoiceManager extends EventEmitter {
  private modelId: string | null = null
  private downloadRequestId: string | null = null
  private preparing: Promise<VoiceStatus> | null = null
  private status: VoiceStatus = {
    phase: 'idle',
    modelName: 'Parakeet Unified 0.6B (English, Q8_0)',
    sizeBytes: VOICE_MODEL.expectedSize,
    downloadPercent: 0,
    downloadedBytes: 0,
    totalBytes: VOICE_MODEL.expectedSize,
    cached: false
  }

  getStatus(): VoiceStatus {
    this.status.cached = findCachedModelFile(VOICE_MODEL) !== null
    return { ...this.status }
  }

  private update(patch: Partial<VoiceStatus>): void {
    this.status = { ...this.status, ...patch }
    this.emit('status', { ...this.status })
  }

  /** Downloads if needed and loads the model. Idempotent while in flight. */
  prepare(): Promise<VoiceStatus> {
    if (this.preparing) return this.preparing
    if (this.modelId) return Promise.resolve(this.getStatus())
    this.preparing = this.doPrepare().finally(() => {
      this.preparing = null
    })
    return this.preparing
  }

  private async doPrepare(): Promise<VoiceStatus> {
    try {
      this.update({ error: undefined })
      if (findCachedModelFile(VOICE_MODEL) === null) {
        this.update({ phase: 'downloading', downloadPercent: 0, downloadedBytes: 0 })
        const op = downloadAsset({
          assetSrc: VOICE_MODEL,
          onProgress: (p) =>
            this.update({
              downloadPercent: Math.round(p.percentage * 10) / 10,
              downloadedBytes: p.downloaded,
              totalBytes: p.total || VOICE_MODEL.expectedSize
            })
        })
        this.downloadRequestId = op.requestId
        await op
        this.downloadRequestId = null
      }
      this.update({ phase: 'loading', cached: true, downloadPercent: 100 })
      this.modelId = await loadModel({ modelSrc: VOICE_MODEL })
      this.update({ phase: 'ready' })
    } catch (err) {
      this.downloadRequestId = null
      const message = err instanceof Error ? err.message : String(err)
      const cancelled = /cancel/i.test(message)
      this.update({ phase: cancelled ? 'idle' : 'error', error: cancelled ? undefined : message })
    }
    return this.getStatus()
  }

  async transcribe(pcm: unknown): Promise<string> {
    const invalid = pcmError(pcm)
    if (invalid) throw new Error(invalid)
    if (!this.modelId || this.status.phase !== 'ready') throw new Error('The voice model is not loaded.')
    const audio = pcm as Uint8Array
    const text = await transcribe({
      modelId: this.modelId,
      // Raw s16le PCM (no container), sent to the worker as base64. The SDK types this as bare-buffer's
      // Buffer, but the Node client only calls toString('base64') on it, which a Node Buffer supports.
      audioChunk: Buffer.from(audio.buffer, audio.byteOffset, audio.byteLength) as unknown as AudioChunk
    })
    return cleanTranscript(text)
  }

  async cancelDownload(): Promise<void> {
    if (this.downloadRequestId) await cancel({ requestId: this.downloadRequestId })
  }

  /** Stops any download and frees the model's memory (~0.8 GB), e.g. when voice input is turned off. */
  async unload(): Promise<void> {
    await this.cancelDownload()
    await this.preparing?.catch(() => {})
    if (this.modelId) {
      const id = this.modelId
      this.modelId = null
      await unloadModel({ modelId: id }).catch(() => {})
    }
    if (this.status.phase === 'ready' || this.status.phase === 'error') this.update({ phase: 'idle', error: undefined })
  }

  async deleteModel(): Promise<void> {
    await this.unload()
    const file = findCachedModelFile(VOICE_MODEL)
    if (file) unlinkSync(file)
    this.update({ cached: false, downloadPercent: 0, downloadedBytes: 0 })
  }
}

export const voiceManager = new VoiceManager()
