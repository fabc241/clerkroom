import { EventEmitter } from 'events'
import { unlinkSync } from 'fs'
import { cancel, downloadAsset, unloadModel } from '@qvac/sdk'
import type { VoiceStatus } from '@shared/ipcTypes'
import { findCachedModelFile } from './modelManager'

type Asset = Parameters<typeof downloadAsset>[0]['assetSrc'] & { modelId: string; expectedSize: number }

/**
 * Downloads, loads and frees one of the optional speech models (dictation or spoken replies).
 * Subclasses say how to load the model; status changes are emitted as 'status'.
 */
export abstract class OptionalModel extends EventEmitter {
  protected modelId: string | null = null
  private downloadRequestId: string | null = null
  private preparing: Promise<VoiceStatus> | null = null
  private status: VoiceStatus

  constructor(
    private readonly asset: Asset,
    modelName: string
  ) {
    super()
    this.status = {
      phase: 'idle',
      modelName,
      sizeBytes: asset.expectedSize,
      downloadPercent: 0,
      downloadedBytes: 0,
      totalBytes: asset.expectedSize,
      cached: false
    }
  }

  /** Loads the downloaded model and returns its id. */
  protected abstract load(): Promise<string>

  getStatus(): VoiceStatus {
    this.status.cached = findCachedModelFile(this.asset) !== null
    return { ...this.status }
  }

  protected get ready(): boolean {
    return this.modelId !== null && this.status.phase === 'ready'
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
      if (findCachedModelFile(this.asset) === null) {
        this.update({ phase: 'downloading', downloadPercent: 0, downloadedBytes: 0 })
        const op = downloadAsset({
          assetSrc: this.asset,
          onProgress: (p) =>
            this.update({
              downloadPercent: Math.round(p.percentage * 10) / 10,
              downloadedBytes: p.downloaded,
              totalBytes: p.total || this.asset.expectedSize
            })
        })
        this.downloadRequestId = op.requestId
        await op
        this.downloadRequestId = null
      }
      this.update({ phase: 'loading', cached: true, downloadPercent: 100 })
      this.modelId = await this.load()
      this.update({ phase: 'ready' })
    } catch (err) {
      this.downloadRequestId = null
      const message = err instanceof Error ? err.message : String(err)
      const cancelled = /cancel/i.test(message)
      this.update({ phase: cancelled ? 'idle' : 'error', error: cancelled ? undefined : message })
    }
    return this.getStatus()
  }

  async cancelDownload(): Promise<void> {
    if (this.downloadRequestId) await cancel({ requestId: this.downloadRequestId })
  }

  /** Stops any download and frees the model's memory, e.g. when the feature is turned off. */
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
    const file = findCachedModelFile(this.asset)
    if (file) unlinkSync(file)
    this.update({ cached: false, downloadPercent: 0, downloadedBytes: 0 })
  }
}
