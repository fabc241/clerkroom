// Plays the patient's spoken replies: 16-bit mono PCM parts, back to back, as they arrive.

export interface Player {
  /** Queues one part of a reply; it starts as soon as the parts before it have finished. */
  enqueue(pcm: Uint8Array, sampleRate: number): void
  /** Stops playback straight away and drops anything queued. */
  stop(): void
  /** Releases the audio device. The player can't be used afterwards. */
  close(): void
}

/** `onPlaying` is called with true when sound starts and false when the queue has run out or is stopped. */
export function createPlayer(onPlaying: (playing: boolean) => void): Player {
  let ctx: AudioContext | null = null
  let endsAt = 0
  const sources = new Set<AudioBufferSourceNode>()

  const settle = (): void => {
    if (sources.size === 0) onPlaying(false)
  }

  return {
    enqueue(pcm, sampleRate) {
      ctx ??= new AudioContext()
      const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2))
      if (samples.length === 0) return
      const buffer = ctx.createBuffer(1, samples.length, sampleRate)
      const channel = buffer.getChannelData(0)
      for (let i = 0; i < samples.length; i++) channel[i] = samples[i] / 0x8000
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      const startAt = Math.max(ctx.currentTime, endsAt)
      endsAt = startAt + buffer.duration
      source.onended = () => {
        sources.delete(source)
        settle()
      }
      sources.add(source)
      source.start(startAt)
      onPlaying(true)
    },
    stop() {
      for (const s of sources) {
        s.onended = null
        s.stop()
      }
      sources.clear()
      endsAt = 0
      onPlaying(false)
    },
    close() {
      this.stop()
      void ctx?.close()
      ctx = null
    }
  }
}
