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
  settings,
  updateSettings
}: {
  status: ModelStatus
  voice: VoiceStatus
  settings: Settings
  updateSettings: (p: Partial<Settings>) => Promise<void>
}): React.JSX.Element {
  const [options, setOptions] = useState<ModelOption[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  useEffect(() => {
    window.digipat.getModelOptions().then(setOptions)
  }, [])

  const busy = status.phase === 'downloading' || status.phase === 'loading' || status.phase === 'checking'
  const selected = options.find((o) => o.id === settings.model)
  const lowMemory = (status.hardware?.memoryGb ?? 16) < 12

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-10 pt-8 pb-16">
      <PageHeader
        title="Local model"
        description="The simulated patient and the examiner run entirely on this Mac, using MedPsy, a medical and psychology language model from the QVAC registry. It downloads once; after that DigiPat works offline."
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
              onChange={() => updateSettings({ model: o.id }).then(() => window.digipat.getModelStatus())}
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
              <button className="btn-primary" onClick={() => window.digipat.prepareModel()}>
                {status.cached ? 'Load model' : `Download (${formatBytes(selected?.sizeBytes ?? 0)}) and load`}
              </button>
            )}
            {status.phase === 'downloading' && (
              <button className="btn" onClick={() => window.digipat.cancelDownload()}>
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
                    await window.digipat.deleteModel(settings.model)
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

      <VoiceSetup
        voice={voice}
        enabled={settings.voiceInput}
        lowMemory={lowMemory}
        setEnabled={async (on) => {
          await updateSettings({ voiceInput: on })
          // Loading a downloaded model is automatic; a download always needs a click.
          if (on && voice.cached) void window.digipat.prepareVoice()
        }}
      />

      <p className="text-[13px] text-text-3">
        MedPsy is released by Tether AI Research under Apache-2.0 for research and educational purposes; its training
        data is licensed for non-commercial use. See Settings & about for details.
      </p>
    </div>
  )
}

function VoiceSetup({
  voice,
  enabled,
  lowMemory,
  setEnabled
}: {
  voice: VoiceStatus
  enabled: boolean
  lowMemory: boolean
  setEnabled: (on: boolean) => Promise<void>
}): React.JSX.Element {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const busy = voice.phase === 'downloading' || voice.phase === 'loading'

  return (
    <Panel title="Voice input · optional">
      <Choice type="checkbox" align="start" checked={enabled} onChange={(on) => void setEnabled(on)}>
        <span className="block text-[15.5px] font-semibold text-text">Dictate instead of typing</span>
        <span className="block max-w-[68ch] text-[14.5px] text-text-2">
          Dictate what you say to the patient and your answers to the examiner questions. Speech is transcribed on this
          Mac by {voice.modelName}; the audio is never stored, and you can edit the text before sending it. English only.
          Uses about {formatBytes(voice.sizeBytes)} of extra memory while turned on.
        </span>
      </Choice>

      {enabled && lowMemory && (
        <p className="text-[14px] text-warn">This Mac has less than 12 GB of memory. Voice input may make replies slower.</p>
      )}
      {enabled && voice.phase === 'error' && voice.error && <ErrorBox message={voice.error} />}
      {enabled && voice.phase === 'downloading' && (
        <Download
          label="Downloading voice model"
          percent={voice.downloadPercent}
          done={voice.downloadedBytes}
          total={voice.totalBytes}
        />
      )}
      {enabled && voice.phase === 'loading' && <p className="text-[15px] text-text">Loading the voice model…</p>}
      {enabled && voice.phase === 'ready' && (
        <p className="flex items-center gap-2.5 text-[15px] text-good">
          <span className="h-2.5 w-2.5 bg-good" aria-hidden /> Voice input ready. Use the microphone button next to a text
          box to dictate.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {enabled && (voice.phase === 'idle' || voice.phase === 'error') && (
          <button className="btn-primary" onClick={() => window.digipat.prepareVoice()}>
            {voice.cached ? 'Load voice model' : `Download (${formatBytes(voice.sizeBytes)}) and load`}
          </button>
        )}
        {voice.phase === 'downloading' && (
          <button className="btn" onClick={() => window.digipat.cancelVoiceDownload()}>
            Pause download
          </button>
        )}
        {voice.cached && !busy && !confirmDelete && (
          <button className="btn-danger" onClick={() => setConfirmDelete(true)}>
            Delete voice model…
          </button>
        )}
        {confirmDelete && (
          <>
            <span className="text-[14.5px] text-text">Remove {formatBytes(voice.sizeBytes)} from disk?</span>
            <button
              className="btn-danger"
              onClick={async () => {
                await window.digipat.deleteVoiceModel()
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
