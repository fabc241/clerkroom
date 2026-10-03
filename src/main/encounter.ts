import { randomUUID } from 'crypto'
import { existsSync, readdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import type { Station } from '@shared/stationSchema'
import type { Feedback, SessionRecord, TranscriptEntry } from '@shared/sessionTypes'
import type { FeedbackProgress, PatientStreamEvent } from '@shared/ipcTypes'
import { modelManager } from './qvac/modelManager'
import {
  CACHE_KEY_PREFIX,
  dropSessionCache,
  runPatientTurn,
  sessionCacheKey,
  toPatientHistory
} from './qvac/patientEngine'
import { generateFeedback } from './qvac/examinerEngine'
import { cancelRun } from './qvac/streamUtils'
import type { SessionStore } from './store/sessionStore'
import type { StationStore } from './store/stationStore'

/** Grace period after the station clock runs out, to absorb renderer/main timer drift. */
const DEADLINE_GRACE_MS = 5_000
const MAX_CANDIDATE_CHARS = 2_000

interface LiveSession {
  record: SessionRecord
  station: Station
  deadline: number
  busy: boolean
}

export class EncounterService {
  private live = new Map<string, LiveSession>()

  constructor(
    private readonly stations: StationStore,
    private readonly sessions: SessionStore,
    private readonly stationSeconds: () => number | null
  ) {}

  start(stationId: string): SessionRecord {
    const found = this.stations.get(stationId)
    if (!found) throw new Error(`Station not found: ${stationId}`)
    const { station } = found
    const record: SessionRecord = {
      id: randomUUID(),
      stationId: station.id,
      stationTitle: station.title,
      stationVersion: station.version,
      startedAt: Date.now(),
      endedAt: null,
      transcript: [],
      disclosedTopics: [],
      postAnswers: [],
      feedback: null
    }
    const seconds = this.stationSeconds() ?? station.timing.stationSec
    this.live.set(record.id, {
      record,
      station,
      deadline: record.startedAt + seconds * 1000 + DEADLINE_GRACE_MS,
      busy: false
    })
    this.sessions.save(record)
    return record
  }

  /** The station a session is running. */
  stationOf(id: string): Station {
    return this.getLive(id).station
  }

  /** True if the patient said exactly this in the session, so only real replies can be read aloud again. */
  isPatientReply(id: string, text: unknown): boolean {
    return typeof text === 'string' && this.getLive(id).record.transcript.some((e) => e.kind === 'patient' && e.text === text)
  }

  private getLive(id: string): LiveSession {
    const s = this.live.get(id) ?? this.rehydrate(id)
    if (!s) throw new Error('Session is not active.')
    return s
  }

  /** Restores a saved session (e.g. after an app restart) as ended, so feedback can still be generated. */
  private rehydrate(id: string): LiveSession | null {
    const record = this.sessions.get(id)
    const found = record && this.stations.get(record.stationId)
    if (!record || !found) return null
    if (record.endedAt === null) record.endedAt = Date.now()
    const s: LiveSession = { record, station: found.station, deadline: 0, busy: false }
    this.live.set(id, s)
    return s
  }

  private assertOpen(s: LiveSession): void {
    if (s.record.endedAt !== null) throw new Error('This station has ended.')
    if (Date.now() > s.deadline) throw new Error('Station time is up.')
  }

  async sendToPatient(id: string, text: string, emit: (e: PatientStreamEvent) => void): Promise<void> {
    const s = this.getLive(id)
    this.assertOpen(s)
    if (s.busy) throw new Error('The patient is still answering.')
    const clean = text.trim().slice(0, MAX_CANDIDATE_CHARS)
    if (!clean) return
    s.busy = true
    try {
      s.record.transcript.push({ kind: 'candidate', text: clean, at: Date.now() })
      const history = toPatientHistory(s.station, s.record.transcript)
      const result = await runPatientTurn({
        modelId: modelManager.readyModelId,
        station: s.station,
        history,
        key: id,
        cacheKey: sessionCacheKey(id),
        onThinking: () => emit({ type: 'thinking' }),
        onDelta: (t) => emit({ type: 'delta', text: t })
      })
      if (result.cancelled) {
        s.record.transcript.push({ kind: 'system', text: 'Patient reply interrupted.', at: Date.now() })
      } else {
        s.record.transcript.push({ kind: 'patient', text: result.text, at: Date.now() })
        for (const t of result.disclosed) {
          if (!s.record.disclosedTopics.includes(t)) s.record.disclosedTopics.push(t)
        }
      }
      this.sessions.save(s.record)
      emit({ type: 'done', text: result.text, disclosedTopics: s.record.disclosedTopics })
    } catch (err) {
      emit({ type: 'error', message: err instanceof Error ? err.message : String(err) })
    } finally {
      s.busy = false
    }
  }

  async interrupt(id: string): Promise<void> {
    await cancelRun(id)
  }

  examine(id: string, system: string): TranscriptEntry {
    const s = this.getLive(id)
    this.assertOpen(s)
    const f = s.station.examFindings.find((x) => x.system === system)
    if (!f) throw new Error(`No findings for "${system}"`)
    const entry: TranscriptEntry = { kind: 'exam', system: f.system, finding: f.finding, at: Date.now() }
    s.record.transcript.push(entry)
    this.sessions.save(s.record)
    return entry
  }

  investigate(id: string, test: string): TranscriptEntry {
    const s = this.getLive(id)
    this.assertOpen(s)
    const inv = s.station.investigations.find((x) => x.test === test)
    if (!inv) throw new Error(`No result for "${test}"`)
    const entry: TranscriptEntry = { kind: 'investigation', test: inv.test, result: inv.result, at: Date.now() }
    s.record.transcript.push(entry)
    this.sessions.save(s.record)
    return entry
  }

  async end(id: string, reason: 'time' | 'candidate'): Promise<SessionRecord> {
    const s = this.getLive(id)
    if (s.record.endedAt === null) {
      await cancelRun(id)
      s.record.endedAt = Date.now()
      s.record.transcript.push({
        kind: 'system',
        text: reason === 'time' ? 'Station time ended.' : 'Candidate ended the station.',
        at: s.record.endedAt
      })
      this.sessions.save(s.record)
      // The patient KV cache (~100+ MB) is no longer needed once the encounter is over.
      await dropSessionCache(sessionCacheKey(id))
    }
    return s.record
  }

  submitAnswers(id: string, answers: { question: string; answer: string }[]): SessionRecord {
    const s = this.getLive(id)
    const valid = new Set(s.station.postEncounterQuestions.map((q) => q.q))
    s.record.postAnswers = answers
      .filter((a) => valid.has(a.question))
      .map((a) => ({ question: a.question, answer: a.answer.slice(0, 4000) }))
    this.sessions.save(s.record)
    return s.record
  }

  async feedback(id: string, onProgress: (p: FeedbackProgress) => void): Promise<Feedback> {
    const s = this.getLive(id)
    if (s.record.endedAt === null) await this.end(id, 'candidate')
    const fb = await generateFeedback({
      modelId: modelManager.readyModelId,
      modelName: modelManager.modelName,
      station: s.station,
      record: s.record,
      key: `${id}:examiner`,
      onProgress
    })
    s.record.feedback = fb
    this.sessions.save(s.record)
    this.live.delete(id)
    return fb
  }
}

/** Removes KV caches left behind by sessions that never ended cleanly (e.g. app crash). */
export async function cleanupStaleSessionCaches(): Promise<void> {
  const dir = join(homedir(), '.qvac', 'kv-cache')
  if (!existsSync(dir)) return
  for (const name of readdirSync(dir)) {
    if (name.startsWith(CACHE_KEY_PREFIX)) await dropSessionCache(name)
  }
}
