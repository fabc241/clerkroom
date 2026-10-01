import { existsSync } from 'fs'
import type { Appearance, Settings } from '@shared/ipcTypes'
import { readJson, writeJson } from './jsonFiles'

const DEFAULTS: Settings = {
  acceptedDisclaimerVersion: 0,
  model: 'medpsy-4b-q4',
  stationSecondsOverride: null,
  skipReadingTime: false,
  voiceInput: false,
  appearance: 'system',
  appLock: false
}

const APPEARANCES: Appearance[] = ['system', 'light', 'dark']

export class SettingsStore {
  private cache: Settings

  constructor(private readonly path: string) {
    this.cache = existsSync(path) ? { ...DEFAULTS, ...readJson<Partial<Settings>>(path) } : { ...DEFAULTS }
  }

  get(): Settings {
    return { ...this.cache }
  }

  update(patch: Partial<Settings>): Settings {
    // The app lock is changed only through setAppLock, after the user has authenticated.
    const allowed: (keyof Settings)[] = (Object.keys(DEFAULTS) as (keyof Settings)[]).filter((k) => k !== 'appLock')
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([k]) => allowed.includes(k as keyof Settings))
    ) as Partial<Settings>
    if (clean.appearance !== undefined && !APPEARANCES.includes(clean.appearance)) delete clean.appearance
    this.cache = { ...this.cache, ...clean }
    writeJson(this.path, this.cache)
    return this.get()
  }

  setAppLock(on: boolean): Settings {
    this.cache = { ...this.cache, appLock: on }
    writeJson(this.path, this.cache)
    return this.get()
  }
}
