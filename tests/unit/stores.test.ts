import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { StationStore } from '../../src/main/store/stationStore'
import { SessionStore } from '../../src/main/store/sessionStore'
import { SettingsStore } from '../../src/main/store/settingsStore'
import { sessionToMarkdown } from '../../src/main/exportSession'
import type { SessionRecord } from '../../src/shared/sessionTypes'
import { STATIONS_DIR, rawStation } from './helpers'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'digipat-test-'))
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

  it('keeps voice input off until the user turns it on, including for older settings files', () => {
    const path = join(dir, 'settings.json')
    writeFileSync(path, JSON.stringify({ acceptedDisclaimerVersion: 1, model: 'medpsy-4b-q4' }))
    expect(new SettingsStore(path).get().voiceInput).toBe(false)
    new SettingsStore(path).update({ voiceInput: true })
    expect(new SettingsStore(path).get().voiceInput).toBe(true)
  })
})
