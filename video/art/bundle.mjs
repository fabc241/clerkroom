import { bundleSdk } from '@qvac/sdk/commands'
const r = await bundleSdk({ projectRoot: import.meta.dirname, hosts: [`${process.platform}-${process.arch}`], quiet: true })
console.log(r.plugins)
