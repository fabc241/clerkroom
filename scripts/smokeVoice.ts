// Smoke test: download (if needed) + load Parakeet Unified, then transcribe speech rendered by macOS `say`.
// Feeds raw 16 kHz s16le PCM exactly as the app does (no WAV container, no decoding).
// Usage: npx tsx scripts/smokeVoice.ts ["sentence to speak"]
import { execFileSync } from 'child_process'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { PARAKEET_UNIFIED_0_6B_Q8_0, close, loadModel, transcribe, unloadModel } from '@qvac/sdk'
import { VOICE_SAMPLE_RATE, cleanTranscript, pcmError } from '../src/shared/voice'

/** Returns the PCM payload of a WAV file's "data" chunk. */
function wavData(wav: Buffer): Buffer {
  let offset = 12
  while (offset + 8 <= wav.length) {
    const id = wav.toString('ascii', offset, offset + 4)
    const size = wav.readUInt32LE(offset + 4)
    if (id === 'data') return wav.subarray(offset + 8, offset + 8 + size)
    offset += 8 + size + (size % 2)
  }
  throw new Error('No data chunk in WAV file')
}

async function main(): Promise<void> {
  const sentence = process.argv[2] ?? 'Hello, I am one of the doctors. Can you tell me what brought you in today?'
  const dir = mkdtempSync(join(tmpdir(), 'digipat-voice-'))
  let pcm: Buffer
  try {
    const wavPath = join(dir, 'speech.wav')
    execFileSync('say', ['-o', wavPath, `--data-format=LEI16@${VOICE_SAMPLE_RATE}`, sentence])
    pcm = wavData(readFileSync(wavPath))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
  const invalid = pcmError(new Uint8Array(pcm))
  if (invalid) throw new Error(invalid)
  console.log(`audio: ${(pcm.length / 2 / VOICE_SAMPLE_RATE).toFixed(1)} s`)

  let lastPct = -1
  const t0 = Date.now()
  const modelId = await loadModel({
    modelSrc: PARAKEET_UNIFIED_0_6B_Q8_0,
    onProgress: (p) => {
      const pct = Math.floor(p.percentage)
      if (pct !== lastPct && pct % 10 === 0) {
        lastPct = pct
        console.log(`download ${pct}%`)
      }
    }
  })
  console.log(`loaded ${modelId} in ${((Date.now() - t0) / 1000).toFixed(1)}s`)

  const t1 = Date.now()
  const text = await transcribe({ modelId, audioChunk: pcm as unknown as Parameters<typeof transcribe>[0]['audioChunk'] })
  console.log(`transcribed in ${((Date.now() - t1) / 1000).toFixed(2)}s`)
  console.log('said: ', sentence)
  console.log('heard:', cleanTranscript(text))
  await unloadModel({ modelId })
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => close().catch(() => {}))
