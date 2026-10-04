import type { Settings, VoiceStatus } from '@shared/ipcTypes'
import { formatBytes } from '../lib/format'
import { Choice, Icon, TypingDots } from './ui'

/** Dictation (speech-to-text) and spoken replies (text-to-speech): their settings and model status. */
export interface VoiceKit {
  settings: Settings
  /** Parakeet, for dictating to the patient. */
  voice: VoiceStatus
  /** Supertonic, for hearing the patient's replies. */
  speech: VoiceStatus
  updateSettings: (patch: Partial<Settings>) => Promise<void>
}

export type VoiceFeature = 'dictation' | 'replies'

const SETTING = { dictation: 'voiceInput', replies: 'speakReplies' } as const

const statusOf = (kit: VoiceKit, f: VoiceFeature): VoiceStatus => (f === 'dictation' ? kit.voice : kit.speech)

export const isOn = (kit: VoiceKit, f: VoiceFeature): boolean => kit.settings[SETTING[f]]
export const isReady = (kit: VoiceKit, f: VoiceFeature): boolean => isOn(kit, f) && statusOf(kit, f).phase === 'ready'

/** Turns a feature on or off. Turning it on loads its model, downloading it first if needed. */
export async function setFeature(kit: VoiceKit, f: VoiceFeature, on: boolean): Promise<void> {
  await kit.updateSettings({ [SETTING[f]]: on })
  if (!on) return
  if (f === 'dictation') void window.clerkroom.prepareVoice()
  else void window.clerkroom.prepareSpeech()
}

/** A few words on where the model is, or null when it is ready or the feature is off. */
export function progressText(kit: VoiceKit, f: VoiceFeature): string | null {
  if (!isOn(kit, f)) return null
  const s = statusOf(kit, f)
  if (s.phase === 'downloading') return `Downloading ${formatBytes(s.totalBytes)} · ${Math.floor(s.downloadPercent)}%`
  if (s.phase === 'loading') return 'Loading…'
  if (s.phase === 'error') return s.error ? `Couldn’t load: ${s.error}` : 'Couldn’t load the model.'
  if (s.phase === 'idle') return s.cached ? 'Not loaded yet' : `Needs a one-time ${formatBytes(s.sizeBytes)} download`
  return null
}

const COPY: Record<VoiceFeature, { title: string; detail: string }> = {
  dictation: {
    title: 'Dictate my questions',
    detail: 'Speak to the patient with the microphone button. You can edit the text before sending it.'
  },
  replies: {
    title: 'Hear the patient’s replies',
    detail: 'Each reply is read aloud in the patient’s voice, and stays on screen as text.'
  }
}

/** The two voice switches, with the model's progress under each, for the station brief. */
export function VoiceSwitches({ kit }: { kit: VoiceKit }): React.JSX.Element {
  return (
    <div className="space-y-3">
      {(['dictation', 'replies'] as const).map((f) => {
        const progress = progressText(kit, f)
        const s = statusOf(kit, f)
        return (
          <Choice key={f} type="checkbox" align="start" checked={isOn(kit, f)} onChange={(on) => void setFeature(kit, f, on)}>
            <span className="block text-[15px] font-semibold text-text">{COPY[f].title}</span>
            <span className="block text-[13.5px] text-text-2">
              {COPY[f].detail}{' '}
              {!isOn(kit, f) && !s.cached && `Downloads ${formatBytes(s.sizeBytes)} once.`}
            </span>
            {progress && (
              <span className={`block text-[13.5px] ${s.phase === 'error' ? 'text-bad' : 'text-text-2'}`} role="status">
                {progress}
              </span>
            )}
            {isReady(kit, f) && (
              <span className="flex items-center gap-2 text-[13.5px] text-good">
                <span className="h-2 w-2 bg-good" aria-hidden /> Ready
              </span>
            )}
          </Choice>
        )
      })}
    </div>
  )
}

/** Speaker button beside the message box: turns spoken replies on or off. */
export function SpeakerToggle({ kit, className = '' }: { kit: VoiceKit; className?: string }): React.JSX.Element {
  const on = isOn(kit, 'replies')
  const progress = progressText(kit, 'replies')
  const busy = on && (kit.speech.phase === 'downloading' || kit.speech.phase === 'loading')
  return (
    <button
      type="button"
      className={`btn ${on ? 'border-focus text-text' : 'text-text-3'} ${className}`}
      aria-pressed={on}
      aria-label={on ? 'Spoken replies on. Turn off' : 'Hear the patient’s replies'}
      title={
        on
          ? progress
            ? `Spoken replies: ${progress}`
            : 'The patient’s replies are read aloud. Click to turn off.'
          : `Hear the patient’s replies read aloud${kit.speech.cached ? '' : ` (downloads ${formatBytes(kit.speech.sizeBytes)} once)`}`
      }
      onClick={() => void setFeature(kit, 'replies', !on)}
    >
      {busy ? <TypingDots label="Loading the speech model" /> : <Icon name={on ? 'speaker' : 'speaker-off'} className="h-5 w-5" />}
    </button>
  )
}
