// Generates consulting-room artwork locally with FLUX.2 [klein] through the QVAC SDK.
//   (cd video/art && node generate.mjs <name> <seed> "<prompt>" [width height steps] [init.png])
//   (uses the worker bundled by bundle.mjs; an init image switches to FLUX.2 in-context img2img)
import { loadModel, unloadModel, diffusion, close, FLUX_2_KLEIN_4B_Q4_0, FLUX_2_KLEIN_4B_VAE, QWEN3_4B_Q4_K_M } from '@qvac/sdk'
import fs from 'fs'
import path from 'path'

const [name, seed, prompt, w = '1024', h = '384', steps = '24', init] = process.argv.slice(2)
const out = path.join(import.meta.dirname, 'out')
fs.mkdirSync(out, { recursive: true })
const modelId = await loadModel({
  modelSrc: FLUX_2_KLEIN_4B_Q4_0,
  modelType: 'sdcpp-generation',
  modelConfig: { device: 'gpu', threads: 4, llmModelSrc: QWEN3_4B_Q4_K_M, vaeModelSrc: FLUX_2_KLEIN_4B_VAE, ...(init ? { prediction: 'flux2_flow' } : {}) }
})
const t0 = Date.now()
const size = init ? { init_image: new Uint8Array(fs.readFileSync(init)) } : { width: Number(w), height: Number(h) }
const { progressStream, outputs } = diffusion({ modelId, prompt, ...size, steps: Number(steps), guidance: 3.5, cfg_scale: 1, seed: Number(seed) })
for await (const _ of progressStream);
const [png] = await outputs
fs.writeFileSync(path.join(out, `${name}.png`), png)
console.log(`${name}: ${((Date.now() - t0) / 1000).toFixed(0)}s`)
await unloadModel({ modelId, clearStorage: false })
await close().catch(() => {})
process.exit(0)
