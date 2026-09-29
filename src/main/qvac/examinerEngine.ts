import type { z } from 'zod'
import type { Station } from '@shared/stationSchema'
import { DOMAIN_LABELS } from '@shared/stationSchema'
import type { AnswerResult, Feedback, ItemResult, SessionRecord } from '@shared/sessionTypes'
import type { FeedbackProgress } from '@shared/ipcTypes'
import {
  bandRating,
  clampRating,
  computeDomainScores,
  findEvidenceTurn,
  overallPercent
} from '@shared/rubric'
import {
  EXAMINER_SYSTEM,
  answersResponseSchema,
  buildAnswersPrompt,
  buildChecklistPrompt,
  buildSummaryPrompt,
  checklistResponseSchema,
  extractJsonObject,
  summaryResponseSchema
} from '../prompts/examinerPrompt'
import { EXAMINER_PARAMS, runCompletion } from './streamUtils'

const BATCH_SIZE = 6

type Ask = (prompt: string) => Promise<string>

/** Asks the model and parses a JSON object that matches the schema, with one retry. */
async function askJson<T extends z.ZodTypeAny>(ask: Ask, prompt: string, schema: T): Promise<z.infer<T> | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await ask(
      attempt === 0
        ? prompt
        : `${prompt}\n\nYour previous reply could not be parsed. Keep your reasoning brief and end with the JSON object only.`
    )
    try {
      const parsed = schema.safeParse(extractJsonObject(text))
      if (parsed.success) return parsed.data
    } catch {
      /* retry */
    }
  }
  return null
}

export async function gradeChecklist(
  ask: Ask,
  station: Station,
  record: SessionRecord,
  onProgress: (p: FeedbackProgress) => void,
  totalSteps: number
): Promise<ItemResult[]> {
  const items = station.rubric.items
  const results: ItemResult[] = []
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE)
    onProgress({ step: `Marking checklist items ${i + 1}–${i + batch.length}`, done: i / BATCH_SIZE, total: totalSteps })
    const parsed = await askJson(ask, buildChecklistPrompt(station, record.transcript, batch), checklistResponseSchema)
    for (const item of batch) {
      const r = parsed?.results.find((x) => x.itemId === item.id)
      if (!r) {
        results.push({
          itemId: item.id,
          domain: item.domain,
          text: item.text,
          weight: item.weight,
          met: 'no',
          evidenceQuote: '',
          evidenceTurn: null,
          comment: 'Could not be assessed automatically — review the transcript yourself.',
          downgraded: false
        })
        continue
      }
      const evidenceTurn = r.met === 'no' ? null : findEvidenceTurn(r.evidenceQuote, record.transcript)
      const downgraded = r.met === 'yes' && evidenceTurn === null
      results.push({
        itemId: item.id,
        domain: item.domain,
        text: item.text,
        weight: item.weight,
        met: downgraded ? 'partial' : r.met,
        evidenceQuote: r.evidenceQuote,
        evidenceTurn,
        comment: r.comment,
        downgraded
      })
    }
  }
  return results
}

export async function gradeAnswers(ask: Ask, station: Station, record: SessionRecord): Promise<AnswerResult[]> {
  const answers = record.postAnswers
  if (answers.length === 0) return []
  const parsed = await askJson(ask, buildAnswersPrompt(station, answers), answersResponseSchema)
  return answers.map((a, idx) => {
    const q = station.postEncounterQuestions.find((p) => p.q === a.question)
    const r = parsed?.answers.find((x) => x.index === idx + 1)
    const keyPoints = q?.keyPoints ?? []
    // Only accept key points that really exist in the station, to avoid invented ones.
    const hit = keyPoints.filter((k) => r?.keyPointsHit.some((h) => h.trim().toLowerCase() === k.trim().toLowerCase()))
    return {
      question: a.question,
      answer: a.answer,
      modelAnswer: q?.modelAnswer ?? '',
      keyPointsHit: hit,
      keyPointsMissed: keyPoints.filter((k) => !hit.includes(k)),
      comment: r?.comment ?? (a.answer.trim() ? 'Could not be assessed automatically — compare with the model answer.' : 'No answer given.')
    }
  })
}

export async function generateFeedback(opts: {
  modelId: string
  modelName: string
  station: Station
  record: SessionRecord
  key: string
  onProgress: (p: FeedbackProgress) => void
}): Promise<Feedback> {
  const { station, record, onProgress } = opts
  const ask: Ask = async (prompt) => {
    const r = await runCompletion({
      modelId: opts.modelId,
      history: [
        { role: 'system', content: EXAMINER_SYSTEM },
        { role: 'user', content: prompt }
      ],
      params: EXAMINER_PARAMS,
      key: opts.key
    })
    if (r.cancelled) throw new Error('Feedback generation cancelled')
    return r.content
  }

  const checklistSteps = Math.ceil(station.rubric.items.length / BATCH_SIZE)
  const totalSteps = checklistSteps + 2

  const items = await gradeChecklist(ask, station, record, onProgress, totalSteps)

  onProgress({ step: 'Marking post-station answers', done: checklistSteps, total: totalSteps })
  const answers = await gradeAnswers(ask, station, record)

  const domainScores = computeDomainScores(items)
  const percent = overallPercent(items)
  const anchor = bandRating(percent)
  const achieved = items.filter((i) => i.met === 'yes').map((i) => i.text)
  const missed = items.filter((i) => i.met !== 'yes').map((i) => i.text)

  onProgress({ step: 'Writing summary', done: checklistSteps + 1, total: totalSteps })
  const scoreLines = domainScores
    .map((d) => `- ${DOMAIN_LABELS[d.domain]}: ${d.percent}%`)
    .concat(`- Overall: ${percent}%`)
    .join('\n')
  const summary = await askJson(ask, buildSummaryPrompt(station, scoreLines, achieved, missed, anchor), summaryResponseSchema)

  onProgress({ step: 'Done', done: totalSteps, total: totalSteps })
  return {
    items,
    answers,
    domainScores,
    overallPercent: percent,
    globalRating: clampRating(summary?.globalRating, anchor),
    summary: summary?.summary ?? `You scored ${percent}% on the checklist. Review the items below.`,
    missedPoints: (summary?.missedPoints ?? missed).slice(0, 3),
    practiseNext: (summary?.practiseNext ?? []).slice(0, 3),
    generatedAt: Date.now(),
    modelName: opts.modelName
  }
}
