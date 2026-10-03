import { useEffect, useState } from 'react'
import type { ModelOption, ModelStatus, Settings, VoiceStatus } from '@shared/ipcTypes'
import { ErrorBox } from '../components/Notices'
import { Choice, Field, PageHeader, Panel, ProgressBar } from '../components/ui'
import { formatBytes } from '../lib/format'

function Download({
  label,
  percent,
  done,
  total
}: {
  label: string
  percent: number
  done: number
  total: number
}): React.JSX.Element {
  return (
    <div className="space-y-2" role="status">
      <div className="flex items-baseline justify-between gap-4 text-[14.5px]">
        <span className="text-text">{label}</span>
        <span className="num text-[16px] text-text-2">
          {formatBytes(done)} / {formatBytes(total)} · {percent.toFixed(1)}%
        </span>
      </div>
      <ProgressBar value={percent} label={label} />
    </div>
  )
}

export function ModelSetup({
  status,
  voice,
  speech,
  settings,
  updateSettings
}: {
  status: ModelStatus
  voice: VoiceStatus
  speech: VoiceStatus
  settings: Settings
  updateSettings: (p: Partial<Settings>) => Promise<void>
}): React.JSX.Element {
  const [options, setOptions] = useState<ModelOption[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  useEffect(() => {
    window.clerkroom.getModelOptions().then(setOptions)
  }, [])

  const busy = status.phase === 'downloading' || status.phase === 'loading' || status.phase === 'checking'
  const selected = options.find((o) => o.id === settings.model)
  const lowMemory = (status.hardware?.memoryGb ?? 16) < 12

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-10 pt-8 pb-16">
      <PageHeader
        title="Local model"
        description="The simulated patient and the examiner run entirely on this Mac, using MedPsy, a medical and psychology language model from the QVAC registry. It downloads once; after that Clerkroom works offline."
      />

      <Panel title="This Mac">
        <div className="grid grid-cols-3 gap-6 text-[15px]">
          <Field label="Processor">{status.hardware?.cpu ?? '—'}</Field>
          <Field label="Memory">
            <span className="num text-[18px]">{status.hardware?.memoryGb ?? '—'}</span> GB
          </Field>
          <Field label="Acceleration">{status.device === 'gpu' ? 'Apple Metal GPU' : 'CPU only (slower)'}</Field>
        </div>
        {!status.hardware?.appleSilicon && (
          <ErrorBox message="This Mac does not have Apple Silicon. The model will run on the CPU and replies will be slow. The 1.7B model is recommended." />
        )}
      </Panel>

      <Panel title="Model">
        <fieldset className={`space-y-3 ${busy ? 'pointer-events-none opacity-60' : ''}`}>
          <legend className="sr-only">Model</legend>
          {options.map((o) => (
            <Choice
              key={o.id}
              name="model"
              align="start"
              checked={settings.model === o.id}
              onChange={() => updateSettings({ model: o.id }).then(() => window.clerkroom.getModelStatus())}
            >
              <span className="block text-[15.5px] font-semibold text-text">{o.label}</span>
              <span className="block text-[14px] text-text-2">
                {formatBytes(o.sizeBytes)} · {o.note}
              </span>
            </Choice>
          ))}
        </fieldset>
        {lowMemory && settings.model !== 'medpsy-1.7b-q4' && (
          <p className="text-[14px] text-warn">This Mac has less than 12 GB of memory. Consider the 1.7B model.</p>
        )}

        <div className="space-y-4 border-t-[1.5px] border-line pt-4">
          {status.fit && status.fit.verdict === 'likely-too-large' && (
            <ErrorBox message={`This model may not fit in memory on this Mac. ${status.fit.detail}`} />
          )}
          {status.phase === 'error' && status.error && <ErrorBox message={status.error} />}
          {status.phase === 'downloading' && (
            <>
              <Download
                label={`Downloading ${selected?.label ?? 'model'}`}
                percent={status.downloadPercent}
                done={status.downloadedBytes}
                total={status.totalBytes}
              />
              <p className="text-[13px] text-text-3">
                The download resumes automatically if interrupted and is verified with a checksum.
              </p>
            </>
          )}
          {status.phase === 'loading' && <p className="text-[15px] text-text">Loading the model into memory…</p>}
          {status.phase === 'checking' && <p className="text-[15px] text-text">Checking this Mac…</p>}
          {status.phase === 'ready' && (
            <p className="flex items-center gap-2.5 text-[15px] text-good">
              <span className="h-2.5 w-2.5 rounded-full bg-good" aria-hidden /> Model loaded and ready.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {(status.phase === 'idle' || status.phase === 'error') && (
              <button className="btn-primary" onClick={() => window.clerkroom.prepareModel()}>
                {status.cached ? 'Load model' : `Download (${formatBytes(selected?.sizeBytes ?? 0)}) and load`}
              </button>
            )}
            {status.phase === 'downloading' && (
              <button className="btn" onClick={() => window.clerkroom.cancelDownload()}>
                Pause download
              </button>
            )}
            {status.cached && !busy && !confirmDelete && (
              <button className="btn-danger" onClick={() => setConfirmDelete(true)}>
                Delete downloaded model…
              </button>
            )}
            {confirmDelete && (
              <>
                <span className="text-[14.5px] text-text">Remove {formatBytes(selected?.sizeBytes ?? 0)} from disk?</span>
                <button
                  className="btn-danger"
                  onClick={async () => {
                    await window.clerkroom.deleteModel(settings.model)
                    setConfirmDelete(false)
                  }}
                >
                  Delete
                </button>
                <button className="btn" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </Panel>

      <OptionalModelPanel
        title="Voice input · optional"
        heading="Dictate instead of typing"
        description={`Dictate what you say to the patient and your answers to the examiner questions. Speech is transcribed on this Mac by ${voice.modelName}; the audio is never stored, and you can edit the text before sending it. English only.`}
        noun="voice model"
        readyText="Voice input ready. Use the microphone button next to a text box to dictate."
        status={voice}
        enabled={settings.voiceInput}
        lowMemory={lowMemory}
        setEnabled={async (on) => {
          await updateSettings({ voiceInput: on })
          // Loading a downloaded model is automatic; a download always needs a click.
          if (on && voice.cached) void window.clerkroom.prepareVoice()
        }}
        prepare={() => window.clerkroom.prepareVoice()}
        cancelDownload={() => window.clerkroom.cancelVoiceDownload()}
        deleteModel={() => window.clerkroom.deleteVoiceModel()}
      />

      <OptionalModelPanel
        title="Spoken replies · optional"
        heading="Hear the patient’s replies"
        description={`Each reply is read aloud on this Mac by ${speech.modelName}, in the voice the station sets for the patient, and stays on screen as text. Nothing is recorded. English only.`}
        noun="speech model"
        readyText="Spoken replies ready. The patient’s replies are read aloud during a station."
        status={speech}
        enabled={settings.speakReplies}
        lowMemory={lowMemory}
        setEnabled={async (on) => {
          await updateSettings({ speakReplies: on })
          if (on && speech.cached) void window.clerkroom.prepareSpeech()
        }}
        prepare={() => window.clerkroom.prepareSpeech()}
        cancelDownload={() => window.clerkroom.cancelSpeechDownload()}
        deleteModel={() => window.clerkroom.deleteSpeechModel()}
      />

      <p className="text-[13px] text-text-3">
        MedPsy is released by Tether AI Research under Apache-2.0 for research and educational purposes; its training
        data is licensed for non-commercial use. See Settings & about for details.
      </p>
    </div>
  )
}

/** An optional speech model (dictation or spoken replies) that the student can turn on, download and delete. */
function OptionalModelPanel({
  title,
  heading,
  description,
  noun,
  readyText,
  status,
  enabled,
  lowMemory,
  setEnabled,
  prepare,
  cancelDownload,
  deleteModel
}: {
  title: string
  heading: string
  description: string
  /** Lower-case name for buttons and progress, e.g. "voice model". */
  noun: string
  readyText: string
  status: VoiceStatus
  enabled: boolean
  lowMemory: boolean
  setEnabled: (on: boolean) => Promise<void>
  prepare: () => Promise<VoiceStatus>
  cancelDownload: () => Promise<void>
  deleteModel: () => Promise<void>
}): React.JSX.Element {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const busy = status.phase === 'downloading' || status.phase === 'loading'

  return (
    <Panel title={title}>
      <Choice type="checkbox" align="start" checked={enabled} onChange={(on) => void setEnabled(on)}>
        <span className="block text-[15.5px] font-semibold text-text">{heading}</span>
        <span className="block max-w-[68ch] text-[14.5px] text-text-2">
          {description} Uses about {formatBytes(status.sizeBytes)} of extra memory while turned on.
        </span>
      </Choice>

      {enabled && lowMemory && (
        <p className="text-[14px] text-warn">This Mac has less than 12 GB of memory. The {noun} may make replies slower.</p>
      )}
      {enabled && status.phase === 'error' && status.error && <ErrorBox message={status.error} />}
      {enabled && status.phase === 'downloading' && (
        <Download
          label={`Downloading ${noun}`}
          percent={status.downloadPercent}
          done={status.downloadedBytes}
          total={status.totalBytes}
        />
      )}
      {enabled && status.phase === 'loading' && <p className="text-[15px] text-text">Loading the {noun}…</p>}
      {enabled && status.phase === 'ready' && (
        <p className="flex items-center gap-2.5 text-[15px] text-good">
          <span className="h-2.5 w-2.5 bg-good" aria-hidden /> {readyText}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {enabled && (status.phase === 'idle' || status.phase === 'error') && (
          <button className="btn-primary" onClick={() => void prepare()}>
            {status.cached ? `Load ${noun}` : `Download (${formatBytes(status.sizeBytes)}) and load`}
          </button>
        )}
        {status.phase === 'downloading' && (
          <button className="btn" onClick={() => void cancelDownload()}>
            Pause download
          </button>
        )}
        {status.cached && !busy && !confirmDelete && (
          <button className="btn-danger" onClick={() => setConfirmDelete(true)}>
            Delete {noun}…
          </button>
        )}
        {confirmDelete && (
          <>
            <span className="text-[14.5px] text-text">Remove {formatBytes(status.sizeBytes)} from disk?</span>
            <button
              className="btn-danger"
              onClick={async () => {
                await deleteModel()
                setConfirmDelete(false)
              }}
            >
              Delete
            </button>
            <button className="btn" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
          </>
        )}
      </div>
    </Panel>
  )
}
