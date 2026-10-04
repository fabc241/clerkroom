// Plain constants (no zod) so the renderer bundle stays small.

/** Bump when the disclaimer text changes materially, so users must re-accept it. */
export const DISCLAIMER_VERSION = 1

export const DOMAINS = ['dataGathering', 'clinicalManagement', 'interpersonal'] as const
export type Domain = (typeof DOMAINS)[number]

export const DOMAIN_LABELS: Record<Domain, string> = {
  dataGathering: 'Data gathering',
  clinicalManagement: 'Clinical management',
  interpersonal: 'Interpersonal skills'
}

export const GLOBAL_RATINGS = ['Fail', 'Borderline', 'Pass', 'Good', 'Excellent'] as const
export type GlobalRating = (typeof GLOBAL_RATINGS)[number]

export const SPECIALTIES = ['psychiatry', 'medicine', 'communication'] as const
export const STATION_TYPES = [
  'history',
  'risk-assessment',
  'mse',
  'explanation',
  'counselling'
] as const
export const DIFFICULTIES = ['foundation', 'intermediate', 'advanced'] as const
export const SENSITIVE_TOPICS = [
  'suicide',
  'self-harm',
  'substance',
  'psychosis',
  'bereavement',
  'abuse'
] as const

// Supertonic 3 voice controls for the patient's spoken replies (`patient.voice`).

/**
 * The voices baked into the Supertonic 3 model. Measured median pitch on the same sentence:
 * F2 ~200 Hz, F4 ~190, F1 ~180, F3 and F5 ~160; M1 ~125, M4 ~120, M3 ~95, M2 and M5 ~85.
 * F4 and M3 also speak a little faster than the rest.
 */
export const SPEECH_VOICES = ['F1', 'F2', 'F3', 'F4', 'F5', 'M1', 'M2', 'M3', 'M4', 'M5'] as const
/** Speaking rate. Mirrors the QVAC SDK's `TTS_PACES` (pinned in tests/unit/stations.test.ts). */
export const SPEECH_PACES = ['slow', 'moderate', 'fast'] as const
