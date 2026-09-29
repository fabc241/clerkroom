import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { DigiPatApi } from '../shared/ipcTypes'

function subscribe<A extends unknown[]>(channel: string, cb: (...args: A) => void): () => void {
  const listener = (_e: IpcRendererEvent, ...args: unknown[]): void => cb(...(args as A))
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: DigiPatApi = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),

  getModelOptions: () => ipcRenderer.invoke('model:options'),
  getModelStatus: () => ipcRenderer.invoke('model:status'),
  prepareModel: () => ipcRenderer.invoke('model:prepare'),
  cancelDownload: () => ipcRenderer.invoke('model:cancelDownload'),
  deleteModel: (choice) => ipcRenderer.invoke('model:delete', choice),
  onModelStatus: (cb) => subscribe('model:status', cb),

  listStations: () => ipcRenderer.invoke('station:list'),
  getStation: (id) => ipcRenderer.invoke('station:get', id),
  saveStation: (s) => ipcRenderer.invoke('station:save', s),
  deleteStation: (id) => ipcRenderer.invoke('station:delete', id),
  validateStation: (s) => ipcRenderer.invoke('station:validate', s),
  importStationFile: () => ipcRenderer.invoke('station:import'),
  exportStationFile: (id) => ipcRenderer.invoke('station:export', id),

  startSession: (stationId) => ipcRenderer.invoke('session:start', stationId),
  sendToPatient: (id, text) => ipcRenderer.invoke('session:send', id, text),
  onPatientStream: (cb) => subscribe('patient:stream', cb),
  interruptPatient: (id) => ipcRenderer.invoke('session:interrupt', id),
  examine: (id, system) => ipcRenderer.invoke('session:examine', id, system),
  investigate: (id, test) => ipcRenderer.invoke('session:investigate', id, test),
  endEncounter: (id, reason) => ipcRenderer.invoke('session:end', id, reason),
  submitAnswers: (id, answers) => ipcRenderer.invoke('session:answers', id, answers),
  generateFeedback: (id) => ipcRenderer.invoke('session:feedback', id),
  onFeedbackProgress: (cb) => subscribe('feedback:progress', cb),

  listSessions: () => ipcRenderer.invoke('history:list'),
  getSession: (id) => ipcRenderer.invoke('history:get', id),
  deleteSession: (id) => ipcRenderer.invoke('history:delete', id),
  exportSession: (id, format) => ipcRenderer.invoke('history:export', id, format),

  openExternal: (key) => ipcRenderer.invoke('app:openExternal', key),
  appInfo: () => ipcRenderer.invoke('app:info')
}

contextBridge.exposeInMainWorld('digipat', api)
