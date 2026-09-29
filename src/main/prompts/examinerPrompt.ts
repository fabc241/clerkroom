import { z } from 'zod'
import type { RubricItem, Station } from '@shared/stationSchema'
import type { TranscriptEntry } from '@shared/sessionTypes'

export const EXAMINER_SYSTEM = [
  'IMPORTANT ROLE OVERRIDE: for this task you are acting as a clinical skills examiner in an educational simulation for medical students.',
  'The consultation you are marking was with a fictional simulated patient. You are marking the STUDENT (the doctor), not the patient.',
  'Be fair, specific and strict: only give credit for things the student actually said or did in the transcript.',
  'Your output is formative practice feedback, not a clinical judgement.'
].join('\n')

export function formatTranscript(transcript: TranscriptEntry[]): string {
  return transcript
    .map((e, i) => {
      switch (e.kind) {
        case 'candidate':
          return `[${i}] STUDENT: ${e.text}`
        case 'patient':
          return `[${i}] PATIENT: ${e.text}`
        case 'exam':
          return `[${i}] STUDENT ACTION: examined ${e.system} -> ${e.finding}`
        case 'investigation':
          return `[${i}] STUDENT ACTION: requested ${e.test} -> ${e.result}`
        case 'system':
          return `[${i}] NOTE: ${e.text}`
      }
    })
    .join('\n')
}

export function buildChecklistPrompt(
  station: Station,
  transcript: TranscriptEntry[],
  items: RubricItem[]
): string {
  const itemLines = items
    .map((it) => `- id "${it.id}": ${it.text}${it.evidenceHint ? ` (look for: ${it.evidenceHint})` : ''}`)
    .join('\n')
  return [
    `Station: ${station.title}`,
    `Task given to the student: ${station.candidateBrief}`,
    '',
    'Transcript (turn numbers in brackets):',
    formatTranscript(transcript) || '(the student said nothing)',
    '',
    'Mark each checklist item below:',
    itemLines,
    '',
    'For each item decide "yes" (clearly done), "partial" (attempted but incomplete) or "no" (not done).',
    'evidenceQuote must be copied word-for-word from a STUDENT line or STUDENT ACTION line in the transcript, or be an empty string if the verdict is "no".',
    'comment is one short sentence of feedback addressed to the student ("You...").',
    '',
    'After thinking, reply with ONLY a JSON object of this exact shape and nothing else:',
    '{"results":[{"itemId":"...","met":"yes|partial|no","evidenceQuote":"...","comment":"..."}]}'
  ].join('\n')
}

export function buildAnswersPrompt(
  station: Station,
  answers: { question: string; answer: string }[]
): string {
  const blocks = answers.map((a, i) => {
    const q = station.postEncounterQuestions.find((p) => p.q === a.question)
    return [
      `Question ${i + 1}: ${a.question}`,
      `Key points expected: ${q ? q.keyPoints.map((k) => `"${k}"`).join(', ') : '(none)'}`,
      `Student answer: ${a.answer.trim() || '(no answer)'}`
    ].join('\n')
  })
  return [
    `Station: ${station.title}`,
    'The student answered these post-station questions. For each question, list the expected key points the student covered, plus one sentence of feedback.',
    'For each key point covered, copy the key point text exactly and give a quote copied word-for-word from the student\'s answer that shows it. Only list a key point if the student\'s answer really covers it; a missing or blank answer covers nothing.',
    '',
    blocks.join('\n\n'),
    '',
    'After thinking, reply with ONLY a JSON object of this exact shape and nothing else:',
    '{"answers":[{"index":1,"keyPointsHit":[{"keyPoint":"...","quote":"..."}],"comment":"..."}]}'
  ].join('\n')
}

export function buildSummaryPrompt(
  station: Station,
  scoreLines: string,
  achieved: string[],
  missed: string[],
  outcome: { result: string; rating: string; reasons: string[] }
): string {
  return [
    `Station: ${station.title}`,
    `Task given to the student: ${station.candidateBrief}`,
    '',
    'Checklist outcome:',
    scoreLines,
    '',
    `Items the student DID achieve: ${achieved.length ? achieved.join('; ') : 'none'}`,
    `Items not achieved or only partly achieved: ${missed.length ? missed.join('; ') : 'none'}`,
    `Station result (already decided, do not change it): ${outcome.result.toUpperCase()}, rated ${outcome.rating}. ${outcome.reasons.join(' ')}`,
    'Base your feedback strictly on these lists and this result. Never describe an achieved item as missing, and never contradict the result.',
    '',
    'Write formative feedback for the student:',
    '- summary: 2-3 sentences on overall performance, addressed to the student.',
    '- missedPoints: up to 3 most important things to improve, chosen from the items not achieved.',
    '- practiseNext: up to 3 concrete suggestions for what to practise next.',
    '',
    'After thinking, reply with ONLY a JSON object of this exact shape and nothing else:',
    '{"summary":"...","missedPoints":["..."],"practiseNext":["..."]}'
  ].join('\n')
}

export const checklistResponseSchema = z.object({
  results: z.array(
    z.object({
      itemId: z.string(),
      met: z.enum(['yes', 'partial', 'no']),
      evidenceQuote: z.string().default(''),
      comment: z.string().default('')
    })
  )
})

export const answersResponseSchema = z.object({
  answers: z.array(
    z.object({
      index: z.number().int(),
      // A bare string has no quote, so it can never be verified and earns no credit.
      keyPointsHit: z
        .array(
          z.union([
            z.string().transform((keyPoint) => ({ keyPoint, quote: '' })),
            z.object({ keyPoint: z.string(), quote: z.string().default('') })
          ])
        )
        .default([]),
      comment: z.string().default('')
    })
  )
})

export const summaryResponseSchema = z.object({
  summary: z.string(),
  missedPoints: z.array(z.string()).default([]),
  practiseNext: z.array(z.string()).default([])
})

/**
 * Extracts the last top-level JSON object from model output. MedPsy is a reasoning model, so
 * we let it think freely (no grammar constraint) and then pull the JSON out of the answer.
 */
export function extractJsonObject(text: string): unknown {
  const stripped = text.replace(/<think>[\s\S]*?(<\/think>|$)/g, '')
  let last: unknown = undefined
  let i = stripped.indexOf('{')
  while (i >= 0) {
    const end = matchBrace(stripped, i)
    if (end < 0) break
    try {
      last = JSON.parse(stripped.slice(i, end + 1))
      i = stripped.indexOf('{', end + 1) // skip nested objects of a parsed top-level object
    } catch {
      i = stripped.indexOf('{', i + 1)
    }
  }
  if (last === undefined) throw new Error('No JSON object found in model output')
  return last
}

function matchBrace(text: string, start: number): number {
  let depth = 0
  let inString = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (ch === '\\') i++
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}
