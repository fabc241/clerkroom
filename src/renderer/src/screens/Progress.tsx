import { useEffect, useMemo, useState } from 'react'
import type { SessionListItem } from '@shared/sessionTypes'
import { DOMAINS, DOMAIN_LABELS } from '@shared/constants'
import { PASS_MARK } from '@shared/rubric'
import type { Navigate } from '../App'
import { Icon, PageHeader, Panel, ProgressBar } from '../components/ui'
import { RESULT_LABEL, formatDate } from '../lib/format'

const TRACK_MAX = 30
const RESULT_PILL = { pass: 'pill-mint', fail: 'pill-rose', incomplete: 'pill-butter' } as const

export function Progress({ navigate }: { navigate: Navigate }): React.JSX.Element {
  const [sessions, setSessions] = useState<SessionListItem[]>([])
  const [confirm, setConfirm] = useState<string | null>(null)
  const refresh = (): void => void window.digipat.listSessions().then(setSessions)
  useEffect(refresh, [])

  const marked = sessions.filter((s) => s.domainScores)
  const passed = marked.filter((s) => s.result === 'pass').length

  // Average of the last five marked attempts per domain, to show where to focus.
  const domainAverages = useMemo(() => {
    const recent = marked.slice(0, 5)
    return DOMAINS.map((d) => {
      const vals = recent.flatMap((s) => s.domainScores!.filter((x) => x.domain === d).map((x) => x.percent))
      return { domain: d, avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null }
    })
  }, [marked])
  const weakest = [...domainAverages].filter((d) => d.avg !== null).sort((a, b) => a.avg! - b.avg!)[0]
  const track = marked.slice(0, TRACK_MAX).reverse()

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-8 pt-7 pb-14">
      <PageHeader
        title="Progress"
        description="Every attempt you have made, stored only on this Mac."
        actions={
          marked.length > 0 && (
            <span className="pill-mint px-3 py-1 text-[13px]">
              <Icon name="check-circle" className="h-4 w-4" /> {passed} of {marked.length} passed
            </span>
          )
        }
      />

      {track.length > 0 && (
        <Panel
          title="Scores over time"
          aside={<span className="field-label">Oldest to newest · pass mark {PASS_MARK}%</span>}
        >
          <div className="h-48 rounded-2xl bg-sky px-4 pt-5">
            <ol className="relative flex h-full items-end gap-2.5" aria-label="Scores of marked attempts, oldest first">
              <li
                className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-text-3/60"
                style={{ bottom: `${PASS_MARK}%` }}
                aria-hidden
              />
              {track.map((s) => (
                <li key={s.id} className="flex h-full max-w-12 min-w-4 flex-1 flex-col justify-end">
                  <button
                    className={`w-full rounded-t-lg transition-opacity hover:opacity-80 ${
                      s.result === 'pass' ? 'bg-good' : s.result === 'incomplete' ? 'bg-warn' : 'bg-bad/70'
                    }`}
                    style={{ height: `${Math.max(3, s.overallPercent ?? 0)}%` }}
                    title={`${s.stationTitle} · ${formatDate(s.startedAt)} · ${s.overallPercent}%`}
                    aria-label={`${s.stationTitle}, ${s.overallPercent}%, ${s.result ? RESULT_LABEL[s.result] : 'not evaluated'}`}
                    onClick={() => navigate({ name: 'feedback', sessionId: s.id })}
                  />
                </li>
              ))}
            </ol>
          </div>
          <div className="flex flex-wrap gap-4 text-[12.5px] font-semibold text-text-2">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-good" /> Passed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-bad/70" /> Not passed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-warn" /> Incomplete
            </span>
          </div>
        </Panel>
      )}

      {marked.length > 0 && (
        <Panel title={`By domain · last ${Math.min(5, marked.length)} attempts`}>
          <div className="space-y-2.5">
            {domainAverages.map((d) => (
              <div key={d.domain} className="grid grid-cols-[180px_1fr_48px] items-center gap-4 text-[14px]">
                <span className="font-semibold text-text-2">{DOMAIN_LABELS[d.domain]}</span>
                <ProgressBar value={d.avg ?? 0} tone={(d.avg ?? 0) >= PASS_MARK ? 'good' : 'accent'} />
                <span className="num text-right font-semibold text-text">{d.avg === null ? '—' : `${d.avg}%`}</span>
              </div>
            ))}
          </div>
          {weakest && (
            <p className="flex items-center gap-2 text-[14px] text-text-2">
              <Icon name="bulb" className="h-4 w-4" />
              <span>
                Focus next on <span className="font-semibold text-text">{DOMAIN_LABELS[weakest.domain]}</span>.
              </span>
            </p>
          )}
        </Panel>
      )}

      <Panel title="All attempts">
        {sessions.length === 0 ? (
          <p className="text-text-2">
            No attempts yet.{' '}
            <button className="link" onClick={() => navigate({ name: 'library' })}>
              Choose a station
            </button>{' '}
            to start.
          </p>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="field-label border-b border-line">
                <th className="py-2 font-semibold">Date</th>
                <th className="py-2 font-semibold">Station</th>
                <th className="py-2 font-semibold">Result</th>
                <th className="py-2 text-right font-semibold">Score</th>
                <th className="w-px py-2" />
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-0">
                  <td className="py-3 pr-4 text-[13.5px] whitespace-nowrap text-text-2">{formatDate(s.startedAt)}</td>
                  <td className="py-3 pr-4 text-[14.5px] font-semibold text-text">{s.stationTitle}</td>
                  <td className="py-3">
                    {s.result ? (
                      <span className={RESULT_PILL[s.result]}>
                        {RESULT_LABEL[s.result]} · {s.globalRating}
                      </span>
                    ) : (
                      <span className="pill-neutral">Not evaluated</span>
                    )}
                  </td>
                  <td className="num py-3 text-right text-[15px] font-bold text-text">
                    {s.overallPercent === null ? '—' : `${s.overallPercent}%`}
                  </td>
                  <td className="py-2.5 pl-6 text-right whitespace-nowrap">
                    {confirm === s.id ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="text-[13.5px] text-text">Delete this attempt?</span>
                        <button
                          className="btn-danger btn-sm"
                          onClick={async () => {
                            await window.digipat.deleteSession(s.id)
                            setConfirm(null)
                            refresh()
                          }}
                        >
                          Delete
                        </button>
                        <button className="btn btn-sm" onClick={() => setConfirm(null)}>
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <span className="inline-flex gap-2">
                        <button className="btn btn-sm" onClick={() => navigate({ name: 'feedback', sessionId: s.id })}>
                          Open
                        </button>
                        <button className="btn btn-sm" onClick={() => window.digipat.exportSession(s.id, 'json')}>
                          JSON
                        </button>
                        <button className="btn btn-sm" onClick={() => setConfirm(s.id)}>
                          Delete…
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  )
}
