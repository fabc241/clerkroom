import { useEffect, useRef, useState } from 'react'
import type { UnlockResult } from '@shared/ipcTypes'
import { Icon } from '../components/ui'
import { LogoMark } from '../components/LogoMark'

const MESSAGES: Record<Exclude<UnlockResult, 'unlocked'>, string> = {
  cancelled: 'Not unlocked. Try again when you are ready.',
  unavailable:
    'This Mac could not confirm it is you. Check that your Mac has a login password (System Settings › Touch ID & Password).'
}

/** Covers the whole window while the app is locked. The main process enforces the lock itself. */
export function LockScreen({ promptOnOpen }: { promptOnOpen: boolean }): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const prompted = useRef(false)

  const unlock = async (): Promise<void> => {
    setBusy(true)
    setMessage(null)
    const result = await window.clerkroom.unlock()
    setBusy(false)
    if (result !== 'unlocked') setMessage(MESSAGES[result])
  }

  // When the app opens, ask straight away; after the Mac sleeps, wait for the user to come back.
  useEffect(() => {
    if (promptOnOpen && !prompted.current) {
      prompted.current = true
      void unlock()
    }
  }, [promptOnOpen])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
      <div className="drag h-12 shrink-0" />
      <div className="flex flex-1 items-center justify-center px-8 pb-16">
        <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-8 text-center shadow-card">
          <LogoMark className="mx-auto h-14 w-14" />
          <h1 className="page-title mt-5 text-[26px]">Clerkroom is locked</h1>
          <p className="mx-auto mt-2 max-w-[38ch] text-[15px] leading-relaxed text-text-2">
            Your saved attempts and stations are encrypted on this Mac. Unlock with Touch ID or your Mac password.
          </p>
          <button className="btn-primary mt-6 min-h-10 px-6" disabled={busy} onClick={() => void unlock()} autoFocus>
            <Icon name="lock" className="h-4 w-4" />
            {busy ? 'Waiting for macOS…' : 'Unlock'}
          </button>
          {message && (
            <p role="alert" className="mx-auto mt-4 max-w-[40ch] text-[13.5px] leading-relaxed text-bad">
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
