import { useEffect, useState } from 'react'
import type { Settings } from '@shared/ipcTypes'
import type { Station } from '@shared/stationSchema'
import type { Navigate } from '../App'
import { ErrorBox } from '../components/Notices'
import { StationIllustration, TINT_BG, stationArt } from '../components/Illustrations'
import { Icon, ProgressBar, Stepper } from '../components/ui'
import { useCountdown } from '../components/useCountdown'
import { formatClock } from '../lib/format'
import { VoiceSwitches, type VoiceKit } from '../components/VoiceOptions'

export function Brief({
  stationId,
  settings,
  voice,
  modelReady,
  navigate
}: {
  stationId: string
  settings: Settings
  voice: VoiceKit
  modelReady: boolean
  navigate: Navigate
}): React.JSX.Element {
  const [station, setStation] = useState<Station | null>(null)
  useEffect(() => {
    window.clerkroom.getStation(stationId).then((r) => setStation(r?.station ?? null))
  }, [stationId])

  if (!station) return <div className="p-10 text-text-3">Loading station…</div>
  return <BriefInner station={station} settings={settings} voice={voice} modelReady={modelReady} navigate={navigate} />
}

function BriefInner({
  station,
  settings,
  voice,
  modelReady,
  navigate
}: {
  station: Station
  settings: Settings
  voice: VoiceKit
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
      const session = await window.clerkroom.startSession(station.id)
      navigate({ name: 'encounter', stationId: station.id, session })
    } catch (e) {
      setError((e as Error).message)
      setStarting(false)
    }
  }

  const remaining = useCountdown(reading, () => void enter(), reading > 0 && modelReady)

  const minutes = Math.round(stationSec / 60)
  const { tint } = stationArt(station)
  const bullets = [
    `You have ${minutes} minutes with the patient. Type or dictate what you would say, as you would say it.`,
    ...(station.examFindings.length > 0 || station.investigations.length > 0
      ? ['Examine the patient or request investigations from the side panel. Results are written by the station author.']
      : []),
    'The patient is simulated by a local AI and may occasionally respond imperfectly.'
  ]

  return (
    <div className="h-full overflow-y-auto bg-canvas">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center gap-5 px-8 py-8">
        <Stepper current={0} />
        <article className="overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
          <div className={`flex items-end justify-between gap-6 px-8 pt-6 pb-5 ${TINT_BG[tint]}`}>
            <div className="min-w-0 pb-1">
              <h1 className="page-title text-[26px]">{station.title}</h1>
              <p className="mt-1 text-[13.5px] font-medium text-text-2">
                {station.patient.name}, {station.patient.age} · {minutes} minute consultation
              </p>
            </div>
            <StationIllustration station={station} className="h-28 w-32 shrink-0" />
          </div>
          <div className="space-y-6 px-8 py-7">
            {reading > 0 && (
              <div className="flex items-center gap-4 rounded-2xl bg-surface-2 px-4 py-3 ring-1 ring-line ring-inset">
                <Icon name="clock" className="h-5 w-5 shrink-0 text-text-2" />
                <div className="flex-1">
                  <div className="flex items-baseline justify-between">
                    <span className="field-label">Reading time</span>
                    <span className="num text-[22px] font-bold text-text">{formatClock(remaining)}</span>
                  </div>
                  <ProgressBar className="mt-1.5" value={((reading - remaining) / reading) * 100} />
                </div>
              </div>
            )}
            <section>
              <h2 className="section-title mb-2">Your task</h2>
              <p className="selectable max-w-[65ch] text-[17px] leading-[1.65] text-text">{station.candidateBrief}</p>
            </section>
            <ul className="space-y-2 text-[14px] text-text-2">
              {bullets.map((b) => (
                <li key={b} className="flex gap-2.5">
                  <Icon name="check-circle" className="mt-0.5 h-4 w-4 shrink-0 text-good" />
                  {b}
                </li>
              ))}
            </ul>
            <section>
              <h2 className="section-title mb-2">Voice</h2>
              <VoiceSwitches kit={voice} />
            </section>
            {!modelReady && <ErrorBox message="The model is not loaded. Go back and open Model to load it first." />}
            {error && <ErrorBox message={error} />}
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-line bg-surface-2 px-8 py-4">
            <button className="btn" onClick={() => navigate({ name: 'library' })}>
              Back to stations
            </button>
            <button className="btn-primary min-h-10 px-5" disabled={!modelReady || starting} onClick={enter}>
              {reading > 0 ? 'Start the consultation now' : 'Start the consultation'}
              <Icon name="arrow-right" className="h-4 w-4" />
            </button>
          </div>
        </article>
      </div>
    </div>
  )
}
