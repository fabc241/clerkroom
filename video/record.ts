// Records the real model output used in the demo video.
//   npx tsx video/record.ts
// 1. Parakeet transcribes the demo question (spoken by macOS `say`).
// 2. MedPsy plays David Evans through a full Chest pain consultation.
// 3. The examiner marks it. Everything is written to video/recording.json.
import { execFileSync } from 'child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { PARAKEET_UNIFIED_0_6B_Q8_0, loadModel, transcribe, unloadModel, close } from '@qvac/sdk'
import type { SessionRecord, TranscriptEntry } from '@shared/sessionTypes'
import { VOICE_SAMPLE_RATE, cleanTranscript } from '../src/shared/voice'
import { modelManager } from '../src/main/qvac/modelManager'
import { dropSessionCache, runPatientTurn, toPatientHistory } from '../src/main/qvac/patientEngine'
import { generateFeedback } from '../src/main/qvac/examinerEngine'
import { loadBundledStations } from '../tests/unit/helpers'

const QUESTION = 'Does the pain go anywhere?'

function wavData(wav: Buffer): Buffer {
  let offset = 12
  while (offset + 8 <= wav.length) {
    const id = wav.toString('ascii', offset, offset + 4)
    const size = wav.readUInt32LE(offset + 4)
    if (id === 'data') return wav.subarray(offset + 8, offset + 8 + size)
    offset += 8 + size + (size % 2)
  }
  throw new Error('No data chunk in WAV file')
}

async function heard(sentence: string): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'clerkroom-video-'))
  let pcm: Buffer
  try {
    const wavPath = join(dir, 'q.wav')
    execFileSync('say', ['-v', 'Daniel', '-r', '175', '-o', wavPath, `--data-format=LEI16@${VOICE_SAMPLE_RATE}`, sentence])
    pcm = wavData(readFileSync(wavPath))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
  const modelId = await loadModel({ modelSrc: PARAKEET_UNIFIED_0_6B_Q8_0 })
  const text = await transcribe({ modelId, audioChunk: pcm as unknown as Parameters<typeof transcribe>[0]['audioChunk'] })
  await unloadModel({ modelId })
  return cleanTranscript(text)
}

type Step = string | TranscriptEntry

const SCRIPT: Step[] = [
  "Hello Mr Evans, my name is Dr Rossi, I'm one of the junior doctors. Is it OK if I ask you some questions? What's brought you in today?",
  QUESTION,
  'I can see this is really frightening. When exactly did it start, what does it feel like, and how bad is it out of ten?',
  'Have you had any sweating, feeling sick or shortness of breath with it?',
  'Is it worse when you breathe in or move, is it a tearing pain going through to your back, and have you had any recent long trips or leg swelling?',
  'Have you had any pain like this before, for example when walking?',
  'Do you smoke, and have you ever been told you have high blood pressure, high cholesterol or diabetes?',
  'Does anyone in your family have heart problems?',
  'Do you take any medications, and do you have any allergies?',
  { kind: 'exam', system: 'Observations', finding: '', at: 0 },
  { kind: 'investigation', test: '12-lead ECG', result: '', at: 0 },
  "I know you're worried because of what happened to your dad, and I'm taking this very seriously. The heart tracing shows your heart is under strain, so I'm getting my senior doctor now, we'll give you something for the pain and some aspirin, and the heart team will likely need to open up an artery. Is that OK?"
]

const ANSWERS = [
  'An acute inferior ST-elevation myocardial infarction (inferior STEMI).',
  'Call for senior help and activate the primary PCI pathway. Give aspirin 300 mg, analgesia such as IV morphine with an antiemetic, oxygen only if hypoxic, GTN if not hypotensive, IV access, bloods and continuous monitoring.'
]

async function main(): Promise<void> {
  const station = loadBundledStations().find((s) => s.id === 'med-chest-pain')!
  const question = await heard(QUESTION)
  console.log(`Parakeet heard: ${question}`)

  const status = await modelManager.prepare('medpsy-4b-q4')
  if (status.phase !== 'ready') throw new Error(`Model not ready: ${status.error ?? status.phase}`)
  const modelId = modelManager.readyModelId

  const transcript: TranscriptEntry[] = []
  const cacheKey = `video-${Date.now()}`
  let t = Date.now()
  for (const step of SCRIPT) {
    t += 15_000
    if (typeof step !== 'string') {
      if (step.kind === 'exam') transcript.push({ ...step, finding: station.examFindings.find((f) => f.system === step.system)!.finding, at: t })
      if (step.kind === 'investigation') transcript.push({ ...step, result: station.investigations.find((i) => i.test === step.test)!.result, at: t })
      continue
    }
    const line = step === QUESTION ? question : step
    transcript.push({ kind: 'candidate', text: line, at: t })
    const r = await runPatientTurn({ modelId, station, history: toPatientHistory(station, transcript), key: 'video', cacheKey, onThinking: () => {}, onDelta: () => {} })
    t += 8_000
    transcript.push({ kind: 'patient', text: r.text, at: t })
    console.log(`D: ${line}\nP: ${r.text}`)
  }
  await dropSessionCache(cacheKey)

  const record: SessionRecord = {
    id: 'video',
    stationId: station.id,
    stationTitle: station.title,
    stationVersion: station.version,
    startedAt: transcript[0].at - 5_000,
    endedAt: t + 10_000,
    transcript,
    disclosedTopics: [],
    postAnswers: station.postEncounterQuestions.map((q, i) => ({ question: q.q, answer: ANSWERS[i] })),
    feedback: null
  }
  const feedback = await generateFeedback({ modelId, modelName: modelManager.modelName, station, record, key: 'video-exam', onProgress: (p) => console.log(`  ${p.step}`) })
  console.log(`Result: ${feedback.result} ${feedback.overallPercent}% ${feedback.globalRating}`)
  for (const i of feedback.items) console.log(`  [${i.met}] ${i.text} :: "${i.evidenceQuote}"`)
  writeFileSync(join(import.meta.dirname, 'recording.json'), JSON.stringify({ question, record: { ...record, feedback } }, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => close().catch(() => {}))
