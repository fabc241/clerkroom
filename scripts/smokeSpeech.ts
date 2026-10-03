// Smoke test: download (if needed) + load Parler TTS mini, then speak a station's opening statement in
// the station's patient voice, sentence by sentence as the app does, and write the audio to a WAV file.
// Usage: npx tsx scripts/smokeSpeech.ts [station-id] [--cpu] [--out file.wav]
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { TTS_MINI_V1_EN_PARLER_TTS_Q8_0, close, loadModel, textToSpeech, unloadModel } from '@qvac/sdk'
import { stationSchema } from '../src/shared/stationSchema'
import { patientVoice, speakableText, speechParts } from '../src/shared/speech'

function wav(samples: Int16Array, sampleRate: number): Buffer {
  const data = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength)
  const h = Buffer.alloc(44)
  h.write('RIFF', 0)
  h.writeUInt32LE(36 + data.length, 4)
  h.write('WAVEfmt ', 8)
  h.writeUInt32LE(16, 16)
  h.writeUInt16LE(1, 20)
  h.writeUInt16LE(1, 22)
  h.writeUInt32LE(sampleRate, 24)
  h.writeUInt32LE(sampleRate * 2, 28)
  h.writeUInt16LE(2, 32)
  h.writeUInt16LE(16, 34)
  h.write('data', 36)
  h.writeUInt32LE(data.length, 40)
  return Buffer.concat([h, data])
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const useGPU = !args.includes('--cpu')
  const outIdx = args.indexOf('--out')
  const out = outIdx >= 0 ? args[outIdx + 1] : 'speech.wav'
  const id = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--out') ?? 'psych-low-mood'
  const station = stationSchema.parse(
    JSON.parse(readFileSync(join(import.meta.dirname, '..', 'stations', `${id}.json`), 'utf8'))
  )
  const voice = patientVoice(station.patient)
  console.log(`station: ${id}  voice: ${JSON.stringify(voice)}  ${useGPU ? 'GPU' : 'CPU'}`)

  let lastPct = -1
  const t0 = Date.now()
  const modelId = await loadModel({
    modelSrc: TTS_MINI_V1_EN_PARLER_TTS_Q8_0,
    modelConfig: { ttsEngine: 'parler', useGPU },
    onProgress: (p) => {
      const pct = Math.floor(p.percentage)
      if (pct !== lastPct && pct % 10 === 0) {
        lastPct = pct
        console.log(`download ${pct}%`)
      }
    }
  })
  console.log(`loaded in ${((Date.now() - t0) / 1000).toFixed(1)}s`)

  const text = station.patient.openingStatement
  console.log(`text: ${text}`)
  const t1 = Date.now()
  const chunks: number[][] = []
  let sampleRate = 44_100
  for (const part of speechParts(speakableText(text))) {
    const run = textToSpeech({ modelId, text: part, inputType: 'text', stream: false, ...voice })
    const samples = await run.buffer
    sampleRate = (await run.sampleRate) ?? sampleRate
    chunks.push(samples)
    console.log(`  +${((Date.now() - t1) / 1000).toFixed(1)}s  ${(samples.length / sampleRate).toFixed(1)}s audio  "${part}"`)
  }
  const all = Int16Array.from(chunks.flat())
  const audioSec = all.length / sampleRate
  const took = (Date.now() - t1) / 1000
  console.log(`synthesised ${audioSec.toFixed(1)}s of audio in ${took.toFixed(1)}s (x${(audioSec / took).toFixed(2)} real time)`)
  writeFileSync(out, wav(all, sampleRate))
  console.log(`wrote ${out}`)
  await unloadModel({ modelId })
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => close().catch(() => {}))
