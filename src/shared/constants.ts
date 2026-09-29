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
