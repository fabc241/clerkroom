import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { dirname } from 'path'

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

/** Atomic write: temp file + rename, so a crash never leaves a half-written record. */
export function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
  renameSync(tmp, path)
}

export function safeFileId(id: string): string {
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(id)) throw new Error(`Invalid id: ${id}`)
  return id
}
