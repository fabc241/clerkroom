/*
 * Hand-drawn flat illustrations for station cards and the consulting room. Outlines use
 * --ill-line so they stay legible on light and dark tints; fills are fixed friendly colours.
 * Stations with sensitive topics use neutral imagery (never means of self-harm).
 */
import type { StationSummary } from '@shared/stationSchema'

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
 * The consulting room: the doctor on the left in a white coat, glasses and stethoscope, gesturing
 * across the desk to the patient seated on the right. A window, a pinned chart and a framed anatomy
 * poster are on the wall; a laptop, a cup and a small plant are on the desk. Drawn in light colours
 * only; it sits on the light room field in both appearances. The patient's hair follows the station.
 */
export function ConsultingRoom({
  patientSex,
  className = ''
}: {
  patientSex: 'female' | 'male' | 'other'
  className?: string
}): React.JSX.Element {
  const skin = '#f3c9a8'
  const coat = '#ffffff'
  const hairDoc = '#8a5431'
  const hairPt = patientSex === 'female' ? '#9a5a33' : patientSex === 'male' ? '#3d3129' : '#6b4b35'
  const shirt = '#6fb0dc'
  return (
    <svg viewBox="0 0 600 260" preserveAspectRatio="xMidYMax meet" className={className} aria-hidden>
      {/* floor and skirting */}
      <rect x="-200" y="238" width="1000" height="40" fill="var(--room-floor)" />
      <path d="M-200 238 H800" {...sw} strokeWidth={1.6} opacity={0.5} />

      {/* window with the light falling in */}
      <path d="M40 150 L118 12 H150 L78 150 Z" fill="#ffffff" opacity={0.25} />
      <rect x="18" y="12" width="96" height="138" rx="4" fill="#eef8fc" {...sw} />
      <rect x="26" y="20" width="80" height="122" rx="2" fill="#e2f2fa" {...sw} strokeWidth={1.4} />
      <path d="M66 20 V142" {...sw} strokeWidth={1.8} />
      <path d="M34 30 L52 30 M34 37 L44 37" stroke="#ffffff" strokeWidth={3} strokeLinecap="round" />
      <rect x="12" y="148" width="108" height="7" rx="2" fill="#ffffff" {...sw} strokeWidth={1.6} />

      {/* pinned chart board */}
      <rect x="244" y="44" width="58" height="66" rx="4" fill="#ffffff" {...sw} />
      <rect x="252" y="52" width="42" height="11" rx="2" fill="#7fb0dc" />
      <rect x="252" y="68" width="19" height="15" rx="2" fill="#f0a27a" />
      <rect x="275" y="68" width="19" height="15" rx="2" fill="#6cc0b4" />
      <rect x="252" y="89" width="42" height="7" rx="2" fill="#f6d36b" />
      <path d="M252 102 H284" {...sw} strokeWidth={1.4} opacity={0.4} />
      <circle cx="273" cy="44" r="3" fill="#e46d6b" {...sw} strokeWidth={1.4} />

      {/* framed anatomy poster: lungs and heart */}
      <rect x="318" y="30" width="70" height="88" rx="3" fill="#35496b" {...sw} />
      <rect x="324" y="36" width="58" height="76" rx="1.5" fill="#ffffff" />
      <path d="M353 42 V56" stroke={LINE} strokeWidth={3.4} strokeLinecap="round" />
      <path d="M353 42 V56" stroke="#dbe7f1" strokeWidth={1.6} strokeLinecap="round" />
      <path d="M350 56 C343 53 336 59 334 68 C332 76 336 81 342 81 C347 81 350 78 350 72 Z" fill="#f3aaa2" {...sw} strokeWidth={1.5} />
      <path d="M356 56 C363 53 370 59 372 68 C374 76 370 81 364 81 C359 81 356 78 356 72 Z" fill="#f3aaa2" {...sw} strokeWidth={1.5} />
      <path d="M353 56 L346 64 M353 56 L360 64" fill="none" {...sw} strokeWidth={1.2} />
      <path d="M340 94 C336 90 336 86 340 86 C342 86 343 88 343 89 C343 88 344 86 346 86 C350 86 350 90 346 94 L343 97 Z" fill="#e46d6b" {...sw} strokeWidth={1.2} />
      <path d="M352 88 H374 M352 93 H370 M352 98 H374 M332 104 H374" {...sw} strokeWidth={1.2} opacity={0.45} />

      {/* doctor's chair */}
      <rect x="124" y="116" width="18" height="90" rx="7" fill="#3f93a0" {...sw} />
      <rect x="124" y="192" width="86" height="12" rx="4" fill="#4fa6b2" {...sw} />
      <path d="M136 204 V238 M198 204 V238" {...sw} strokeWidth={3} />

      {/* doctor: legs under the desk */}
      <path d="M204 196 H262 V234" fill="none" stroke={LINE} strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M204 196 H262 V234" fill="none" stroke="#34425c" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M256 236 H280" stroke={LINE} strokeWidth={8} strokeLinecap="round" />

      {/* doctor: coat, shirt, tie */}
      <path d="M148 198 V146 C148 128 160 118 178 118 H194 C212 118 222 128 222 146 V198 Z" fill={coat} {...sw} />
      <path d="M178 119 L186 140 L194 119 Z" fill="#b9d6f2" {...sw} strokeWidth={1.4} />
      <path d="M184 124 L181 148 L186 154 L191 148 L188 124 Z" fill="#2f4a73" {...sw} strokeWidth={1.4} />
      <path d="M176 119 L186 150 L196 119" fill="none" {...sw} strokeWidth={1.8} />
      <path d="M186 150 V198" {...sw} strokeWidth={1.5} opacity={0.6} />
      <path d="M198 160 H212 V168 H198 Z" fill="none" {...sw} strokeWidth={1.4} />
      <path d="M202 160 V154" stroke="#3f6fb0" strokeWidth={2.4} strokeLinecap="round" />

      {/* doctor: stethoscope round the neck */}
      <Tube d="M174 120 C168 136 170 152 176 162" fill="#9aa7b8" w={3} />
      <Tube d="M198 120 C204 136 206 150 204 160" fill="#9aa7b8" w={3} />
      <circle cx="204" cy="164" r="5" fill="#cfd8e3" {...sw} strokeWidth={1.6} />
      <circle cx="176" cy="164" r="2.6" fill="#9aa7b8" {...sw} strokeWidth={1.2} />

      {/* doctor: arm resting forward on the desk */}
      <path d="M160 140 C156 158 160 170 176 172 L240 170" fill="none" stroke={LINE} strokeWidth={15} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M160 140 C156 158 160 170 176 172 L240 170" fill="none" stroke={coat} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx="248" cy="169" rx="8" ry="5" fill={skin} {...sw} strokeWidth={1.8} />

      {/* doctor: head */}
      <rect x="179" y="104" width="14" height="16" rx="4" fill={skin} {...sw} strokeWidth={1.8} />
      <circle cx="186" cy="88" r="21" fill={skin} {...sw} />
      <ellipse cx="166" cy="92" rx="4" ry="5.5" fill={skin} {...sw} strokeWidth={1.6} />
      <path
        d="M165 88 C162 70 172 60 186 61 C191 55 203 55 208 61 C213 66 212 74 208 79 C202 74 194 73 185 75 C176 77 170 81 165 88 Z"
        fill={hairDoc}
        {...sw}
      />
      <path d="M176 80 L186 80 M193 80 L203 80" {...sw} strokeWidth={1.8} stroke="#5b3620" />
      <rect x="174" y="84" width="13" height="10" rx="3.5" fill="#ffffff" fillOpacity={0.3} {...sw} strokeWidth={1.8} />
      <rect x="191" y="84" width="13" height="10" rx="3.5" fill="#ffffff" fillOpacity={0.3} {...sw} strokeWidth={1.8} />
      <path d="M187 88 H191 M174 88 L168 87" {...sw} strokeWidth={1.8} />
      <circle cx="181" cy="89" r="1.8" fill={LINE} />
      <circle cx="198" cy="89" r="1.8" fill={LINE} />
      <path d="M181 99 C185 104 193 104 197 99 Z" fill="#ffffff" {...sw} strokeWidth={1.6} />

      {/* doctor: open hand gesturing toward the patient */}
      <path d="M214 134 C222 150 230 158 244 156 L262 148" fill="none" stroke={LINE} strokeWidth={15} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M214 134 C222 150 230 158 244 156 L262 148" fill="none" stroke={coat} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M263 152 C261 146 263 141 268 139 L284 134 C287 133 289 137 286 139 L276 143 L288 142 C291 142 291 146 288 147 L278 149 C276 153 270 156 266 155 Z"
        fill={skin}
        {...sw}
        strokeWidth={1.8}
      />
      <path d="M268 139 L271 131 C272 128 276 129 275 132 L273 140" fill={skin} {...sw} strokeWidth={1.8} />

      {/* patient's chair */}
      <rect x="484" y="118" width="18" height="88" rx="7" fill="#e5847a" {...sw} />
      <rect x="416" y="192" width="86" height="12" rx="4" fill="#ee998f" {...sw} />
      <path d="M428 204 V238 M490 204 V238" {...sw} strokeWidth={3} />

      {/* patient: legs */}
      <path d="M458 196 H406 V234" fill="none" stroke={LINE} strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M458 196 H406 V234" fill="none" stroke="#3f5578" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M412 236 H390" stroke={LINE} strokeWidth={8} strokeLinecap="round" />

      {/* patient: hair behind the head (long for a female patient) */}
      {patientSex === 'female' && (
        <path
          d="M432 98 C430 76 442 64 457 64 C473 64 484 76 482 98 C481 116 488 130 494 140 C482 144 473 136 471 126 L443 126 C439 136 429 144 418 140 C426 128 433 116 432 98 Z"
          fill={hairPt}
          {...sw}
        />
      )}

      {/* patient: t-shirt */}
      <rect x="450" y="110" width="14" height="18" rx="4" fill={skin} {...sw} strokeWidth={1.8} />
      <path d="M426 200 V150 C426 134 438 126 454 126 H462 C478 126 488 134 488 150 V200 Z" fill={shirt} {...sw} />
      <path d="M447 127 C451 135 461 135 466 127" fill={skin} {...sw} strokeWidth={1.8} />

      {/* patient: near arm down to the hands in the lap */}
      <Tube d="M440 138 C434 150 432 164 434 176 C436 186 442 190 452 190" fill={skin} w={9} />
      <Tube d="M440 138 C436 146 434 154 433 160" fill={shirt} w={13} />
      <ellipse cx="456" cy="190" rx="9" ry="6" fill={skin} {...sw} strokeWidth={1.8} />

      {/* patient: head and face */}
      <circle cx="457" cy="96" r="21" fill={skin} {...sw} />
      {patientSex === 'female' ? (
        <path
          d="M434 96 C433 77 445 68 459 69 C472 70 481 80 479 96 C473 86 465 80 454 82 C446 83 439 88 434 96 Z"
          fill={hairPt}
          {...sw}
        />
      ) : (
        <>
          <ellipse cx="478" cy="98" rx="4" ry="5.5" fill={skin} {...sw} strokeWidth={1.6} />
          <path
            d="M435 94 C433 78 444 70 457 70 C472 70 481 79 479 94 C474 87 466 84 457 84 C448 84 440 87 435 94 Z"
            fill={hairPt}
            {...sw}
          />
        </>
      )}
      <path d="M444 92 L451 91 M461 91 L468 92" {...sw} strokeWidth={1.6} stroke="#5b3620" />
      <circle cx="448" cy="98" r="2.2" fill={LINE} />
      <circle cx="463" cy="98" r="2.2" fill={LINE} />
      <ellipse cx="443" cy="104" rx="3.5" ry="2" fill="#f19a8f" opacity={0.5} />
      <ellipse cx="468" cy="104" rx="3.5" ry="2" fill="#f19a8f" opacity={0.5} />
      <path d="M450 106 C454 111 459 111 463 106 Z" fill="#ffffff" {...sw} strokeWidth={1.6} />

      {/* desk, drawn in front of both */}
      <path d="M252 180 V238 M384 180 V238" {...sw} strokeWidth={4} />
      <rect x="284" y="180" width="90" height="44" rx="3" fill="#e3e9f0" {...sw} strokeWidth={1.8} />
      <rect x="238" y="172" width="160" height="10" rx="3" fill="#d9a877" {...sw} />
      <path d="M244 176 H392" stroke="#ffffff" strokeWidth={1.4} strokeLinecap="round" opacity={0.45} />

      {/* laptop, lid toward the doctor */}
      <path d="M296 172 L290 136 C290 134 291 133 293 133 H334 C336 133 337 134 337 136 L331 172 Z" fill="#c9d2dd" {...sw} strokeWidth={1.8} />
      <circle cx="313.5" cy="152" r="4" fill="#ffffff" opacity={0.8} />
      <rect x="282" y="168" width="64" height="5" rx="2" fill="#b6c1ce" {...sw} strokeWidth={1.6} />

      {/* cup on a saucer */}
      <ellipse cx="360" cy="171" rx="12" ry="2.5" fill="#ffffff" {...sw} strokeWidth={1.4} />
      <path d="M352 156 H367 V165 C367 168 364 170 359.5 170 C355 170 352 168 352 165 Z" fill="#ffffff" {...sw} strokeWidth={1.6} />
      <path d="M367 158 C372 158 372 165 367 165" fill="none" {...sw} strokeWidth={1.6} />

      {/* small plant on the desk */}
      <path d="M377 171 L375 156 H393 L391 171 Z" fill="#f4f6f8" {...sw} strokeWidth={1.6} />
      <path d="M384 156 C376 146 376 136 380 128 C386 136 388 146 384 156 Z" fill="#8fd1a6" {...sw} strokeWidth={1.4} />
      <path d="M384 156 C390 146 396 142 402 142 C400 150 394 156 384 156 Z" fill="#6fbf8b" {...sw} strokeWidth={1.4} />
      <path d="M384 156 C378 150 372 146 366 146 C368 152 376 156 384 156 Z" fill="#6fbf8b" {...sw} strokeWidth={1.4} />

      {/* floor plant in the corner */}
      <path d="M538 238 L532 208 H564 L558 238 Z" fill="#f2f2f2" {...sw} />
      <path d="M548 208 C534 188 536 170 544 158 C554 172 556 190 548 208 Z" fill="#8fd1a6" {...sw} strokeWidth={1.6} />
      <path d="M548 208 C560 192 572 186 582 186 C578 200 566 208 548 208 Z" fill="#6fbf8b" {...sw} strokeWidth={1.6} />
      <path d="M548 208 C534 200 524 190 520 178 C534 180 544 192 548 208 Z" fill="#6fbf8b" {...sw} strokeWidth={1.6} />
    </svg>
  )
}
