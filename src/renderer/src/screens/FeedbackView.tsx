import { useEffect, useRef, useState } from 'react'
import type { FeedbackProgress } from '@shared/ipcTypes'
import type { ItemVerdict, SessionRecord } from '@shared/sessionTypes'
import { DOMAIN_LABELS } from '@shared/constants'
import type { Navigate } from '../App'
import { AiFeedbackNotice, ErrorBox } from '../components/Notices'
import { TranscriptView } from '../components/TranscriptView'
import { RATING_STYLE, formatDate } from '../lib/format'

const VERDICT: Record<ItemVerdict, { icon: string; label: string; cls: string }> = {
  yes: { icon: '✓', label: 'Done', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  partial: { icon: '◐', label: 'Partly', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  no: { icon: '✗', label: 'Not done', cls: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' }
}

export function FeedbackView({
  sessionId,
  navigate,
  modelReady
}: {
  sessionId: string
  navigate: Navigate
  modelReady: boolean
}): React.JSX.Element {
  const [record, setRecord] = useState<SessionRecord | null>(null)
  const [progress, setProgress] = useState<FeedbackProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [highlight, setHighlight] = useState<number | null>(null)
  const started = useRef(false)

  const generate = async (): Promise<void> => {
    setError(null)
    setProgress({ step: 'Starting', done: 0, total: 1 })
    try {
      await window.digipat.generateFeedback(sessionId)
      setRecord(await window.digipat.getSession(sessionId))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setProgress(null)
    }
  }

  useEffect(() => {
    const off = window.digipat.onFeedbackProgress((id, p) => id === sessionId && setProgress(p))
    window.digipat.getSession(sessionId).then((r) => {
      setRecord(r)
      if (r && !r.feedback && modelReady && !started.current) {
        started.current = true
        void generate()
      }
    })
    return off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const jumpTo = (turn: number | null): void => {
    if (turn === null) return
    setHighlight(turn)
    document.getElementById(`turn-${turn}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  if (!record) return <div className="p-8 text-sm text-stone-500">Loading…</div>
  const fb = record.feedback

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="label">Feedback · {formatDate(record.startedAt)}</div>
          <h1 className="text-xl font-semibold">{record.stationTitle}</h1>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => window.digipat.exportSession(record.id, 'md')}>
            Export
          </button>
          <button className="btn-secondary" onClick={() => navigate({ name: 'brief', stationId: record.stationId })}>
            Try again
          </button>
          <button className="btn-primary" onClick={() => navigate({ name: 'library' })}>
            Stations
          </button>
        </div>
      </div>

      <AiFeedbackNotice />

      {progress && (
        <div className="card space-y-2">
          <div className="text-sm">The examiner is marking your station on this Mac… {progress.step}</div>
          <div className="h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
            <div
              className="h-full bg-brand-500 transition-all"
              style={{ width: `${Math.max(5, (progress.done / Math.max(1, progress.total)) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-stone-500">This usually takes one to three minutes.</p>
        </div>
      )}
      {error && (
        <div className="space-y-2">
          <ErrorBox message={`Feedback could not be generated: ${error}`} />
          <button className="btn-secondary" disabled={!modelReady} onClick={generate}>
            Retry
          </button>
        </div>
      )}
      {!fb && !progress && !error && (
        <div className="card flex items-center justify-between">
          <span className="text-sm">No feedback yet for this attempt.</span>
          <button className="btn-primary" disabled={!modelReady} onClick={generate}>
            Generate feedback
          </button>
        </div>
      )}

      {fb && (
        <>
          <div className="card grid grid-cols-[auto_1fr] items-center gap-6">
            <div className="text-center">
              <div className={`chip px-3 py-1 text-base ${RATING_STYLE[fb.globalRating]}`}>{fb.globalRating}</div>
              <div className="mt-2 text-3xl font-semibold tabular-nums">{fb.overallPercent}%</div>
              <div className="text-xs text-stone-500">checklist score</div>
            </div>
            <div className="space-y-2">
              {fb.domainScores.map((d) => (
                <div key={d.domain}>
                  <div className="flex justify-between text-xs">
                    <span>{DOMAIN_LABELS[d.domain]}</span>
                    <span className="tabular-nums">{d.percent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
                    <div className="h-full bg-brand-500" style={{ width: `${d.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card selectable space-y-4">
            <p className="text-sm leading-relaxed">{fb.summary}</p>
            <div className="grid gap-4 md:grid-cols-2">
              {fb.missedPoints.length > 0 && (
                <div>
                  <div className="label">To improve</div>
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {fb.missedPoints.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
              {fb.practiseNext.length > 0 && (
                <div>
                  <div className="label">Practise next</div>
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {fb.practiseNext.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="card selectable">
            <div className="label mb-3">Checklist</div>
            <div className="divide-y divide-stone-200 dark:divide-stone-800">
              {fb.items.map((i) => (
                <div key={i.itemId} className="flex gap-3 py-2.5">
                  <span className={`chip h-fit shrink-0 ${VERDICT[i.met].cls}`} title={VERDICT[i.met].label}>
                    {VERDICT[i.met].icon} {VERDICT[i.met].label}
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="font-medium">
                      {i.text}{' '}
                      <span className="text-xs font-normal text-stone-400">
                        {DOMAIN_LABELS[i.domain]} · weight {i.weight}
                      </span>
                    </div>
                    {i.comment && <div className="text-stone-600 dark:text-stone-300">{i.comment}</div>}
                    {i.evidenceQuote && i.evidenceTurn !== null && (
                      <button
                        className="mt-1 text-left text-xs text-brand-700 italic hover:underline dark:text-brand-100"
                        onClick={() => jumpTo(i.evidenceTurn)}
                      >
                        “{i.evidenceQuote}” — show in transcript
                      </button>
                    )}
                    {i.downgraded && (
                      <div className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                        Not credited: the examiner’s quoted evidence could not be found in your transcript.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {fb.answers.length > 0 && (
            <div className="card selectable space-y-5">
              <div className="label">Examiner questions</div>
              {fb.answers.map((a, idx) => (
                <div key={a.question} className="space-y-2 text-sm">
                  <div className="font-medium">
                    {idx + 1}. {a.question}
                  </div>
                  <div className="rounded-lg bg-stone-50 p-3 whitespace-pre-wrap dark:bg-stone-950">
                    {a.answer || <span className="text-stone-400">No answer</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {a.keyPointsHit.map((k) => (
                      <span key={k} className={`chip ${VERDICT.yes.cls}`}>
                        ✓ {k}
                      </span>
                    ))}
                    {a.keyPointsMissed.map((k) => (
                      <span key={k} className={`chip ${VERDICT.no.cls}`}>
                        ✗ {k}
                      </span>
                    ))}
                  </div>
                  {a.comment && <div className="text-stone-600 dark:text-stone-300">{a.comment}</div>}
                  <details>
                    <summary className="cursor-pointer text-xs text-stone-500">Model answer</summary>
                    <p className="mt-1 text-stone-700 dark:text-stone-300">{a.modelAnswer}</p>
                  </details>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-stone-400">
            Marked by {fb.modelName} on this Mac. Domain scores are calculated from the checklist, not by the AI.
          </p>
        </>
      )}

      <div className="card">
        <div className="label mb-3">Transcript</div>
        <div className="selectable">
          <TranscriptView transcript={record.transcript} highlight={highlight} />
        </div>
      </div>
    </div>
  )
}
