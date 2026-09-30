import { useCallback, useEffect, useRef, useState } from 'react'
import type { Appearance, ModelStatus, Settings, VoiceStatus } from '@shared/ipcTypes'
import type { SessionRecord } from '@shared/sessionTypes'
import { DISCLAIMER_VERSION } from '@shared/constants'
import { EducationalBadge } from './components/Notices'
import { Icon } from './components/ui'
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

const NAV: { route: Route; label: string; icon: 'grid' | 'chart' | 'edit' | 'cpu' | 'settings' }[] = [
  { route: { name: 'library' }, label: 'Stations', icon: 'grid' },
  { route: { name: 'progress' }, label: 'Progress', icon: 'chart' },
  { route: { name: 'editor' }, label: 'Station editor', icon: 'edit' },
  { route: { name: 'model' }, label: 'Model', icon: 'cpu' },
  { route: { name: 'about' }, label: 'Settings & about', icon: 'settings' }
]

export default function App(): React.JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [model, setModel] = useState<ModelStatus | null>(null)
  const [voice, setVoice] = useState<VoiceStatus | null>(null)
  const [route, setRoute] = useState<Route>(() => (import.meta.env.DEV && devRoute()) || { name: 'library' })

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

  // Each screen is a fresh sheet: start it at the top, not where the last one was scrolled.
  const mainRef = useRef<HTMLElement>(null)
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
  }, [route])

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    setSettings(await window.digipat.updateSettings(patch))
  }, [])

  if (!settings || !model || !voice) {
    return <div className="p-8 text-text-3">Starting…</div>
  }

  if (settings.acceptedDisclaimerVersion < DISCLAIMER_VERSION) {
    return <Onboarding onAccept={() => updateSettings({ acceptedDisclaimerVersion: DISCLAIMER_VERSION })} />
  }

  // During a station the whole window is dedicated to the encounter.
  const fullscreen = route.name === 'encounter' || route.name === 'brief'
  const navigate: Navigate = setRoute
  const voiceReady = settings.voiceInput && voice.phase === 'ready'
  const active = route.name === 'feedback' ? 'progress' : route.name === 'post' ? 'library' : route.name

  return (
    <div className="flex h-full flex-col">
      <header className="drag flex h-14 shrink-0 items-center gap-4 border-b border-line bg-surface pr-4 pl-[84px]">
        <span className="flex items-center gap-2">
          <LogoMark />
          <span className="text-[17px] font-bold tracking-[-0.01em]">DigiPat</span>
        </span>
        <EducationalBadge />
        <span className="ml-auto flex items-center gap-2 text-[12.5px] font-semibold whitespace-nowrap">
          <span
            className={`h-2 w-2 rounded-full ${
              model.phase === 'ready' ? 'bg-good' : model.phase === 'error' ? 'bg-bad' : 'animate-pulse bg-warn'
            }`}
            aria-hidden
          />
          <span className={model.phase === 'error' ? 'text-bad' : 'text-text-2'}>
            {model.phase === 'ready'
              ? `Model ready · ${model.device === 'gpu' ? 'Metal GPU' : 'CPU'}`
              : model.phase === 'downloading'
                ? `Downloading model ${model.downloadPercent.toFixed(0)}%`
                : model.phase === 'loading'
                  ? 'Loading model…'
                  : model.phase === 'error'
                    ? 'Model error'
                    : 'Model not loaded'}
          </span>
        </span>
        <AppearanceSwitch value={settings.appearance} onChange={(appearance) => updateSettings({ appearance })} />
      </header>
      <div className="flex min-h-0 flex-1">
        {!fullscreen && (
          <nav aria-label="Sections" className="w-56 shrink-0 border-r border-line bg-surface px-3 py-5">
            <ul className="space-y-1">
              {NAV.map((n) => {
                const current = active === n.route.name
                return (
                  <li key={n.label}>
                    <button
                      onClick={() => navigate(n.route)}
                      aria-current={current ? 'page' : undefined}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[14px] font-semibold transition-colors ${
                        current ? 'bg-surface-2 text-text ring-1 ring-line' : 'text-text-2 hover:bg-surface-2 hover:text-text'
                      }`}
                    >
                      <Icon name={n.icon} className="h-[18px] w-[18px]" />
                      {n.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>
        )}
        <main ref={mainRef} className="min-w-0 flex-1 overflow-y-auto">
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

const APPEARANCE: [Appearance, string, 'sun' | 'moon' | 'monitor'][] = [
  ['light', 'Light', 'sun'],
  ['dark', 'Dark', 'moon'],
  ['system', 'System', 'monitor']
]

/** Light / Dark / System, always reachable from the header. */
function AppearanceSwitch({
  value,
  onChange
}: {
  value: Appearance
  onChange: (a: Appearance) => void
}): React.JSX.Element {
  return (
    <div role="radiogroup" aria-label="Appearance" className="no-drag flex rounded-xl bg-surface-2 p-0.5 ring-1 ring-line">
      {APPEARANCE.map(([v, label, icon]) => (
        <button
          key={v}
          role="radio"
          aria-checked={value === v}
          title={v === 'system' ? 'System (match macOS)' : label}
          aria-label={v === 'system' ? 'System (match macOS)' : label}
          onClick={() => onChange(v)}
          className={`flex h-7 items-center gap-1.5 rounded-[10px] px-2.5 text-[12.5px] font-semibold transition-colors ${
            value === v ? 'bg-surface text-text shadow-card' : 'text-text-3 hover:text-text'
          }`}
        >
          <Icon name={icon} className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">{label}</span>
        </button>
      ))}
    </div>
  )
}

/** DigiPat mark: a speech bubble holding a pulse line. */
function LogoMark(): React.JSX.Element {
  return (
    <svg viewBox="0 0 28 28" className="h-7 w-7" aria-hidden>
      <path d="M6 4h16a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4h-8l-6 5v-5H6a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z" fill="var(--tint-sky)" stroke="var(--text)" strokeWidth={1.8} strokeLinejoin="round" />
      <path d="M7 13h4l2-4 3 8 2-4h3" fill="none" stroke="#e46d6b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Development only: open a screen directly from the URL hash, e.g. #{"name":"progress"}. */
function devRoute(): Route | null {
  try {
    return location.hash.length > 1 ? (JSON.parse(decodeURIComponent(location.hash.slice(1))) as Route) : null
  } catch {
    return null
  }
}
