import { useEffect, useState } from 'react'
import type { Appearance, LockStatus, Settings } from '@shared/ipcTypes'
import { ChipGroup, Choice, Icon, PageHeader, Panel } from '../components/ui'
import { DISCLAIMER_POINTS } from './Onboarding'

const STATION_LENGTHS: [string, string][] = [
  ['', 'As set by each station'],
  ['300', '5 minutes'],
  ['480', '8 minutes'],
  ['600', '10 minutes'],
  ['900', '15 minutes, relaxed practice']
]

export function About({
  settings,
  updateSettings,
  onSettings
}: {
  settings: Settings
  updateSettings: (p: Partial<Settings>) => Promise<void>
  onSettings: (s: Settings) => void
}): React.JSX.Element {
  const [info, setInfo] = useState<{ version: string; modelsDir: string; dataDir: string } | null>(null)
  useEffect(() => {
    window.clerkroom.appInfo().then(setInfo)
  }, [])

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-10 pt-8 pb-16">
      <PageHeader
        title="Settings & about"
        description={`Clerkroom ${info?.version ?? ''} · free and non-commercial`}
      />

      <Panel title="Appearance">
        <ChipGroup<Appearance>
          label="Mode"
          value={settings.appearance}
          onChange={(appearance) => updateSettings({ appearance })}
          options={[
            ['light', 'Light'],
            ['dark', 'Dark'],
            ['system', 'System (match macOS)']
          ]}
        />
        <p className="text-[13.5px] text-text-2">Also available from the switch at the top right of the window.</p>
      </Panel>

      <Panel title="Practice">
        <ChipGroup
          label="Station length"
          value={settings.stationSecondsOverride === null ? '' : String(settings.stationSecondsOverride)}
          onChange={(v) => updateSettings({ stationSecondsOverride: v ? Number(v) : null })}
          options={STATION_LENGTHS}
        />
        <Choice
          type="checkbox"
          checked={settings.skipReadingTime}
          onChange={(on) => updateSettings({ skipReadingTime: on })}
        >
          <span className="text-[14.5px] text-text">Skip reading time and go straight into the consultation</span>
        </Choice>
      </Panel>

      <AppLockPanel settings={settings} onSettings={onSettings} />

      <Panel title="Intended use">
        <ol className="max-w-[72ch] space-y-2.5 text-[15px] leading-relaxed text-text">
          {DISCLAIMER_POINTS.map((p, i) => (
            <li key={p} className="flex gap-3">
              <span className="num w-5 shrink-0 text-[15px] text-text-2">{i + 1}</span>
              {p}
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title="Privacy">
        <p className="max-w-[72ch] text-[15px] leading-relaxed text-text">
          Clerkroom has no accounts, analytics or telemetry. The only network activity is the one-time model download from
          the QVAC registry. If you turn on voice input, speech is transcribed on this Mac and the audio is discarded
          straight away; only the text you send is kept. Spoken replies are made on this Mac and only played, never
          saved. Your stations and attempts are stored as files on this Mac
          {settings.appLock ? ', encrypted while the app lock is on' : ''}:
        </p>
        <dl className="selectable grid grid-cols-[80px_1fr] gap-y-1 font-mono text-[12.5px] text-text-2">
          <dt className="field-label pt-0.5">Data</dt>
          <dd>{info?.dataDir}</dd>
          <dt className="field-label pt-0.5">Models</dt>
          <dd>{info?.modelsDir}</dd>
        </dl>
      </Panel>

      <Panel title="Licences & credits">
        <div className="max-w-[72ch] space-y-3 text-[15px] leading-relaxed text-text">
          <p>
            Local inference by the{' '}
            <button className="link" onClick={() => window.clerkroom.openExternal('licence-qvac')}>
              QVAC SDK
            </button>{' '}
            (Tether, Apache-2.0).
          </p>
          <p>
            Language model:{' '}
            <button className="link" onClick={() => window.clerkroom.openExternal('licence-medpsy')}>
              MedPsy
            </button>{' '}
            by Tether AI Research, released under Apache-2.0 for research and educational purposes. Its synthetic training
            data is licensed CC-BY-NC 4.0, so this app is distributed free of charge and for non-commercial use only.
            MedPsy is not a substitute for clinical judgement.
          </p>
          <p>Optional voice input: Parakeet Unified 0.6B speech recognition, from the QVAC registry.</p>
          <p>Optional spoken replies: Supertonic 3 by Supertone (OpenRAIL-M), from the QVAC registry.</p>
          <p>Typefaces: Barlow and Barlow Condensed by Jeremy Tribby, SIL Open Font License 1.1.</p>
          <p>
            The bundled stations are fictional teaching cases written for this app, structured around common clinical
            skills assessment frameworks (e.g. Calgary–Cambridge, data gathering / clinical management / interpersonal
            skills).
          </p>
        </div>
      </Panel>
    </div>
  )
}

/** Touch ID / Mac password lock. Turning it on or off asks macOS to confirm it is the Mac's owner. */
function AppLockPanel({
  settings,
  onSettings
}: {
  settings: Settings
  onSettings: (s: Settings) => void
}): React.JSX.Element {
  const [status, setStatus] = useState<LockStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => {
    window.clerkroom.getLockStatus().then(setStatus)
  }, [settings.appLock])

  const toggle = async (on: boolean): Promise<void> => {
    setBusy(true)
    setMessage(null)
    try {
      const { result, settings: next } = await window.clerkroom.setLockEnabled(on)
      onSettings(next)
      if (result === 'cancelled') setMessage(`The lock is still ${on ? 'off' : 'on'}: macOS did not confirm it was you.`)
      if (result === 'unavailable') setMessage('This Mac could not confirm it is you. Check that it has a login password in System Settings.')
      if (result === 'keychain-unavailable')
        setMessage('macOS did not let Clerkroom use the Keychain, so your data could not be encrypted. The lock is still off.')
    } catch (err) {
      setMessage(`Could not change the lock: ${(err as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const unavailable = status !== null && !status.available && !settings.appLock
  return (
    <Panel title="App lock">
      <Choice
        type="checkbox"
        align="start"
        checked={settings.appLock}
        disabled={busy || status === null || unavailable}
        onChange={(on) => void toggle(on)}
      >
        <span className="block text-[14.5px] text-text">Lock Clerkroom with Touch ID or your Mac password</span>
        <span className="mt-1 block max-w-[64ch] text-[13.5px] leading-relaxed text-text-2">
          Clerkroom asks for Touch ID or your Mac password when it opens and after your Mac sleeps or its screen locks.
          Your saved attempts and stations are encrypted with a key kept in your macOS Keychain. Nothing is sent
          anywhere and there is no account or extra password to remember.
        </span>
      </Choice>
      {unavailable && (
        <p className="text-[13.5px] text-text-2">
          Not available on this Mac: set a login password in System Settings › Touch ID &amp; Password to use it.
        </p>
      )}
      {message && (
        <p role="alert" className="text-[13.5px] text-bad">
          {message}
        </p>
      )}
      {settings.appLock && (
        <div>
          <button className="btn btn-sm" onClick={() => void window.clerkroom.lockNow()}>
            <Icon name="lock" className="h-3.5 w-3.5" /> Lock now
          </button>
        </div>
      )}
    </Panel>
  )
}
