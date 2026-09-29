import { useEffect, useState } from 'react'
import type { ModelOption, ModelStatus, Settings } from '@shared/ipcTypes'
import { ErrorBox } from '../components/Notices'
import { formatBytes } from '../lib/format'

export function ModelSetup({
  status,
  settings,
  updateSettings
}: {
  status: ModelStatus
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
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-xl font-semibold">Local AI model</h1>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
          The simulated patient and the examiner feedback run entirely on this Mac using MedPsy, a medical and
          psychology language model from the QVAC registry. The model is downloaded once; after that the app works
          offline.
        </p>
      </div>

      <div className="card space-y-4">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="label">Processor</div>
            {status.hardware?.cpu ?? '—'}
          </div>
          <div>
            <div className="label">Memory</div>
            {status.hardware?.memoryGb ?? '—'} GB
          </div>
          <div>
            <div className="label">Acceleration</div>
            {status.device === 'gpu' ? 'Apple Metal GPU' : 'CPU only (slower)'}
          </div>
        </div>
        {!status.hardware?.appleSilicon && (
          <ErrorBox message="This Mac does not have Apple Silicon. The model will run on the CPU and replies will be slow. The 1.7B model is recommended." />
        )}
      </div>

      <div className="card space-y-3">
        <div className="label">Model</div>
        {options.map((o) => (
          <label
            key={o.id}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
              settings.model === o.id ? 'border-brand-500 bg-brand-50 dark:bg-stone-800' : 'border-stone-200 dark:border-stone-700'
            } ${busy ? 'pointer-events-none opacity-60' : ''}`}
          >
            <input
              type="radio"
              name="model"
              className="mt-1 accent-brand-600"
              checked={settings.model === o.id}
              onChange={() => updateSettings({ model: o.id }).then(() => window.digipat.getModelStatus())}
            />
            <div>
              <div className="text-sm font-medium">{o.label}</div>
              <div className="text-xs text-stone-500">
                {formatBytes(o.sizeBytes)} · {o.note}
              </div>
            </div>
          </label>
        ))}
        {lowMemory && settings.model !== 'medpsy-1.7b-q4' && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            This Mac has less than 12 GB of memory — consider the 1.7B model.
          </p>
        )}
      </div>

      <div className="card space-y-4">
        {status.fit && status.fit.verdict === 'likely-too-large' && (
          <ErrorBox message={`This model may not fit in memory on this Mac. ${status.fit.detail}`} />
        )}
        {status.phase === 'error' && status.error && <ErrorBox message={status.error} />}

        {status.phase === 'downloading' && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Downloading {selected?.label}</span>
              <span className="tabular-nums">
                {formatBytes(status.downloadedBytes)} / {formatBytes(status.totalBytes)} (
                {status.downloadPercent.toFixed(1)}%)
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
              <div className="h-full bg-brand-500 transition-all" style={{ width: `${status.downloadPercent}%` }} />
            </div>
            <p className="text-xs text-stone-500">
              The download resumes automatically if interrupted and is verified with a checksum.
            </p>
          </div>
        )}
        {status.phase === 'loading' && <p className="text-sm">Loading the model into memory…</p>}
        {status.phase === 'checking' && <p className="text-sm">Checking this Mac…</p>}
        {status.phase === 'ready' && (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">Model loaded and ready.</p>
        )}

        <div className="flex flex-wrap gap-2">
          {(status.phase === 'idle' || status.phase === 'error') && (
            <button className="btn-primary" onClick={() => window.digipat.prepareModel()}>
              {status.cached ? 'Load model' : `Download (${formatBytes(selected?.sizeBytes ?? 0)}) and load`}
            </button>
          )}
          {status.phase === 'downloading' && (
            <button className="btn-secondary" onClick={() => window.digipat.cancelDownload()}>
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
              <span className="self-center text-sm">Remove {formatBytes(selected?.sizeBytes ?? 0)} from disk?</span>
              <button
                className="btn-danger"
                onClick={async () => {
                  await window.digipat.deleteModel(settings.model)
                  setConfirmDelete(false)
                }}
              >
                Delete
              </button>
              <button className="btn-secondary" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
      <p className="text-xs text-stone-500">
        MedPsy is released by Tether AI Research under Apache-2.0 for research and educational purposes; its
        training data is licensed for non-commercial use. See About for details.
      </p>
    </div>
  )
}
