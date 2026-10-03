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

// Parler TTS mini v1 voice controls for the patient's spoken replies (`patient.voice`).

/** The named speakers Parler mini v1 was trained on. Reusing one name keeps the voice the same across replies. */
export const PARLER_SPEAKERS = [
  'Laura', 'Gary', 'Jon', 'Lea', 'Karen', 'Rick', 'Brenda', 'David', 'Eileen', 'Jordan', 'Mike',
  'Yann', 'Joy', 'James', 'Eric', 'Lauren', 'Rose', 'Will', 'Jason', 'Aaron', 'Naomie', 'Alisa',
  'Patrick', 'Jerry', 'Tina', 'Jenna', 'Bill', 'Tom', 'Carol', 'Barbara', 'Rebecca', 'Anna',
  'Bruce', 'Emily'
] as const
// The lists below mirror the QVAC tts-ggml addon, which rejects any other value at synthesis time.
// Emotions and paces are pinned against the SDK in tests/unit/stations.test.ts. Pitch and
// expressivity are only checked natively; the addon renders them as "with a <pitch> pitch" and
// "in a <expressivity> manner".
export const PARLER_PACES = ['slow', 'moderate', 'fast'] as const
export const PARLER_PITCHES = ['low', 'moderate', 'high'] as const
export const PARLER_EXPRESSIVITIES = ['monotone', 'slightly expressive', 'expressive'] as const
export const PARLER_EMOTIONS = [
  'command',
  'anger',
  'narration',
  'conversation',
  'disgust',
  'fear',
  'happy',
  'neutral',
  'proper noun',
  'news',
  'sad',
  'surprise'
] as const
