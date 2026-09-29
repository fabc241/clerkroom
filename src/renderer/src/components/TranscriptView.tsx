import type { TranscriptEntry } from '@shared/sessionTypes'

export function TranscriptView({
  transcript,
  highlight
}: {
  transcript: TranscriptEntry[]
  highlight?: number | null
}): React.JSX.Element {
  return (
    <div className="space-y-3">
      {transcript.map((e, i) => {
        const ring = highlight === i ? 'ring-2 ring-amber-400' : ''
        if (e.kind === 'candidate')
          return (
            <div key={i} id={`turn-${i}`} className="flex justify-end">
              <div className={`max-w-[75%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-sm text-white ${ring}`}>
                {e.text}
              </div>
            </div>
          )
        if (e.kind === 'patient')
          return (
            <div key={i} id={`turn-${i}`} className="flex justify-start">
              <div className={`max-w-[75%] rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-sm shadow-sm dark:bg-stone-800 ${ring}`}>
                {e.text}
              </div>
            </div>
          )
        if (e.kind === 'exam' || e.kind === 'investigation')
          return (
            <div key={i} id={`turn-${i}`} className="flex justify-center">
              <div className={`max-w-[85%] rounded-lg border border-dashed border-stone-300 px-3 py-2 text-xs dark:border-stone-700 ${ring}`}>
                <span className="font-medium">
                  {e.kind === 'exam' ? `Examination — ${e.system}: ` : `Investigation — ${e.test}: `}
                </span>
                {e.kind === 'exam' ? e.finding : e.result}
              </div>
            </div>
          )
        return (
          <div key={i} id={`turn-${i}`} className="text-center text-xs text-stone-400">
            {e.text}
          </div>
        )
      })}
    </div>
  )
}
