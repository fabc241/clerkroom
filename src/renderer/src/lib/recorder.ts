import { VOICE_SAMPLE_RATE, downmix, encodePcm16 } from '@shared/voice'

export interface Recording {
  /** Stops recording and returns 16 kHz mono s16le PCM for the speech model. */
  stop(): Promise<Uint8Array>
  /** Stops recording and discards the audio. */
  cancel(): void
}

/**
 * Records from the default microphone. Audio stays in memory: it is compressed by MediaRecorder,
 * then decoded and resampled to 16 kHz by an OfflineAudioContext, and never written to disk.
 */
export async function startRecording(): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
  })
  const releaseMic = (): void => stream.getTracks().forEach((t) => t.stop())
  let recorder: MediaRecorder
  try {
    recorder = new MediaRecorder(stream)
  } catch (err) {
    releaseMic()
    throw err
  }
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }
  const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()))
  recorder.start()

  const halt = (): void => {
    if (recorder.state !== 'inactive') recorder.stop()
    releaseMic()
  }

  return {
    async stop() {
      halt()
      await stopped
      const encoded = await new Blob(chunks, { type: recorder.mimeType }).arrayBuffer()
      if (encoded.byteLength === 0) return new Uint8Array()
      // decodeAudioData resamples to the context's rate.
      const decoded = await new OfflineAudioContext(1, 1, VOICE_SAMPLE_RATE).decodeAudioData(encoded)
      const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i))
      return encodePcm16(downmix(channels))
    },
    cancel: halt
  }
}

/** Turns getUserMedia / decoding failures into something a student can act on. */
export function describeRecordingError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Clerkroom is not allowed to use the microphone. Allow it in System Settings → Privacy & Security → Microphone.'
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No microphone was found.'
  if (name === 'NotReadableError') return 'The microphone is in use by another app.'
  if (name === 'EncodingError') return 'The recording could not be processed. Please try again.'
  const message = err instanceof Error ? err.message : String(err)
  // Errors thrown in the main process arrive wrapped by ipcRenderer.invoke.
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}
