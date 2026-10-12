import * as THREE from 'three'

export function selectableCalls(calls) {
  return [...calls.values()].map(call => call.marker).filter(marker => marker.userData.resolved && marker.userData.decision.verdict === 'flagged')
}
export function createCallSelection(canvas, camera, getCalls, onSelect, enabled = () => true) {
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2()
  let down = null
  function pick(event) {
    const bounds = canvas.getBoundingClientRect()
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1)
    camera.updateMatrixWorld(); raycaster.setFromCamera(pointer, camera)
    const targets = selectableCalls(getCalls())
    targets.forEach(target => target.updateWorldMatrix(true, false))
    return raycaster.intersectObjects(targets, false)[0]?.object.userData.decision
  }
  function pointerDown(event) { if (event.button === 0 && enabled()) down = { x: event.clientX, y: event.clientY, id: event.pointerId } }
  function pointerUp(event) {
    const start = down; down = null
    if (!start || start.dragged || start.id !== event.pointerId || !enabled() || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return
    const decision = pick(event); if (decision) onSelect(decision)
  }
  function move(event) {
    if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) down.dragged = true
    canvas.style.cursor = !down && enabled() && pick(event) ? 'pointer' : 'grab'
  }
  function cancel() { down = null; canvas.style.cursor = 'grab' }
  canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointerup', pointerUp)
  canvas.addEventListener('pointermove', move); canvas.addEventListener('pointercancel', cancel); canvas.addEventListener('pointerleave', cancel)
  return { dispose() { canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointerup', pointerUp); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointercancel', cancel); canvas.removeEventListener('pointerleave', cancel); canvas.style.cursor = '' } }
}
