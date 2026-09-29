import { useEffect, useState } from 'react'
import type { Station } from '@shared/stationSchema'
import { appendDictation } from '@shared/voice'
import type { Navigate } from '../App'
import { DictateButton } from '../components/DictateButton'
import { ErrorBox } from '../components/Notices'

export function PostEncounter({
  stationId,
  sessionId,
  voiceInput,
  voiceReady,
  navigate
}: {
  stationId: string
  sessionId: string
  voiceInput: boolean
  voiceReady: boolean
  navigate: Navigate
}): React.JSX.Element {
  const [station, setStation] = useState<Station | null>(null)
  const [answers, setAnswers] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    window.digipat.getStation(stationId).then((r) => {
      setStation(r?.station ?? null)
      setAnswers(r?.station.postEncounterQuestions.map(() => '') ?? [])
    })
  }, [stationId])

  if (!station) return <div className="p-8 text-sm text-stone-500">Loading…</div>

  const submit = async (): Promise<void> => {
    setSaving(true)
    try {
      await window.digipat.submitAnswers(
        sessionId,
        station.postEncounterQuestions.map((q, i) => ({ question: q.q, answer: answers[i] ?? '' }))
      )
      navigate({ name: 'feedback', sessionId })
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <div className="label">Station ended</div>
        <h1 className="text-xl font-semibold">{station.title} — examiner questions</h1>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
          Answer as you would to an examiner. Short, structured answers are fine.
          {voiceInput && ' You can type or dictate each answer, then edit it before submitting.'}
        </p>
      </div>
      {station.postEncounterQuestions.map((q, i) => (
        <div key={q.q} className="card space-y-2">
          <div className="flex items-start gap-3">
            <div className="flex-1 text-sm font-medium">
              {i + 1}. {q.q}
            </div>
            {voiceInput && (
              <DictateButton
                className="shrink-0 px-2.5 py-1"
                ready={voiceReady}
                disabled={saving}
                onError={setError}
                onText={(t) => setAnswers((a) => a.map((v, j) => (j === i ? appendDictation(v, t) : v)))}
              />
            )}
          </div>
          <textarea
            className="input min-h-28"
            aria-label={`Answer to question ${i + 1}`}
            value={answers[i] ?? ''}
            onChange={(e) => setAnswers((a) => a.map((v, j) => (j === i ? e.target.value : v)))}
          />
        </div>
      ))}
      {error && <ErrorBox message={error} />}
      <div className="flex justify-end">
        <button className="btn-primary" disabled={saving} onClick={submit}>
          Submit and get feedback
        </button>
      </div>
    </div>
  )
}
