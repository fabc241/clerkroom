import type { DigiPatApi } from '../shared/ipcTypes'

declare global {
  interface Window {
    digipat: DigiPatApi
  }
}

export {}
