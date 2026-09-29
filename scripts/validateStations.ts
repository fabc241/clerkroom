// Validates every bundled station against the schema. Usage: npm run validate-stations
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { formatIssues, stationSchema } from '../src/shared/stationSchema'

const dir = join(import.meta.dirname, '..', 'stations')
let failed = 0
for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const res = stationSchema.safeParse(JSON.parse(readFileSync(join(dir, f), 'utf8')))
  if (res.success) {
    const s = res.data
    const idOk = f === `${s.id}.json`
    console.log(`${idOk ? '✓' : '✗'} ${f} — ${s.rubric.items.length} rubric items, ${s.patient.revealOnlyIfAsked.length} hidden facts`)
    if (!idOk) {
      failed++
      console.log(`    file name must be "${s.id}.json"`)
    }
  } else {
    failed++
    console.log(`✗ ${f}`)
    for (const line of formatIssues(res.error)) console.log(`    ${line}`)
  }
}
process.exit(failed ? 1 : 0)
