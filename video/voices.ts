// Which macOS voices does Parakeet transcribe correctly? npx tsx video/voices.ts
import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'
import { PARAKEET_UNIFIED_0_6B_Q8_0, loadModel, transcribe, unloadModel, close } from '@qvac/sdk'
import { VOICE_SAMPLE_RATE, cleanTranscript } from '../src/shared/voice'
const S = 'Does the pain go anywhere?'
const wavData = (w: Buffer): Buffer => { let o = 12; while (o + 8 <= w.length) { const id = w.toString('ascii', o, o + 4); const n = w.readUInt32LE(o + 4); if (id === 'data') return w.subarray(o + 8, o + 8 + n); o += 8 + n + (n % 2) } throw new Error('no data') }
async function main(): Promise<void> {
  const modelId = await loadModel({ modelSrc: PARAKEET_UNIFIED_0_6B_Q8_0 })
  for (const v of ['Daniel', 'Samantha', 'Moira', 'Karen', 'Eddy (Inglese (UK))', 'Flo (Inglese (UK))', 'Reed (Inglese (UK))', 'Kathy', 'Fred', 'Rishi', 'Tessa']) {
    for (const rate of [150, 175]) {
      try {
        const p = `${process.env.TMPDIR}/v.wav`
        execFileSync('say', ['-v', v, '-r', String(rate), '-o', p, `--data-format=LEI16@${VOICE_SAMPLE_RATE}`, S])
        const t = await transcribe({ modelId, audioChunk: wavData(readFileSync(p)) as never })
        console.log(`${v} @${rate}: ${cleanTranscript(t)}`)
      } catch (e) { console.log(`${v}: ${(e as Error).message.split('\n')[0]}`) }
    }
  }
  await unloadModel({ modelId })
}
main().finally(() => close().catch(() => {}))
