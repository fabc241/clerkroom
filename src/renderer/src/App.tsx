import { useCallback, useEffect, useState } from 'react'
import type { ModelStatus, Settings, VoiceStatus } from '@shared/ipcTypes'
import type { SessionRecord } from '@shared/sessionTypes'
import { DISCLAIMER_VERSION } from '@shared/constants'
import { EducationalBadge } from './components/Notices'
import { Onboarding } from './screens/Onboarding'
import { ModelSetup } from './screens/ModelSetup'
import { Library } from './screens/Library'
import { Brief } from './screens/Brief'
import { Encounter } from './screens/Encounter'
import { PostEncounter } from './screens/PostEncounter'
import { FeedbackView } from './screens/FeedbackView'
import { Progress } from './screens/Progress'
import { StationEditor } from './screens/StationEditor'
import { About } from './screens/About'

export type Route =
  | { name: 'library' }
  | { name: 'model' }
  | { name: 'brief'; stationId: string }
  | { name: 'encounter'; stationId: string; session: SessionRecord }
  | { name: 'post'; stationId: string; sessionId: string }
  | { name: 'feedback'; sessionId: string }
  | { name: 'progress' }
  | { name: 'editor'; stationId?: string; duplicate?: boolean }
  | { name: 'about' }

export type Navigate = (r: Route) => void

const NAV: { route: Route; label: string }[] = [
  { route: { name: 'library' }, label: 'Stations' },
  { route: { name: 'progress' }, label: 'Progress' },
  { route: { name: 'editor' }, label: 'Station editor' },
  { route: { name: 'model' }, label: 'Model' },
  { route: { name: 'about' }, label: 'About & settings' }
]

export default function App(): React.JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [model, setModel] = useState<ModelStatus | null>(null)
  const [voice, setVoice] = useState<VoiceStatus | null>(null)
  const [route, setRoute] = useState<Route>({ name: 'library' })

  useEffect(() => {
    Promise.all([window.digipat.getSettings(), window.digipat.getVoiceStatus()]).then(([st, v]) => {
      setSettings(st)
      setVoice(v)
      if (st.voiceInput && v.cached && v.phase === 'idle') window.digipat.prepareVoice()
    })
    window.digipat.getModelStatus().then((s) => {
      setModel(s)
      // Load automatically only if already downloaded; a download always needs a click.
      if (s.cached && s.phase === 'idle') window.digipat.prepareModel()
    })
    const offModel = window.digipat.onModelStatus(setModel)
    const offVoice = window.digipat.onVoiceStatus(setVoice)
    return () => {
      offModel()
      offVoice()
    }
  }, [])

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    setSettings(await window.digipat.updateSettings(patch))
  }, [])

  if (!settings || !model || !voice) return <div className="p-8 text-sm text-stone-500">Starting…</div>

  if (settings.acceptedDisclaimerVersion < DISCLAIMER_VERSION) {
    return <Onboarding onAccept={() => updateSettings({ acceptedDisclaimerVersion: DISCLAIMER_VERSION })} />
  }

  // During a station the whole window is dedicated to the encounter.
  const fullscreen = route.name === 'encounter' || route.name === 'brief'
  const navigate: Navigate = setRoute
  const voiceReady = settings.voiceInput && voice.phase === 'ready'

  return (
    <div className="flex h-full flex-col">
      <header className="drag flex h-12 shrink-0 items-center gap-3 border-b border-stone-200 pr-4 pl-20 dark:border-stone-800">
        <span className="text-sm font-semibold">DigiPat</span>
        <EducationalBadge />
        <span className="ml-auto flex items-center gap-2 text-xs text-stone-500">
          <span
            className={`h-2 w-2 rounded-full ${
              model.phase === 'ready'
                ? 'bg-emerald-500'
                : model.phase === 'error'
                  ? 'bg-red-500'
                  : 'animate-pulse bg-amber-400'
            }`}
          />
          {model.phase === 'ready'
            ? `Model ready (${model.device === 'gpu' ? 'Metal GPU' : 'CPU'})`
            : model.phase === 'downloading'
              ? `Downloading model ${model.downloadPercent.toFixed(0)}%`
              : model.phase === 'loading'
                ? 'Loading model…'
                : model.phase === 'error'
                  ? 'Model error'
                  : 'Model not loaded'}
        </span>
      </header>
      <div className="flex min-h-0 flex-1">
        {!fullscreen && (
          <nav className="w-48 shrink-0 space-y-1 border-r border-stone-200 p-3 dark:border-stone-800">
            {NAV.map((n) => (
              <button
                key={n.label}
                onClick={() => navigate(n.route)}
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                  route.name === n.route.name
                    ? 'bg-brand-50 font-medium text-brand-700 dark:bg-stone-800 dark:text-brand-100'
                    : 'text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-900'
                }`}
              >
                {n.label}
              </button>
            ))}
          </nav>
        )}
        <main className="min-w-0 flex-1 overflow-y-auto">
          {route.name === 'library' && <Library navigate={navigate} modelReady={model.phase === 'ready'} />}
          {route.name === 'model' && (
            <ModelSetup status={model} voice={voice} settings={settings} updateSettings={updateSettings} />
          )}
          {route.name === 'brief' && (
            <Brief
              stationId={route.stationId}
              settings={settings}
              modelReady={model.phase === 'ready'}
              navigate={navigate}
            />
          )}
          {route.name === 'encounter' && (
            <Encounter
              stationId={route.stationId}
              session={route.session}
              settings={settings}
              voiceReady={voiceReady}
              navigate={navigate}
            />
          )}
          {route.name === 'post' && (
            <PostEncounter
              stationId={route.stationId}
              sessionId={route.sessionId}
              voiceInput={settings.voiceInput}
              voiceReady={voiceReady}
              navigate={navigate}
            />
          )}
          {route.name === 'feedback' && (
            <FeedbackView sessionId={route.sessionId} navigate={navigate} modelReady={model.phase === 'ready'} />
          )}
          {route.name === 'progress' && <Progress navigate={navigate} />}
          {route.name === 'editor' && (
            <StationEditor key={`${route.stationId}-${route.duplicate}`} stationId={route.stationId} duplicate={route.duplicate} navigate={navigate} />
          )}
          {route.name === 'about' && <About settings={settings} updateSettings={updateSettings} />}
        </main>
      </div>
    </div>
  )
}
