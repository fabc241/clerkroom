import type { SessionResult } from '@shared/sessionTypes'

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export const SPECIALTY_LABEL: Record<string, string> = {
  psychiatry: 'Psychiatry',
  medicine: 'Medicine',
  communication: 'Communication'
}

export const TYPE_LABEL: Record<string, string> = {
  history: 'History',
  'risk-assessment': 'Risk assessment',
  mse: 'Mental state exam',
  explanation: 'Explanation',
  counselling: 'Counselling'
}

export const RESULT_LABEL: Record<SessionResult, string> = {
  pass: 'Passed',
  fail: 'Failed',
  incomplete: 'Incomplete'
}
