import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { generateEvents } from '../src/data/generator.js'
import { parseDataset } from '../src/data/dataset.js'
import { createReplay } from '../src/data/replay.js'
import { createCoreState } from '../src/core-state.js'
import { createLayout } from '../src/layout.js'
import { createRawEventFlow } from '../src/raw-events.js'
import { createAgentOutputFlow } from '../src/agent-outputs.js'
import { createReturnFlow } from '../src/return-flow.js'

globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillText() {} }) }) }
const sample = () => generateEvents()

test('downloadable fixture validates and generated samples always include 12.5% flagged SIMs', () => {
  const fixture = parseDataset(readFileSync(new URL('../public/datasets/sim-farm-test.json', import.meta.url), 'utf8'))
  assert.equal(fixture.summary.flagged, 2); assert.equal(fixture.summary.sims, 16)
  for (let seed = 1; seed <= 20; seed++) {
    const dataset = parseDataset(JSON.stringify(generateEvents(seed)))
    assert.deepEqual(dataset.summary, { raw: 64, inputs: 64, decisions: 16, sims: 16, flagged: 2 })
    assert.ok(dataset.duration > dataset.events.at(-1).timestamp + 6000)
  }
  assert.notDeepEqual(generateEvents(42), generateEvents(43))
})

test('loader rejects malformed JSON, broken lineage, unsupported nodes, invalid timing and oversized input', () => {
  assert.throws(() => parseDataset('bad json'), /Invalid JSON/)
  assert.throws(() => parseDataset('{}'), /array/)
  assert.throws(() => parseDataset(' '.repeat(1024 * 1024 + 1)), /too large/)
  const cases = [
    [e => { e[0].tower_id = 'tower_9' }, /tower/],
    [e => { e[1].id = e[0].id }, /unique/],
    [e => { e.find(e => e.kind === 'agent_output').derived_from = ['missing'] }, /reference/],
    [e => { e.find(e => e.kind === 'agent_output').timestamp = 1 }, /1850/],
    [e => { e.find(e => e.kind === 'core_decision').timestamp = 0 }, /1650/],
    [e => { e.find(e => e.kind === 'core_decision').confidence = 2 }, /confidence/],
    [e => { e.find(e => e.kind === 'core_decision').agent_inputs.pop() }, /four/],
    [e => { e.find(e => e.kind === 'core_decision').contributions[0].weight = 1 }, /weights/],
  ]
  for (const [change, expected] of cases) { const events = sample(); change(events); assert.throws(() => parseDataset(JSON.stringify(events)), expected) }
})

test('unordered input is sorted and optional kind and contributions are normalized', () => {
  const events = sample().reverse()
  events.forEach(e => { delete e.kind; delete e.contributions })
  const dataset = parseDataset(JSON.stringify(events))
  assert.equal(dataset.events[0].timestamp, 0)
  assert.equal(dataset.events.filter(e => e.kind === 'core_decision').length, 16)
  assert.equal(dataset.events.find(e => e.kind === 'core_decision').contributions[0].weight, .25)
})

test('decision waits for evidence, visits reasoning before decision, and incoming events cannot overwrite it', () => {
  const dataset = parseDataset(JSON.stringify(sample()))
  const decision = dataset.events.find(e => e.kind === 'core_decision')
  const inputs = decision.agent_inputs.map(id => dataset.byId.get(id))
  const state = createCoreState()
  state.enqueue(decision); state.enqueue(decision)
  state.update(5); assert.notEqual(state.snapshot().state, 'reasoning')
  inputs.forEach(input => state.receive(input)); state.update(.01)
  assert.equal(state.snapshot().state, 'reasoning')
  const other = dataset.events.find(e => e.kind === 'agent_output' && e.ue_id !== decision.ue_id)
  state.begin(other); state.receive(other); assert.equal(state.snapshot().state, 'reasoning')
  assert.deepEqual(state.update(1.61), [decision])
  assert.equal(state.snapshot().state, 'decision')
  assert.deepEqual(state.update(.7), [])
  assert.equal(state.snapshot().decisionCount, 1)
})

test('full Phase 4 replay delivers all 16 verdicts back to the correct SIM and resets without residual particles', () => {
  const dataset = parseDataset(JSON.stringify(sample()))
  const scene = new THREE.Scene(), layout = createLayout(scene)
  const raw = createRawEventFlow(scene, layout, () => {})
  const output = createAgentOutputFlow(scene, layout, () => {})
  const delivered = [], emitted = [], observedReasoning = new Set()
  const returns = createReturnFlow(scene, layout, output.routes, dataset.events.filter(e => e.kind === 'core_decision'), e => delivered.push(e))
  const baseline = returns.group.children.length
  const replay = createReplay(dataset.events, dataset.duration)
  replay.subscribe(e => {
    if (e.kind === 'raw') raw.emit(e)
    else if (e.kind === 'agent_output') output.emit(e)
    else layout.core.state.enqueue(e)
  })
  for (let i = 0; i < (dataset.duration - 100) / 10; i++) {
    replay.update(.01); raw.update(.01); output.update(.01); layout.agents.update(.01)
    for (const decision of layout.core.update(.01)) {
      assert.ok(observedReasoning.has(decision.ue_id))
      emitted.push(decision); returns.emit(decision)
    }
    const snapshot = layout.core.state.snapshot()
    if (snapshot.state === 'reasoning') { observedReasoning.add(snapshot.activeDecision.ue_id); assert.equal(snapshot.latestInputs.length, 4) }
    returns.update(.01)
  }
  assert.equal(emitted.length, 16); assert.equal(delivered.length, 16)
  assert.equal(new Set(delivered.map(e => e.ue_id)).size, 16)
  assert.equal(delivered.filter(e => e.verdict === 'flagged').length, 2)
  for (const decision of delivered) {
    const marker = returns.calls.get(decision.ue_id).marker
    assert.equal(marker.userData.decision.tower_id, decision.tower_id)
    assert.equal(marker.material.color.getHexString(), decision.verdict === 'flagged' ? 'ff5375' : '58e7a0')
  }
  assert.equal(returns.group.children.length, baseline)
  assert.equal(layout.core.state.snapshot().queued, 0)
  returns.reset(); layout.core.reset()
  for (const { marker } of returns.calls.values()) assert.equal(marker.material.color.getHexString(), '426174')
  assert.equal(layout.core.state.snapshot().decisionCount, 0)
  returns.dispose(); raw.dispose(); output.dispose(); replay.dispose()
  assert.equal(scene.children.length, 1)
})
