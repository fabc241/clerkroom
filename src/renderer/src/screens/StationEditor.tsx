import { useEffect, useRef, useState } from 'react'
import {
  DIFFICULTIES,
  DOMAINS,
  DOMAIN_LABELS,
  SENSITIVE_TOPICS,
  SPECIALTIES,
  STATION_TYPES
} from '@shared/constants'
import type { Navigate } from '../App'
import { ErrorBox } from '../components/Notices'
import { SPECIALTY_LABEL, TYPE_LABEL } from '../lib/format'

/** The editor works on a loose draft; the main process validates it against the zod schema. */
type Draft = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const TEMPLATE: Draft = {
  schemaVersion: 1,
  id: 'my-new-station',
  version: 1,
  title: 'New station',
  specialty: 'psychiatry',
  stationType: 'history',
  difficulty: 'foundation',
  timing: { readingSec: 120, stationSec: 480 },
  candidateBrief: 'You are a junior doctor in … Take a focused history from …',
  patient: {
    name: '',
    age: 30,
    sex: 'female',
    occupation: '',
    setting: '',
    openingStatement: '',
    demeanour: '',
    speechStyle: 'Everyday language, no medical terms.',
    ice: { ideas: '', concerns: '', expectations: '' },
    freelyShared: [],
    revealOnlyIfAsked: [],
    cue: ''
  },
  examFindings: [],
  investigations: [],
  postEncounterQuestions: [],
  rubric: { items: [] },
  forbiddenTerms: [],
  safety: {},
  authoring: { author: '', source: 'fictional' }
}

function setPath(obj: Draft, path: string[], value: unknown): Draft {
  if (path.length === 0) return value as Draft
  const [head, ...rest] = path
  const copy: Draft = Array.isArray(obj) ? [...obj] : { ...obj }
  copy[head] = setPath(obj?.[head] ?? {}, rest, value)
  return copy
}

