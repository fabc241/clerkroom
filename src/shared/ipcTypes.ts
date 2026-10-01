import type { Feedback, SessionListItem, SessionRecord, TranscriptEntry } from './sessionTypes'
import type { Station, StationSummary } from './stationSchema'

export type ModelChoice = 'medpsy-4b-q4' | 'medpsy-4b-q5' | 'medpsy-1.7b-q4'

export interface ModelOption {
  id: ModelChoice
  label: string
  sizeBytes: number
  note: string
}

export type ModelPhase =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'loading'
  | 'ready'
  | 'error'

export interface ModelStatus {
  phase: ModelPhase
  choice: ModelChoice
  downloadPercent: number
  downloadedBytes: number
  totalBytes: number
  cached: boolean
  device: 'gpu' | 'cpu'
  error?: string
  fit?: { verdict: string; detail: string }
  hardware?: { cpu: string; memoryGb: number; appleSilicon: boolean }
}

export interface Settings {
  acceptedDisclaimerVersion: number
  model: ModelChoice
  stationSecondsOverride: number | null
  skipReadingTime: boolean
  /** Optional dictation with the local Parakeet speech-to-text model. Off until the user enables it. */
  voiceInput: boolean
  /** Light or dark appearance, or follow macOS. */
  appearance: Appearance
}

export type Appearance = 'system' | 'light' | 'dark'

export type VoicePhase = 'idle' | 'downloading' | 'loading' | 'ready' | 'error'

export interface VoiceStatus {
  phase: VoicePhase
  modelName: string
  sizeBytes: number
  downloadPercent: number
  downloadedBytes: number
  totalBytes: number
  cached: boolean
  error?: string
}

export type PatientStreamEvent =
  | { type: 'thinking' }
  | { type: 'delta'; text: string }
  | { type: 'done'; text: string; disclosedTopics: string[] }
  | { type: 'error'; message: string }

export type FeedbackProgress = { step: string; done: number; total: number }

export type ImportResult =
  | { ok: true; station: Station }
  | { ok: false; errors: string[] }

/** API exposed on window.clerkroom by the preload script. */
export interface ClerkroomApi {
  // Settings
  getSettings(): Promise<Settings>
  updateSettings(patch: Partial<Settings>): Promise<Settings>

  // Model
  getModelOptions(): Promise<ModelOption[]>
  getModelStatus(): Promise<ModelStatus>
  prepareModel(): Promise<ModelStatus>
  cancelDownload(): Promise<void>
  deleteModel(choice: ModelChoice): Promise<void>
  onModelStatus(cb: (s: ModelStatus) => void): () => void

  // Voice input (speech-to-text)
  getVoiceStatus(): Promise<VoiceStatus>
  prepareVoice(): Promise<VoiceStatus>
  cancelVoiceDownload(): Promise<void>
  deleteVoiceModel(): Promise<void>
  onVoiceStatus(cb: (s: VoiceStatus) => void): () => void
  /** Asks macOS for microphone access if needed; resolves false if the user has denied it. */
  requestMicrophone(): Promise<boolean>
  /** Transcribes 16 kHz mono s16le PCM. Resolves '' when no speech was detected. */
  transcribe(pcm: Uint8Array): Promise<string>

  // Stations
  listStations(): Promise<StationSummary[]>
  getStation(id: string): Promise<{ station: Station; bundled: boolean } | null>
  saveStation(station: unknown): Promise<ImportResult>
  deleteStation(id: string): Promise<void>
  validateStation(station: unknown): Promise<ImportResult>
  importStationFile(): Promise<ImportResult | null>
  exportStationFile(id: string): Promise<boolean>

  // Encounter
  startSession(stationId: string): Promise<SessionRecord>
  sendToPatient(sessionId: string, text: string): Promise<void>
  onPatientStream(cb: (sessionId: string, e: PatientStreamEvent) => void): () => void
  interruptPatient(sessionId: string): Promise<void>
  examine(sessionId: string, system: string): Promise<TranscriptEntry>
  investigate(sessionId: string, test: string): Promise<TranscriptEntry>
  endEncounter(sessionId: string, reason: 'time' | 'candidate'): Promise<SessionRecord>
  submitAnswers(
    sessionId: string,
    answers: { question: string; answer: string }[]
  ): Promise<SessionRecord>
  generateFeedback(sessionId: string): Promise<Feedback>
  onFeedbackProgress(cb: (sessionId: string, p: FeedbackProgress) => void): () => void

  // History
  listSessions(): Promise<SessionListItem[]>
  getSession(id: string): Promise<SessionRecord | null>
  deleteSession(id: string): Promise<void>
  exportSession(id: string, format: 'json' | 'md'): Promise<boolean>

  // Misc
  openExternal(url: 'licence-qvac' | 'licence-medpsy' | 'crisis-info'): Promise<void>
  appInfo(): Promise<{ version: string; modelsDir: string; dataDir: string }>
}
