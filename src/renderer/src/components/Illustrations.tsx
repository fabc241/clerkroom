/*
 * Hand-drawn flat illustrations for station cards, and the consulting-room artwork. Outlines use
 * --ill-line so they stay legible on light and dark tints; fills are fixed friendly colours.
 * Stations with sensitive topics use neutral imagery (never means of self-harm).
 */
import type { StationSummary } from '@shared/stationSchema'
import roomMale from '../assets/room-male.jpg'
import roomFemale from '../assets/room-female.jpg'
import roomOther from '../assets/room-other.jpg'

type Tint = 'sky' | 'mint' | 'butter' | 'rose' | 'peach' | 'lilac' | 'slate'
type Art = 'heart' | 'lungs' | 'brain' | 'stomach' | 'mind-cloud' | 'mind-sun' | 'mind-swirl' | 'mind-wave' | 'mind-sprout' | 'capsule' | 'glass' | 'talk'

const LINE = 'var(--ill-line)'
const sw = { stroke: LINE, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const BY_ID: Record<string, [Art, Tint]> = {
  'med-chest-pain': ['heart', 'sky'],
  'med-breathlessness': ['lungs', 'mint'],
  'med-abdominal-pain': ['stomach', 'peach'],
  'med-headache-red-flags': ['brain', 'butter'],
  'comm-breaking-bad-news-ms': ['brain', 'rose'],
  'comm-starting-ssri': ['capsule', 'lilac'],
  'psych-low-mood': ['mind-cloud', 'slate'],
  'psych-suicide-risk-overdose': ['mind-sprout', 'mint'],
  'psych-first-episode-psychosis': ['mind-swirl', 'lilac'],
  'psych-mse-elevated-mood': ['mind-sun', 'butter'],
  'psych-alcohol-history': ['glass', 'peach'],
  'psych-panic-anxiety': ['mind-wave', 'sky']
}
const BY_SPECIALTY: Record<string, [Art, Tint]> = {
  psychiatry: ['mind-cloud', 'lilac'],
  medicine: ['heart', 'rose'],
  communication: ['talk', 'sky']
}

/** The illustration and tint for a station; custom stations fall back by specialty. */
export function stationArt(s: Pick<StationSummary, 'id' | 'specialty'>): { art: Art; tint: Tint } {
  const [art, tint] = BY_ID[s.id] ?? BY_SPECIALTY[s.specialty] ?? ['talk', 'slate']
  return { art, tint }
}

/** The tint as a CSS variable, for mixing lighter steps of the same hue. */
export const TINT_VAR: Record<Tint, string> = {
  sky: 'var(--tint-sky)',
  mint: 'var(--tint-mint)',
  butter: 'var(--tint-butter)',
  rose: 'var(--tint-rose)',
  peach: 'var(--tint-peach)',
  lilac: 'var(--tint-lilac)',
  slate: 'var(--tint-slate)'
}

export const TINT_BG: Record<Tint, string> = {
  sky: 'bg-sky',
  mint: 'bg-mint',
  butter: 'bg-butter',
  rose: 'bg-rose',
  peach: 'bg-peach',
  lilac: 'bg-lilac',
  slate: 'bg-slate'
}

/** Draws an outlined tube: a thick line in the outline colour with the fill colour inside. */
function Tube({ d, fill, w = 7 }: { d: string; fill: string; w?: number }): React.JSX.Element {
  return (
    <>
      <path d={d} fill="none" stroke={LINE} strokeWidth={w + 3.5} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={fill} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </>
  )
}

function Heart(): React.JSX.Element {
  return (
    <>
      <path d="M4 64 H26 L31 54 L37 76 L42 64 H48 M92 64 H116" fill="none" {...sw} strokeWidth={1.6} opacity={0.5} />
      {/* great vessels behind the heart */}
      <Tube d="M82 44 V12" fill="#8db7e3" />
      <Tube d="M60 40 C57 26 60 14 71 12 C80 11 86 17 86 26" fill="#e46d6b" w={8} />
      <Tube d="M64 13 V5" fill="#e46d6b" w={4} />
      <Tube d="M71 12 V4" fill="#e46d6b" w={4} />
      <Tube d="M78 13 L80 5" fill="#e46d6b" w={4} />
      {/* atria */}
      <ellipse cx="80" cy="46" rx="13" ry="11" fill="#e98580" {...sw} />
      <ellipse cx="50" cy="46" rx="11" ry="10" fill="#e98580" {...sw} />
      {/* ventricles */}
      <path
        d="M42 50 C36 62 38 76 48 86 C54 92 60 95 64 94 C74 91 86 80 90 66 C93 56 90 48 82 46 C72 44 56 44 42 50 Z"
        fill="#ef8f8b"
        {...sw}
      />
      {/* pulmonary trunk in front */}
      <Tube d="M58 52 C54 42 50 34 42 30" fill="#8db7e3" w={7} />
      <Tube d="M42 30 L34 32" fill="#8db7e3" w={4} />
      {/* coronary vessels */}
      <path d="M64 52 C63 64 61 76 58 88 M62 66 L54 72 M61 78 L67 84" fill="none" {...sw} strokeWidth={1.6} />
      <path d="M78 52 C84 60 86 70 84 78 M84 66 L90 68" fill="none" {...sw} strokeWidth={1.6} />
      <ellipse cx="50" cy="66" rx="5" ry="10" fill="#ffffff" opacity={0.3} />
    </>
  )
}

function Lungs(): React.JSX.Element {
  return (
    <>
      <path d="M60 8 V38" stroke={LINE} strokeWidth={10} strokeLinecap="round" />
      <path d="M60 8 V38" stroke="#dbe7f1" strokeWidth={6.5} strokeLinecap="round" />
      {[14, 20, 26, 32].map((y) => (
        <path key={y} d={`M57.5 ${y} H62.5`} {...sw} strokeWidth={1.2} />
      ))}
      <path d="M52 41 C38 36 25 46 21 64 C18 79 24 89 36 89 C46 89 52 83 52 73 Z" fill="#f3aaa2" {...sw} />
      <path d="M68 41 C82 36 95 46 99 64 C102 79 96 89 84 89 C74 89 68 83 68 73 Z" fill="#f3aaa2" {...sw} />
      <path d="M60 37 C55 41 50 45 46 52 M46 52 L39 62 M46 52 L45 67 M39 62 L33 67 M39 62 L38 74" fill="none" {...sw} strokeWidth={1.6} />
      <path d="M60 37 C65 41 70 45 74 52 M74 52 L81 62 M74 52 L75 67 M81 62 L87 67 M81 62 L82 74" fill="none" {...sw} strokeWidth={1.6} />
      <ellipse cx="32" cy="58" rx="4" ry="8" fill="#ffffff" opacity={0.35} />
    </>
  )
}

function Brain({ id }: { id: string }): React.JSX.Element {
  const outline =
    'M30 60 C21 56 19 44 27 38 C27 26 39 19 50 23 C56 15 72 15 79 23 C91 21 101 31 97 43 C105 50 101 64 90 64 C88 72 78 77 70 72 C63 78 52 78 47 72 C39 76 30 70 30 60 Z'
  return (
    <>
      <defs>
        <clipPath id={`brain-${id}`}>
          <path d={outline} />
        </clipPath>
      </defs>
      <path d="M70 70 C70 79 72 85 77 91" stroke={LINE} strokeWidth={9} strokeLinecap="round" fill="none" />
      <path d="M70 70 C70 79 72 85 77 91" stroke="#e9b8a4" strokeWidth={5.5} strokeLinecap="round" fill="none" />
      <g clipPath={`url(#brain-${id})`}>
        <rect x="0" y="0" width="120" height="100" fill="#f3aebb" />
        <path d="M52 10 C58 34 56 50 64 80 L120 80 L120 10 Z" fill="#9fc8ea" />
        <path d="M84 10 C84 40 90 56 110 70 L120 70 L120 10 Z" fill="#f5d489" />
      </g>
      <path d={outline} fill="none" {...sw} />
      <path
        d="M36 44 C42 40 46 46 52 42 M40 56 C46 52 52 58 58 52 M58 32 C62 38 68 34 72 40 M66 50 C72 46 76 52 82 48 M80 30 C84 36 88 34 92 40 M56 64 C60 60 66 64 70 60"
        fill="none"
        {...sw}
        strokeWidth={1.6}
        opacity={0.75}
      />
    </>
  )
}

function Stomach({ id }: { id: string }): React.JSX.Element {
  const body =
    'M56 10 L66 10 L66 24 C66 32 72 36 80 40 C94 46 97 66 88 78 C77 92 52 92 40 80 C33 72 34 60 42 57 C49 54 55 58 59 62 C63 50 57 42 56 32 Z'
  return (
    <>
      <defs>
        <clipPath id={`stomach-${id}`}>
          <path d={body} />
        </clipPath>
      </defs>
      <g clipPath={`url(#stomach-${id})`}>
        <rect x="0" y="0" width="120" height="100" fill="#f4b5b1" />
        <path d="M20 70 C40 64 60 72 80 66 C92 62 100 64 110 66 L110 100 L20 100 Z" fill="#96d3aa" />
      </g>
      <path d={body} fill="none" {...sw} />
      <path d="M40 80 C34 86 30 90 24 90" fill="none" {...sw} />
      <path d="M72 50 C78 54 82 60 82 68" fill="none" {...sw} strokeWidth={1.5} opacity={0.6} />
    </>
  )
}

function Mind({ inner }: { inner: 'cloud' | 'sun' | 'swirl' | 'wave' | 'sprout' }): React.JSX.Element {
  return (
    <>
      <path
        d="M40 92 L40 78 C29 72 25 59 27 46 C30 28 45 16 62 16 C80 16 92 30 92 46 C92 51 96 55 98 60 L92 62 C92 70 89 76 81 78 L73 78 L73 92"
        fill="#e7ebf3"
        {...sw}
      />
      {inner === 'cloud' && (
        <>
          <path d="M44 52 C40 52 38 48 40 45 C40 40 46 38 49 41 C51 36 59 35 61 41 C66 40 69 45 66 49 C66 51 64 52 62 52 Z" fill="#aab8cf" {...sw} strokeWidth={1.6} />
          <path d="M46 57 L44 62 M53 57 L51 62 M60 57 L58 62" {...sw} strokeWidth={1.6} stroke="#7d9cc9" />
        </>
      )}
      {inner === 'sun' && (
        <>
          <circle cx="56" cy="44" r="8" fill="#f6c95b" {...sw} strokeWidth={1.6} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <path
              key={a}
              d={`M${56 + Math.cos((a * Math.PI) / 180) * 12} ${44 + Math.sin((a * Math.PI) / 180) * 12} L${56 + Math.cos((a * Math.PI) / 180) * 16} ${44 + Math.sin((a * Math.PI) / 180) * 16}`}
              {...sw}
              strokeWidth={1.6}
            />
          ))}
        </>
      )}
      {inner === 'swirl' && (
        <path d="M56 44 C56 40 62 40 62 45 C62 51 52 52 50 45 C48 37 58 32 65 37 C72 42 70 54 60 57" fill="none" stroke="#8d7ad6" strokeWidth={2.4} strokeLinecap="round" />
      )}
      {inner === 'wave' && (
        <path d="M40 46 H46 L50 38 L55 54 L60 34 L65 52 L69 46 H76" fill="none" stroke="#e46d6b" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      )}
      {inner === 'sprout' && (
        <>
          <path d="M57 58 V42" {...sw} strokeWidth={1.8} stroke="#3f8f63" />
          <path d="M57 46 C50 46 46 40 46 34 C53 34 57 39 57 46 Z" fill="#8fd1a6" {...sw} strokeWidth={1.6} />
          <path d="M57 44 C63 44 68 38 68 32 C61 32 57 37 57 44 Z" fill="#8fd1a6" {...sw} strokeWidth={1.6} />
          <path d="M49 58 H65" {...sw} strokeWidth={1.8} />
        </>
      )}
    </>
  )
}

