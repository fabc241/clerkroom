import { useEffect, useState, type ReactNode } from 'react'

/** Visual checkbox (square) or radio (round) mark; the real input stays in the DOM for a11y. */
function Mark({ type, checked }: { type: 'radio' | 'checkbox'; checked: boolean }): React.JSX.Element {
  return (
    <span
      aria-hidden
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center border-[1.5px] transition-colors ${
        type === 'radio' ? 'rounded-full' : 'rounded-[5px]'
      } ${checked ? 'border-accent bg-accent text-on-accent' : 'border-line-strong bg-surface'}`}
    >
      {checked &&
        (type === 'radio' ? (
          <span className="h-[7px] w-[7px] rounded-full bg-on-accent" />
        ) : (
          <Icon name="check" className="h-3 w-3" />
        ))}
    </span>
  )
}

/** A radio or checkbox with its label. */
export function Choice({
  type = 'radio',
  name,
  checked,
  onChange,
  disabled,
  align = 'center',
  children,
  className = ''
}: {
  type?: 'radio' | 'checkbox'
  name?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  align?: 'center' | 'start'
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <label
      className={`group cursor-pointer gap-2.5 ${align === 'start' ? 'flex items-start' : 'inline-flex items-center'} ${
        disabled ? 'cursor-not-allowed opacity-50' : ''
      } ${className}`}
    >
      <input
        type={type}
        name={name}
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        className={`inline-flex rounded-md peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus ${
          align === 'start' ? 'mt-[2px]' : ''
        }`}
      >
        <Mark type={type} checked={checked} />
      </span>
      <span className="min-w-0">{children}</span>
    </label>
  )
}

/** A single-choice row of filter chips. */
export function ChipGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  className = ''
}: {
  label: string
  value: T
  options: [T, string][]
  onChange: (v: T) => void
  className?: string
}): React.JSX.Element {
  return (
    <div role="radiogroup" aria-label={label} className={`flex items-start gap-3 ${className}`}>
      <span className="field-label w-24 shrink-0 pt-1.5">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map(([v, text]) => (
          <button
            key={v}
            role="radio"
            aria-checked={value === v}
            className={`chip ${value === v ? 'chip-on' : ''}`}
            onClick={() => onChange(v)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Rounded progress bar. */
export function ProgressBar({
  value,
  tone = 'accent',
  className = '',
  label
}: {
  /** 0–100. */
  value: number
  tone?: 'accent' | 'good' | 'warn' | 'bad'
  className?: string
  label?: string
}): React.JSX.Element {
  const fill = { accent: 'bg-accent', good: 'bg-good', warn: 'bg-warn', bad: 'bg-bad' }[tone]
  return (
    <div
      role={label ? 'progressbar' : undefined}
      aria-label={label}
      aria-valuenow={label ? Math.round(value) : undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      className={`h-2 overflow-hidden rounded-full bg-surface-2 ring-1 ring-line ring-inset ${className}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-out ${fill}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}

/** A label above its value. */
export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }): React.JSX.Element {
  return (
    <div className={className}>
      <div className="field-label mb-0.5">{label}</div>
      <div className="text-text">{children}</div>
    </div>
  )
}

export const STATION_STEPS = ['Reading', 'Consultation', 'Examiner questions', 'Evaluation'] as const

/** The fixed order of a station, as a compact stepper. */
export function Stepper({ current, className = '' }: { current: number; className?: string }): React.JSX.Element {
  return (
    <ol className={`flex flex-wrap items-center gap-x-2 gap-y-1.5 ${className}`} aria-label="Station steps">
      {STATION_STEPS.map((step, i) => {
        const state = i < current ? 'done' : i === current ? 'now' : 'ahead'
        return (
          <li key={step} className="flex items-center gap-2" aria-current={state === 'now' ? 'step' : undefined}>
            <span
              className={`flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-semibold ${
                state === 'now'
                  ? 'bg-accent text-on-accent'
                  : state === 'done'
                    ? 'bg-surface-2 text-text-2 ring-1 ring-line'
                    : 'text-text-3'
              }`}
            >
              {state === 'done' ? <Icon name="check" className="h-3 w-3" /> : <span className="num">{i + 1}</span>}
              {step}
            </span>
            {i < STATION_STEPS.length - 1 && <span className="h-px w-4 bg-line-strong" aria-hidden />}
          </li>
        )
      })}
    </ol>
  )
}

