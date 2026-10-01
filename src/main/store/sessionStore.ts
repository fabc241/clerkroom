import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import { join } from 'path'
import type { SessionListItem, SessionRecord } from '@shared/sessionTypes'
import { feedbackResult } from '@shared/rubric'
import { readJson, safeFileId, writeJson } from './jsonFiles'

export class SessionStore {
  constructor(private readonly dir: string) {
    mkdirSync(dir, { recursive: true })
  }

  private path(id: string): string {
    return join(this.dir, `${safeFileId(id)}.json`)
  }

  save(record: SessionRecord): void {
    writeJson(this.path(record.id), record, true)
  }

  get(id: string): SessionRecord | null {
    const p = this.path(id)
    return existsSync(p) ? readJson<SessionRecord>(p) : null
  }

  delete(id: string): void {
    const p = this.path(id)
    if (existsSync(p)) unlinkSync(p)
  }

  list(): SessionListItem[] {
    const items: SessionListItem[] = []
    for (const f of readdirSync(this.dir).filter((f) => f.endsWith('.json'))) {
      try {
        const r = readJson<SessionRecord>(join(this.dir, f))
        items.push({
          id: r.id,
          stationId: r.stationId,
          stationTitle: r.stationTitle,
          startedAt: r.startedAt,
          overallPercent: r.feedback?.overallPercent ?? null,
          result: r.feedback ? feedbackResult(r.feedback) : null,
          globalRating: r.feedback?.globalRating ?? null,
          domainScores: r.feedback?.domainScores ?? null
        })
      } catch {
        /* skip unreadable records */
      }
    }
    return items.sort((a, b) => b.startedAt - a.startedAt)
  }
}
