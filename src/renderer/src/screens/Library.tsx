import { useEffect, useMemo, useState } from 'react'
import { DIFFICULTIES } from '@shared/constants'
import type { StationSummary } from '@shared/stationSchema'
import type { SessionListItem } from '@shared/sessionTypes'
import type { Navigate } from '../App'
import { StationIllustration, TINT_BG, TINT_VAR, stationArt } from '../components/Illustrations'
import { ErrorBox, NoteBox } from '../components/Notices'
import { ChipGroup, Icon, LevelPill } from '../components/ui'
import { SPECIALTY_LABEL, TYPE_LABEL } from '../lib/format'

const LEVEL_LABEL: Record<string, string> = { foundation: 'Foundation', intermediate: 'Intermediate', advanced: 'Advanced' }

export function Library({ navigate, modelReady }: { navigate: Navigate; modelReady: boolean }): React.JSX.Element {
  const [stations, setStations] = useState<StationSummary[]>([])
  const [sessions, setSessions] = useState<SessionListItem[]>([])
  const [specialty, setSpecialty] = useState('all')
  const [type, setType] = useState('all')
  const [difficulty, setDifficulty] = useState('all')
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const refresh = (): void => {
    window.clerkroom.listStations().then(setStations)
    window.clerkroom.listSessions().then(setSessions)
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
    const res = await window.clerkroom.importStationFile()
    if (!res) return
    setImportMsg(
      res.ok
        ? { ok: true, text: `Imported “${res.station.title}”.` }
        : { ok: false, text: `Import failed:\n${res.errors.slice(0, 8).join('\n')}` }
    )
    refresh()
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-8 pt-7 pb-14">
      <div className="panel flex items-start justify-between gap-4 px-5 py-4">
        <div className="min-w-0 flex-1 space-y-2.5">
          <ChipGroup
            label="Specialty"
            value={specialty}
            onChange={setSpecialty}
            options={[['all', 'All'], ...(Object.entries(SPECIALTY_LABEL) as [string, string][])]}
          />
          <ChipGroup
            label="Station type"
            value={type}
            onChange={setType}
            options={[['all', 'All'], ...(Object.entries(TYPE_LABEL) as [string, string][])]}
          />
          <ChipGroup
            label="Level"
            value={difficulty}
            onChange={setDifficulty}
            options={[['all', 'All'], ...DIFFICULTIES.map((d): [string, string] => [d, LEVEL_LABEL[d]])]}
          />
        </div>
        <button className="btn shrink-0" onClick={importStation}>
          <Icon name="upload" className="h-4 w-4" /> Import station…
        </button>
      </div>

      {!modelReady && (
        <ErrorBox message="The local model isn’t loaded yet, so stations can’t start. Open Model in the sidebar to load it." />
      )}
      {importMsg && (importMsg.ok ? <NoteBox message={importMsg.text} /> : <ErrorBox message={importMsg.text} />)}

      <ul className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-5">
        {filtered.map((s) => {
          const b = best.get(s.id)
          const { tint } = stationArt(s)
          return (
            <li
              key={s.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-line shadow-card transition-[box-shadow,transform] duration-200 ease-out focus-within:shadow-lift hover:-translate-y-0.5 hover:shadow-lift"
            >
              <div className={`relative flex min-h-48 flex-col px-4 pt-3 pb-3.5 ${TINT_BG[tint]}`}>
                <div className="flex items-start justify-between gap-2 text-[12.5px] font-semibold text-text-2">
                  <span className="flex flex-wrap gap-1.5">
                    {b && (
                      <span className={b.result === 'pass' ? 'pill-mint' : 'pill bg-surface text-text-2'} title="Best previous attempt">
                        {b.result === 'pass' && <Icon name="check" className="h-3 w-3" />}
                        Best {b.overallPercent}%
                      </span>
                    )}
                    {s.sensitiveTopic && <span className="pill bg-surface text-text-2">Sensitive topic</span>}
                    {!s.bundled && <span className="pill bg-surface text-text-2">Custom</span>}
                  </span>
                  <span className="num flex shrink-0 items-center gap-1">
                    <Icon name="clock" className="h-3.5 w-3.5" />~{Math.round(s.timing.stationSec / 60)} min
                  </span>
                </div>
                <div className="flex flex-1 items-center justify-center py-1">
                  <StationIllustration station={s} className="h-28 w-32 transition-transform duration-300 ease-out group-hover:scale-105" />
                </div>
                <div className="flex min-h-[2.75em] items-end text-[17px] leading-snug">
                  <h2 className="line-clamp-2 font-bold text-text">{s.title}</h2>
                </div>
              </div>
              {/* A lighter step of the card's own hue, so each card reads as one pastel object. */}
              <div
                className="flex flex-1 flex-col gap-3 px-4 pt-3 pb-4"
                style={{ background: `color-mix(in oklab, ${TINT_VAR[tint]} 42%, var(--surface))` }}
              >
                <p className="text-[12.5px] font-medium text-text-2">
                  {SPECIALTY_LABEL[s.specialty]} · {TYPE_LABEL[s.stationType]}
                </p>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <LevelPill level={s.difficulty} />
                  <span className="flex items-center gap-1.5">
                    <button
                      className="btn-icon h-8 min-h-8 w-8 shrink-0"
                      title={s.bundled ? 'Duplicate & edit' : 'Edit'}
                      aria-label={s.bundled ? `Duplicate and edit ${s.title}` : `Edit ${s.title}`}
                      onClick={() => navigate({ name: 'editor', stationId: s.id, duplicate: s.bundled })}
                    >
                      <Icon name="edit" className="h-4 w-4 shrink-0" />
                    </button>
                    <button
                      className="btn-primary btn-sm"
                      disabled={!modelReady}
                      onClick={() => navigate({ name: 'brief', stationId: s.id })}
                    >
                      Start station
                    </button>
                  </span>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      {filtered.length === 0 && (
        <p className="text-text-2">
          No stations match these filters.{' '}
          <button
            className="link"
            onClick={() => {
              setSpecialty('all')
              setType('all')
              setDifficulty('all')
            }}
          >
            Show all stations
          </button>
        </p>
      )}
    </div>
  )
}
