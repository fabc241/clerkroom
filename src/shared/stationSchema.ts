import { z } from 'zod'

// A station is a fictional, educational OSCE scenario. Nothing here describes a real patient.

import {
  DIFFICULTIES,
  DOMAINS,
  SENSITIVE_TOPICS,
  SPECIALTIES,
  STATION_TYPES
} from './constants'

export * from './constants'

const nonEmpty = z.string().trim().min(1)

export const hiddenFactSchema = z.object({
  topic: nonEmpty.describe('Short label, e.g. "Suicidal thoughts"'),
  trigger: nonEmpty.describe('What the candidate must ask about for this to be revealed'),
  answer: nonEmpty.describe('What the patient says once asked'),
  keywords: z
    .array(nonEmpty)
    .min(1)
    .describe('Words that indicate the fact was disclosed in a patient reply'),
  askKeywords: z
    .array(nonEmpty)
    .default([])
    .describe(
      'Words or word-stems in the candidate\'s question that unlock this fact (e.g. "sleep", "suicid", "end your life")'
    )
})
export type HiddenFact = z.infer<typeof hiddenFactSchema>

export const rubricItemSchema = z.object({
  id: nonEmpty,
  domain: z.enum(DOMAINS),
  text: nonEmpty,
  weight: z.number().int().min(1).max(3).default(1),
  evidenceHint: z.string().default('')
})
export type RubricItem = z.infer<typeof rubricItemSchema>

export const stationSchema = z
  .object({
    schemaVersion: z.literal(1).default(1),
    id: z
      .string()
      .regex(/^[a-z0-9][a-z0-9-]*$/, 'Use lowercase letters, digits and dashes'),
    version: z.number().int().min(1).default(1),
    title: nonEmpty,
    specialty: z.enum(SPECIALTIES),
    stationType: z.enum(STATION_TYPES),
    difficulty: z.enum(DIFFICULTIES),
    timing: z
      .object({
        readingSec: z.number().int().min(0).max(600).default(120),
        stationSec: z.number().int().min(60).max(1800).default(480)
      })
      .default({ readingSec: 120, stationSec: 480 }),
    candidateBrief: nonEmpty,
    patient: z.object({
      name: nonEmpty,
      age: z.number().int().min(0).max(110),
      sex: z.enum(['female', 'male', 'other']),
      occupation: z.string().default(''),
      setting: nonEmpty,
      openingStatement: nonEmpty,
      demeanour: nonEmpty,
      speechStyle: nonEmpty,
      ice: z.object({ ideas: nonEmpty, concerns: nonEmpty, expectations: nonEmpty }),
      freelyShared: z.array(nonEmpty).default([]),
      revealOnlyIfAsked: z.array(hiddenFactSchema).default([]),
      cue: z.string().optional(),
      mseObservations: z.array(nonEmpty).optional()
    }),
    examFindings: z.array(z.object({ system: nonEmpty, finding: nonEmpty })).default([]),
    investigations: z.array(z.object({ test: nonEmpty, result: nonEmpty })).default([]),
    postEncounterQuestions: z
      .array(z.object({ q: nonEmpty, modelAnswer: nonEmpty, keyPoints: z.array(nonEmpty).min(1) }))
      .default([]),
    rubric: z.object({
      items: z.array(rubricItemSchema).min(3)
    }),
    // Terms the simulated patient must never say (e.g. the diagnosis label).
    forbiddenTerms: z.array(nonEmpty).default([]),
    safety: z.object({ sensitiveTopic: z.enum(SENSITIVE_TOPICS).optional() }).default({}),
    authoring: z
      .object({
        author: z.string().default('DigiPat'),
        source: z.literal('fictional').default('fictional'),
        reviewedBy: z.string().optional()
      })
      .default({ author: 'DigiPat', source: 'fictional' })
  })
  .superRefine((s, ctx) => {
    const ids = new Set<string>()
    s.rubric.items.forEach((item, i) => {
      if (ids.has(item.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['rubric', 'items', i, 'id'],
          message: `Duplicate rubric item id "${item.id}"`
        })
      }
      ids.add(item.id)
    })
  })

export type Station = z.infer<typeof stationSchema>
export type StationInput = z.input<typeof stationSchema>

export type StationSummary = Pick<
  Station,
  'id' | 'title' | 'specialty' | 'stationType' | 'difficulty' | 'timing'
> & { sensitiveTopic?: string; bundled: boolean }

export function summarize(s: Station, bundled: boolean): StationSummary {
  return {
    id: s.id,
    title: s.title,
    specialty: s.specialty,
    stationType: s.stationType,
    difficulty: s.difficulty,
    timing: s.timing,
    sensitiveTopic: s.safety.sensitiveTopic,
    bundled
  }
}

/** Formats zod issues as "path: message" lines for the editor/import UI. */
export function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((i) => {
    const where = i.path.join('.') || '(root)'
    if (i.code === 'too_small' && i.origin === 'string') return `${where}: required`
    if (i.code === 'too_small' && i.origin === 'array') return `${where}: add at least ${i.minimum}`
    if (i.code === 'invalid_type' && i.input === undefined) return `${where}: required`
    return `${where}: ${i.message}`
  })
}
