import { EventEmitter } from 'events'
import { existsSync, readdirSync, statSync, unlinkSync } from 'fs'
import { homedir, cpus, totalmem } from 'os'
import { join } from 'path'
import {
  HEALTHCARE_4B_MEDICAL_Q4_K_M,
  HEALTHCARE_4B_MEDICAL_Q5_K_M,
  HEALTHCARE_1_7B_MEDICAL_Q4_K_M,
  VERBOSITY,
  assessModelFit,
  cancel,
  close,
  downloadAsset,
  loadModel,
  unloadModel
} from '@qvac/sdk'
import type { ModelChoice, ModelOption, ModelStatus } from '@shared/ipcTypes'

type Descriptor =
  | typeof HEALTHCARE_4B_MEDICAL_Q4_K_M
  | typeof HEALTHCARE_4B_MEDICAL_Q5_K_M
  | typeof HEALTHCARE_1_7B_MEDICAL_Q4_K_M

const DESCRIPTORS: Record<ModelChoice, Descriptor> = {
  'medpsy-4b-q4': HEALTHCARE_4B_MEDICAL_Q4_K_M,
  'medpsy-4b-q5': HEALTHCARE_4B_MEDICAL_Q5_K_M,
  'medpsy-1.7b-q4': HEALTHCARE_1_7B_MEDICAL_Q4_K_M
}

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'medpsy-4b-q4',
    label: 'MedPsy 4B (Q4_K_M) — recommended',
    sizeBytes: HEALTHCARE_4B_MEDICAL_Q4_K_M.expectedSize,
    note: 'Best balance of quality and speed on Apple Silicon laptops.'
  },
  {
    id: 'medpsy-4b-q5',
    label: 'MedPsy 4B (Q5_K_M)',
    sizeBytes: HEALTHCARE_4B_MEDICAL_Q5_K_M.expectedSize,
    note: 'Slightly higher quality, a little slower. 16 GB RAM recommended.'
  },
  {
    id: 'medpsy-1.7b-q4',
    label: 'MedPsy 1.7B (Q4_K_M) — low memory',
    sizeBytes: HEALTHCARE_1_7B_MEDICAL_Q4_K_M.expectedSize,
    note: 'For 8 GB Macs or Intel Macs. Noticeably weaker role-play and feedback.'
  }
]

/** Context window for simulation: system prompt + ~8 minutes of dialogue + reasoning. */
export const CTX_SIZE = 8192

export function modelsDir(): string {
  return process.env.QVAC_MODELS_DIR ?? join(homedir(), '.qvac', 'models')
}

/** The SDK caches files as "<hash>_<modelId>" in the models dir; a full-size file means cached. */
export function findCachedModelFile(d: { modelId: string; expectedSize: number }): string | null {
  const dir = modelsDir()
  if (!existsSync(dir)) return null
  for (const f of readdirSync(dir)) {
    if (f === d.modelId || f.endsWith(`_${d.modelId}`)) {
      const p = join(dir, f)
      if (statSync(p).size === d.expectedSize) return p
    }
  }
  return null
}

function findCachedFile(choice: ModelChoice): string | null {
  return findCachedModelFile(DESCRIPTORS[choice])
}

class ModelManager extends EventEmitter {
  private modelId: string | null = null
  private loadedChoice: ModelChoice | null = null
  private downloadRequestId: string | null = null
  private preparing: Promise<ModelStatus> | null = null
  private status: ModelStatus

  constructor() {
    super()
    const appleSilicon = process.arch === 'arm64'
    this.status = {
      phase: 'idle',
      choice: 'medpsy-4b-q4',
      downloadPercent: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      cached: false,
      device: appleSilicon ? 'gpu' : 'cpu',
      hardware: {
        cpu: cpus()[0]?.model ?? 'unknown',
        memoryGb: Math.round(totalmem() / 1024 ** 3),
        appleSilicon
      }
    }
  }

  getStatus(choice?: ModelChoice): ModelStatus {
    if (choice && choice !== this.status.choice && this.status.phase !== 'downloading') {
      this.update({ choice, phase: this.loadedChoice === choice ? 'ready' : 'idle' })
    }
    this.status.cached = findCachedFile(this.status.choice) !== null
    return { ...this.status }
  }

