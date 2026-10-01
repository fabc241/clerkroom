/** Clerkroom mark: a speech bubble holding a pulse line. */
export function LogoMark({ className = 'h-7 w-7' }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden>
      <path d="M6 4h16a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4h-8l-6 5v-5H6a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z" fill="var(--tint-sky)" stroke="var(--text)" strokeWidth={1.8} strokeLinejoin="round" />
      <path d="M7 13h4l2-4 3 8 2-4h3" fill="none" stroke="#e46d6b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
