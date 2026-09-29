// Smoke test: download (if needed) + load MedPsy-4B, run one streamed completion.
// Usage: npx tsx scripts/smokeModel.ts
import {
  HEALTHCARE_4B_MEDICAL_Q4_K_M,
  loadModel,
  completion,
  unloadModel,
  close,
  getSystemResources,
  VERBOSITY
} from '@qvac/sdk'

async function main(): Promise<void> {
  console.log('resources:', JSON.stringify(await getSystemResources()).slice(0, 600))

  let lastPct = -1
  const t0 = Date.now()
  const modelId = await loadModel({
    modelSrc: HEALTHCARE_4B_MEDICAL_Q4_K_M,
    modelConfig: { device: 'gpu', ctx_size: 8192, verbosity: VERBOSITY.ERROR },
    onProgress: (p) => {
      const pct = Math.floor(p.percentage)
      if (pct !== lastPct && pct % 5 === 0) {
        lastPct = pct
        console.log(`download ${pct}%`)
      }
    }
  })
  console.log(`loaded ${modelId} in ${((Date.now() - t0) / 1000).toFixed(1)}s`)

  const t1 = Date.now()
  let firstContent = 0
  const run = completion({
    modelId,
    history: [
      {
        role: 'system',
        content:
          'In this educational role-play you are NOT an assistant. You are Sam, a 34-year-old patient who has felt low for two months. Answer in 1-3 short sentences of everyday language.'
      },
      { role: 'user', content: 'Hello, I am the doctor. What brings you in today?' }
    ],
    stream: true,
    captureThinking: true,
    generationParams: { temp: 0.6, top_p: 0.95, top_k: 20, predict: 1024 }
  })
  let thinkingChars = 0
  for await (const ev of run.events) {
    if (ev.type === 'thinkingDelta') thinkingChars += ev.text.length
    if (ev.type === 'contentDelta') {
      if (!firstContent) firstContent = Date.now()
      process.stdout.write(ev.text)
    }
  }
  const final = await run.final
  console.log('\n---')
  console.log('thinking chars:', thinkingChars, 'stop:', final.stopReason)
  console.log('time to first visible token (s):', ((firstContent - t1) / 1000).toFixed(1))
  console.log('stats:', JSON.stringify(final.stats))
  await unloadModel({ modelId })
  await close()
}

main().catch(async (e) => {
  console.error(e)
  await close().catch(() => {})
  process.exit(1)
})
