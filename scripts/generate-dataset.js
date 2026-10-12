import { writeFileSync } from 'node:fs'
import { generateEvents } from '../src/data/generator.js'
import { parseDataset } from '../src/data/dataset.js'
const events = generateEvents(42)
const dataset = parseDataset(JSON.stringify(events))
writeFileSync(new URL('../public/datasets/sim-farm-test.json', import.meta.url), JSON.stringify(events, null, 2) + '\n')
console.log(`Generated ${events.length} events, ${dataset.summary.sims} SIMs, ${dataset.summary.flagged} flagged; replay ${dataset.duration / 1000}s.`)
