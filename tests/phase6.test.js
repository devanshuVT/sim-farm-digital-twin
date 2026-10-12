import test from 'node:test'
import assert from 'node:assert/strict'
import { PerspectiveCamera, EventDispatcher, Vector3 } from 'three'
import { createCameraFocus } from '../src/camera-focus.js'

function setup(reduced = false) {
  const camera = new PerspectiveCamera(); camera.position.set(0, 23, 27)
  const controls = new EventDispatcher(); controls.target = new Vector3(); controls.update = () => {}
  const focus = createCameraFocus(camera, controls, () => new Vector3(0, 23, 27), () => reduced)
  return { camera, controls, focus }
}
test('flagged camera approaches core, holds and returns exactly to overview', () => {
  const { camera, controls, focus } = setup()
  focus.trigger('clean'); assert.equal(focus.active, false)
  focus.trigger('flagged'); focus.update(.85)
  assert.ok(Math.abs(camera.position.distanceTo(controls.target) - 16) < 1e-9)
  const close = camera.position.clone(); focus.update(.6); assert.ok(camera.position.equals(close))
  focus.update(2); assert.equal(focus.active, false)
  assert.ok(camera.position.equals(new Vector3(0, 23, 27))); assert.ok(controls.target.equals(new Vector3()))
})
test('manual interaction cancels camera motion and reduced motion skips it', () => {
  const { camera, controls, focus } = setup()
  focus.trigger('flagged'); focus.update(.3); controls.dispatchEvent({ type: 'start' })
  const position = camera.position.clone(); focus.update(5)
  assert.equal(focus.active, false); assert.ok(camera.position.equals(position))
  focus.dispose()
  const reduced = setup(true); reduced.focus.trigger('flagged'); assert.equal(reduced.focus.active, false)
})
