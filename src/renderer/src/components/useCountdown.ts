import { useEffect, useRef, useState } from 'react'

/** Wall-clock countdown (robust to throttled timers). Calls onExpire once when it reaches zero. */
export function useCountdown(totalSeconds: number, onExpire: () => void, running = true): number {
  const [endAt] = useState(() => Date.now() + totalSeconds * 1000)
  const [remaining, setRemaining] = useState(totalSeconds)
  const expired = useRef(false)
  const cb = useRef(onExpire)
  cb.current = onExpire

  useEffect(() => {
    if (!running) return
    const tick = (): void => {
      const left = Math.max(0, (endAt - Date.now()) / 1000)
      setRemaining(left)
      if (left <= 0 && !expired.current) {
        expired.current = true
        cb.current()
      }
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [endAt, running])

  return remaining
}