export function StationEditor({
  stationId,
  duplicate,
  navigate
}: {
  stationId?: string
  duplicate?: boolean
  navigate: Navigate
}): React.JSX.Element {
  const [draft, setDraft] = useState<Draft | null>(stationId ? null : structuredClone(TEMPLATE))
  const [originalId, setOriginalId] = useState<string | null>(null)
  const [tab, setTab] = useState<'form' | 'json'>('form')
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (!stationId) return
    window.digipat.getStation(stationId).then((r) => {
      if (!r) return setDraft(structuredClone(TEMPLATE))
      const s: Draft = structuredClone(r.station)
      if (duplicate) {
        s.id = `${s.id}-custom`
        s.title = `${s.title} (custom)`
        s.authoring = { ...s.authoring, author: '' }
      } else {
        setOriginalId(s.id)
      }
      setDraft(s)
    })
  }, [stationId, duplicate])

  // Live validation, debounced.
  useEffect(() => {
    if (!draft) return
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const res = await window.digipat.validateStation(draft)
      setErrors(res.ok ? [] : res.errors)
    }, 400)
  }, [draft])

  if (!draft) return <div className="p-8 text-sm text-stone-500">Loading…</div>

  const set = (path: string, value: unknown): void => setDraft((d) => setPath(d!, path.split('.'), value))
  const get = (path: string): any => path.split('.').reduce((o, k) => o?.[k], draft) // eslint-disable-line @typescript-eslint/no-explicit-any

  const save = async (): Promise<boolean> => {
    setMessage(null)
    const res = await window.digipat.saveStation(draft)
    if (!res.ok) {
      setErrors(res.errors)
      return false
    }
    if (originalId && originalId !== res.station.id) await window.digipat.deleteStation(originalId)
    setOriginalId(res.station.id)
    setMessage('Saved.')
    return true
  }

  const switchTab = (t: 'form' | 'json'): void => {
    if (t === 'json') {
      setJsonText(JSON.stringify(draft, null, 2))
      setJsonError(null)
    }
    setTab(t)
  }

  const text = (path: string, label: string, multiline = false, placeholder = ''): React.JSX.Element => (
    <div>
      <label className="label">{label}</label>
      {multiline ? (
        <textarea className="input min-h-20" value={get(path) ?? ''} placeholder={placeholder} onChange={(e) => set(path, e.target.value)} />
      ) : (
        <input className="input" value={get(path) ?? ''} placeholder={placeholder} onChange={(e) => set(path, e.target.value)} />
      )}
    </div>
  )
  const num = (path: string, label: string): React.JSX.Element => (
    <div>
      <label className="label">{label}</label>
      <input className="input" type="number" value={get(path) ?? 0} onChange={(e) => set(path, Number(e.target.value))} />
    </div>
  )
  const select = (path: string, label: string, opts: readonly string[], labels?: Record<string, string>, allowEmpty = false): React.JSX.Element => (
    <div>
      <label className="label">{label}</label>
      <select
        className="input"
        value={get(path) ?? ''}
        onChange={(e) => set(path, e.target.value === '' ? undefined : e.target.value)}
      >
        {allowEmpty && <option value="">None</option>}
        {opts.map((o) => (
          <option key={o} value={o}>
            {labels?.[o] ?? o}
          </option>
        ))}
      </select>
    </div>
  )

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Station editor</h1>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
            Write fictional cases only. Never base a station on a real, identifiable patient.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => navigate({ name: 'editor', stationId: undefined })}>
            New
          </button>
          {originalId && (
            <button className="btn-secondary" onClick={() => window.digipat.exportStationFile(originalId)}>
              Export JSON
            </button>
          )}
          <button
            className="btn-secondary"
            disabled={errors.length > 0}
            onClick={async () => (await save()) && navigate({ name: 'brief', stationId: draft.id })}
          >
            Save & try it
          </button>
          <button className="btn-primary" disabled={errors.length > 0} onClick={save}>
            Save
          </button>
        </div>
      </div>

      {message && (
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          {message}
        </div>
      )}
      {errors.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <div className="font-medium">Fix these before saving:</div>
          <ul className="mt-1 list-disc pl-5 text-xs">
            {errors.slice(0, 12).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-1 border-b border-stone-200 dark:border-stone-800">
        {(['form', 'json'] as const).map((t) => (
          <button
            key={t}
            className={`-mb-px border-b-2 px-4 py-2 text-sm ${tab === t ? 'border-brand-600 font-medium' : 'border-transparent text-stone-500'}`}
            onClick={() => switchTab(t)}
          >
            {t === 'form' ? 'Form' : 'JSON'}
          </button>
        ))}
      </div>

      {tab === 'json' ? (
        <div className="space-y-2">
          <textarea
            className="input min-h-[60vh] font-mono text-xs"
            spellCheck={false}
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value)
              try {
                setDraft(JSON.parse(e.target.value))
                setJsonError(null)
              } catch (err) {
                setJsonError((err as Error).message)
              }
            }}
          />
          {jsonError && <ErrorBox message={`JSON syntax: ${jsonError}`} />}
        </div>
      ) : (
        <div className="space-y-6">
          <Section title="Station">
            <div className="grid grid-cols-2 gap-4">
              {text('title', 'Title')}
              {text('id', 'ID (lowercase-with-dashes)')}
              {select('specialty', 'Specialty', SPECIALTIES, SPECIALTY_LABEL)}
              {select('stationType', 'Station type', STATION_TYPES, TYPE_LABEL)}
              {select('difficulty', 'Difficulty', DIFFICULTIES)}
              {select('safety.sensitiveTopic', 'Sensitive topic (shows support footer)', SENSITIVE_TOPICS, undefined, true)}
              {num('timing.readingSec', 'Reading time (seconds)')}
              {num('timing.stationSec', 'Station time (seconds)')}
            </div>
            {text('candidateBrief', 'Candidate instructions', true)}
          </Section>

          <Section title="Simulated patient">
            <div className="grid grid-cols-3 gap-4">
              {text('patient.name', 'Name')}
              {num('patient.age', 'Age')}
              {select('patient.sex', 'Sex', ['female', 'male', 'other'])}
              {text('patient.occupation', 'Occupation')}
              <div className="col-span-2">{text('patient.setting', 'Setting')}</div>
            </div>
            {text('patient.openingStatement', 'Opening statement', true)}
            {text('patient.demeanour', 'Demeanour / emotional state', true)}
            {text('patient.speechStyle', 'Speech style', true)}
            <div className="grid grid-cols-3 gap-4">
              {text('patient.ice.ideas', 'Ideas', true)}
              {text('patient.ice.concerns', 'Concerns', true)}
              {text('patient.ice.expectations', 'Expectations', true)}
            </div>
            <StringList label="Information the patient may share freely" value={get('patient.freelyShared') ?? []} onChange={(v) => set('patient.freelyShared', v)} />
            <ObjectList
              label="Hidden information (revealed only if asked)"
              value={get('patient.revealOnlyIfAsked') ?? []}
              onChange={(v) => set('patient.revealOnlyIfAsked', v)}
              fields={[
                { key: 'topic', label: 'Topic (for authors and the eval)' },
                { key: 'trigger', label: 'Reveal only if asked about…' },
                { key: 'answer', label: 'What the patient says', multiline: true },
                { key: 'askKeywords', label: 'Unlock words in the question (comma-separated stems, e.g. sleep, suicid, end your life)', list: true },
                { key: 'keywords', label: 'Detection keywords (comma-separated, taken from the answer)', list: true }
              ]}
              empty={{ topic: '', trigger: '', answer: '', askKeywords: [], keywords: [] }}
            />
            {text('patient.cue', 'Cue if the candidate is stuck (optional)')}
            <StringList
              label="Forbidden terms — the patient must not say these (e.g. the diagnosis) until the candidate does"
              value={get('forbiddenTerms') ?? []}
              onChange={(v) => set('forbiddenTerms', v)}
            />
          </Section>

          <Section title="Examination & investigations (scripted, shown on request)">
            <ObjectList
              label="Examination findings"
              value={get('examFindings') ?? []}
              onChange={(v) => set('examFindings', v)}
              fields={[
                { key: 'system', label: 'System / button label' },
                { key: 'finding', label: 'Finding', multiline: true }
              ]}
              empty={{ system: '', finding: '' }}
            />
            <ObjectList
              label="Investigations"
              value={get('investigations') ?? []}
              onChange={(v) => set('investigations', v)}
              fields={[
                { key: 'test', label: 'Test / button label' },
                { key: 'result', label: 'Result', multiline: true }
              ]}
              empty={{ test: '', result: '' }}
            />
          </Section>

          <Section title="Marking">
            <ObjectList
              label="Checklist items (at least 3)"
              value={get('rubric.items') ?? []}
              onChange={(v) => set('rubric.items', v)}
              fields={[
                { key: 'id', label: 'Item id' },
                { key: 'domain', label: 'Domain', options: DOMAINS, optionLabels: DOMAIN_LABELS },
                { key: 'text', label: 'What the candidate should do' },
                { key: 'weight', label: 'Weight (1–3)', number: true },
                { key: 'critical', label: 'Must-pass (failing it fails the station)', checkbox: true },
                { key: 'evidenceHint', label: 'Evidence hint for the examiner' }
              ]}
              empty={{ id: '', domain: 'dataGathering', text: '', weight: 1, critical: false, evidenceHint: '' }}
            />
            <ObjectList
              label="Post-station examiner questions"
              value={get('postEncounterQuestions') ?? []}
              onChange={(v) => set('postEncounterQuestions', v)}
              fields={[
                { key: 'q', label: 'Question' },
                { key: 'modelAnswer', label: 'Model answer', multiline: true },
                { key: 'keyPoints', label: 'Key points (comma-separated)', list: true }
              ]}
              empty={{ q: '', modelAnswer: '', keyPoints: [] }}
            />
          </Section>

          <Section title="Authoring">
            <div className="grid grid-cols-2 gap-4">
              {text('authoring.author', 'Author')}
              {text('authoring.reviewedBy', 'Reviewed by (optional)')}
            </div>
          </Section>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="card space-y-4">
      <h2 className="font-medium">{title}</h2>
      {children}
    </section>
  )
}

