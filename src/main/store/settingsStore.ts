import { existsSync } from 'fs'
import type { Settings } from '@shared/ipcTypes'
import { readJson, writeJson } from './jsonFiles'

const DEFAULTS: Settings = {
  acceptedDisclaimerVersion: 0,
  model: 'medpsy-4b-q4',
  stationSecondsOverride: null,
  skipReadingTime: false
}

export class SettingsStore {
  private cache: Settings

  constructor(private readonly path: string) {
    this.cache = existsSync(path) ? { ...DEFAULTS, ...readJson<Partial<Settings>>(path) } : { ...DEFAULTS }
  }

  get(): Settings {
    return { ...this.cache }
  }

  update(patch: Partial<Settings>): Settings {
    const allowed: (keyof Settings)[] = Object.keys(DEFAULTS) as (keyof Settings)[]
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([k]) => allowed.includes(k as keyof Settings))
    ) as Partial<Settings>
    this.cache = { ...this.cache, ...clean }
    writeJson(this.path, this.cache)
    return this.get()
  }
}
