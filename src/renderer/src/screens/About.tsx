import { useEffect, useState } from 'react'
import type { Settings } from '@shared/ipcTypes'
import { DISCLAIMER_POINTS } from './Onboarding'

export function About({
  settings,
  updateSettings
}: {
  settings: Settings
  updateSettings: (p: Partial<Settings>) => Promise<void>
}): React.JSX.Element {
  const [info, setInfo] = useState<{ version: string; modelsDir: string; dataDir: string } | null>(null)
  useEffect(() => {
    window.digipat.appInfo().then(setInfo)
  }, [])

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-xl font-semibold">About & settings</h1>
        <p className="mt-1 text-sm text-stone-500">DigiPat {info?.version} · free and non-commercial</p>
      </div>

      <section className="card space-y-4">
        <h2 className="font-medium">Practice settings</h2>
        <label className="flex items-center justify-between gap-4 text-sm">
          <span>Station length</span>
          <select
            className="input w-56"
            value={settings.stationSecondsOverride ?? ''}
            onChange={(e) => updateSettings({ stationSecondsOverride: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">As set by each station</option>
            <option value="300">5 minutes</option>
            <option value="480">8 minutes</option>
            <option value="600">10 minutes</option>
            <option value="900">15 minutes (relaxed practice)</option>
          </select>
        </label>
        <label className="flex items-center justify-between gap-4 text-sm">
          <span>Skip reading time</span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand-600"
            checked={settings.skipReadingTime}
            onChange={(e) => updateSettings({ skipReadingTime: e.target.checked })}
          />
        </label>
      </section>

      <section className="card space-y-3">
        <h2 className="font-medium">Intended use</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">
          {DISCLAIMER_POINTS.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>

      <section className="card space-y-3 text-sm">
        <h2 className="font-medium">Privacy</h2>
        <p>
          The app has no accounts, analytics or telemetry. The only network activity is the one-time model download
          from the QVAC registry. Your stations and attempts are stored as files on this Mac:
        </p>
        <ul className="selectable space-y-1 font-mono text-xs text-stone-600 dark:text-stone-400">
          <li>Data: {info?.dataDir}</li>
          <li>Models: {info?.modelsDir}</li>
        </ul>
      </section>

      <section className="card space-y-3 text-sm">
        <h2 className="font-medium">Licences & credits</h2>
        <p>
          Local inference by the{' '}
          <button className="underline" onClick={() => window.digipat.openExternal('licence-qvac')}>
            QVAC SDK
          </button>{' '}
          (Tether, Apache-2.0).
        </p>
        <p>
          Language model:{' '}
          <button className="underline" onClick={() => window.digipat.openExternal('licence-medpsy')}>
            MedPsy
          </button>{' '}
          by Tether AI Research, released under Apache-2.0 for research and educational purposes. Its synthetic
          training data is licensed CC-BY-NC 4.0, so this app is distributed free of charge and for non-commercial
          use only. MedPsy is not a substitute for clinical judgement.
        </p>
        <p>
          The bundled stations are fictional teaching cases written for this app, structured around common clinical skills assessment
          frameworks (e.g. Calgary–Cambridge, data gathering / clinical management / interpersonal skills).
        </p>
      </section>
    </div>
  )
}
