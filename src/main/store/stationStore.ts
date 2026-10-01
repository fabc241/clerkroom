import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import { join } from 'path'
import {
  formatIssues,
  stationSchema,
  summarize,
  type Station,
  type StationSummary
} from '@shared/stationSchema'
import type { ImportResult } from '@shared/ipcTypes'
import { readJson, safeFileId, writeJson } from './jsonFiles'

/**
 * Bundled stations are read-only and ship with the app; user stations live in userData and
 * may be created, edited and deleted. A user station may not reuse a bundled station's id.
 */
export class StationStore {
  private bundled = new Map<string, Station>()
  private bundledErrors: string[] = []

  constructor(
    private readonly bundledDir: string,
    private readonly userDir: string
  ) {
    mkdirSync(userDir, { recursive: true })
    this.loadBundled()
  }

  private loadBundled(): void {
    if (!existsSync(this.bundledDir)) return
    for (const f of readdirSync(this.bundledDir).filter((f) => f.endsWith('.json'))) {
      const parsed = stationSchema.safeParse(readJson(join(this.bundledDir, f)))
      if (parsed.success) this.bundled.set(parsed.data.id, parsed.data)
      else this.bundledErrors.push(`${f}: ${formatIssues(parsed.error).join('; ')}`)
    }
  }

  get loadErrors(): string[] {
    return this.bundledErrors
  }

  private readUser(): Station[] {
    const out: Station[] = []
    for (const f of readdirSync(this.userDir).filter((f) => f.endsWith('.json'))) {
      const parsed = stationSchema.safeParse(readJson(join(this.userDir, f)))
      if (parsed.success) out.push(parsed.data)
    }
    return out
  }

  list(): StationSummary[] {
    const all = [
      ...[...this.bundled.values()].map((s) => summarize(s, true)),
      ...this.readUser().map((s) => summarize(s, false))
    ]
    return all.sort((a, b) => a.specialty.localeCompare(b.specialty) || a.title.localeCompare(b.title))
  }

  get(id: string): { station: Station; bundled: boolean } | null {
    const b = this.bundled.get(id)
    if (b) return { station: b, bundled: true }
    const path = join(this.userDir, `${safeFileId(id)}.json`)
    if (!existsSync(path)) return null
    const parsed = stationSchema.safeParse(readJson(path))
    return parsed.success ? { station: parsed.data, bundled: false } : null
  }

  validate(input: unknown): ImportResult {
    const parsed = stationSchema.safeParse(input)
    if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) }
    if (this.bundled.has(parsed.data.id)) {
      return {
        ok: false,
        errors: [`id: "${parsed.data.id}" is used by a built-in station — choose a different id`]
      }
    }
    return { ok: true, station: parsed.data }
  }

  save(input: unknown): ImportResult {
    const result = this.validate(input)
    if (result.ok) writeJson(join(this.userDir, `${safeFileId(result.station.id)}.json`), result.station, true)
    return result
  }

  delete(id: string): void {
    if (this.bundled.has(id)) throw new Error('Built-in stations cannot be deleted.')
    const path = join(this.userDir, `${safeFileId(id)}.json`)
    if (existsSync(path)) unlinkSync(path)
  }
}