function StringList({
  label,
  value,
  onChange
}: {
  label: string
  value: string[]
  onChange: (v: string[]) => void
}): React.JSX.Element {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="space-y-2">
        {value.map((v, i) => (
          <div key={i} className="flex gap-2">
            <input className="input" value={v} onChange={(e) => onChange(value.map((x, j) => (j === i ? e.target.value : x)))} />
            <button className="btn-secondary px-2" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove">
              ✕
            </button>
          </div>
        ))}
        <button className="btn-secondary px-2.5 py-1 text-xs" onClick={() => onChange([...value, ''])}>
          + Add
        </button>
      </div>
    </div>
  )
}

interface FieldDef {
  key: string
  label: string
  multiline?: boolean
  list?: boolean
  number?: boolean
  checkbox?: boolean
  options?: readonly string[]
  optionLabels?: Record<string, string>
}

function ObjectList({
  label,
  value,
  onChange,
  fields,
  empty
}: {
  label: string
  value: Draft[]
  onChange: (v: Draft[]) => void
  fields: FieldDef[]
  empty: Draft
}): React.JSX.Element {
  const update = (i: number, key: string, v: unknown): void => onChange(value.map((x, j) => (j === i ? { ...x, [key]: v } : x)))
  return (
    <div>
      <label className="label">{label}</label>
      <div className="space-y-3">
        {value.map((item, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-stone-200 p-3 dark:border-stone-700">
            <div className="grid grid-cols-2 gap-2">
              {fields.map((f) => (
                <div key={f.key} className={f.multiline ? 'col-span-2' : ''}>
                  <div className="mb-0.5 text-xs text-stone-500">{f.label}</div>
                  {f.checkbox ? (
                    <input
                      type="checkbox"
                      className="mt-1.5 h-4 w-4"
                      checked={item[f.key] === true}
                      onChange={(e) => update(i, f.key, e.target.checked)}
                    />
                  ) : f.options ? (
                    <select className="input" value={item[f.key] ?? ''} onChange={(e) => update(i, f.key, e.target.value)}>
                      {f.options.map((o) => (
                        <option key={o} value={o}>
                          {f.optionLabels?.[o] ?? o}
                        </option>
                      ))}
                    </select>
                  ) : f.multiline ? (
                    <textarea className="input min-h-16" value={item[f.key] ?? ''} onChange={(e) => update(i, f.key, e.target.value)} />
                  ) : f.list ? (
                    <input
                      className="input"
                      value={(item[f.key] ?? []).join(', ')}
                      onChange={(e) =>
                        update(
                          i,
                          f.key,
                          e.target.value.split(',').map((s) => s.trimStart()).filter((s, idx, arr) => s || idx === arr.length - 1)
                        )
                      }
                      onBlur={(e) => update(i, f.key, e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                    />
                  ) : (
                    <input
                      className="input"
                      type={f.number ? 'number' : 'text'}
                      value={item[f.key] ?? ''}
                      onChange={(e) => update(i, f.key, f.number ? Number(e.target.value) : e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <button className="btn-secondary px-2.5 py-1 text-xs" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                Remove
              </button>
            </div>
          </div>
        ))}
        <button className="btn-secondary px-2.5 py-1 text-xs" onClick={() => onChange([...value, structuredClone(empty)])}>
          + Add
        </button>
      </div>
    </div>
  )
}
