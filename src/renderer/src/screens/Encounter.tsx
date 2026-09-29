import { useCallback, useEffect, useRef, useState } from 'react'
import type { Settings } from '@shared/ipcTypes'
import type { SessionRecord, TranscriptEntry } from '@shared/sessionTypes'
import type { Station } from '@shared/stationSchema'
import type { Navigate } from '../App'
import { ErrorBox, SensitiveTopicFooter, ThinkingDots } from '../components/Notices'
import { useCountdown } from '../components/useCountdown'
import { TranscriptView } from '../components/TranscriptView'
import { formatClock } from '../lib/format'

type PatientState = 'idle' | 'thinking' | 'speaking'

export function Encounter(props: {
  stationId: string
  session: SessionRecord
  settings: Settings
  navigate: Navigate
}): React.JSX.Element {
  const [station, setStation] = useState<Station | null>(null)
  useEffect(() => {
    window.digipat.getStation(props.stationId).then((r) => setStation(r?.station ?? null))
  }, [props.stationId])
  if (!station) return <div className="p-8 text-sm text-stone-500">Loading…</div>
  return <EncounterInner {...props} station={station} />
}

function EncounterInner({
  station,
  session,
  settings,
  navigate
}: {
  station: Station
  session: SessionRecord
  settings: Settings
  navigate: Navigate
}): React.JSX.Element {
  const stationSec = settings.stationSecondsOverride ?? station.timing.stationSec
  // Time already elapsed (e.g. startSession round-trip) counts against the clock.
  const initialSec = Math.max(0, stationSec - (Date.now() - session.startedAt) / 1000)

  const [transcript, setTranscript] = useState<TranscriptEntry[]>(session.transcript)
  const [patientState, setPatientState] = useState<PatientState>('idle')
  const [pending, setPending] = useState('')
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ended, setEnded] = useState(false)
  const [showBrief, setShowBrief] = useState(true)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const finish = useCallback(
    async (reason: 'time' | 'candidate') => {
      if (ended) return
      setEnded(true)
      await window.digipat.endEncounter(session.id, reason)
      if (station.postEncounterQuestions.length > 0) {
        navigate({ name: 'post', stationId: station.id, sessionId: session.id })
      } else {
        navigate({ name: 'feedback', sessionId: session.id })
      }
    },
    [ended, navigate, session.id, station]
  )

  const remaining = useCountdown(initialSec, () => void finish('time'))

  useEffect(() => {
    return window.digipat.onPatientStream((id, e) => {
      if (id !== session.id) return
      if (e.type === 'thinking') setPatientState('thinking')
      else if (e.type === 'delta') {
        setPatientState('speaking')
        setPending((p) => p + e.text)
      } else if (e.type === 'done') {
        // The final text is authoritative (it may have been corrected by the character guard).
        if (e.text) setTranscript((t) => [...t, { kind: 'patient', text: e.text, at: Date.now() }])
        setPending('')
        setPatientState('idle')
        setTimeout(() => inputRef.current?.focus(), 0)
      } else if (e.type === 'error') {
        setError(e.message)
        setPending('')
        setPatientState('idle')
      }
    })
  }, [session.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript, pending, patientState])

  const busy = patientState !== 'idle'

  const send = async (): Promise<void> => {
    const text = input.trim()
    if (!text || busy || ended) return
    setError(null)
    setInput('')
    setTranscript((t) => [...t, { kind: 'candidate', text, at: Date.now() }])
    setPatientState('thinking')
    try {
      await window.digipat.sendToPatient(session.id, text)
    } catch (e) {
      setError((e as Error).message)
      setPatientState('idle')
    }
  }

  const act = async (fn: () => Promise<TranscriptEntry>): Promise<void> => {
    try {
      const entry = await fn()
      setTranscript((t) => [...t, entry])
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const done = (kind: 'exam' | 'investigation', key: string): boolean =>
    transcript.some((e) => (kind === 'exam' ? e.kind === 'exam' && e.system === key : e.kind === 'investigation' && e.test === key))

  const lowTime = remaining <= 60

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-4 border-b border-stone-200 px-6 py-3 dark:border-stone-800">
        <div className="min-w-0">
          <div className="truncate font-medium">{station.title}</div>
          <div className="text-xs text-stone-500">
            Patient: {station.patient.name}, {station.patient.age}
          </div>
        </div>
        <div
          className={`ml-auto rounded-lg px-3 py-1 font-mono text-xl tabular-nums ${
            lowTime ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-stone-100 dark:bg-stone-800'
          }`}
          aria-live="polite"
        >
          {formatClock(remaining)}
        </div>
        {confirmEnd ? (
          <div className="flex items-center gap-2">
            <span className="text-sm">End the station now?</span>
            <button className="btn-danger" onClick={() => finish('candidate')}>
              End
            </button>
            <button className="btn-secondary" onClick={() => setConfirmEnd(false)}>
              Continue
            </button>
          </div>
        ) : (
          <button className="btn-secondary" disabled={ended} onClick={() => setConfirmEnd(true)}>
            End station
          </button>
        )}
      </div>
      {lowTime && remaining > 0 && (
        <div className="bg-red-50 px-6 py-1.5 text-center text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
          One minute remaining — start closing the consultation.
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="selectable flex-1 overflow-y-auto px-6 py-4">
            {transcript.length === 0 && (
              <p className="mt-8 text-center text-sm text-stone-500">
                The patient is waiting. Start by introducing yourself.
              </p>
            )}
            <TranscriptView transcript={transcript} />
            {busy && (
              <div className="mt-3 flex justify-start">
                <div className="max-w-[75%] rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-sm shadow-sm dark:bg-stone-800">
                  {pending ? pending : <span className="text-stone-400"><ThinkingDots /></span>}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          {error && (
            <div className="px-6 pb-2">
              <ErrorBox message={error} />
            </div>
          )}
          <div className="border-t border-stone-200 px-6 py-3 dark:border-stone-800">
            <div className="flex gap-3">
              <textarea
                ref={inputRef}
                autoFocus
                rows={2}
                className="input flex-1 resize-none"
                placeholder={ended ? 'The station has ended.' : 'What do you say to the patient? (Enter to send, Shift+Enter for a new line)'}
                value={input}
                disabled={ended}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void send()
                  }
                }}
              />
              {busy ? (
                <button className="btn-secondary self-end" onClick={() => window.digipat.interruptPatient(session.id)}>
                  Stop
                </button>
              ) : (
                <button className="btn-primary self-end" disabled={!input.trim() || ended} onClick={send}>
                  Send
                </button>
              )}
            </div>
          </div>
        </section>

        <aside className="w-80 shrink-0 space-y-5 overflow-y-auto border-l border-stone-200 p-4 dark:border-stone-800">
          <div>
            <button className="label flex w-full justify-between" onClick={() => setShowBrief((v) => !v)}>
              <span>Candidate instructions</span>
              <span>{showBrief ? '−' : '+'}</span>
            </button>
            {showBrief && <p className="selectable text-sm leading-relaxed">{station.candidateBrief}</p>}
          </div>
          {station.examFindings.length > 0 && (
            <div>
              <div className="label">Examine</div>
              <div className="flex flex-wrap gap-1.5">
                {station.examFindings.map((f) => (
                  <button
                    key={f.system}
                    className="btn-secondary px-2.5 py-1 text-xs"
                    disabled={ended || done('exam', f.system)}
                    onClick={() => act(() => window.digipat.examine(session.id, f.system))}
                  >
                    {f.system}
                  </button>
                ))}
              </div>
            </div>
          )}
          {station.investigations.length > 0 && (
            <div>
              <div className="label">Investigations</div>
              <div className="flex flex-wrap gap-1.5">
                {station.investigations.map((i) => (
                  <button
                    key={i.test}
                    className="btn-secondary px-2.5 py-1 text-xs"
                    disabled={ended || done('investigation', i.test)}
                    onClick={() => act(() => window.digipat.investigate(session.id, i.test))}
                  >
                    {i.test}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-stone-500">
            Findings and results are scripted by the station author, not generated by the AI. Your requests are
            recorded and considered in the feedback.
          </p>
        </aside>
      </div>
      {station.safety.sensitiveTopic && <SensitiveTopicFooter />}
    </div>
  )
}