export function PageHeader({
  title,
  description,
  actions,
  children
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children?: ReactNode
}): React.JSX.Element {
  return (
    <header className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 max-w-[64ch]">
          <h1 className="page-title">{title}</h1>
          {description && <p className="mt-1.5 text-text-2">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  )
}

/** A white panel with an optional title row. */
export function Panel({
  title,
  aside,
  children,
  className = ''
}: {
  title?: ReactNode
  aside?: ReactNode
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <section className={`panel space-y-4 p-6 ${className}`}>
      {(title || aside) && (
        <div className="flex items-center justify-between gap-4">
          {title && <h2 className="section-title">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  )
}

export function TypingDots({ label = 'Typing' }: { label?: string }): React.JSX.Element {
  return (
    <span className="typing-dots inline-flex items-center gap-1" role="status" aria-label={label}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
    </span>
  )
}

const LEVEL_PILL: Record<string, string> = { foundation: 'pill-mint', intermediate: 'pill-butter', advanced: 'pill-rose' }
const LEVEL_LABEL: Record<string, string> = { foundation: 'Foundation', intermediate: 'Intermediate', advanced: 'Advanced' }

export function LevelPill({ level }: { level: string }): React.JSX.Element {
  return <span className={LEVEL_PILL[level] ?? 'pill-neutral'}>{LEVEL_LABEL[level] ?? level}</span>
}

/** Point on the gauge arc (centre 100,100) at `pct` of the way from left to right, radius `r`. */
function arcPoint(pct: number, r: number): [number, number] {
  const a = Math.PI * (1 - pct / 100)
  return [100 + Math.cos(a) * r, 100 - Math.sin(a) * r]
}
function arcPath(from: number, to: number, r = 80): string {
  const [x1, y1] = arcPoint(from, r)
  const [x2, y2] = arcPoint(to, r)
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

/**
 * Semicircle score gauge on a zoned track: fail (red) up to 40%, borderline (amber) up to the
 * pass mark, pass (green) above it. The pass mark is ticked and labelled inside the band. With
 * `animate` the score arc draws from zero once.
 */
export function Gauge({
  value,
  passMark,
  tone,
  animate,
  caption,
  children
}: {
  value: number
  passMark: number
  tone: 'good' | 'warn' | 'bad'
  animate: boolean
  caption?: ReactNode
  children?: ReactNode
}): React.JSX.Element {
  const [shown, setShown] = useState(animate ? 0 : value)
  useEffect(() => {
    if (!animate) return setShown(value)
    const id = requestAnimationFrame(() => setShown(value))
    return () => cancelAnimationFrame(id)
  }, [animate, value])
  const len = Math.PI * 80
  const color = { good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)' }[tone]
  const [tx1, ty1] = arcPoint(passMark, 72.5)
  const [tx2, ty2] = arcPoint(passMark, 87.5)
  const [lx, ly] = arcPoint(passMark, 103)
  return (
    <div className="mx-auto w-[240px] text-center">
      <div className="relative">
        <svg viewBox="-10 -10 220 116" className="w-full" aria-hidden>
          <path d={arcPath(0, 40)} fill="none" stroke="var(--bad)" strokeWidth={16} opacity={0.22} />
          <path d={arcPath(40, passMark)} fill="none" stroke="var(--warn)" strokeWidth={16} opacity={0.26} />
          <path d={arcPath(passMark, 100)} fill="none" stroke="var(--good)" strokeWidth={16} opacity={0.24} />
          <path
            d={arcPath(0, 100)}
            fill="none"
            stroke={color}
            strokeWidth={16}
            strokeDasharray={len}
            strokeDashoffset={len * (1 - Math.max(0, Math.min(100, shown)) / 100)}
            className="gauge-arc"
          />
          <path d={`M${tx1} ${ty1} L${tx2} ${ty2}`} stroke="var(--text)" strokeWidth={2.5} strokeLinecap="round" />
          <text x={lx} y={ly} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--text-2)">
            {passMark}%
          </text>
        </svg>
        <div className="absolute inset-x-0 bottom-1">{children}</div>
      </div>
      {caption && <div className="mt-2">{caption}</div>}
    </div>
  )
}

type IconName =
  | 'grid'
  | 'chart'
  | 'edit'
  | 'cpu'
  | 'settings'
  | 'mic'
  | 'send'
  | 'stop'
  | 'chevron-down'
  | 'chevron-up'
  | 'arrow-right'
  | 'plus'
  | 'check'
  | 'check-circle'
  | 'alert'
  | 'x-circle'
  | 'clock'
  | 'upload'
  | 'download'
  | 'sun'
  | 'moon'
  | 'monitor'
  | 'stethoscope'
  | 'flask'
  | 'book'
  | 'bulb'
  | 'list'
  | 'shield'

const PATHS: Record<IconName, ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />,
  cpu: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </>
  ),
  send: <path d="M4 12l16-8-6 16-2.5-6.5L4 12z" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
  'chevron-down': <path d="M6 9l6 6 6-6" />,
  'chevron-up': <path d="M6 15l6-6 6 6" />,
  'arrow-right': <path d="M5 12h14M13 6l6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  'check-circle': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l3 3 5-6" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3l9.5 17H2.5L12 3z" />
      <path d="M12 10v4.5M12 17.5v.5" />
    </>
  ),
  'x-circle': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  upload: <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />,
  download: <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  monitor: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  stethoscope: (
    <>
      <path d="M6 3v6a5 5 0 0 0 10 0V3" />
      <path d="M11 14v2a5 5 0 0 0 10 0v-2" />
      <circle cx="21" cy="12" r="2" />
    </>
  ),
  flask: <path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3M7 15h10" />,
  book: <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5zM4 19a2 2 0 0 1 2-2h13" />,
  bulb: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V17h5v-1.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" />,
  list: <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />,
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
}

export function Icon({ name, className = 'h-4 w-4' }: { name: IconName; className?: string }): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  )
}
