import { app, dialog, ipcMain, shell, type BrowserWindow } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import type { ModelChoice, Settings } from '@shared/ipcTypes'
import { MODEL_OPTIONS, modelManager, modelsDir } from './qvac/modelManager'
import type { EncounterService } from './encounter'
import type { SessionStore } from './store/sessionStore'
import type { SettingsStore } from './store/settingsStore'
import type { StationStore } from './store/stationStore'
import { sessionToMarkdown } from './exportSession'

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
}): void {
  const { settings, stations, sessions, encounter } = deps
  const send = (channel: string, ...args: unknown[]): void => {
    const w = deps.getWindow()
    if (w && !w.isDestroyed()) w.webContents.send(channel, ...args)
  }

  modelManager.on('status', (s) => send('model:status', s))

  // Settings
  ipcMain.handle('settings:get', () => settings.get())
  ipcMain.handle('settings:update', (_e, patch: Partial<Settings>) => settings.update(patch))

  // Model
  ipcMain.handle('model:options', () => MODEL_OPTIONS)
  ipcMain.handle('model:status', () => modelManager.getStatus(settings.get().model))
  ipcMain.handle('model:prepare', () => modelManager.prepare(settings.get().model))
  ipcMain.handle('model:cancelDownload', () => modelManager.cancelDownload())
  ipcMain.handle('model:delete', (_e, choice: ModelChoice) => modelManager.deleteModel(choice))

  // Stations
  ipcMain.handle('station:list', () => stations.list())
  ipcMain.handle('station:get', (_e, id: string) => stations.get(id))
  ipcMain.handle('station:save', (_e, s: unknown) => stations.save(s))
  ipcMain.handle('station:delete', (_e, id: string) => stations.delete(id))
  ipcMain.handle('station:validate', (_e, s: unknown) => stations.validate(s))
  ipcMain.handle('station:import', async () => {
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
  ipcMain.handle('station:export', async (_e, id: string) => {
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
  ipcMain.handle('session:start', (_e, stationId: string) => encounter.start(stationId))
  ipcMain.handle('session:send', (_e, id: string, text: string) => {
    // Fire-and-forget: results stream back on 'patient:stream'.
    encounter
      .sendToPatient(id, text, (ev) => send('patient:stream', id, ev))
      .catch((err: Error) => send('patient:stream', id, { type: 'error', message: err.message }))
  })
  ipcMain.handle('session:interrupt', (_e, id: string) => encounter.interrupt(id))
  ipcMain.handle('session:examine', (_e, id: string, system: string) => encounter.examine(id, system))
  ipcMain.handle('session:investigate', (_e, id: string, test: string) => encounter.investigate(id, test))
  ipcMain.handle('session:end', (_e, id: string, reason: 'time' | 'candidate') => encounter.end(id, reason))
  ipcMain.handle('session:answers', (_e, id: string, answers: { question: string; answer: string }[]) =>
    encounter.submitAnswers(id, answers)
  )
  ipcMain.handle('session:feedback', (_e, id: string) =>
    encounter.feedback(id, (p) => send('feedback:progress', id, p))
  )

  // History
  ipcMain.handle('history:list', () => sessions.list())
  ipcMain.handle('history:get', (_e, id: string) => sessions.get(id))
  ipcMain.handle('history:delete', (_e, id: string) => sessions.delete(id))
  ipcMain.handle('history:export', async (_e, id: string, format: 'json' | 'md') => {
    const r = sessions.get(id)
    if (!r) return false
    const res = await dialog.showSaveDialog(deps.getWindow()!, {
      title: 'Export session',
      defaultPath: `digipat-${r.stationId}-${new Date(r.startedAt).toISOString().slice(0, 10)}.${format}`
    })
    if (res.canceled || !res.filePath) return false
    writeFileSync(res.filePath, format === 'json' ? JSON.stringify(r, null, 2) : sessionToMarkdown(r))
    return true
  })

  // Misc
  ipcMain.handle('app:openExternal', (_e, key: keyof typeof EXTERNAL_LINKS) => {
    const url = EXTERNAL_LINKS[key]
    if (url) return shell.openExternal(url)
  })
  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    modelsDir: modelsDir(),
    dataDir: app.getPath('userData')
  }))
}