function Capsule(): React.JSX.Element {
  return (
    <g transform="rotate(-35 60 50)">
      <path d="M60 30 H40 A20 20 0 0 0 40 70 H60 Z" fill="#9fc8ea" {...sw} />
      <path d="M60 30 H80 A20 20 0 0 1 80 70 H60 Z" fill="#fbf6ee" {...sw} />
      <ellipse cx="42" cy="40" rx="8" ry="3" fill="#ffffff" opacity={0.5} />
    </g>
  )
}

function Glass(): React.JSX.Element {
  return (
    <>
      <path d="M38 20 H82 L76 86 C76 89 73 91 70 91 H50 C47 91 44 89 44 86 Z" fill="#f4f7fb" {...sw} />
      <path d="M41 46 H79 L76 86 C76 89 73 91 70 91 H50 C47 91 44 89 44 86 Z" fill="#f2b95e" opacity={0.9} />
      <rect x="50" y="52" width="10" height="10" rx="2" transform="rotate(12 55 57)" fill="#ffffff" opacity={0.75} {...sw} strokeWidth={1.4} />
      <rect x="62" y="60" width="9" height="9" rx="2" transform="rotate(-10 66 64)" fill="#ffffff" opacity={0.75} {...sw} strokeWidth={1.4} />
      <path d="M38 20 H82 L76 86 C76 89 73 91 70 91 H50 C47 91 44 89 44 86 Z" fill="none" {...sw} />
    </>
  )
}

