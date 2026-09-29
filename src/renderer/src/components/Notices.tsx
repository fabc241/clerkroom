export function EducationalBadge(): React.JSX.Element {
  return (
    <span
      className="chip bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
      title="Educational simulation only. Not a medical device. Not for diagnosis or real patient care."
    >
      Educational simulation · not a medical device
    </span>
  )
}

/** Persistent footer for stations touching on suicide, self-harm, substances, etc. */
export function SensitiveTopicFooter(): React.JSX.Element {
  return (
    <div className="border-t border-violet-200 bg-violet-50 px-4 py-2 text-xs text-violet-900 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200">
      This is a fictional simulation covering a sensitive topic. If you are personally affected or in
      distress, please contact local emergency services or a crisis line.{' '}
      <button className="underline" onClick={() => window.digipat.openExternal('crisis-info')}>
        Find a helpline
      </button>
    </div>
  )
}

export function AiFeedbackNotice(): React.JSX.Element {
  return (
    <p className="rounded-lg bg-stone-100 px-3 py-2 text-xs text-stone-600 dark:bg-stone-800 dark:text-stone-300">
      AI-generated formative feedback — it may be inaccurate and is not an examiner's judgement. Use it
      to guide practice, and discuss with a tutor.
    </p>
  )
}

export function ErrorBox({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
      {message}
    </div>
  )
}

export function ThinkingDots(): React.JSX.Element {
  return (
    <span className="inline-flex gap-1" aria-label="thinking">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
    </span>
  )
}
