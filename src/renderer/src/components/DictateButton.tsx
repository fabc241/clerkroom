import { useCallback, useEffect, useRef, useState } from 'react'
import { MAX_RECORDING_SEC } from '@shared/voice'
import { describeRecordingError, startRecording, type Recording } from '../lib/recorder'
import { formatClock } from '../lib/format'
import { Icon, TypingDots } from './ui'

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
      if (!(await window.clerkroom.requestMicrophone())) throw new DOMException('Microphone denied', 'NotAllowedError')
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
      const text = await window.clerkroom.transcribe(await r.stop())
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
        className={`btn border-bad bg-rose text-bad ${base}`}
        onClick={() => void stop()}
        aria-label="Stop recording and transcribe"
        aria-pressed
      >
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-bad" aria-hidden />
        <span className="num">{formatClock(elapsed)}</span>
        Stop
      </button>
    )
  }

  const busy = state !== 'idle'
  return (
    <button
      type="button"
      className={`btn ${base}`}
      disabled={busy || !props.ready || props.disabled}
      onClick={() => void start()}
      aria-label="Dictate"
      title={
        props.ready
          ? `Dictate (up to ${MAX_RECORDING_SEC} seconds). Speech is transcribed on this Mac; you can edit the text before sending.`
          : 'The voice model is still loading.'
      }
    >
      {state === 'transcribing' ? (
        <>
          <TypingDots label="Transcribing" />
        </>
      ) : (
        <Icon name="mic" className="h-5 w-5" />
      )}
    </button>
  )
}
