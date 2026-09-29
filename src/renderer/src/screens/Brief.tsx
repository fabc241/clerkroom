import { useEffect, useState } from 'react'
import type { Settings } from '@shared/ipcTypes'
import type { Station } from '@shared/stationSchema'
import type { Navigate } from '../App'
import { ErrorBox } from '../components/Notices'
import { useCountdown } from '../components/useCountdown'
import { formatClock } from '../lib/format'

export function Brief({
  stationId,
  settings,
  modelReady,
  navigate
}: {
  stationId: string
  settings: Settings
  modelReady: boolean
  navigate: Navigate
}): React.JSX.Element {
  const [station, setStation] = useState<Station | null>(null)
  useEffect(() => {
    window.digipat.getStation(stationId).then((r) => setStation(r?.station ?? null))
  }, [stationId])

  if (!station) return <div className="p-8 text-sm text-stone-500">Loading station…</div>
  return <BriefInner station={station} settings={settings} modelReady={modelReady} navigate={navigate} />
}

function BriefInner({
  station,
  settings,
  modelReady,
  navigate
}: {
  station: Station
  settings: Settings
  modelReady: boolean
  navigate: Navigate
}): React.JSX.Element {
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const reading = settings.skipReadingTime ? 0 : station.timing.readingSec
  const stationSec = settings.stationSecondsOverride ?? station.timing.stationSec

  const enter = async (): Promise<void> => {
    if (starting) return
    setStarting(true)
    try {
      const session = await window.digipat.startSession(station.id)
      navigate({ name: 'encounter', stationId: station.id, session })
    } catch (e) {
      setError((e as Error).message)
      setStarting(false)
    }
  }

  const remaining = useCountdown(reading, () => void enter(), reading > 0 && modelReady)

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto p-8">
      <div className="card w-full max-w-2xl space-y-5 p-8">
        <div className="flex items-center justify-between">
          <div className="label">Reading time</div>
          {reading > 0 && <div className="font-mono text-2xl tabular-nums">{formatClock(remaining)}</div>}
        </div>
        <h1 className="text-xl font-semibold">{station.title}</h1>
        <div className="selectable rounded-lg bg-stone-50 p-4 text-sm leading-relaxed dark:bg-stone-950">
          {station.candidateBrief}
        </div>
        <ul className="list-disc space-y-1 pl-5 text-xs text-stone-500">
          <li>You will have {Math.round(stationSec / 60)} minutes. Type what you would say to the patient.</li>
          {(station.examFindings.length > 0 || station.investigations.length > 0) && (
            <li>Use the side panel to examine the patient or request investigations; results come from the station.</li>
          )}
          <li>The patient is simulated by a local AI. It may occasionally respond imperfectly.</li>
        </ul>
        {!modelReady && <ErrorBox message="The model is not loaded. Go to Model to load it first." />}
        {error && <ErrorBox message={error} />}
        <div className="flex justify-between">
          <button className="btn-secondary" onClick={() => navigate({ name: 'library' })}>
            Back
          </button>
          <button className="btn-primary" disabled={!modelReady || starting} onClick={enter}>
            {reading > 0 ? 'Enter the station now' : 'Enter the station'}
          </button>
        </div>
      </div>
    </div>
  )
}
