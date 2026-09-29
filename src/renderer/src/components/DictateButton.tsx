import { useCallback, useEffect, useRef, useState } from 'react'
import { MAX_RECORDING_SEC } from '@shared/voice'
import { describeRecordingError, startRecording, type Recording } from '../lib/recorder'
import { formatClock } from '../lib/format'
import { ThinkingDots } from './Notices'

type DictationState = 'idle' | 'starting' | 'recording' | 'transcribing'

/**
 * Push-to-dictate: click to start recording, click again to stop. The transcript is handed to
 * `onText` for the student to review — it is never sent anywhere automatically.
 */
export function DictateButton(props: {
  /** False while the voice model is still downloading or loading. */
  ready: boolean
  disabled?: boolean
  onText: (text: string) => void
  onError: (message: string | null) => void
  className?: string
}): React.JSX.Element {
  const [state, setState] = useState<DictationState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const recording = useRef<Recording | null>(null)
  const alive = useRef(true)
  const latest = useRef(props)
  latest.current = props

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      recording.current?.cancel()
      recording.current = null
    }
  }, [])

  const start = async (): Promise<void> => {
    latest.current.onError(null)
    setState('starting')
    try {
      if (!(await window.digipat.requestMicrophone())) throw new DOMException('Microphone denied', 'NotAllowedError')
      const r = await startRecording()
      if (!alive.current) return r.cancel()
      recording.current = r
      setElapsed(0)
      setState('recording')
    } catch (err) {
      if (!alive.current) return
      setState('idle')
      latest.current.onError(describeRecordingError(err))
    }
  }

  const stop = useCallback(async (): Promise<void> => {
    const r = recording.current
    if (!r) return
    recording.current = null
    setState('transcribing')
    try {
      const text = await window.digipat.transcribe(await r.stop())
      if (!alive.current) return
      if (text) latest.current.onText(text)
      else latest.current.onError('No speech was detected. Try again, a little closer to the microphone.')
    } catch (err) {
      if (alive.current) latest.current.onError(describeRecordingError(err))
    } finally {
      if (alive.current) setState('idle')
    }
  }, [])

  useEffect(() => {
    if (state !== 'recording') return
    const startedAt = Date.now()
    const timer = setInterval(() => {
      const sec = (Date.now() - startedAt) / 1000
      setElapsed(Math.floor(sec))
      if (sec >= MAX_RECORDING_SEC) void stop()
    }, 250)
    return () => clearInterval(timer)
  }, [state, stop])

  const base = props.className ?? ''

  if (state === 'recording') {
    return (
      <button
        type="button"
        className={`btn border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-300 ${base}`}
        onClick={() => void stop()}
        aria-label="Stop recording and transcribe"
        aria-pressed
      >
        <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" />
        <span className="tabular-nums">{formatClock(elapsed)}</span>
        Stop
      </button>
    )
  }

  const busy = state !== 'idle'
  return (
    <button
      type="button"
      className={`btn-secondary ${base}`}
      disabled={busy || !props.ready || props.disabled}
      onClick={() => void start()}
      aria-label="Dictate"
      title={
        props.ready
          ? `Dictate (up to ${MAX_RECORDING_SEC} seconds). Speech is transcribed on this Mac; you can edit the text before sending.`
          : 'The voice model is not loaded yet — see Model.'
      }
    >
      {state === 'transcribing' ? (
        <>
          <ThinkingDots />
          <span className="sr-only">Transcribing</span>
        </>
      ) : (
        <MicIcon />
      )}
    </button>
  )
}

function MicIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
    </svg>
  )
}
