// Preload for the video capture: gives the real renderer a window.digipat backed by the
// recorded session (video/recording.json), with streaming driven step by step from main.cjs.
const { readFileSync, readdirSync } = require('fs')
const { join } = require('path')

const ROOT = join(__dirname, '..', '..')
const rec = JSON.parse(readFileSync(join(ROOT, 'video', 'recording.json'), 'utf8'))
const stations = readdirSync(join(ROOT, 'stations'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(ROOT, 'stations', f), 'utf8')))
const byId = (id) => stations.find((s) => s.id === id)

const summarize = (s) => ({
  id: s.id,
  title: s.title,
  specialty: s.specialty,
  stationType: s.stationType,
  difficulty: s.difficulty,
  timing: s.timing,
  sensitiveTopic: s.safety.sensitiveTopic,
  bundled: true
})

const settings = { acceptedDisclaimerVersion: 1, model: 'medpsy-4b-q4', stationSecondsOverride: null, skipReadingTime: true, voiceInput: true, appearance: 'dark' }
const model = { phase: 'ready', choice: 'medpsy-4b-q4', downloadPercent: 100, downloadedBytes: 2.7e9, totalBytes: 2.7e9, cached: true, device: 'gpu', hardware: { cpu: 'Apple Silicon', memoryGb: 16, appleSilicon: true } }
const voice = { phase: 'ready', modelName: 'Parakeet Unified 0.6B', sizeBytes: 741e6, downloadPercent: 100, downloadedBytes: 741e6, totalBytes: 741e6, cached: true }

const patientCbs = new Set()
let transcribeResolve = null
const emit = (e) => patientCbs.forEach((cb) => cb(window.__video.sessionId, e))

window.__video = {
  sessionId: 'video',
  rec,
  emit,
  /** Resolves the pending dictation with the text Parakeet heard. */
  finishTranscribe: () => transcribeResolve && transcribeResolve(rec.question)
}

// A silent synthetic microphone, so the real recorder UI runs without a device.
navigator.mediaDevices.getUserMedia = async () => {
  const ctx = new AudioContext()
  const osc = ctx.createOscillator()
  const dst = ctx.createMediaStreamDestination()
  osc.connect(dst)
  osc.start()
  return dst.stream
}

window.digipat = {
  getSettings: async () => settings,
  updateSettings: async (p) => Object.assign(settings, p),
  getModelOptions: async () => [],
  getModelStatus: async () => model,
  prepareModel: async () => model,
  cancelDownload: async () => {},
  deleteModel: async () => {},
  onModelStatus: () => () => {},
  getVoiceStatus: async () => voice,
  prepareVoice: async () => voice,
  cancelVoiceDownload: async () => {},
  deleteVoiceModel: async () => {},
  onVoiceStatus: () => () => {},
  requestMicrophone: async () => true,
  transcribe: () => new Promise((r) => (transcribeResolve = r)),
  listStations: async () => stations.map(summarize),
  getStation: async (id) => ({ station: byId(id), bundled: true }),
  saveStation: async (s) => ({ ok: true, station: s }),
  deleteStation: async () => {},
  validateStation: async (s) => ({ ok: true, station: s }),
  importStationFile: async () => null,
  exportStationFile: async () => false,
  startSession: async () => ({ ...rec.record, feedback: null, transcript: [], startedAt: Date.now(), endedAt: null }),
  sendToPatient: async () => emit({ type: 'thinking' }),
  onPatientStream: (cb) => (patientCbs.add(cb), () => patientCbs.delete(cb)),
  interruptPatient: async () => {},
  examine: async () => null,
  investigate: async () => null,
  endEncounter: async () => rec.record,
  submitAnswers: async () => rec.record,
  generateFeedback: async () => rec.record.feedback,
  onFeedbackProgress: () => () => {},
  listSessions: async () => [],
  getSession: async () => rec.record,
  deleteSession: async () => {},
  exportSession: async () => false,
  openExternal: async () => {},
  appInfo: async () => ({ version: '0.1.0', modelsDir: '~/.qvac/models', dataDir: '' })
}
