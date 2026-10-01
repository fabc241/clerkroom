import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppLock } from '../../src/main/appLock'
import {
  hasEncryptedFiles,
  readJson,
  rewriteJsonFiles,
  setCipher,
  setEncryptWrites,
  writeJson,
  type Cipher
} from '../../src/main/store/jsonFiles'
import { SettingsStore } from '../../src/main/store/settingsStore'

// Stand-in for safeStorage: reversible, and the output never contains the plain text.
const fakeCipher: Cipher = {
  encrypt: (s) => Buffer.from(Buffer.from(s).toString('base64').split('').reverse().join('')),
  decrypt: (b) => Buffer.from(b.toString().split('').reverse().join(''), 'base64').toString()
}

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'clerkroom-lock-'))
  setCipher(fakeCipher)
  setEncryptWrites(false)
})
afterEach(() => {
  setCipher(null)
  setEncryptWrites(false)
  rmSync(dir, { recursive: true, force: true })
})

describe('encrypted records', () => {
  const record = { id: 'abc', transcript: 'Hello Mr Evans' }

  it('encrypts secure writes only while the lock is on, and reads both forms', () => {
    const path = join(dir, 'abc.json')
    writeJson(path, record, true)
    expect(readFileSync(path, 'utf8')).toContain('Hello Mr Evans')

    setEncryptWrites(true)
    writeJson(path, record, true)
    expect(readFileSync(path, 'utf8')).not.toContain('Hello Mr Evans')
    expect(hasEncryptedFiles(dir)).toBe(true)
    expect(readJson(path)).toEqual(record)
  })

  it('never encrypts plain writes such as settings', () => {
    setEncryptWrites(true)
    const path = join(dir, 'settings.json')
    writeJson(path, { appLock: true })
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ appLock: true })
  })

  it('re-encrypts and decrypts a whole folder when the lock is toggled', () => {
    writeJson(join(dir, 'a.json'), record, true)
    writeJson(join(dir, 'b.json'), { ...record, id: 'b' }, true)
    setEncryptWrites(true)
    rewriteJsonFiles(dir)
    expect(hasEncryptedFiles(dir)).toBe(true)
    expect(readFileSync(join(dir, 'a.json'), 'utf8')).not.toContain('Evans')

    setEncryptWrites(false)
    rewriteJsonFiles(dir)
    expect(hasEncryptedFiles(dir)).toBe(false)
    expect(readJson(join(dir, 'b.json'))).toEqual({ ...record, id: 'b' })
  })

  it('cannot read an encrypted record without the key', () => {
    setEncryptWrites(true)
    writeJson(join(dir, 'a.json'), record, true)
    setCipher(null)
    expect(() => readJson(join(dir, 'a.json'))).toThrow()
  })
})

describe('SettingsStore', () => {
  it('ignores appLock in ordinary updates; only setAppLock changes it', () => {
    const store = new SettingsStore(join(dir, 'settings.json'))
    expect(store.update({ appLock: true, skipReadingTime: true }).appLock).toBe(false)
    expect(store.setAppLock(true).appLock).toBe(true)
    expect(new SettingsStore(join(dir, 'settings.json')).get().appLock).toBe(true)
  })
})

describe('AppLock', () => {
  const helper = (exitCode: number): string => {
    const path = join(dir, `helper-${exitCode}`)
    writeFileSync(path, `#!/bin/sh\nexit ${exitCode}\n`)
    chmodSync(path, 0o755)
    return path
  }

  it('holds requests until the user authenticates', async () => {
    const lock = new AppLock(helper(0), () => true, true)
    let served = false
    const request = lock.whenUnlocked().then(() => (served = true))
    await new Promise((r) => setTimeout(r, 20))
    expect(served).toBe(false)

    expect(await lock.unlock()).toBe('unlocked')
    await request
    expect(served).toBe(true)
    expect(lock.isLocked).toBe(false)
  })

  it('stays locked when the prompt is cancelled or unavailable', async () => {
    const cancelled = new AppLock(helper(1), () => true, true)
    expect(await cancelled.unlock()).toBe('cancelled')
    expect(cancelled.isLocked).toBe(true)

    const missing = new AppLock(join(dir, 'no-such-helper'), () => true, true)
    expect(await missing.unlock()).toBe('unavailable')
    expect(await missing.available()).toBe(false)
    expect(missing.isLocked).toBe(true)
  })

  it('locks again on sleep only while the lock is turned on', () => {
    let enabled = true
    const lock = new AppLock(helper(0), () => enabled, false)
    lock.lock()
    expect(lock.isLocked).toBe(true)

    enabled = false
    const off = new AppLock(helper(0), () => enabled, false)
    off.lock()
    expect(off.isLocked).toBe(false)
  })
})
