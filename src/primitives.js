import * as THREE from 'three'

export function line(points, color, opacity = 1) {
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color, transparent: true, opacity }))
}
export function ring(radius, color, opacity = .3) {
  return line(Array.from({ length: 129 }, (_, i) => new THREE.Vector3(Math.cos(i / 128 * Math.PI * 2) * radius, .015, Math.sin(i / 128 * Math.PI * 2) * radius)), color, opacity)
}
export function label(text, color = '#a8bacd', width = 3) {
  const canvas = document.createElement('canvas')
  let context = canvas.getContext('2d')
  context.font = '500 48px system-ui'
  const measured = context.measureText?.(text).width ?? text.length * 25
  canvas.width = Math.ceil(measured + 32); canvas.height = 72
  context = canvas.getContext('2d')
  context.font = '500 48px system-ui'; context.textAlign = 'center'; context.textBaseline = 'middle'
  context.fillStyle = color; context.fillText(text, canvas.width / 2, 36)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }))
  const height = width <= 2.4 ? .62 : .8
  sprite.scale.set(canvas.width / 72 * height, height, 1)
  return sprite
}
export function rod(from, to, radius, material) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, from.distanceTo(to), 6), material)
  mesh.position.copy(from).add(to).multiplyScalar(.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize())
  return mesh
}
