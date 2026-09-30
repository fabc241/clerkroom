/*
 * Development-only stand-in for the Electron preload API, so the renderer can be previewed in a
 * plain browser (`npx electron-vite dev --rendererOnly`). It is imported only when
 * import.meta.env.DEV is true and window.digipat is missing, so it never ships in the app.
 * All data here is synthetic.
 */
import type { DigiPatApi, FeedbackProgress, ModelStatus, PatientStreamEvent, Settings, VoiceStatus } from '@shared/ipcTypes'
import type { Feedback, SessionListItem, SessionRecord, TranscriptEntry } from '@shared/sessionTypes'
import { stationSchema, summarize, type Station } from '@shared/stationSchema'
import { feedbackResult } from '@shared/rubric'

const files = import.meta.glob('../../../../stations/*.json', { eager: true, import: 'default' })
const stations: Station[] = Object.values(files).map((d) => stationSchema.parse(d))
const byId = (id: string): Station => stations.find((s) => s.id === id) ?? stations[0]

let settings: Settings = {
  acceptedDisclaimerVersion: new URLSearchParams(location.search).has('onboarding') ? 0 : 1,
  model: 'medpsy-4b-q4',
  stationSecondsOverride: null,
  skipReadingTime: false,
  voiceInput: true,
  appearance: 'system'
}

const model: ModelStatus = {
  phase: 'ready',
  choice: 'medpsy-4b-q4',
  downloadPercent: 100,
  downloadedBytes: 2.7e9,
  totalBytes: 2.7e9,
  cached: true,
  device: 'gpu',
  hardware: { cpu: 'Apple M3 Pro', memoryGb: 18, appleSilicon: true }
}
const voice: VoiceStatus = {
  phase: 'ready',
  modelName: 'Parakeet Unified 0.6B',
  sizeBytes: 741e6,
  downloadPercent: 100,
  downloadedBytes: 741e6,
  totalBytes: 741e6,
  cached: true
}

const t0 = Date.now() - 3 * 86400_000
const transcript: TranscriptEntry[] = [
  { kind: 'candidate', text: "Hello Mr Baker, I'm Dr Rossi, one of the junior doctors. Is it all right if we talk in here? Would you like anyone with you?", at: t0 + 4_000 },
  { kind: 'patient', text: "No, it's fine. My wife's parking the car. Have you got my scan results?", at: t0 + 12_000 },
  { kind: 'candidate', text: 'Before I go through them, can you tell me what you understand about why you had the MRI?', at: t0 + 31_000 },
  { kind: 'patient', text: 'They said my vision going blurry and the tingling might be something with my nerves. I keep thinking it could be a tumour.', at: t0 + 44_000 },
  { kind: 'candidate', text: "I'm afraid the results aren't what we'd hoped for.", at: t0 + 70_000 },
  { kind: 'patient', text: 'Right… go on.', at: t0 + 76_000 },
  { kind: 'exam', system: 'Eyes', finding: 'Mild pallor of the right optic disc. Visual acuity 6/9 right, 6/6 left.', at: t0 + 90_000 },
  { kind: 'candidate', text: 'The scan shows changes in the brain and spinal cord that fit with multiple sclerosis. It is not a tumour.', at: t0 + 118_000 },
  { kind: 'patient', text: 'MS? Does that mean I’ll end up in a wheelchair? I drive for work.', at: t0 + 131_000 },
  { kind: 'system', text: 'Candidate ended the station.', at: t0 + 480_000 }
]

