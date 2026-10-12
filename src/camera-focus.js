import { Vector3 } from 'three'

// Presentation-only motion; replay remains independent of the camera.
export function createCameraFocus(camera, controls, overview, reducedMotion = () => false) {
  let motion = null
  const cancel = () => { motion = null }
  controls.addEventListener('start', cancel)
  const smooth = t => t * t * (3 - 2 * t)
  return {
    trigger(verdict) {
      if (verdict !== 'flagged' || motion || reducedMotion()) return
      const target = new Vector3(0, 1, 0)
      const direction = camera.position.clone().sub(controls.target).normalize()
      motion = { elapsed: 0, from: camera.position.clone(), targetFrom: controls.target.clone(),
        close: target.clone().addScaledVector(direction, 16), target }
    },
    update(dt) {
      if (!motion) return
      const m = motion; m.elapsed += dt
      if (m.elapsed < .85) {
        const t = smooth(m.elapsed / .85)
        camera.position.lerpVectors(m.from, m.close, t)
        controls.target.lerpVectors(m.targetFrom, m.target, t)
      } else if (m.elapsed < 2.05) {
        camera.position.copy(m.close); controls.target.copy(m.target)
      } else {
        const t = smooth(Math.min((m.elapsed - 2.05) / 1.15, 1))
        camera.position.lerpVectors(m.close, overview(), t)
        controls.target.lerpVectors(m.target, new Vector3(), t)
        if (t === 1) cancel()
      }
      controls.update()
    },
    cancel,
    get active() { return motion !== null },
    dispose() { cancel(); controls.removeEventListener('start', cancel) },
  }
}
