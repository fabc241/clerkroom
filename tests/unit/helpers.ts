import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { stationSchema, type Station } from '../../src/shared/stationSchema'

export const STATIONS_DIR = join(import.meta.dirname, '..', '..', 'stations')

export function loadBundledStations(): Station[] {
  return readdirSync(STATIONS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => stationSchema.parse(JSON.parse(readFileSync(join(STATIONS_DIR, f), 'utf8'))))
}

export function rawStation(id: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(STATIONS_DIR, `${id}.json`), 'utf8'))
}
