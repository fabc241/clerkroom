import { existsSync, mkdirSync, readdirSync, renameSync } from 'fs'
import { join } from 'path'

/**
 * The app used to be called DigiPat. Moves its records into the Clerkroom data folder so progress
 * survives the rename. Electron creates the new folder (caches) before the app's code runs, so this
 * moves the app's own files rather than the folder, and never overwrites a file that already exists.
 * Returns how many files were moved.
 */
export function migrateLegacyData(legacyDir: string, dataDir: string): number {
  if (!existsSync(legacyDir)) return 0
  let moved = 0
  const move = (from: string, to: string): void => {
    if (existsSync(from) && !existsSync(to)) {
      renameSync(from, to)
      moved++
    }
  }
  for (const folder of ['sessions', 'stations']) {
    const from = join(legacyDir, folder)
    if (!existsSync(from)) continue
    mkdirSync(join(dataDir, folder), { recursive: true })
    for (const f of readdirSync(from).filter((f) => f.endsWith('.json'))) move(join(from, f), join(dataDir, folder, f))
  }
  mkdirSync(dataDir, { recursive: true })
  move(join(legacyDir, 'settings.json'), join(dataDir, 'settings.json'))
  return moved
}
