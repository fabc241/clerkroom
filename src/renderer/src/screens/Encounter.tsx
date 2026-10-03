import { useCallback, useEffect, useRef, useState } from 'react'
import type { Settings } from '@shared/ipcTypes'
import type { SessionRecord, TranscriptEntry } from '@shared/sessionTypes'
import type { Station } from '@shared/stationSchema'
import { appendDictation } from '@shared/voice'
import type { Navigate } from '../App'
import { DictateButton } from '../components/DictateButton'
import { ErrorBox, SensitiveTopicFooter } from '../components/Notices'
import { ConsultingRoom } from '../components/Illustrations'
import { Choice, Icon, ProgressBar, TypingDots } from '../components/ui'
import { useCountdown } from '../components/useCountdown'
import { TranscriptView } from '../components/TranscriptView'
import { formatClock } from '../lib/format'
import { createPlayer, type Player } from '../lib/player'
import { SpeakerToggle, isOn, isReady, progressText, setFeature, type VoiceKit } from '../components/VoiceOptions'

type PatientState = 'idle' | 'thinking' | 'speaking'

export function Encounter(props: {
  stationId: string
  session: SessionRecord
  settings: Settings
  voice: VoiceKit
  navigate: Navigate
}): React.JSX.Element {
  const [station, setStation] = useState<Station | null>(null)
  useEffect(() => {
    window.clerkroom.getStation(props.stationId).then((r) => setStation(r?.station ?? null))
  }, [props.stationId])
  if (!station) return <div className="p-10 text-text-3">Loading…</div>
  return <EncounterInner {...props} station={station} />
}

