import { Icon, TypingDots } from './ui'

export function EducationalBadge(): React.JSX.Element {
  return (
    <span
      className="pill-neutral gap-1.5"
      title="Educational simulation only. Not a medical device. Not for diagnosis or real patient care."
    >
      <Icon name="shield" className="h-3.5 w-3.5" />
      Educational simulation · not a medical device
    </span>
  )
}

/** Persistent footer for stations touching on suicide, self-harm, substances, etc. */
export function SensitiveTopicFooter(): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 border-t border-line bg-lilac px-6 py-2.5 text-[13px] text-text">
      <span className="pill bg-surface text-text-2">Sensitive topic</span>
      <p>
        This is a fictional simulation. If you are personally affected or in distress, please contact local emergency
        services or a crisis line.{' '}
        <button className="link" onClick={() => window.digipat.openExternal('crisis-info')}>
          Find a helpline
        </button>
      </p>
    </div>
  )
}

export function AiFeedbackNotice(): React.JSX.Element {
  return (
    <p className="flex items-start gap-2.5 rounded-xl bg-surface-2 px-4 py-3 text-[13px] text-text-2 ring-1 ring-line ring-inset">
      <Icon name="cpu" className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        AI-generated formative feedback from a model running on this Mac. It may be inaccurate and is not an
        examiner’s judgement. Use it to guide practice, and discuss it with a tutor.
      </span>
    </p>
  )
}

export function ErrorBox({ message }: { message: string }): React.JSX.Element {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl bg-rose px-4 py-3 text-[14px] text-text">
      <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-bad" />
      <span className="whitespace-pre-wrap">{message}</span>
    </div>
  )
}

/** Short confirmation, e.g. after saving. */
export function NoteBox({ message }: { message: string }): React.JSX.Element {
  return (
    <div role="status" className="flex items-start gap-3 rounded-xl bg-mint px-4 py-3 text-[14px] text-text">
      <Icon name="check-circle" className="mt-0.5 h-4 w-4 shrink-0 text-good" />
      <span>{message}</span>
    </div>
  )
}

export function ThinkingDots(): React.JSX.Element {
  return <TypingDots label="Thinking" />
}
