import test from 'node:test'
import assert from 'node:assert/strict'
import { createMeetingClock, createDecisionHistory } from '../src/meeting-mode.js'
import { generateEvents } from '../src/data/generator.js'
import { parseDataset } from '../src/data/dataset.js'
import { decisionDetails } from '../src/ui/reasoning-model.js'

test('meeting clock scales time tenfold with bounded steps, then restores normal pacing', () => {
  const clock = createMeetingClock(); let elapsed = 0
  const step = dt => { assert.ok(dt <= .05); elapsed += dt }
  clock.advance(.05, step); assert.equal(elapsed, .05)
  clock.toggle(); assert.equal(clock.speed, 10); clock.advance(.05, step)
  assert.ok(Math.abs(elapsed - .55) < 1e-9)
  clock.toggle(); clock.advance(.05, step); assert.ok(Math.abs(elapsed - .6) < 1e-9)
})
test('history retains separate repeated occurrences and independent evidence across datasets', () => {
  const dataset = parseDataset(JSON.stringify(generateEvents()))
  const decision = dataset.events.find(e => e.verdict === 'flagged')
  const history = createDecisionHistory()
  const clean = history.record(dataset.events.find(e => e.verdict === 'clean'), dataset.byId)
  assert.equal(decisionDetails(clean.decision, clean.byId).verdict, 'clean')
  const first = history.record(decision, dataset.byId)
  const second = history.record(decision, dataset.byId)
  assert.equal(history.entries[0], second); assert.equal(history.entries[1], first)
  const expected = decisionDetails(first.decision, first.byId)
  decision.reasoning_trace = 'Changed'; dataset.byId.clear()
  assert.deepEqual(decisionDetails(first.decision, first.byId), expected)
  assert.equal(first.sequence, 2); assert.equal(second.sequence, 3)
})
