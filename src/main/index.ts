import { app, BrowserWindow, nativeTheme, powerMonitor, safeStorage, session } from 'electron'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { is } from '@electron-toolkit/utils'
import { registerIpc } from './ipc'
import { modelManager } from './qvac/modelManager'
import { voiceManager } from './qvac/transcriber'
import { EncounterService, cleanupStaleSessionCaches } from './encounter'
import { SessionStore } from './store/sessionStore'
import { SettingsStore } from './store/settingsStore'
import { StationStore } from './store/stationStore'
import { encryptPlainFiles, hasEncryptedFiles, setCipher, setEncryptWrites } from './store/jsonFiles'
import { migrateLegacyData } from './store/legacyData'
import { AppLock } from './appLock'

const here = fileURLToPath(new URL('.', import.meta.url))
let win: BrowserWindow | null = null
let lock: AppLock | null = null

// Lets tests and demos run against a throwaway data folder.
if (process.env['CLERKROOM_USER_DATA']) app.setPath('userData', process.env['CLERKROOM_USER_DATA'])
else {
  const dataDir = app.getPath('userData')
  try {
    migrateLegacyData(join(dirname(dataDir), 'DigiPat'), dataDir)
  } catch (err) {
    console.error('Could not move the DigiPat data:', err)
  }
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 620,
    show: false,
    title: 'Clerkroom',
    titleBarStyle: 'hiddenInset',
    // Matches the sheet's paper so the window never flashes the wrong appearance before first paint.
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#161618' : '#fdfdfc',
    webPreferences: {
      preload: join(here, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // DevTools could call the app's API directly, so the packaged app has none.
      devTools: is.dev
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
  nativeTheme.themeSource = settings.get().appearance

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
  const userStationsDir = join(userData, 'stations')
  const sessionsDir = join(userData, 'sessions')
  const stations = new StationStore(join(app.getAppPath(), 'stations'), userStationsDir)
  const sessions = new SessionStore(sessionsDir)

  // Optional app lock. Saved data is encrypted with a key macOS keeps in the Keychain for this app.
  // safeStorage is only called once there is something to encrypt or decrypt, so the Keychain is
  // never touched while the lock is off.
  setCipher({ encrypt: (s) => safeStorage.encryptString(s), decrypt: (b) => safeStorage.decryptString(b) })
  // Encrypted data keeps the lock on even if settings.json was edited to turn it off.
  if (!settings.get().appLock && [sessionsDir, userStationsDir].some(hasEncryptedFiles)) settings.setAppLock(true)
  setEncryptWrites(settings.get().appLock)
  // While the lock is on, nothing stays on disk unencrypted (e.g. attempts moved in from DigiPat).
  if (settings.get().appLock) {
    for (const dir of [sessionsDir, userStationsDir]) {
      try {
        encryptPlainFiles(dir)
      } catch (err) {
        console.error('Could not encrypt saved data:', err)
      }
    }
  }
  const helper = app.isPackaged
    ? join(process.resourcesPath, 'unlock', 'Clerkroom')
    : join(app.getAppPath(), 'build', 'native', 'unlock', 'Clerkroom')
  lock = new AppLock(helper, () => settings.get().appLock, settings.get().appLock)
  powerMonitor.on('lock-screen', () => lock?.lock())
  powerMonitor.on('suspend', () => lock?.lock())
  const encounter = new EncounterService(stations, sessions, () => settings.get().stationSecondsOverride)

  if (stations.loadErrors.length) console.error('Invalid bundled stations:', stations.loadErrors)

  registerIpc({
    getWindow: () => win,
    settings,
    stations,
    sessions,
    encounter,
    lock,
    dataDirs: [sessionsDir, userStationsDir],
    encryptionAvailable: () => safeStorage.isEncryptionAvailable()
  })
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
  lock?.dispose()
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