const feedback: Feedback = {
  items: [
    { itemId: 'setting', domain: 'interpersonal', text: "Introduces self, ensures privacy and asks if he'd like someone with him", weight: 1, met: 'yes', evidenceQuote: "Is it all right if we talk in here? Would you like anyone with you?", evidenceTurn: 0, comment: 'You checked privacy and offered support before starting.', downgraded: false },
    { itemId: 'perception', domain: 'dataGathering', text: 'Establishes what he knows and understands so far', weight: 2, met: 'yes', evidenceQuote: 'can you tell me what you understand about why you had the MRI?', evidenceTurn: 2, comment: 'You asked for his understanding before giving news.', downgraded: false },
    { itemId: 'invitation', domain: 'interpersonal', text: 'Checks how much information he wants', weight: 1, met: 'no', evidenceQuote: '', evidenceTurn: null, comment: 'You did not ask how much detail he wanted.', downgraded: false },
    { itemId: 'warning-shot', domain: 'interpersonal', text: 'Gives a warning shot before the news', weight: 2, met: 'yes', evidenceQuote: "I'm afraid the results aren't what we'd hoped for.", evidenceTurn: 4, comment: 'A clear warning shot.', downgraded: false },
    { itemId: 'clear-news', domain: 'clinicalManagement', text: 'Explains the diagnosis clearly and simply, without jargon', weight: 3, met: 'yes', critical: true, evidenceQuote: 'changes in the brain and spinal cord that fit with multiple sclerosis', evidenceTurn: 7, comment: 'You named the diagnosis plainly and addressed the tumour fear.', downgraded: false },
    { itemId: 'silence', domain: 'interpersonal', text: 'Allows silence and responds to emotion with empathy', weight: 3, met: 'no', evidenceQuote: 'Right… go on.', evidenceTurn: null, comment: 'Not credited: the examiner could not point to anything you said or did for this item.', downgraded: true },
    { itemId: 'concerns', domain: 'dataGathering', text: 'Explores his specific concerns (wheelchair, job, family)', weight: 2, met: 'partial', evidenceQuote: '', evidenceTurn: null, comment: 'He raised the wheelchair and driving; explore them before moving on.', downgraded: false },
    { itemId: 'accurate-hope', domain: 'clinicalManagement', text: 'Gives realistic hope: variable course, treatments available, many people live full lives', weight: 2, met: 'no', evidenceQuote: '', evidenceTurn: null, comment: 'No realistic hope was offered.', downgraded: false },
    { itemId: 'plan', domain: 'clinicalManagement', text: 'Outlines next steps and support (specialist nurse, information, follow-up)', weight: 2, met: 'no', evidenceQuote: '', evidenceTurn: null, comment: 'You did not say what happens next.', downgraded: false },
    { itemId: 'check', domain: 'interpersonal', text: 'Summarises, checks understanding and invites questions', weight: 1, met: 'no', evidenceQuote: '', evidenceTurn: null, comment: 'You ended without summarising.', downgraded: false }
  ],
  answers: [
    { question: 'Which framework can structure breaking bad news, and what are its steps?', answer: 'SPIKES: setting, perception, invitation, knowledge, emotions, strategy and summary.', modelAnswer: 'SPIKES — Setting, Perception, Invitation, Knowledge, Emotions/Empathy, Strategy & Summary.', keyPointsHit: ['SPIKES', 'Setting', 'Perception', 'Invitation', 'Knowledge'], keyPointsMissed: ['Emotions / empathy'], comment: 'Complete framework; name the empathy step explicitly.' },
    { question: 'What would the ongoing plan for this patient include?', answer: 'Refer to neurology.', modelAnswer: 'Neurology follow-up, MS specialist nurse, written information, DVLA advice, disease-modifying therapy discussion.', keyPointsHit: ['Neurology follow-up'], keyPointsMissed: ['MS specialist nurse', 'Written information', 'DVLA advice', 'Disease-modifying therapy'], comment: 'Only one element of the plan.' }
  ],
  domainScores: [
    { domain: 'dataGathering', earned: 2, possible: 4, percent: 50 },
    { domain: 'clinicalManagement', earned: 3, possible: 7, percent: 43 },
    { domain: 'interpersonal', earned: 3, possible: 8, percent: 38 }
  ],
  overallPercent: 42,
  checklistPercent: 42,
  answersPercent: 45,
  result: 'fail',
  resultReasons: ['Your score of 42% is below the pass mark of 55%.'],
  globalRating: 'Borderline',
  summary:
    'You set the scene well, checked his understanding and delivered the diagnosis clearly, which is the hardest part. The consultation stopped just as he raised his biggest fears, so his concerns, realistic hope and the plan were never covered.',
  missedPoints: ['Explore his specific concerns', 'Offer realistic hope', 'Outline next steps and support'],
  practiseNext: ['After the news, pause and ask “What’s going through your mind?”', 'Rehearse a two-sentence plan: nurse, information, follow-up'],
  generatedAt: t0 + 540_000,
  modelName: 'MedPsy 4B (Q4_K_M)'
}

const record: SessionRecord = {
  id: 'demo-1',
  stationId: 'comm-breaking-bad-news-ms',
  stationTitle: byId('comm-breaking-bad-news-ms').title,
  stationVersion: 1,
  startedAt: t0,
  endedAt: t0 + 480_000,
  transcript,
  disclosedTopics: [],
  postAnswers: feedback.answers.map((a) => ({ question: a.question, answer: a.answer })),
  feedback
}

const history: SessionRecord[] = [
  record,
  ...[
    ['psych-low-mood', 71, 'pass', 'Good', 6],
    ['med-chest-pain', 64, 'fail', 'Borderline', 5],
    ['psych-low-mood', 52, 'fail', 'Borderline', 9],
    ['med-chest-pain', 0, 'fail', 'Fail', 11],
    ['psych-suicide-risk-overdose', 58, 'pass', 'Pass', 12]
  ].map(([id, pct, result, rating, daysAgo]): SessionRecord => ({
    ...record,
    id: `demo-${id}-${daysAgo}`,
    stationId: id as string,
    stationTitle: byId(id as string).title,
    startedAt: Date.now() - (daysAgo as number) * 86400_000,
    feedback: {
      ...feedback,
      overallPercent: pct as number,
      result: result as 'pass' | 'fail',
      globalRating: rating as Feedback['globalRating'],
      domainScores: feedback.domainScores.map((d, i) => ({ ...d, percent: Math.max(0, (pct as number) + (i - 1) * 9) }))
    }
  }))
]

