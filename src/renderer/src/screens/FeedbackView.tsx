import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { FeedbackProgress } from '@shared/ipcTypes'
import type { ItemResult, ItemVerdict, SessionRecord, SessionResult } from '@shared/sessionTypes'
import { DOMAIN_LABELS } from '@shared/constants'
import { ANSWERS_SHARE, PASS_MARK, feedbackResult } from '@shared/rubric'
import type { Navigate } from '../App'
import { AiFeedbackNotice, ErrorBox } from '../components/Notices'
import { Gauge, Icon, PageHeader, ProgressBar, Stepper } from '../components/ui'
import { TranscriptView } from '../components/TranscriptView'
import { RESULT_LABEL, formatDate } from '../lib/format'

const RESULT_TONE: Record<SessionResult, 'good' | 'bad' | 'warn'> = { pass: 'good', fail: 'bad', incomplete: 'warn' }
const VERDICT: Record<ItemVerdict, { label: string; icon: 'check-circle' | 'alert' | 'x-circle'; cls: string }> = {
  yes: { label: 'Done', icon: 'check-circle', cls: 'text-good' },
  partial: { label: 'Partly', icon: 'alert', cls: 'text-warn' },
  no: { label: 'Not done', icon: 'x-circle', cls: 'text-bad' }
}