function EncounterInner({
  station,
  session,
  settings,
  voice,
  navigate
}: {
  station: Station
  session: SessionRecord
  settings: Settings
  voice: VoiceKit
  navigate: Navigate
}): React.JSX.Element {
  const speechReady = isReady(voice, 'replies')
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

  // Spoken replies: audio for a reply is accepted only between its 'done' and its 'end', so parts of a
  // reply the student has already stopped are never played.
  const [voiceComing, setVoiceComing] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const expectAudio = useRef(false)
  const player = useRef<Player | null>(null)
  useEffect(() => {
    player.current = createPlayer(setSpeaking)
    return () => {
      player.current?.close()
      player.current = null
      if (expectAudio.current) void window.clerkroom.stopSpeaking()
    }
  }, [])
  const stopVoice = useCallback(() => {
    if (expectAudio.current) void window.clerkroom.stopSpeaking()
    expectAudio.current = false
    setVoiceComing(false)
    player.current?.stop()
  }, [])

  useEffect(() => {
    return window.clerkroom.onPatientAudio((id, e) => {
      if (id !== session.id || !expectAudio.current) return
      if (e.type === 'audio') {
        setVoiceComing(false)
        player.current?.enqueue(e.pcm, e.sampleRate)
        return
      }
      expectAudio.current = false
      setVoiceComing(false)
      if (e.type === 'error') setError(e.message)
    })
  }, [session.id])

  const finish = useCallback(
    async (reason: 'time' | 'candidate') => {
      if (ended) return
      setEnded(true)
      stopVoice()
      await window.clerkroom.endEncounter(session.id, reason)
      if (station.postEncounterQuestions.length > 0) {
        navigate({ name: 'post', stationId: station.id, sessionId: session.id })
      } else {
        navigate({ name: 'feedback', sessionId: session.id })
      }
    },
    [ended, navigate, session.id, station, stopVoice]
  )

  const remaining = useCountdown(initialSec, () => void finish('time'))

  useEffect(() => {
    return window.clerkroom.onPatientStream((id, e) => {
      if (id !== session.id) return
      if (e.type === 'thinking') setPatientState('thinking')
      else if (e.type === 'delta') {
        setPatientState('speaking')
        setPending((p) => p + e.text)
      } else if (e.type === 'done') {
        // The final text is authoritative (it may have been corrected by the character guard).
        if (e.text) setTranscript((t) => [...t, { kind: 'patient', text: e.text, at: Date.now() }])
        if (e.text && settings.speakReplies) {
          expectAudio.current = true
          setVoiceComing(true)
        }
        setPending('')
        setPatientState('idle')
        setTimeout(() => inputRef.current?.focus(), 0)
      } else if (e.type === 'error') {
        setError(e.message)
        setPending('')
        setPatientState('idle')
      }
    })
  }, [session.id, settings.speakReplies])

  // Jump to the latest line when the station opens; glide for each new line after that.
  const scrolledOnce = useRef(false)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: scrolledOnce.current ? 'smooth' : 'auto' })
    scrolledOnce.current = true
  }, [transcript, pending, patientState])

  const busy = patientState !== 'idle'

  const listen = (text: string): void => {
    stopVoice()
    expectAudio.current = true
    setVoiceComing(true)
    window.clerkroom.replayReply(session.id, text).catch((e: Error) => {
      expectAudio.current = false
      setVoiceComing(false)
      setError(e.message)
    })
  }
  // Download or loading progress for either voice feature, shown above the message box.
  const voiceProgress = (
    [
      ['Microphone', progressText(voice, 'dictation')],
      ['Patient’s voice', progressText(voice, 'replies')]
    ] as const
  ).filter(([, p]) => p)

  const send = async (): Promise<void> => {
    const text = input.trim()
    if (!text || busy || ended) return
    stopVoice()
    setError(null)
    setInput('')
    setTranscript((t) => [...t, { kind: 'candidate', text, at: Date.now() }])
    setPatientState('thinking')
    try {
      await window.clerkroom.sendToPatient(session.id, text)
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
  const usedPercent = ((stationSec - remaining) / stationSec) * 100
  const patientFirst = station.patient.name.split(' ')[0]

  const actionList = (
    kind: 'exam' | 'investigation',
    items: { key: string }[],
    run: (key: string) => Promise<TranscriptEntry>
  ): React.JSX.Element => (
    <ul className="space-y-1.5">
      {items.map(({ key }) => {
        const made = done(kind, key)
        return (
          <li key={key}>
            <Choice
              type="checkbox"
              checked={made}
              disabled={ended || made}
              onChange={() => void act(() => run(key))}
              className="text-[14px]"
            >
              <span className={made ? 'text-text' : 'text-text-2'}>{key}</span>
            </Choice>
          </li>
        )
      })}
    </ul>
  )

  return (
    <div className="flex h-full flex-col bg-canvas">
      <div className="flex items-center gap-6 border-b border-line bg-surface px-6 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[18px] font-bold text-text">{station.title}</h1>
          <div className="text-[13px] text-text-2">
            {station.patient.name}, {station.patient.age} · {station.patient.setting}
          </div>
        </div>
        <div
          className={`flex w-64 shrink-0 items-center gap-3 rounded-2xl px-3.5 py-2 ring-1 ring-inset ${
            lowTime ? 'bg-rose ring-transparent' : 'bg-surface-2 ring-line'
          }`}
        >
          <Icon name="clock" className={`h-5 w-5 shrink-0 ${lowTime ? 'text-bad' : 'text-text-2'}`} />
          <div className="flex-1">
            <div className="flex items-baseline justify-between">
              <span className="field-label">Time left</span>
              <span
                className={`num text-[22px] leading-none font-bold ${lowTime ? 'text-bad' : 'text-text'}`}
                aria-live="polite"
                aria-label={`${formatClock(remaining)} remaining`}
              >
                {formatClock(remaining)}
              </span>
            </div>
            <ProgressBar className="mt-1.5" value={usedPercent} tone={lowTime ? 'bad' : 'accent'} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {confirmEnd ? (
            <>
              <span className="text-[13.5px] text-text">End now? You can’t come back.</span>
              <button className="btn-danger" onClick={() => finish('candidate')}>
                End station
              </button>
              <button className="btn" onClick={() => setConfirmEnd(false)}>
                Keep going
              </button>
            </>
          ) : (
            <button className="btn" disabled={ended} onClick={() => setConfirmEnd(true)}>
              End station
            </button>
          )}
        </div>
      </div>
      {lowTime && remaining > 0 && (
        <div className="bg-rose px-6 py-1.5 text-center text-[13.5px] font-semibold text-text">
          One minute left. Start closing the consultation.
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-5 p-5">
        <section className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="room relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl ring-1 ring-line">
            <ConsultingRoom
              patientSex={station.patient.sex}
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[var(--scene-h)] w-full"
            />
            {/* The conversation fills the wall above the two of them; the newest lines sit just over their heads. */}
            <div
              className="room-scroll selectable relative min-h-0 flex-1 overflow-y-auto px-6 pt-10 pb-4"
              style={{ marginBottom: 'calc(var(--scene-h) * 0.72)' }}
            >
              {transcript.length === 0 && (
                <p className="mx-auto mt-8 w-fit rounded-2xl bg-surface px-4 py-2.5 text-[15px] text-text-2 shadow-card">
                  {patientFirst} is waiting. Start by introducing yourself.
                </p>
              )}
              <TranscriptView
                transcript={transcript}
                startedAt={session.startedAt}
                patientName={station.patient.name}
                onListen={speechReady && !ended ? listen : undefined}
              />
              {busy && (
                <div className="mt-3 flex justify-end">
                  <div className="max-w-[72%] text-right">
                    <div className="mb-1 px-1 text-[11.5px] font-semibold text-text-2">{patientFirst}</div>
                    <p className="bubble-them inline-block rounded-2xl bg-butter px-4 py-2.5 text-left text-[15px] leading-[1.5] text-text shadow-card">
                      {pending ? pending : <TypingDots label={`${patientFirst} is thinking`} />}
                    </p>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>
          {(speaking || (voiceComing && speechReady)) && (
            <div className="flex items-center gap-2.5 px-1 text-[13.5px] text-text-2" aria-live="polite">
              <Icon name="speaker" className="h-4 w-4 shrink-0" />
              {speaking ? `${patientFirst} is speaking` : `Preparing ${patientFirst}’s voice…`}
              <button className="btn btn-sm" onClick={stopVoice}>
                Stop
              </button>
            </div>
          )}
          {voiceProgress.map(([label, p]) => (
            <p key={label} className="px-1 text-[13.5px] text-text-2" role="status">
              {label}: {p}
            </p>
          ))}
          {error && <ErrorBox message={error} />}
          <div className="flex items-end gap-2">
            <SpeakerToggle kit={voice} className="h-12 w-12 px-0" />
            {isOn(voice, 'dictation') ? (
              <DictateButton
                className="h-12 w-12 px-0"
                ready={isReady(voice, 'dictation')}
                disabled={ended}
                onError={setError}
                onText={(t) => {
                  setInput((v) => appendDictation(v, t))
                  inputRef.current?.focus()
                }}
              />
            ) : (
              <button
                type="button"
                className="btn h-12 w-12 px-0 text-text-3"
                aria-label="Turn on dictation"
                title="Dictate your questions with the microphone"
                disabled={ended}
                onClick={() => void setFeature(voice, 'dictation', true)}
              >
                <Icon name="mic" className="h-5 w-5" />
              </button>
            )}
            <div className="relative flex-1">
              <label htmlFor="say" className="sr-only">
                Your words to {patientFirst}
              </label>
              <textarea
                id="say"
                ref={inputRef}
                autoFocus
                rows={1}
                className="field block min-h-12 resize-none py-3 pr-14 text-[15px]"
                placeholder={
                  ended
                    ? 'The station has ended.'
                    : isReady(voice, 'dictation')
                      ? `Type your response to ${patientFirst} or dictate…`
                      : `Type your response to ${patientFirst}…`
                }
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
                <button
                  className="btn-icon btn-sm absolute right-2 bottom-2 w-8"
                  aria-label="Stop the patient's reply"
                  title="Stop the reply"
                  onClick={() => window.clerkroom.interruptPatient(session.id)}
                >
                  <Icon name="stop" className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  className="btn-primary btn-sm absolute right-2 bottom-2 w-8 px-0"
                  aria-label="Send"
                  title="Send (Enter)"
                  disabled={!input.trim() || ended}
                  onClick={send}
                >
                  <Icon name="send" className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </section>

        <aside className="w-72 shrink-0 space-y-4 overflow-y-auto">
          <section className="panel p-4">
            <button
              className="flex w-full items-center justify-between"
              aria-expanded={showBrief}
              onClick={() => setShowBrief((v) => !v)}
            >
              <span className="section-title text-[14.5px]">Your task</span>
              <Icon name={showBrief ? 'chevron-up' : 'chevron-down'} className="h-4 w-4 text-text-2" />
            </button>
            {showBrief && (
              <p className="selectable mt-2.5 text-[13.5px] leading-relaxed text-text-2">{station.candidateBrief}</p>
            )}
          </section>
          {station.examFindings.length > 0 && (
            <section className="panel space-y-3 p-4">
              <h2 className="section-title flex items-center gap-2 text-[14.5px]">
                <Icon name="stethoscope" className="h-4 w-4" /> Examine
              </h2>
              {actionList(
                'exam',
                station.examFindings.map((f) => ({ key: f.system })),
                (k) => window.clerkroom.examine(session.id, k)
              )}
            </section>
          )}
          {station.investigations.length > 0 && (
            <section className="panel space-y-3 p-4">
              <h2 className="section-title flex items-center gap-2 text-[14.5px]">
                <Icon name="flask" className="h-4 w-4" /> Investigations
              </h2>
              {actionList(
                'investigation',
                station.investigations.map((i) => ({ key: i.test })),
                (k) => window.clerkroom.investigate(session.id, k)
              )}
            </section>
          )}
          <p className="px-1 text-[12.5px] leading-relaxed text-text-3">
            Findings and results are written by the station author, not generated by the AI. Each request is recorded
            and counts in the evaluation.
          </p>
        </aside>
      </div>
      {station.safety.sensitiveTopic && <SensitiveTopicFooter />}
    </div>
  )
}
