import * as THREE from 'three'
import { label, ring } from './primitives.js'

export const AGENT_DEFINITIONS = [
  { id: 'cqi', name: 'CQI Agent', color: '#57d6c5' },
  { id: 'mobility', name: 'PUSCH-SINR / Mobility', color: '#85afff' },
  { id: 'timing', name: 'Call-Pattern / Timing', color: '#c1a0ff' },
  { id: 'context', name: 'Context Agent · placeholder', color: '#efc078' },
]
export function createAgents() {
  const group = new THREE.Group()
  const nodes = AGENT_DEFINITIONS.map((definition, index) => {
    const angle = index * Math.PI / 2 + Math.PI / 4
    const position = new THREE.Vector3(Math.cos(angle) * 6.1, .85, Math.sin(angle) * 6.1)
    const node = new THREE.Group(); node.position.copy(position)
    const material = new THREE.MeshStandardMaterial({ color: definition.color, emissive: definition.color, emissiveIntensity: .28, metalness: .55, roughness: .3 })
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(.52), material)
    const cage = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.OctahedronGeometry(.73)), new THREE.LineBasicMaterial({ color: definition.color, transparent: true, opacity: .45 }))
    const base = ring(.85, definition.color, .65); base.position.y = -.78
    node.add(body, cage, base)
    const caption = label(definition.name, definition.color, 4.1); caption.position.set(0, 1.12, 0); node.add(caption)
    group.add(node)
    return { ...definition, position, node, body, material, pulse: 0 }
  })
  return {
    group, nodes,
    receive(id) { const node = nodes.find(n => n.id === id); if (node) node.pulse = 1 },
    update(dt) {
      for (const node of nodes) {
        node.pulse = Math.max(0, node.pulse - dt * 1.8)
        node.material.emissiveIntensity = .28 + node.pulse * 2.2
        node.body.scale.setScalar(1 + node.pulse * .22)
      }
    },
  }
}