  get readyModelId(): string {
    if (!this.modelId || this.status.phase !== 'ready') throw new Error('Model is not loaded yet.')
    return this.modelId
  }

  get modelName(): string {
    return MODEL_OPTIONS.find((o) => o.id === this.loadedChoice)?.label ?? 'unknown'
  }

  private update(patch: Partial<ModelStatus>): void {
    this.status = { ...this.status, ...patch }
    this.emit('status', { ...this.status })
  }

  /** Checks fit, downloads if needed, and loads the model. Idempotent while in flight. */
  prepare(choice: ModelChoice): Promise<ModelStatus> {
    if (this.preparing) return this.preparing
    if (this.modelId && this.loadedChoice === choice) return Promise.resolve(this.getStatus())
    this.preparing = this.doPrepare(choice).finally(() => {
      this.preparing = null
    })
    return this.preparing
  }

  private async doPrepare(choice: ModelChoice): Promise<ModelStatus> {
    const d = DESCRIPTORS[choice]
    try {
      if (this.modelId && this.loadedChoice !== choice) {
        await unloadModel({ modelId: this.modelId }).catch(() => {})
        this.modelId = null
        this.loadedChoice = null
      }

      this.update({ choice, phase: 'checking', error: undefined, totalBytes: d.expectedSize })
      const cached = findCachedFile(choice) !== null
      if (!cached) {
        this.update({ fit: await this.assessFit(d) })

        this.update({ phase: 'downloading', downloadPercent: 0, downloadedBytes: 0 })
        const op = downloadAsset({
          assetSrc: d,
          onProgress: (p) =>
            this.update({
              downloadPercent: Math.round(p.percentage * 10) / 10,
              downloadedBytes: p.downloaded,
              totalBytes: p.total || d.expectedSize
            })
        })
        this.downloadRequestId = op.requestId
        await op
        this.downloadRequestId = null
      }

      this.update({ phase: 'loading', cached: true, downloadPercent: 100 })
      this.modelId = await loadModel({
        // All MedPsy descriptors share the llamacpp-completion engine; narrow for overload resolution.
        modelSrc: d as typeof HEALTHCARE_4B_MEDICAL_Q4_K_M,
        modelConfig: {
          device: this.status.device,
          ctx_size: CTX_SIZE,
          verbosity: VERBOSITY.ERROR
        }
      })
      this.loadedChoice = choice
      this.update({ phase: 'ready' })
    } catch (err) {
      this.downloadRequestId = null
      const message = err instanceof Error ? err.message : String(err)
      const cancelled = /cancel/i.test(message)
      this.update({ phase: cancelled ? 'idle' : 'error', error: cancelled ? undefined : message })
    }
    return this.getStatus()
  }

  private async assessFit(d: Descriptor): Promise<ModelStatus['fit']> {
    try {
      const r = await assessModelFit({
        models: [
          {
            model: {
              name: d.name,
              sha256Checksum: d.sha256Checksum,
              registryPath: d.registryPath,
              registrySource: d.registrySource
            },
            workload: { kind: 'llm', contextTokens: CTX_SIZE }
          }
        ],
        execution: 'sequential',
        policy: 'interactive-v1'
      })
      return { verdict: r.verdict, detail: r.reasons.join(' ') }
    } catch (err) {
      return { verdict: 'unknown', detail: err instanceof Error ? err.message : String(err) }
    }
  }

  async cancelDownload(): Promise<void> {
    if (this.downloadRequestId) await cancel({ requestId: this.downloadRequestId })
  }

  async deleteModel(choice: ModelChoice): Promise<void> {
    if (this.loadedChoice === choice && this.modelId) {
      await unloadModel({ modelId: this.modelId }).catch(() => {})
      this.modelId = null
      this.loadedChoice = null
      this.update({ phase: 'idle' })
    }
    const file = findCachedFile(choice)
    if (file) unlinkSync(file)
    this.update({ cached: findCachedFile(this.status.choice) !== null })
  }

  async shutdown(): Promise<void> {
    try {
      if (this.modelId) await unloadModel({ modelId: this.modelId })
    } finally {
      this.modelId = null
      await close().catch(() => {})
    }
  }
}

export const modelManager = new ModelManager()
