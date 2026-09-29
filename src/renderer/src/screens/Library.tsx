import { useEffect, useMemo, useState } from 'react'
import type { StationSummary } from '@shared/stationSchema'
import type { SessionListItem } from '@shared/sessionTypes'
import type { Navigate } from '../App'
import { ErrorBox } from '../components/Notices'
import { RATING_STYLE, SPECIALTY_LABEL, TYPE_LABEL } from '../lib/format'

export function Library({ navigate, modelReady }: { navigate: Navigate; modelReady: boolean }): React.JSX.Element {
  const [stations, setStations] = useState<StationSummary[]>([])
  const [sessions, setSessions] = useState<SessionListItem[]>([])
  const [specialty, setSpecialty] = useState('all')
  const [type, setType] = useState('all')
  const [difficulty, setDifficulty] = useState('all')
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const refresh = (): void => {
    window.digipat.listStations().then(setStations)
    window.digipat.listSessions().then(setSessions)
  }
  useEffect(refresh, [])

  const best = useMemo(() => {
    const m = new Map<string, SessionListItem>()
    for (const s of sessions) {
      if (s.overallPercent === null) continue
      const cur = m.get(s.stationId)
      if (!cur || (cur.overallPercent ?? 0) < s.overallPercent) m.set(s.stationId, s)
    }
    return m
  }, [sessions])

  const filtered = stations.filter(
    (s) =>
      (specialty === 'all' || s.specialty === specialty) &&
      (type === 'all' || s.stationType === type) &&
      (difficulty === 'all' || s.difficulty === difficulty)
  )

  const importStation = async (): Promise<void> => {
    const res = await window.digipat.importStationFile()
    if (!res) return
    setImportMsg(
      res.ok
        ? { ok: true, text: `Imported "${res.station.title}".` }
        : { ok: false, text: `Import failed:\n${res.errors.slice(0, 8).join('\n')}` }
    )
    refresh()
  }

  const select = (value: string, set: (v: string) => void, opts: [string, string][]): React.JSX.Element => (
    <select className="input w-auto" value={value} onChange={(e) => set(e.target.value)}>
      {opts.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  )

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Stations</h1>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
            Choose a fictional clinical station. You will get reading time, then a timed consultation with a simulated
            patient, followed by questions and formative feedback.
          </p>
        </div>
        <button className="btn-secondary shrink-0" onClick={importStation}>
          Import station…
        </button>
      </div>

      {!modelReady && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          The local model isn't loaded yet.{' '}
          <button className="font-medium underline" onClick={() => navigate({ name: 'model' })}>
            Set up the model
          </button>{' '}
          to start a station.
        </div>
      )}
      {importMsg &&
        (importMsg.ok ? (
          <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            {importMsg.text}
          </div>
        ) : (
          <pre className="whitespace-pre-wrap">
            <ErrorBox message={importMsg.text} />
          </pre>
        ))}

      <div className="flex flex-wrap gap-2">
        {select(specialty, setSpecialty, [['all', 'All specialties'], ...Object.entries(SPECIALTY_LABEL)])}
        {select(type, setType, [['all', 'All station types'], ...Object.entries(TYPE_LABEL)])}
        {select(difficulty, setDifficulty, [
          ['all', 'All levels'],
          ['foundation', 'Foundation'],
          ['intermediate', 'Intermediate'],
          ['advanced', 'Advanced']
        ])}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filtered.map((s) => {
          const b = best.get(s.id)
          return (
            <div key={s.id} className="card flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium">{s.title}</h2>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className="chip bg-brand-50 text-brand-700 dark:bg-stone-800 dark:text-brand-100">
                      {SPECIALTY_LABEL[s.specialty]}
                    </span>
                    <span className="chip bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                      {TYPE_LABEL[s.stationType]}
                    </span>
                    <span className="chip bg-stone-100 text-stone-700 capitalize dark:bg-stone-800 dark:text-stone-300">
                      {s.difficulty}
                    </span>
                    {s.sensitiveTopic && (
                      <span className="chip bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300">
                        Sensitive topic
                      </span>
                    )}
                    {!s.bundled && (
                      <span className="chip bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">Custom</span>
                    )}
                  </div>
                </div>
                {b && b.globalRating && (
                  <span className={`chip shrink-0 ${RATING_STYLE[b.globalRating]}`} title="Best previous attempt">
                    Best: {b.overallPercent}%{b.result === 'pass' ? ' · Passed' : ''}
                  </span>
                )}
              </div>
              <div className="text-xs text-stone-500">
                {Math.round(s.timing.readingSec / 60)} min reading · {Math.round(s.timing.stationSec / 60)} min station
              </div>
              <div className="mt-auto flex gap-2">
                <button
                  className="btn-primary"
                  disabled={!modelReady}
                  onClick={() => navigate({ name: 'brief', stationId: s.id })}
                >
                  Start station
                </button>
                <button
                  className="btn-secondary"
                  onClick={() =>
                    navigate({ name: 'editor', stationId: s.id, duplicate: s.bundled })
                  }
                >
                  {s.bundled ? 'Duplicate & edit' : 'Edit'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
      {filtered.length === 0 && <p className="text-sm text-stone-500">No stations match these filters.</p>}
    </div>
  )
}