function Findings({
  title,
  icon,
  tone,
  bg,
  items,
  delay
}: {
  title: string
  icon: 'check-circle' | 'alert' | 'x-circle' | 'bulb'
  tone: string
  bg: string
  items: ReactNode[]
  /** Entrance delay in ms, or null to render without the entrance (revisits). */
  delay: number | null
}): React.JSX.Element | null {
  if (items.length === 0) return null
  return (
    <section
      className={`rounded-2xl p-5 ${bg} ${delay === null ? '' : 'rise-in'}`}
      style={{ '--rise-delay': `${delay ?? 0}ms` } as React.CSSProperties}
    >
      <h3 className="section-title mb-2.5 flex items-center gap-2 text-[15px]">
        <Icon name={icon} className={`h-[18px] w-[18px] ${tone}`} />
        {title}
      </h3>
      <ul className="selectable space-y-1.5 text-[14.5px] text-text">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2.5">
            <Icon name={icon} className={`mt-[3px] h-4 w-4 shrink-0 ${tone}`} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </section>
  )
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
  const [details, setDetails] = useState(false)
  // The gauge sweeps and the findings rise in once, when marks arrive while this screen is open.
  const [justMarked, setJustMarked] = useState(false)
  const [patientName, setPatientName] = useState<string | undefined>(undefined)
  const started = useRef(false)

  const generate = async (): Promise<void> => {
    setError(null)
    setProgress({ step: 'Starting', done: 0, total: 1 })
    try {
      await window.digipat.generateFeedback(sessionId)
      setRecord(await window.digipat.getSession(sessionId))
      setJustMarked(true)
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
      if (r) window.digipat.getStation(r.stationId).then((s) => setPatientName(s?.station.patient.name))
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

  if (!record) return <div className="p-10 text-text-3">Loading…</div>
  const fb = record.feedback
  const result = fb ? feedbackResult(fb) : null
  const itemLine = (i: ItemResult): ReactNode => (
    <>
      {i.critical && <span className="pill-rose mr-1.5 align-[1px]">Must pass</span>}
      {i.text}
    </>
  )

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-8 pt-7 pb-14">
      <PageHeader
        title={`Evaluation: ${record.stationTitle}`}
        description={formatDate(record.startedAt)}
        actions={
          <>
            <button className="btn" onClick={() => window.digipat.exportSession(record.id, 'md')}>
              <Icon name="download" className="h-4 w-4" /> Export
            </button>
            <button className="btn" onClick={() => navigate({ name: 'library' })}>
              Stations
            </button>
            {/* Until the attempt is marked, marking is the main action. */}
            <button
              className={fb ? 'btn-primary' : 'btn'}
              onClick={() => navigate({ name: 'brief', stationId: record.stationId })}
            >
              Try again
            </button>
          </>
        }
      >
        <Stepper current={3} />
      </PageHeader>

      {progress && (
        <div className="panel space-y-3 p-6" role="status">
          <div className="flex items-baseline justify-between gap-4">
            <span className="section-title">Evaluating your consultation</span>
            <span className="text-[13.5px] text-text-2">{progress.step}</span>
          </div>
          <ProgressBar value={(progress.done / Math.max(1, progress.total)) * 100} />
          <p className="text-[13px] text-text-3">The examiner runs on this Mac. This usually takes one to three minutes.</p>
        </div>
      )}
      {error && (
        <div className="space-y-3">
          <ErrorBox message={`Your attempt could not be evaluated: ${error}`} />
          <button className="btn" disabled={!modelReady} onClick={generate}>
            Try again
          </button>
        </div>
      )}
      {!fb && !progress && !error && (
        <div className="panel flex items-center justify-between gap-4 p-6">
          <span className="text-text-2">
            {modelReady ? 'This attempt has not been evaluated yet.' : 'Load the model to evaluate this attempt.'}
          </span>
          <button className="btn-primary" disabled={!modelReady} onClick={generate}>
            Evaluate this attempt
          </button>
        </div>
      )}

      {fb && result && (
        <>
          <div className="panel space-y-6 p-6">
            <div className="grid items-center gap-6 md:grid-cols-[260px_1fr]">
              <Gauge
                value={fb.overallPercent}
                passMark={PASS_MARK}
                tone={RESULT_TONE[result]}
                animate={justMarked}
                caption={
                  <span
                    className={`text-[15px] font-bold ${justMarked ? 'rise-in' : ''} ${
                      result === 'pass' ? 'text-good' : result === 'fail' ? 'text-bad' : 'text-warn'
                    }`}
                    style={{ '--rise-delay': '1200ms' } as React.CSSProperties}
                  >
                    {RESULT_LABEL[result]} · {fb.globalRating}
                  </span>
                }
              >
                <div className="num text-[38px] leading-none font-bold text-text">{fb.overallPercent}%</div>
              </Gauge>
              <div className="space-y-4">
                <ul className="space-y-1 text-[14.5px] text-text">
                  {(fb.resultReasons ?? []).map((r) => (
                    <li key={r} className="flex gap-2.5">
                      <Icon
                        name={result === 'pass' ? 'check-circle' : result === 'fail' ? 'x-circle' : 'alert'}
                        className={`mt-[3px] h-4 w-4 shrink-0 ${
                          result === 'pass' ? 'text-good' : result === 'fail' ? 'text-bad' : 'text-warn'
                        }`}
                      />
                      {r}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2 text-[13px]">
                  <span className="pill-neutral">Pass mark {PASS_MARK}%</span>
                  {fb.checklistPercent !== undefined && (
                    <span className="pill-neutral">
                      Checklist {fb.checklistPercent}% · counts {Math.round((1 - ANSWERS_SHARE) * 100)}%
                    </span>
                  )}
                  {fb.answersPercent != null && (
                    <span className="pill-neutral">
                      Examiner questions {fb.answersPercent}% · counts {Math.round(ANSWERS_SHARE * 100)}%
                    </span>
                  )}
                </div>
                {result === 'incomplete' && (
                  <button className="btn" disabled={!modelReady || !!progress} onClick={generate}>
                    Evaluate again
                  </button>
                )}
                <div className="space-y-2">
                  {fb.domainScores.map((d) => (
                    <div key={d.domain} className="grid grid-cols-[160px_1fr_44px] items-center gap-3 text-[13.5px]">
                      <span className="font-semibold text-text-2">{DOMAIN_LABELS[d.domain]}</span>
                      <ProgressBar value={d.percent} tone={d.percent >= PASS_MARK ? 'good' : 'accent'} />
                      <span className="num text-right font-semibold text-text">{d.percent}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <p className="selectable max-w-[75ch] text-[15.5px] leading-[1.65] text-text">{fb.summary}</p>

            <div className="space-y-3">
              <Findings
                title="What went well"
                icon="check-circle"
                tone="text-good"
                bg="bg-mint"
                items={fb.items.filter((i) => i.met === 'yes').map(itemLine)}
                delay={justMarked ? 300 : null}
              />
              <Findings
                title="What could be improved"
                icon="alert"
                tone="text-warn"
                bg="bg-butter"
                items={
                  fb.items.some((i) => i.met === 'partial')
                    ? fb.items.filter((i) => i.met === 'partial').map(itemLine)
                    : fb.missedPoints
                }
                delay={justMarked ? 450 : null}
              />
              <Findings
                title="Key learning points"
                icon="x-circle"
                tone="text-bad"
                bg="bg-rose"
                items={[...fb.items]
                  .filter((i) => i.met === 'no')
                  .sort((a, b) => Number(!!b.critical) - Number(!!a.critical))
                  .map(itemLine)}
                delay={justMarked ? 600 : null}
              />
              <Findings
                title="Practise next"
                icon="bulb"
                tone="text-text-2"
                bg="bg-lilac"
                items={fb.practiseNext}
                delay={justMarked ? 750 : null}
              />
            </div>

            <AiFeedbackNotice />

            <div className="flex justify-center">
              <button className="btn min-h-10 px-5" aria-expanded={details} onClick={() => setDetails((v) => !v)}>
                <Icon name={details ? 'chevron-up' : 'chevron-down'} className="h-4 w-4" />
                {details ? 'Hide the detailed report' : 'Review full detailed report'}
              </button>
            </div>
          </div>

          {details && (
            <>
              <section className="panel p-6">
                <h2 className="section-title mb-3">Checklist</h2>
                <ul className="divide-y divide-line">
                  {fb.items.map((i, row) => (
                    <li key={i.itemId} className="flex gap-4 py-3.5">
                      <span className="num w-6 shrink-0 pt-0.5 text-[13px] font-semibold text-text-3">{row + 1}</span>
                      <div className="selectable min-w-0 flex-1">
                        <div className="text-[14.5px] font-semibold text-text">{itemLine(i)}</div>
                        <div className="mt-0.5 text-[12.5px] text-text-3">
                          {DOMAIN_LABELS[i.domain]} · weight {i.weight}
                        </div>
                        {i.comment && <p className="mt-1.5 text-[14px] text-text-2">{i.comment}</p>}
                        {i.evidenceQuote && i.evidenceTurn !== null && (
                          <button
                            className="mt-1.5 max-w-full rounded-lg bg-surface-2 px-2.5 py-1 text-left text-[13.5px] text-text ring-1 ring-line hover:ring-focus"
                            onClick={() => jumpTo(i.evidenceTurn)}
                          >
                            <span className="italic">“{i.evidenceQuote}”</span>
                            <span className="ml-2 font-semibold text-text-2">Show in transcript</span>
                          </button>
                        )}
                        {i.notAssessed && (
                          <p className="mt-1.5 text-[13px] text-warn">Not assessed: the examiner’s reply could not be read.</p>
                        )}
                        {i.downgraded && !i.notAssessed && !i.comment.startsWith('Not credited') && (
                          <p className="mt-1.5 text-[13px] text-bad">
                            Not credited: the quoted evidence was not found in your consultation.
                          </p>
                        )}
                      </div>
                      <span className={`flex shrink-0 items-start gap-1.5 pt-0.5 text-[13px] font-semibold ${VERDICT[i.met].cls}`}>
                        <Icon name={VERDICT[i.met].icon} className="h-4 w-4" />
                        {VERDICT[i.met].label}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              {fb.answers.length > 0 && (
                <section className="panel space-y-5 p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="section-title">Examiner questions</h2>
                    {fb.answersPercent != null && <span className="num font-bold text-text">{fb.answersPercent}%</span>}
                  </div>
                  {fb.answers.map((a, idx) => (
                    <div key={a.question} className="selectable space-y-2.5 rounded-2xl bg-surface-2 p-4 ring-1 ring-line">
                      <div className="text-[15px] font-semibold text-text">
                        {idx + 1}. {a.question}
                      </div>
                      <p className="rounded-xl bg-surface px-3.5 py-2.5 text-[14.5px] whitespace-pre-wrap text-text ring-1 ring-line">
                        {a.answer || <span className="text-text-3">No answer given.</span>}
                      </p>
                      <ul className="flex flex-wrap gap-1.5">
                        {a.keyPointsHit.map((k) => (
                          <li key={k} className="pill-mint">
                            <Icon name="check" className="h-3 w-3" /> {k}
                          </li>
                        ))}
                        {a.keyPointsMissed.map((k) => (
                          <li key={k} className="pill-neutral">
                            {k}
                          </li>
                        ))}
                      </ul>
                      {a.comment && <p className="text-[14px] text-text-2">{a.comment}</p>}
                      <details>
                        <summary className="cursor-pointer text-[13px] font-semibold text-text-2 hover:text-text">
                          Model answer
                        </summary>
                        <p className="mt-1.5 max-w-[70ch] text-[14px] text-text-2">{a.modelAnswer}</p>
                      </details>
                    </div>
                  ))}
                </section>
              )}

              <section className="panel space-y-4 p-6">
                <h2 className="section-title">Transcript</h2>
                <div className="room selectable rounded-2xl p-5">
                  <TranscriptView
                    transcript={record.transcript}
                    highlight={highlight}
                    startedAt={record.startedAt}
                    patientName={patientName}
                  />
                </div>
              </section>
              <p className="text-[12.5px] text-text-3">
                Evaluated by {fb.modelName} on this Mac. The AI marks each item; the scores, the pass mark and the result
                are calculated in code, not by the AI.
              </p>
            </>
          )}
        </>
      )}
    </div>
  )
}
