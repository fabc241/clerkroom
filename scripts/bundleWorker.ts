// Regenerates the QVAC worker in qvac/ from the plugins listed in qvac.config.json.
// `npm run dev` uses this worker, so run it after adding or removing a plugin.
// (`npm run package` / `make` regenerate it automatically through the QVAC Forge plugin.)
// Usage: npm run bundle-worker
import { bundleSdk } from '@qvac/sdk/commands'

const host = `${process.platform}-${process.arch}`
const result = await bundleSdk({ projectRoot: process.cwd(), hosts: [host], quiet: true })
console.log(`Worker bundled for ${host} with plugins:\n  ${result.plugins.join('\n  ')}`)
