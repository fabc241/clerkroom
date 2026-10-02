import { app, dialog, ipcMain, nativeTheme, shell, systemPreferences, type BrowserWindow } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import type { LockChangeResult, LockStatus, ModelChoice, Settings } from '@shared/ipcTypes'
import { MODEL_OPTIONS, modelManager, modelsDir } from './qvac/modelManager'
import { voiceManager } from './qvac/transcriber'
import type { EncounterService } from './encounter'
import type { SessionStore } from './store/sessionStore'
import type { SettingsStore } from './store/settingsStore'
import type { StationStore } from './store/stationStore'
import { sessionToMarkdown } from './exportSession'
import type { AppLock } from './appLock'
import { rewriteJsonFiles, setEncryptWrites } from './store/jsonFiles'

const EXTERNAL_LINKS = {
  'licence-qvac': 'https://github.com/tetherto/qvac/blob/main/LICENSE',
  'licence-medpsy': 'https://huggingface.co/qvac/MedPsy-4B-GGUF',
  'crisis-info': 'https://findahelpline.com'
} as const

export function registerIpc(deps: {
  getWindow: () => BrowserWindow | null
  settings: SettingsStore
  stations: StationStore
  sessions: SessionStore
  encounter: EncounterService
  lock: AppLock
  /** Folders holding the user's own records, re-encrypted or decrypted when the lock is toggled. */
  dataDirs: string[]
  /** Asks the Keychain, so it is called only when the user turns the lock on. */
  encryptionAvailable: () => boolean
}): void {
  const { settings, stations, sessions, encounter, lock } = deps
  const send = (channel: string, ...args: unknown[]): void => {
    const w = deps.getWindow()
    if (w && !w.isDestroyed()) w.webContents.send(channel, ...args)
  }

  // While the app is locked, every request except checking and unlocking waits until the user
  // unlocks, so neither the UI nor DevTools can read data past the lock screen.
  const OPEN_WHILE_LOCKED = new Set(['lock:status', 'lock:unlock'])
  const handle = (channel: string, fn: Parameters<typeof ipcMain.handle>[1]): void =>
    ipcMain.handle(channel, async (e, ...args) => {
      if (!OPEN_WHILE_LOCKED.has(channel)) await lock.whenUnlocked()
      return fn(e, ...args)
    })

  modelManager.on('status', (s) => send('model:status', s))
  lock.on('change', (locked: boolean) => send('lock:changed', locked))

  // App lock
  handle('lock:status', async (): Promise<LockStatus> => ({
    enabled: settings.get().appLock,
    locked: lock.isLocked,
    available: await lock.available()
  }))
  handle('lock:unlock', () => lock.unlock())
  handle('lock:now', () => lock.lock())
  handle('lock:setEnabled', async (_e, on: boolean): Promise<{ result: LockChangeResult; settings: Settings }> => {
    if (on === settings.get().appLock) return { result: 'unlocked', settings: settings.get() }
    if (on && !deps.encryptionAvailable()) return { result: 'keychain-unavailable', settings: settings.get() }
    const result = await lock.authenticate(on ? 'turn on the app lock' : 'turn off the app lock')
    if (result !== 'unlocked') return { result, settings: settings.get() }
    // Rewrite the data first: if this is interrupted, encrypted files left behind keep the lock on at next launch.
    setEncryptWrites(on)
    for (const dir of deps.dataDirs) rewriteJsonFiles(dir)
    return { result, settings: settings.setAppLock(on) }
  })
  voiceManager.on('status', (s) => send('voice:status', s))

  // Settings
  handle('settings:get', () => settings.get())
  handle('settings:update', (_e, patch: Partial<Settings>) => {
    const next = settings.update(patch)
    // Turning voice input off releases the speech model's memory straight away.
    if (patch.voiceInput === false) void voiceManager.unload()
    // The renderer follows prefers-color-scheme, which Electron derives from themeSource.
    if (patch.appearance) nativeTheme.themeSource = next.appearance
    return next
  })

  // Model
  handle('model:options', () => MODEL_OPTIONS)
  handle('model:status', () => modelManager.getStatus(settings.get().model))
  handle('model:prepare', () => modelManager.prepare(settings.get().model))
  handle('model:cancelDownload', () => modelManager.cancelDownload())
  handle('model:delete', (_e, choice: ModelChoice) => {
    if (!MODEL_OPTIONS.some((o) => o.id === choice)) throw new Error(`Unknown model: ${String(choice)}`)
    return modelManager.deleteModel(choice)
  })

  // Voice input
  const assertVoiceEnabled = (): void => {
    if (!settings.get().voiceInput) throw new Error('Voice input is turned off.')
  }
  handle('voice:status', () => voiceManager.getStatus())
  handle('voice:prepare', () => {
    assertVoiceEnabled()
    return voiceManager.prepare()
  })
  handle('voice:cancelDownload', () => voiceManager.cancelDownload())
  handle('voice:delete', () => voiceManager.deleteModel())
  handle('voice:requestMicrophone', async () => {
    assertVoiceEnabled()
    if (process.platform !== 'darwin') return true
    // Shows the macOS prompt the first time; resolves false if access was denied in System Settings.
    return systemPreferences.askForMediaAccess('microphone')
  })
  handle('voice:transcribe', (_e, pcm: unknown) => {
    assertVoiceEnabled()
    return voiceManager.transcribe(pcm)
  })

  // Stations
  handle('station:list', () => stations.list())
  handle('station:get', (_e, id: string) => stations.get(id))
  handle('station:save', (_e, s: unknown) => stations.save(s))
  handle('station:delete', (_e, id: string) => stations.delete(id))
  handle('station:validate', (_e, s: unknown) => stations.validate(s))
  handle('station:import', async () => {
    const w = deps.getWindow()
    const res = await dialog.showOpenDialog(w!, {
      title: 'Import station',
      filters: [{ name: 'Station JSON', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (res.canceled || !res.filePaths[0]) return null
    let data: unknown
    try {
      data = JSON.parse(readFileSync(res.filePaths[0], 'utf8'))
    } catch (err) {
      return { ok: false, errors: [`Not valid JSON: ${(err as Error).message}`] }
    }
    return stations.save(data)
  })
  handle('station:export', async (_e, id: string) => {
    const found = stations.get(id)
    if (!found) return false
    const res = await dialog.showSaveDialog(deps.getWindow()!, {
      title: 'Export station',
      defaultPath: `${found.station.id}.json`,
      filters: [{ name: 'Station JSON', extensions: ['json'] }]
    })
    if (res.canceled || !res.filePath) return false
    writeFileSync(res.filePath, JSON.stringify(found.station, null, 2))
    return true
  })

  // Encounter
  handle('session:start', (_e, stationId: string) => encounter.start(stationId))
  handle('session:send', (_e, id: string, text: string) => {
    // Fire-and-forget: results stream back on 'patient:stream'.
    encounter
      .sendToPatient(id, text, (ev) => send('patient:stream', id, ev))
      .catch((err: Error) => send('patient:stream', id, { type: 'error', message: err.message }))
  })
  handle('session:interrupt', (_e, id: string) => encounter.interrupt(id))
  handle('session:examine', (_e, id: string, system: string) => encounter.examine(id, system))
  handle('session:investigate', (_e, id: string, test: string) => encounter.investigate(id, test))
  handle('session:end', (_e, id: string, reason: 'time' | 'candidate') => encounter.end(id, reason))
  handle('session:answers', (_e, id: string, answers: { question: string; answer: string }[]) =>
    encounter.submitAnswers(id, answers)
  )
  handle('session:feedback', (_e, id: string) =>
    encounter.feedback(id, (p) => send('feedback:progress', id, p))
  )

  // History
  handle('history:list', () => sessions.list())
  handle('history:get', (_e, id: string) => sessions.get(id))
  handle('history:delete', (_e, id: string) => sessions.delete(id))
  handle('history:export', async (_e, id: string, format: 'json' | 'md') => {
    const r = sessions.get(id)
    if (!r) return false
    const res = await dialog.showSaveDialog(deps.getWindow()!, {
      title: 'Export session',
      defaultPath: `clerkroom-${r.stationId}-${new Date(r.startedAt).toISOString().slice(0, 10)}.${format}`
    })
    if (res.canceled || !res.filePath) return false
    writeFileSync(res.filePath, format === 'json' ? JSON.stringify(r, null, 2) : sessionToMarkdown(r))
    return true
  })

  // Misc
  handle('app:openExternal', (_e, key: keyof typeof EXTERNAL_LINKS) => {
    // Own keys only, so a key such as 'constructor' cannot reach an inherited property.
    if (Object.hasOwn(EXTERNAL_LINKS, key)) return shell.openExternal(EXTERNAL_LINKS[key])
  })
  handle('app:info', () => ({
    version: app.getVersion(),
    modelsDir: modelsDir(),
    dataDir: app.getPath('userData')
  }))
}
