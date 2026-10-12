import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { decisionDetails } from '../src/ui/reasoning-model.js'
import { generateEvents } from '../src/data/generator.js'
import { parseDataset } from '../src/data/dataset.js'
import { selectableCalls, createCallSelection } from '../src/selection.js'

test('reasoning detail resolves exact SIM evidence, timestamp, trace, and contribution weights', () => {
  const dataset = parseDataset(JSON.stringify(generateEvents()))
  const decision = dataset.events.find(event => event.verdict === 'flagged')
  const detail = decisionDetails(decision, dataset.byId)
  assert.equal(detail.ue, decision.ue_id); assert.equal(detail.trace, decision.reasoning_trace)
  assert.equal(detail.timestamp, `${(decision.timestamp / 1000).toFixed(3)} s from replay start`)
  assert.equal(detail.inputs.length, 4)
  assert.equal(detail.inputs.reduce((total, input) => total + input.percent, 0), 100)
  assert.equal(detail.inputs.find(input => input.leading).name, 'Call-Pattern / Timing')
  decision.agent_inputs.forEach((id, index) => {
    const input = dataset.byId.get(id)
    assert.equal(detail.inputs[index].value, input.value.toFixed(3))
    assert.ok(detail.inputs[index].why.length)
    assert.ok(detail.inputs[index].source.includes(dataset.byId.get(input.derived_from[0]).signal_type))
  })
})

test('only arrived flagged SIMs are selectable; hidden future verdicts and clean calls are excluded', () => {
  const calls = new Map()
  for (const [id, resolved, verdict] of [['pending', false, 'flagged'], ['clean', true, 'clean'], ['flagged', true, 'flagged']]) {
    const marker = new THREE.Mesh(); marker.name = id; marker.userData = { resolved, decision: { verdict } }; calls.set(id, { marker })
  }
  assert.deepEqual(selectableCalls(calls).map(marker => marker.name), ['flagged'])
})

test('ray selection works for a click, rejects camera drags, and removes event handlers on dispose', () => {
  const listeners = new Map()
  const canvas = { style: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 200 }), addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) }
  const camera = new THREE.PerspectiveCamera(45, 1, .1, 100); camera.position.z = 5; camera.lookAt(0, 0, 0); camera.updateMatrixWorld()
  const marker = new THREE.Mesh(new THREE.SphereGeometry(.5), new THREE.MeshBasicMaterial())
  const decision = { verdict: 'flagged', ue_id: 'test' }; marker.userData = { resolved: true, decision }
  const calls = new Map([['test', { marker }]])
  let picked = 0, enabled = true
  const selector = createCallSelection(canvas, camera, () => calls, selected => { assert.equal(selected, decision); picked++ }, () => enabled)
  const event = { clientX: 100, clientY: 100, pointerId: 1, button: 0 }
  listeners.get('pointerdown')(event); listeners.get('pointerup')(event); assert.equal(picked, 1)
  listeners.get('pointerdown')(event); listeners.get('pointermove')({ ...event, clientX: 120 }); listeners.get('pointerup')(event); assert.equal(picked, 1)
  enabled = false; listeners.get('pointerdown')(event); listeners.get('pointerup')(event); assert.equal(picked, 1)
  selector.dispose(); assert.equal(listeners.size, 0); marker.geometry.dispose(); marker.material.dispose()
})