const listeners = {
  patient: new Set<(id: string, e: PatientStreamEvent) => void>(),
  progress: new Set<(id: string, p: FeedbackProgress) => void>()
}
let demoMarked = false
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export function installMockApi(): void {
  const api: DigiPatApi = {
    getSettings: async () => settings,
    updateSettings: async (patch) => (settings = { ...settings, ...patch }),
    getModelOptions: async () => [
      { id: 'medpsy-4b-q4', label: 'MedPsy 4B (Q4_K_M) — recommended', sizeBytes: 2.7e9, note: 'Best balance of quality and speed' },
      { id: 'medpsy-4b-q5', label: 'MedPsy 4B (Q5_K_M)', sizeBytes: 3.1e9, note: 'Slightly better quality, more memory' },
      { id: 'medpsy-1.7b-q4', label: 'MedPsy 1.7B (Q4_K_M)', sizeBytes: 1.2e9, note: 'For 8 GB Macs; faster, less nuanced' }
    ],
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
    requestMicrophone: async () => false,
    transcribe: async () => '',
    listStations: async () => stations.map((s) => summarize(s, true)),
    getStation: async (id) => ({ station: byId(id), bundled: true }),
    saveStation: async (s) => ({ ok: true, station: s as Station }),
    deleteStation: async () => {},
    validateStation: async () => ({ ok: true, station: byId('psych-low-mood') }),
    importStationFile: async () => null,
    exportStationFile: async () => false,
    startSession: async (stationId) => ({
      ...record,
      id: `live-${Date.now()}`,
      stationId,
      stationTitle: byId(stationId).title,
      startedAt: Date.now() - 200_000,
      endedAt: null,
      transcript: new URLSearchParams(location.search).has('fresh') ? [] : transcript.slice(0, 9).map((e, i) => ({ ...e, at: Date.now() - (9 - i) * 20_000 })),
      feedback: null
    }),
    sendToPatient: async (id) => {
      const emit = (e: PatientStreamEvent): void => listeners.patient.forEach((cb) => cb(id, e))
      emit({ type: 'thinking' })
      await sleep(900)
      const reply = 'I suppose… what happens now? Will I be able to keep working?'
      for (const w of reply.split(' ')) {
        emit({ type: 'delta', text: `${w} ` })
        await sleep(60)
      }
      emit({ type: 'done', text: reply, disclosedTopics: [] })
    },
    onPatientStream: (cb) => {
      listeners.patient.add(cb)
      return () => listeners.patient.delete(cb)
    },
    interruptPatient: async () => {},
    examine: async (_id, system) => ({ kind: 'exam', system, finding: byId('med-chest-pain').examFindings[0]?.finding ?? 'Normal.', at: Date.now() }),
    investigate: async (_id, test) => ({ kind: 'investigation', test, result: 'Sinus rhythm, rate 88. No acute changes.', at: Date.now() }),
    endEncounter: async () => record,
    submitAnswers: async () => record,
    generateFeedback: async (id) => {
      for (let i = 0; i <= 3; i++) {
        listeners.progress.forEach((cb) => cb(id, { step: ['Marking checklist items 1–6', 'Marking checklist items 7–10', 'Marking post-station answers', 'Writing summary'][i], done: i, total: 4 }))
        await sleep(500)
      }
      demoMarked = true
      return feedback
    },
    onFeedbackProgress: (cb) => {
      listeners.progress.add(cb)
      return () => listeners.progress.delete(cb)
    },
    listSessions: async () =>
      history.map(
        (r): SessionListItem => ({
          id: r.id,
          stationId: r.stationId,
          stationTitle: r.stationTitle,
          startedAt: r.startedAt,
          overallPercent: r.feedback?.overallPercent ?? null,
          result: r.feedback ? feedbackResult(r.feedback) : null,
          globalRating: r.feedback?.globalRating ?? null,
          domainScores: r.feedback?.domainScores ?? null
        })
      ),
    getSession: async (id) => {
      const found = history.find((r) => r.id === id) ?? record
      return new URLSearchParams(location.search).has('unmarked') && !demoMarked ? { ...found, feedback: null } : found
    },
    deleteSession: async () => {},
    exportSession: async () => false,
    openExternal: async () => {},
    appInfo: async () => ({ version: '0.1.0', modelsDir: '~/.qvac/models', dataDir: '~/Library/Application Support/DigiPat' })
  } as DigiPatApi
  Object.assign(window, { digipat: api })
}
