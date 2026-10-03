import { existsSync } from 'fs'
import type { Appearance, ModelChoice, Settings } from '@shared/ipcTypes'
import { readJson, writeJson } from './jsonFiles'

const DEFAULTS: Settings = {
  acceptedDisclaimerVersion: 0,
  model: 'medpsy-4b-q4',
  stationSecondsOverride: null,
  skipReadingTime: false,
  voiceInput: false,
  speakReplies: false,
  appearance: 'system',
  appLock: false
}

const APPEARANCES: Appearance[] = ['system', 'light', 'dark']
const MODELS: ModelChoice[] = ['medpsy-4b-q4', 'medpsy-4b-q5', 'medpsy-1.7b-q4']

const isCount = (v: unknown): boolean => Number.isInteger(v) && (v as number) >= 0

// The renderer's patches are checked field by field; a value of the wrong shape is dropped.
const VALID: { [K in keyof Settings]: (v: unknown) => boolean } = {
  acceptedDisclaimerVersion: isCount,
  model: (v) => MODELS.includes(v as ModelChoice),
  stationSecondsOverride: (v) => v === null || (isCount(v) && (v as number) > 0),
  skipReadingTime: (v) => typeof v === 'boolean',
  voiceInput: (v) => typeof v === 'boolean',
  speakReplies: (v) => typeof v === 'boolean',
  appearance: (v) => APPEARANCES.includes(v as Appearance),
  appLock: (v) => typeof v === 'boolean'
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
    // The app lock is changed only through setAppLock, after the user has authenticated.
    const allowed: (keyof Settings)[] = (Object.keys(DEFAULTS) as (keyof Settings)[]).filter((k) => k !== 'appLock')
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([k, v]) => allowed.includes(k as keyof Settings) && VALID[k as keyof Settings](v))
    ) as Partial<Settings>
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
