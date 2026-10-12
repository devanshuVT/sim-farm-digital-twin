import * as THREE from 'three'
import { line } from './primitives.js'
import { OUTPUT_TRAVEL_SECONDS } from './data/signals.js'

export function createAgentOutputFlow(scene, layout, onArrival) {
  const group = new THREE.Group(); scene.add(group)
  const geometry = new THREE.OctahedronGeometry(.15)
  const active = []
  const routes = new Map(layout.agents.nodes.map(agent => {
    const end = layout.core.ports.get(agent.id).position
    const mid = agent.position.clone().lerp(end, .5); mid.y += .65
    const curve = new THREE.QuadraticBezierCurve3(agent.position, mid, end)
    const routeLine = line(curve.getPoints(40), agent.color, .25); group.add(routeLine)
    const material = new THREE.MeshBasicMaterial({ color: agent.color })
    return [agent.id, { curve, line: routeLine, material, active: 0 }]
  }))
  return {
    routes,
    emit(input) {
      const route = routes.get(input.agent_id)
      if (!route) return
      const head = new THREE.Mesh(geometry, route.material)
      const trail = Array.from({ length: 3 }, (_, i) => {
        const mesh = new THREE.Mesh(geometry, route.material); mesh.scale.setScalar(.6 - i * .13); return mesh
      })
      for (const mesh of [head, ...trail]) { mesh.position.copy(route.curve.getPoint(0)); group.add(mesh) }
      route.active++; route.line.material.opacity = .7
      layout.core.begin(input)
      active.push({ input, route, head, trail, progress: 0 })
    },
    update(dt) {
      for (let i = active.length - 1; i >= 0; i--) {
        const particle = active[i]; particle.progress = Math.min(1, particle.progress + dt / OUTPUT_TRAVEL_SECONDS)
        particle.head.position.copy(particle.route.curve.getPoint(particle.progress))
        particle.head.rotation.y += dt * 2
        particle.trail.forEach((mesh, j) => mesh.position.copy(particle.route.curve.getPoint(Math.max(0, particle.progress - (j + 1) * .06))))
        if (particle.progress >= 1) {
          layout.core.receive(particle.input); onArrival(particle.input)
          group.remove(particle.head, ...particle.trail)
          particle.route.active--; particle.route.line.material.opacity = particle.route.active ? .7 : .25
          active.splice(i, 1)
        }
      }
    },
    dispose() {
      scene.remove(group); active.length = 0; geometry.dispose()
      routes.forEach(route => { route.material.dispose(); route.line.geometry.dispose(); route.line.material.dispose() })
    },
  }
}
