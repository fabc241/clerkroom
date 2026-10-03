import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { StationStore } from '../../src/main/store/stationStore'
import { SessionStore } from '../../src/main/store/sessionStore'
import { SettingsStore } from '../../src/main/store/settingsStore'
import { migrateLegacyData } from '../../src/main/store/legacyData'
import { sessionToMarkdown } from '../../src/main/exportSession'
import type { SessionRecord } from '../../src/shared/sessionTypes'
import { STATIONS_DIR, rawStation } from './helpers'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'clerkroom-test-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('StationStore', () => {
  it('lists bundled stations and saves/deletes user stations', () => {
    const store = new StationStore(STATIONS_DIR, join(dir, 'stations'))
    expect(store.loadErrors).toEqual([])
    expect(store.list()).toHaveLength(12)

    const custom = { ...rawStation('med-chest-pain'), id: 'my-chest-pain', title: 'My chest pain' }
    const res = store.save(custom)
    expect(res.ok).toBe(true)
    expect(store.list()).toHaveLength(13)
    expect(store.get('my-chest-pain')?.bundled).toBe(false)

    store.delete('my-chest-pain')
    expect(store.get('my-chest-pain')).toBeNull()
  })

  it('refuses to overwrite or delete a built-in station', () => {
    const store = new StationStore(STATIONS_DIR, join(dir, 'stations'))
    const res = store.save(rawStation('med-chest-pain'))
    expect(res.ok).toBe(false)
    expect(() => store.delete('med-chest-pain')).toThrow()
  })

  it('returns readable validation errors', () => {
    const store = new StationStore(STATIONS_DIR, join(dir, 'stations'))
    const res = store.validate({ id: 'x' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.errors.some((e) => e.startsWith('title'))).toBe(true)
  })

  it('rejects path traversal ids', () => {
    const store = new StationStore(STATIONS_DIR, join(dir, 'stations'))
    expect(() => store.get('../../etc/passwd')).toThrow()
  })
})

describe('SessionStore and export', () => {
  const record: SessionRecord = {
    id: 'abc-123',
    stationId: 'psych-low-mood',
    stationTitle: 'Low mood — history',
    stationVersion: 1,
    startedAt: 1_700_000_000_000,
    endedAt: 1_700_000_480_000,
    transcript: [
      { kind: 'candidate', text: 'Hello', at: 0 },
      { kind: 'patient', text: 'Hi doctor', at: 1 }
    ],
    disclosedTopics: [],
    postAnswers: [],
    feedback: null
  }

  it('saves, lists and deletes sessions', () => {
    const store = new SessionStore(join(dir, 'sessions'))
    store.save(record)
    expect(store.get('abc-123')?.stationId).toBe('psych-low-mood')
    expect(store.list()[0]).toMatchObject({ id: 'abc-123', overallPercent: null })
    store.delete('abc-123')
    expect(store.list()).toEqual([])
  })

  it('exports markdown with the educational disclaimer', () => {
    const md = sessionToMarkdown(record)
    expect(md).toContain('Not a medical device')
    expect(md).toContain('**Doctor:** Hello')
    expect(md).toContain('**Patient:** Hi doctor')
  })
})

describe('SettingsStore', () => {
  it('persists known keys and ignores unknown ones', () => {
    const path = join(dir, 'settings.json')
    const s = new SettingsStore(path)
    s.update({ acceptedDisclaimerVersion: 1, bogus: true } as never)
    const reloaded = new SettingsStore(path).get()
    expect(reloaded.acceptedDisclaimerVersion).toBe(1)
    expect('bogus' in reloaded).toBe(false)
  })

  it('follows macOS appearance by default and rejects unknown appearance values', () => {
    const path = join(dir, 'settings.json')
    expect(new SettingsStore(path).get().appearance).toBe('system')
    new SettingsStore(path).update({ appearance: 'dark' })
    expect(new SettingsStore(path).get().appearance).toBe('dark')
    new SettingsStore(path).update({ appearance: 'sepia' as never })
    expect(new SettingsStore(path).get().appearance).toBe('dark')
  })

  it('drops values of the wrong shape and never changes the app lock', () => {
    const path = join(dir, 'settings.json')
    new SettingsStore(path).update({
      model: 'gpt' as never,
      stationSecondsOverride: -5,
      voiceInput: 'yes' as never,
      speakReplies: 1 as never,
      acceptedDisclaimerVersion: 1.5,
      appLock: true
    })
    expect(new SettingsStore(path).get()).toMatchObject({
      model: 'medpsy-4b-q4',
      stationSecondsOverride: null,
      voiceInput: false,
      speakReplies: false,
      acceptedDisclaimerVersion: 0,
      appLock: false
    })
    new SettingsStore(path).update({ model: 'medpsy-1.7b-q4', stationSecondsOverride: 300 })
    expect(new SettingsStore(path).get()).toMatchObject({ model: 'medpsy-1.7b-q4', stationSecondsOverride: 300 })
  })

  it('keeps voice input and spoken replies off until the user turns them on, including for older settings files', () => {
    const path = join(dir, 'settings.json')
    writeFileSync(path, JSON.stringify({ acceptedDisclaimerVersion: 1, model: 'medpsy-4b-q4' }))
    expect(new SettingsStore(path).get()).toMatchObject({ voiceInput: false, speakReplies: false })
    new SettingsStore(path).update({ voiceInput: true, speakReplies: true })
    expect(new SettingsStore(path).get()).toMatchObject({ voiceInput: true, speakReplies: true })
  })
})

describe('migrateLegacyData', () => {
  it('moves DigiPat records into a Clerkroom folder that Electron already created', () => {
    const legacy = join(dir, 'DigiPat')
    const data = join(dir, 'Clerkroom')
    mkdirSync(join(legacy, 'sessions'), { recursive: true })
    writeFileSync(join(legacy, 'sessions', 'a.json'), '{"id":"a"}')
    writeFileSync(join(legacy, 'sessions', 'b.json'), '{"id":"b"}')
    writeFileSync(join(legacy, 'settings.json'), '{"appearance":"dark"}')
    // Electron's own caches and a newer settings file already exist in the new folder.
    mkdirSync(join(data, 'Cache'), { recursive: true })
    writeFileSync(join(data, 'settings.json'), '{"appearance":"system"}')

    expect(migrateLegacyData(legacy, data)).toBe(2)
    expect(readdirSync(join(data, 'sessions')).sort()).toEqual(['a.json', 'b.json'])
    expect(readdirSync(join(legacy, 'sessions'))).toEqual([])
    // An existing file is never overwritten.
    expect(readFileSync(join(data, 'settings.json'), 'utf8')).toBe('{"appearance":"system"}')
    expect(existsSync(join(legacy, 'settings.json'))).toBe(true)

    expect(migrateLegacyData(legacy, data)).toBe(0)
  })

  it('does nothing when there is no DigiPat folder', () => {
    expect(migrateLegacyData(join(dir, 'missing'), join(dir, 'Clerkroom'))).toBe(0)
  })
})
