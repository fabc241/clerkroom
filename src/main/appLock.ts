import { execFile, type ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { existsSync } from 'fs'
import type { UnlockResult } from '@shared/ipcTypes'

/**
 * Optional app lock. While locked, the main process answers no data request (see ipc.ts), so the
 * lock holds even if someone reaches the renderer. Unlocking needs the Mac owner's Touch ID or
 * login password, asked by the native helper in native/unlock.swift.
 */
export class AppLock extends EventEmitter {
  private locked: boolean
  private waiters: (() => void)[] = []
  private prompt: Promise<UnlockResult> | null = null
  private child: ChildProcess | null = null
  private canAuthenticate: Promise<boolean> | null = null

  constructor(
    private readonly helperPath: string,
    private readonly enabled: () => boolean,
    startLocked: boolean
  ) {
    super()
    this.locked = startLocked
  }

  get isLocked(): boolean {
    return this.locked
  }

  /** Whether this Mac can confirm its owner (a login password is set, the helper is present). */
  available(): Promise<boolean> {
    this.canAuthenticate ??= this.run(['--check']).then((code) => code === 0)
    return this.canAuthenticate
  }

  /** Locks now, e.g. when the Mac sleeps. Does nothing while the lock is turned off. */
  lock(): void {
    if (!this.enabled() || this.locked) return
    this.locked = true
    this.emit('change', true)
  }

  async unlock(): Promise<UnlockResult> {
    if (!this.locked) return 'unlocked'
    const result = await this.authenticate('unlock your saved attempts')
    if (result === 'unlocked' && this.locked) {
      this.locked = false
      for (const resolve of this.waiters.splice(0)) resolve()
      this.emit('change', false)
    }
    return result
  }

  /** Shows the macOS prompt. Concurrent callers share one prompt. */
  authenticate(reason: string): Promise<UnlockResult> {
    this.prompt ??= this.run([reason])
      .then((code): UnlockResult => (code === 0 ? 'unlocked' : code === 1 ? 'cancelled' : 'unavailable'))
      .finally(() => (this.prompt = null))
    return this.prompt
  }

  /** Resolves straight away when unlocked; otherwise once the user unlocks. */
  whenUnlocked(): Promise<void> {
    return this.locked ? new Promise((resolve) => this.waiters.push(resolve)) : Promise.resolve()
  }

  /** Closes a prompt that is still open, e.g. when the app quits. */
  dispose(): void {
    this.child?.kill()
  }

  private run(args: string[]): Promise<number> {
    return new Promise((resolve) => {
      if (!existsSync(this.helperPath)) return resolve(2)
      this.child = execFile(this.helperPath, args, (err) => {
        this.child = null
        // A non-zero exit gives a numeric code; a failure to start gives a string such as 'ENOENT'.
        resolve(!err ? 0 : typeof err.code === 'number' ? err.code : 2)
      })
    })
  }
}
