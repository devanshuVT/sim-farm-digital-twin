import * as THREE from 'three'
import { ring, label, rod } from './primitives.js'
import { createAgents } from './agents.js'
import { createCore } from './core.js'

export function createLayout(scene) {
  const group = new THREE.Group()
  const agents = createAgents(); const core = createCore()
  group.add(agents.group, core.group)
  const towerMaterial = new THREE.MeshStandardMaterial({ color: '#59869c', metalness: .65, roughness: .4 })
  const panelMaterial = new THREE.MeshStandardMaterial({ color: '#b9e3ed', emissive: '#549bba', emissiveIntensity: .3, metalness: .5, roughness: .3 })
  const towers = Array.from({ length: 8 }, (_, i) => {
    const angle = i / 8 * Math.PI * 2
    const position = new THREE.Vector3(Math.cos(angle) * 10.5, 1.7, Math.sin(angle) * 10.5)
    const tower = new THREE.Group(); tower.position.set(position.x, 0, position.z)
    for (let leg = 0; leg < 3; leg++) {
      const a = leg / 3 * Math.PI * 2
      tower.add(rod(new THREE.Vector3(Math.cos(a) * .36, .12, Math.sin(a) * .36), new THREE.Vector3(0, 1.7, 0), .035, towerMaterial))
      const panel = new THREE.Mesh(new THREE.BoxGeometry(.14, .6, .23), panelMaterial)
      panel.position.set(Math.cos(a) * .2, 1.55, Math.sin(a) * .2); panel.rotation.y = -a; tower.add(panel)
    }
    tower.add(ring(.64, '#71adca', .55))
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(.095, 12, 8), new THREE.MeshBasicMaterial({ color: '#95e8ff' }))
    beacon.position.y = 1.95; tower.add(beacon)
    const caption = label(`T${String(i + 1).padStart(2, '0')} · TOWER`, '#9ebdcd', 2.4); caption.position.y = 2.5; tower.add(caption)
    group.add(tower)
    return { id: `tower_${i + 1}`, position, node: tower }
  })
  for (const [radius, color, opacity] of [[10.5, '#46839a', .35], [6.1, '#697aab', .4], [11.7, '#284052', .3]]) group.add(ring(radius, color, opacity))
  const grid = new THREE.PolarGridHelper(12, 16, 6, 96, '#1c3041', '#142334'); grid.position.y = -.02; group.add(grid)
  const paths = new Map()
  towers.forEach((tower) => {
    agents.nodes.forEach(agent => {
    // Follow the outer annulus before approaching the agent, never crossing the core.
    const startAngle = Math.atan2(tower.position.z, tower.position.x)
    const endAngle = Math.atan2(agent.position.z, agent.position.x)
    const angleDelta = Math.atan2(Math.sin(endAngle - startAngle), Math.cos(endAngle - startAngle))
    const points = Array.from({ length: 17 }, (_, index) => {
      const t = index / 16, angle = startAngle + angleDelta * t, radius = 10.5 + (6.1 - 10.5) * t
      return new THREE.Vector3(Math.cos(angle) * radius, 1.7 + (.85 - 1.7) * t + Math.sin(t * Math.PI) * .5, Math.sin(angle) * radius)
    })
    const curve = new THREE.CatmullRomCurve3(points)
    const route = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(40)), new THREE.LineBasicMaterial({ color: agent.color, transparent: true, opacity: .045 }))
    group.add(route); paths.set(`${tower.id}:${agent.id}`, { curve, agent, line: route })
    })
  })
  scene.add(group)
  return { group, agents, core, towers, paths }
}
