import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, renameSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'

/** Encrypts saved attempts and user stations; in the app this is Electron's safeStorage (macOS Keychain key). */
export interface Cipher {
  encrypt(plain: string): Buffer
  decrypt(data: Buffer): string
}

// Encrypted records keep their .json name but start with this marker instead of JSON.
const ENCRYPTED = Buffer.from('CLRKENC1')

let cipher: Cipher | null = null
let encryptWrites = false

export function setCipher(c: Cipher | null): void {
  cipher = c
}

/** Turns encryption of secure writes on or off. Reading handles both forms either way. */
export function setEncryptWrites(on: boolean): void {
  encryptWrites = on
}

export function readJson<T>(path: string): T {
  const raw = readFileSync(path)
  if (!raw.subarray(0, ENCRYPTED.length).equals(ENCRYPTED)) return JSON.parse(raw.toString('utf8')) as T
  if (!cipher) throw new Error(`Cannot decrypt ${path}`)
  return JSON.parse(cipher.decrypt(raw.subarray(ENCRYPTED.length))) as T
}

/**
 * Atomic write: temp file + rename, so a crash never leaves a half-written record. `secure` marks
 * the user's own data (attempts, stations), which is encrypted while the app lock is on.
 */
export function writeJson(path: string, data: unknown, secure = false): void {
  mkdirSync(dirname(path), { recursive: true })
  const json = JSON.stringify(data, null, 2)
  const tmp = `${path}.tmp`
  writeFileSync(tmp, secure && encryptWrites && cipher ? Buffer.concat([ENCRYPTED, cipher.encrypt(json)]) : json)
  renameSync(tmp, path)
}

function isEncrypted(path: string): boolean {
  const head = Buffer.alloc(ENCRYPTED.length)
  const fd = openSync(path, 'r')
  try {
    return readSync(fd, head, 0, head.length, 0) === head.length && head.equals(ENCRYPTED)
  } finally {
    closeSync(fd)
  }
}

function jsonFiles(dir: string): string[] {
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => join(dir, f)) : []
}

export function hasEncryptedFiles(dir: string): boolean {
  return jsonFiles(dir).some(isEncrypted)
}

/** Encrypts any record in `dir` that is still plain, e.g. one moved in from an older version. */
export function encryptPlainFiles(dir: string): void {
  for (const path of jsonFiles(dir)) if (!isEncrypted(path)) writeJson(path, readJson(path), true)
}

/** Rewrites every record in `dir` in the current form, after the app lock is turned on or off. */
export function rewriteJsonFiles(dir: string): void {
  for (const path of jsonFiles(dir)) writeJson(path, readJson(path), true)
}

export function safeFileId(id: string): string {
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(id)) throw new Error(`Invalid id: ${id}`)
  return id
}