function Talk(): React.JSX.Element {
  return (
    <>
      <path d="M22 22 H72 C77 22 80 25 80 30 V54 C80 59 77 62 72 62 H42 L30 72 V62 H22 C17 62 14 59 14 54 V30 C14 25 17 22 22 22 Z" fill="#ffffff" {...sw} />
      <path d="M52 44 H96 C101 44 104 47 104 52 V74 C104 79 101 82 96 82 H90 V92 L78 82 H52 C47 82 44 79 44 74 V52 C44 47 47 44 52 44 Z" fill="#9fc8ea" {...sw} />
      <circle cx="62" cy="63" r="2.6" fill={LINE} />
      <circle cx="74" cy="63" r="2.6" fill={LINE} />
      <circle cx="86" cy="63" r="2.6" fill={LINE} />
    </>
  )
}

export function StationIllustration({
  station,
  className = 'h-24 w-28'
}: {
  station: Pick<StationSummary, 'id' | 'specialty'>
  className?: string
}): React.JSX.Element {
  const { art } = stationArt(station)
  return (
    <svg viewBox="0 0 120 100" className={className} aria-hidden>
      {art === 'heart' && <Heart />}
      {art === 'lungs' && <Lungs />}
      {art === 'brain' && <Brain id={station.id} />}
      {art === 'stomach' && <Stomach id={station.id} />}
      {art === 'mind-cloud' && <Mind inner="cloud" />}
      {art === 'mind-sun' && <Mind inner="sun" />}
      {art === 'mind-swirl' && <Mind inner="swirl" />}
      {art === 'mind-wave' && <Mind inner="wave" />}
      {art === 'mind-sprout' && <Mind inner="sprout" />}
      {art === 'capsule' && <Capsule />}
      {art === 'glass' && <Glass />}
      {art === 'talk' && <Talk />}
    </svg>
  )
}

/**
 * The consulting room scene: the doctor at the desk and the patient (matched to the station's sex).
 * The artwork was generated locally with FLUX.2 [klein] through the QVAC SDK and is bundled with
 * the app. The top fades into the room's sky.
 */
export function ConsultingRoom({
  patientSex,
  className = ''
}: {
  patientSex: 'female' | 'male' | 'other'
  className?: string
}): React.JSX.Element {
  const src = patientSex === 'female' ? roomFemale : patientSex === 'male' ? roomMale : roomOther
  return <img src={src} alt="" aria-hidden draggable={false} className={`room-scene object-cover object-bottom ${className}`} />
}
