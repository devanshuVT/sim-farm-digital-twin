import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { generateEvents, REPLAY_DURATION_MS } from '../src/data/generator.js'
import { createReplay } from '../src/data/replay.js'
import { createCoreState } from '../src/core-state.js'
import { createLayout } from '../src/layout.js'
import { createRawEventFlow } from '../src/raw-events.js'
import { createAgentOutputFlow } from '../src/agent-outputs.js'

// Canvas label stand-in only. Geometry, state, routes, and particle updates are real Three.js.
// This test does not verify WebGL rendering or browser layout.
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillText() {} }) }) }

test('derived records preserve raw lineage, SIM identity, timing and all four perspectives', () => {
  const events = generateEvents()
  assert.deepEqual(events, generateEvents())
  assert.equal(events.length, 144)
  assert.equal(new Set(events.map(e => e.id)).size, 144)
  const raw = new Map(events.filter(e => e.kind === 'raw').map(e => [e.id, e]))
  const bySim = new Map()
  for (const input of events.filter(e => e.kind === 'agent_output')) {
    const source = raw.get(input.derived_from[0])
    assert.equal(source.ue_id, input.ue_id)
    assert.ok(input.timestamp >= source.timestamp + 2100)
    assert.ok(input.value >= 0 && input.value <= 1)
    if (!bySim.has(input.ue_id)) bySim.set(input.ue_id, new Set())
    bySim.get(input.ue_id).add(input.agent_id)
  }
  assert.equal(bySim.size, 16)
  for (const agents of bySim.values()) assert.equal(agents.size, 4)
})

test('full replay moves all inputs through real geometry, flashes ports, and cleans up particles', () => {
  const scene = new THREE.Scene(), layout = createLayout(scene)
  for (const route of layout.paths.values()) {
    for (const p of route.curve.getPoints(100)) assert.ok(Math.hypot(p.x, p.z) >= 6.09, 'raw path must remain outside core')
  }
  let rawCount = 0, outputCount = 0
  const rawArrivals = new Set()
  const raw = createRawEventFlow(scene, layout, event => { rawCount++; rawArrivals.add(event.id) })
  const output = createAgentOutputFlow(scene, layout, input => {
    outputCount++
    assert.ok(rawArrivals.has(input.derived_from[0]), 'raw event arrives before derived input')
    assert.equal(layout.core.ports.get(input.agent_id).pulse, 1)
  })
  const baseline = scene.children.length
  const replay = createReplay(generateEvents(), REPLAY_DURATION_MS)
  replay.subscribe(event => { if (event.kind === 'raw') raw.emit(event); else if (event.kind === 'agent_output') output.emit(event) })
  // Stop before the second loop, after all particles have had time to arrive.
  for (let i = 0; i < 7100; i++) {
    replay.update(.01); raw.update(.01); output.update(.01); layout.agents.update(.01); layout.core.update(.01)
  }
  assert.equal(rawCount, 64); assert.equal(outputCount, 64)
  const snapshot = layout.core.state.snapshot()
  assert.equal(snapshot.total, 64); assert.equal(snapshot.ueCount, 16)
  assert.equal(snapshot.latestInputs.length, 4); assert.equal(snapshot.inFlight, 0)
  assert.equal(snapshot.state, 'idle')
  assert.equal(scene.children.length, baseline)
  const outputGroup = scene.children.find(child => child !== layout.group)
  assert.equal(outputGroup.children.length, 4, 'only four static routes remain after particles arrive')
  for (const port of layout.core.ports.values()) assert.equal(port.arrived, true)
  layout.core.reset(); assert.equal(layout.core.state.snapshot().total, 0)
  for (const port of layout.core.ports.values()) assert.equal(port.arrived, false)
  raw.dispose(); output.dispose(); replay.dispose()
})

test('aggregation is driven by in-flight and arriving evidence, deduplicates, and resets', () => {
  const state = createCoreState()
  const input = generateEvents().find(e => e.kind === 'agent_output')
  assert.equal(state.snapshot().state, 'idle')
  state.begin(input); state.update(10)
  assert.equal(state.snapshot().state, 'aggregation')
  state.receive(input); state.receive(input)
  assert.equal(state.snapshot().total, 1)
  state.update(.5); assert.equal(state.snapshot().state, 'aggregation')
  state.update(1); assert.equal(state.snapshot().state, 'idle')
  state.reset(); assert.equal(state.snapshot().ueCount, 0)
})

test('pause freezes dispatch and each loop replays the complete recording', () => {
  const replay = createReplay(generateEvents(), REPLAY_DURATION_MS)
  let count = 0, loops = 0
  replay.subscribe(() => count++); replay.onLoop(() => loops++)
  replay.update(71); assert.equal(count, 144)
  replay.pause(); replay.update(100); assert.equal(count, 144); assert.equal(loops, 0)
  replay.start(); replay.update(1); assert.equal(loops, 1); assert.equal(count, 145)
  replay.update(71); assert.equal(count, 288)
  replay.dispose()
})
