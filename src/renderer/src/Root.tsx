import { useEffect, useState } from 'react'
import App from './App'
import { LockScreen } from './screens/LockScreen'

/**
 * Shows the lock screen until the user unlocks. The app mounts only after the first unlock, and
 * stays mounted (inert, behind the lock screen) when the Mac sleeps, so a station in progress survives.
 */
export default function Root(): React.JSX.Element {
  const [locked, setLocked] = useState<boolean | null>(null)
  const [opened, setOpened] = useState(false)

  useEffect(() => {
    const off = window.clerkroom.onLockChanged(setLocked)
    window.clerkroom.getLockStatus().then((s) => setLocked(s.locked))
    return off
  }, [])

  useEffect(() => {
    if (locked === false) setOpened(true)
  }, [locked])

  if (locked === null) return <div className="p-8 text-text-3">Starting…</div>

  return (
    <>
      {opened && (
        <div className="h-full" inert={locked} aria-hidden={locked}>
          <App />
        </div>
      )}
      {locked && <LockScreen promptOnOpen={!opened} />}
    </>
  )
}
