import * as THREE from 'three'
import { SIGNALS, RAW_TRAVEL_SECONDS } from './data/signals.js'

export function createRawEventFlow(scene, layout, onArrival) {
  const active = []
  const geometry = new THREE.SphereGeometry(.10, 10, 8)
  const materials = new Map(layout.agents.nodes.map(agent => [agent.id, new THREE.MeshBasicMaterial({ color: agent.color })]))
  return {
    emit(event) {
      const route = layout.paths.get(`${event.tower_id}:${SIGNALS.find(s => s.signal === event.signal_type)?.agent}`)
      if (!route) return
      const head = new THREE.Mesh(geometry, materials.get(route.agent.id))
      const trail = [0, 1, 2].map(i => {
        const mesh = new THREE.Mesh(geometry, materials.get(route.agent.id)); mesh.scale.setScalar(.65 - i * .15); scene.add(mesh); return mesh
      })
      head.position.copy(route.curve.getPoint(0)); scene.add(head)
      for (const mesh of trail) mesh.position.copy(head.position)
      active.push({ event, route, head, trail, progress: 0 })
    },
    update(dt) {
      for (let i = active.length - 1; i >= 0; i--) {
        const particle = active[i]; particle.progress += dt / RAW_TRAVEL_SECONDS
        particle.head.position.copy(particle.route.curve.getPoint(Math.min(1, particle.progress)))
        particle.trail.forEach((mesh, j) => mesh.position.copy(particle.route.curve.getPoint(Math.max(0, Math.min(1, particle.progress - (j + 1) * .045)))))
        if (particle.progress >= 1) {
          layout.agents.receive(particle.route.agent.id)
          onArrival(particle.event, particle.route.agent)
          scene.remove(particle.head, ...particle.trail); active.splice(i, 1)
        }
      }
    },
    dispose() {
      active.forEach(particle => scene.remove(particle.head, ...particle.trail)); active.length = 0
      geometry.dispose(); materials.forEach(material => material.dispose())
    },
  }
}
