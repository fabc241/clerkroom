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

export const RESULT_STYLE: Record<SessionResult, string> = {
  pass: 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950',
  fail: 'bg-red-600 text-white dark:bg-red-500 dark:text-red-950',
  incomplete: 'bg-amber-500 text-white dark:bg-amber-400 dark:text-amber-950'
}

export const RESULT_LABEL: Record<SessionResult, string> = {
  pass: 'Passed',
  fail: 'Failed',
  incomplete: 'Incomplete'
}

export const RATING_STYLE: Record<string, string> = {
  Fail: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  Borderline: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  Pass: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  Good: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  Excellent: 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200'
}
