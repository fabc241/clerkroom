import { useEffect, useState } from 'react'
import type { Station } from '@shared/stationSchema'
import { appendDictation } from '@shared/voice'
import type { Navigate } from '../App'
import { DictateButton } from '../components/DictateButton'
import { ErrorBox } from '../components/Notices'
import { Icon, PageHeader, Stepper } from '../components/ui'

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

  if (!station) return <div className="p-10 text-text-3">Loading…</div>

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

  const answered = answers.filter((a) => a.trim()).length
  const CARD = [
    { bg: 'bg-sky', icon: 'list' },
    { bg: 'bg-mint', icon: 'bulb' },
    { bg: 'bg-butter', icon: 'book' },
    { bg: 'bg-lilac', icon: 'stethoscope' },
    { bg: 'bg-peach', icon: 'flask' }
  ] as const

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-8 pt-7 pb-14">
      <PageHeader
        title={`Examiner questions: ${station.title}`}
        description={
          <>
            Answer as you would to an examiner; short, structured answers are fine.
            {voiceInput && ' You can type or dictate each answer, then edit it before submitting.'}
          </>
        }
      >
        <Stepper current={2} />
      </PageHeader>

      <div className="panel space-y-4 p-5">
        {station.postEncounterQuestions.map((q, i) => {
          const c = CARD[i % CARD.length]
          return (
            <section key={q.q} className={`space-y-3 rounded-2xl p-4 ${c.bg}`}>
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-text shadow-card">
                  <Icon name={c.icon} className="h-[18px] w-[18px]" />
                </span>
                <label htmlFor={`answer-${i}`} className="flex-1 pt-1.5 text-[15.5px] leading-snug font-semibold text-text">
                  {q.q}
                </label>
                {voiceInput && (
                  <DictateButton
                    className="shrink-0 bg-surface"
                    ready={voiceReady}
                    disabled={saving}
                    onError={setError}
                    onText={(t) => setAnswers((a) => a.map((v, j) => (j === i ? appendDictation(v, t) : v)))}
                  />
                )}
              </div>
              <textarea
                id={`answer-${i}`}
                className="field min-h-24 resize-y"
                placeholder="Type your answer here…"
                value={answers[i] ?? ''}
                onChange={(e) => setAnswers((a) => a.map((v, j) => (j === i ? e.target.value : v)))}
              />
            </section>
          )
        })}
      </div>

      {error && <ErrorBox message={error} />}
      <div className="flex flex-col items-center gap-2">
        <button className="btn-primary min-h-11 px-6 text-[14.5px]" disabled={saving} onClick={submit}>
          Submit answers for evaluation
        </button>
        <p className="text-[13px] text-text-3">
          {answered === station.postEncounterQuestions.length
            ? 'All questions answered.'
            : `${answered} of ${station.postEncounterQuestions.length} answered. Blank answers score nothing.`}
        </p>
      </div>
    </div>
  )
}
