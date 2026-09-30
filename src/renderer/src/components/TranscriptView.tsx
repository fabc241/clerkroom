import type { TranscriptEntry } from '@shared/sessionTypes'
import { formatClock } from '../lib/format'
import { Icon } from './ui'

/**
 * The consultation as speech bubbles: the doctor (you) on the left, as in the consulting room,
 * the patient on the right. Examination and investigation results appear as result cards.
 */
export function TranscriptView({
  transcript,
  highlight,
  startedAt,
  patientName = 'Patient'
}: {
  transcript: TranscriptEntry[]
  highlight?: number | null
  startedAt?: number
  patientName?: string
}): React.JSX.Element {
  const origin = startedAt ?? transcript[0]?.at ?? 0
  const patient = patientName.split(' ')[0]
  const time = (at: number): string => formatClock(Math.max(0, (at - origin) / 1000))
  return (
    <ol className="space-y-4">
      {transcript.map((e, i) => {
        const lit = highlight === i ? 'ring-2 ring-focus ring-offset-2 ring-offset-transparent' : ''
        if (e.kind === 'system') {
          return (
            <li key={i} id={`turn-${i}`} className="flex justify-center py-1">
              <span className={`pill bg-surface/80 text-text-2 ring-1 ring-line ${lit}`}>{e.text}</span>
            </li>
          )
        }
        if (e.kind === 'exam' || e.kind === 'investigation') {
          return (
            <li key={i} id={`turn-${i}`} className="flex justify-center">
              <div className={`flex max-w-[80%] items-start gap-3 rounded-2xl bg-surface px-4 py-3 shadow-card ${lit}`}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-mint text-text">
                  <Icon name={e.kind === 'exam' ? 'stethoscope' : 'flask'} className="h-4 w-4" />
                </span>
                <div className="min-w-0 text-[14px]">
                  <div className="font-semibold text-text">
                    {e.kind === 'exam' ? `Examination · ${e.system}` : `Investigation · ${e.test}`}
                  </div>
                  <div className="text-text-2">{e.kind === 'exam' ? e.finding : e.result}</div>
                </div>
              </div>
            </li>
          )
        }
        const you = e.kind === 'candidate'
        return (
          <li key={i} id={`turn-${i}`} className={`flex ${you ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[72%] ${you ? '' : 'text-right'}`}>
              <div className="mb-1 px-1 text-[11.5px] font-semibold text-text-2">
                {you ? 'You' : patient} · <span className="num">{time(e.at)}</span>
              </div>
              <p
                className={`inline-block rounded-2xl px-4 py-2.5 text-left text-[15px] leading-[1.5] text-text shadow-card ${
                  you ? 'bubble-you bg-surface' : 'bubble-them bg-butter'
                } ${lit}`}
              >
                {e.text}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
