import { app, BrowserWindow, session } from 'electron'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { is } from '@electron-toolkit/utils'
import { registerIpc } from './ipc'
import { modelManager } from './qvac/modelManager'
import { voiceManager } from './qvac/transcriber'
import { EncounterService, cleanupStaleSessionCaches } from './encounter'
import { SessionStore } from './store/sessionStore'
import { SettingsStore } from './store/settingsStore'
import { StationStore } from './store/stationStore'

const here = fileURLToPath(new URL('.', import.meta.url))
let win: BrowserWindow | null = null

// Lets tests and demos run against a throwaway data folder.
if (process.env['DIGIPAT_USER_DATA']) app.setPath('userData', process.env['DIGIPAT_USER_DATA'])

function createWindow(): void {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 620,
    show: false,
    title: 'DigiPat',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(here, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  win.on('ready-to-show', () => win?.show())
  win.on('closed', () => (win = null))

  // Offline-by-design: the renderer never navigates away or opens windows.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (e, url) => {
    if (!(is.dev && process.env['ELECTRON_RENDERER_URL'] && url.startsWith(process.env['ELECTRON_RENDERER_URL']))) {
      e.preventDefault()
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(here, '../renderer/index.html'))
  }
}

// One instance only: two copies would load the model twice and share session caches.
if (!app.requestSingleInstanceLock()) app.quit()
app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.whenReady().then(() => {
  const userData = app.getPath('userData')
  const settings = new SettingsStore(join(userData, 'settings.json'))

  // Deny every permission request (camera, geolocation, notifications...). The one exception is
  // the microphone, for the app's own window and only while the user has voice input turned on.
  const micAllowed = (wc: Electron.WebContents | null): boolean =>
    settings.get().voiceInput && !!win && !win.isDestroyed() && wc === win.webContents
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb, details) => {
    const media = perm === 'media' ? (details as Electron.MediaAccessPermissionRequest).mediaTypes ?? [] : []
    cb(micAllowed(wc) && media.length > 0 && media.every((t) => t === 'audio'))
  })
  session.defaultSession.setPermissionCheckHandler(
    (wc, perm, _origin, details) => perm === 'media' && details.mediaType === 'audio' && micAllowed(wc)
  )
  const stations = new StationStore(join(app.getAppPath(), 'stations'), join(userData, 'stations'))
  const sessions = new SessionStore(join(userData, 'sessions'))
  const encounter = new EncounterService(stations, sessions, () => settings.get().stationSecondsOverride)

  if (stations.loadErrors.length) console.error('Invalid bundled stations:', stations.loadErrors)

  registerIpc({ getWindow: () => win, settings, stations, sessions, encounter })
  void cleanupStaleSessionCaches()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

let shuttingDown = false
app.on('before-quit', (e) => {
  if (shuttingDown) return
  shuttingDown = true
  e.preventDefault()
  // Unload the voice model first: modelManager.shutdown() closes the QVAC worker.
  voiceManager
    .unload()
    .catch(() => {})
    .then(() => modelManager.shutdown())
    .catch(() => {})
    .finally(() => app.quit())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
