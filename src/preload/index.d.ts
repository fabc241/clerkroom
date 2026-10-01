import type { ClerkroomApi } from '../shared/ipcTypes'

declare global {
  interface Window {
    clerkroom: ClerkroomApi
  }
}

export {}
