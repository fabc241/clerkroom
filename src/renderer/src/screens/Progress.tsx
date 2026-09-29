import { useEffect, useMemo, useState } from 'react'
import type { SessionListItem } from '@shared/sessionTypes'
import { DOMAINS, DOMAIN_LABELS } from '@shared/constants'
import type { Navigate } from '../App'
import { RATING_STYLE, formatDate } from '../lib/format'

export function Progress({ navigate }: { navigate: Navigate }): React.JSX.Element {
  const [sessions, setSessions] = useState<SessionListItem[]>([])
  const [confirm, setConfirm] = useState<string | null>(null)
  const refresh = (): void => void window.digipat.listSessions().then(setSessions)
  useEffect(refresh, [])

  const marked = sessions.filter((s) => s.domainScores)

  // Average of the last five marked attempts per domain, to show where to focus.
  const domainAverages = useMemo(() => {
    const recent = marked.slice(0, 5)
    return DOMAINS.map((d) => {
      const vals = recent.flatMap((s) => s.domainScores!.filter((x) => x.domain === d).map((x) => x.percent))
      return { domain: d, avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null }
    })
  }, [marked])

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <div>
        <h1 className="text-xl font-semibold">Progress</h1>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
          Your attempts are stored only on this Mac.
        </p>
      </div>

      {marked.length > 0 && (
        <div className="card">
          <div className="label mb-3">Recent performance by domain (last {Math.min(5, marked.length)} marked attempts)</div>
          <div className="grid grid-cols-3 gap-6">
            {domainAverages.map((d) => (
              <div key={d.domain}>
                <div className="text-sm">{DOMAIN_LABELS[d.domain]}</div>
                <div className="text-2xl font-semibold tabular-nums">{d.avg === null ? '—' : `${d.avg}%`}</div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
                  <div className="h-full bg-brand-500" style={{ width: `${d.avg ?? 0}%` }} />
                </div>
              </div>
            ))}
          </div>
          {(() => {
            const weakest = [...domainAverages].filter((d) => d.avg !== null).sort((a, b) => a.avg! - b.avg!)[0]
            return weakest ? (
              <p className="mt-4 text-sm text-stone-600 dark:text-stone-300">
                Focus area: <span className="font-medium">{DOMAIN_LABELS[weakest.domain]}</span>.
              </p>
            ) : null
          })()}
        </div>
      )}

      <div className="card p-0">
        {sessions.length === 0 ? (
          <p className="p-5 text-sm text-stone-500">No attempts yet. Start a station from the Stations page.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs text-stone-500 dark:border-stone-800">
                <th className="px-5 py-2 font-medium">Date</th>
                <th className="py-2 font-medium">Station</th>
                <th className="py-2 font-medium">Result</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-b border-stone-100 last:border-0 dark:border-stone-800">
                  <td className="px-5 py-2.5 whitespace-nowrap text-stone-500">{formatDate(s.startedAt)}</td>
                  <td className="py-2.5">{s.stationTitle}</td>
                  <td className="py-2.5">
                    {s.globalRating ? (
                      <span className={`chip ${RATING_STYLE[s.globalRating]}`}>
                        {s.globalRating} · {s.overallPercent}%
                      </span>
                    ) : (
                      <span className="text-xs text-stone-400">Not marked</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-5 text-right whitespace-nowrap">
                    {confirm === s.id ? (
                      <>
                        <button
                          className="btn-danger px-2 py-1 text-xs"
                          onClick={async () => {
                            await window.digipat.deleteSession(s.id)
                            setConfirm(null)
                            refresh()
                          }}
                        >
                          Delete
                        </button>{' '}
                        <button className="btn-secondary px-2 py-1 text-xs" onClick={() => setConfirm(null)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn-secondary px-2 py-1 text-xs"
                          onClick={() => navigate({ name: 'feedback', sessionId: s.id })}
                        >
                          Open
                        </button>{' '}
                        <button className="btn-secondary px-2 py-1 text-xs" onClick={() => window.digipat.exportSession(s.id, 'json')}>
                          JSON
                        </button>{' '}
                        <button className="btn-secondary px-2 py-1 text-xs" onClick={() => setConfirm(s.id)}>
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
