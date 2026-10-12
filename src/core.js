import * as THREE from 'three'
import { label, ring, line } from './primitives.js'
import { AGENT_DEFINITIONS } from './agents.js'
import { createCoreState } from './core-state.js'

// Evidence-driven visual states; verdicts are replayed mock data, not live LLM results.
export function createCore() {
  const group = new THREE.Group()
  const lattice = new THREE.IcosahedronGeometry(1.85, 0)
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(lattice), new THREE.LineBasicMaterial({ color: '#9caeff', transparent: true, opacity: .8 }))
  edges.position.y = 1.65; group.add(edges)
  const vertices = []
  const positions = lattice.getAttribute('position')
  for (let i = 0; i < positions.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(positions, i)
    if (!vertices.some(p => p.distanceTo(v) < .001)) vertices.push(v)
  }
  const material = new THREE.MeshStandardMaterial({ color: '#cbd5ff', emissive: '#809cff', emissiveIntensity: .85, metalness: .3, roughness: .25 })
  for (const v of vertices) {
    const node = new THREE.Mesh(new THREE.IcosahedronGeometry(.12, 1), material)
    node.position.copy(v).add(new THREE.Vector3(0, 1.65, 0)); group.add(node)
    group.add(line([node.position, new THREE.Vector3(0, 1.65, 0)], '#6b7ecd', .35))
  }
  const inner = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(.7, 0)), new THREE.LineBasicMaterial({ color: '#c9d4ff', transparent: true, opacity: .6 }))
  inner.position.y = 1.65; inner.rotation.z = .5; group.add(inner)
  // A dedicated hexagonal stage and fixed orbital frame distinguish the fusion hub.
  const stage = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.55, .22, 6), new THREE.MeshStandardMaterial({ color: '#25204c', emissive: '#322363', emissiveIntensity: .45, metalness: .65, roughness: .35 }))
  stage.position.y = -.14; group.add(stage)
  const orbit = new THREE.Mesh(new THREE.TorusGeometry(2.05, .025, 8, 80), new THREE.MeshBasicMaterial({ color: '#b7a2ff', transparent: true, opacity: .65 }))
  orbit.position.y = 1.65; orbit.rotation.x = Math.PI / 2.6; group.add(orbit)
  group.add(ring(2.15, '#8c9ce8', .45), ring(2.4, '#8c9ce8', .16))
  const title = label('LLM DECISION / FUSION', '#d0d8ff', 4.5); title.position.set(0, 4.25, 0); group.add(title)
  const status = label('WAITING FOR INPUTS', '#7586a2', 3.9); status.position.set(0, -.05, 2.8); group.add(status)
  const activeStatus = label('AGGREGATION', '#bfcfff', 3.9); activeStatus.position.copy(status.position); activeStatus.visible = false; group.add(activeStatus)
  const ports = new Map(AGENT_DEFINITIONS.map((definition, index) => {
    const angle = index * Math.PI / 2 + Math.PI / 4
    const position = new THREE.Vector3(Math.cos(angle) * 1.3, 1.65, Math.sin(angle) * 1.3)
    const material = new THREE.MeshStandardMaterial({ color: definition.color, emissive: definition.color, emissiveIntensity: .2 })
    const marker = new THREE.Mesh(new THREE.IcosahedronGeometry(.16, 1), material)
    marker.position.copy(position); group.add(marker)
    const halo = new THREE.Mesh(new THREE.SphereGeometry(.25, 16, 8), new THREE.MeshBasicMaterial({ color: definition.color, transparent: true, opacity: 0, depthWrite: false }))
    halo.position.copy(position); group.add(halo)
    return [definition.id, { position, marker, halo, pulse: 0, arrived: false }]
  }))
  const reasoningStatus = label('REASONING / WEIGHING INPUTS', '#dfd1ff', 4.3)
  const cleanStatus = label('DECISION / CLEAN', '#65e5a6', 3.9)
  const flaggedStatus = label('DECISION / FLAGGED', '#ff6984', 3.9)
  for (const caption of [reasoningStatus, cleanStatus, flaggedStatus]) { caption.position.copy(status.position); caption.visible = false; group.add(caption) }
  const portList = [...ports.values()]
  const reasoningLinks = portList.map((port, index) => {
    const next = portList[(index + 1) % 4]
    const connection = line([port.position, new THREE.Vector3(0, 1.65 + (index % 2 ? -.3 : .3), 0), next.position], '#e0caff', .08)
    group.add(connection); return connection
  })
  const state = createCoreState()
  lattice.dispose()
  return {
    group, ports, state,
    begin(input) { state.begin(input) },
    receive(input) {
      state.receive(input)
      const port = ports.get(input.agent_id)
      if (port) { port.pulse = 1; port.arrived = true }
    },
    reset() {
      state.reset()
      ports.forEach(port => { port.pulse = 0; port.arrived = false })
    },
    update(dt) {
      const decisions = state.update(dt)
      const snapshot = state.snapshot()
      const phase = snapshot.state
      status.visible = phase === 'idle'; activeStatus.visible = phase === 'aggregation'
      reasoningStatus.visible = phase === 'reasoning'
      cleanStatus.visible = phase === 'decision' && snapshot.activeDecision.verdict === 'clean'
      flaggedStatus.visible = phase === 'decision' && snapshot.activeDecision.verdict === 'flagged'
      const decisionColor = snapshot.activeDecision?.verdict === 'flagged' ? '#ff5375' : '#58e7a0'
      edges.material.color.set(phase === 'decision' ? decisionColor : phase === 'reasoning' ? '#c9afff' : '#9caeff')
      edges.material.opacity = phase === 'idle' ? .5 : .95
      material.emissive.set(phase === 'decision' ? decisionColor : '#809cff')
      material.emissiveIntensity = phase === 'decision' ? 2.2 : .85
      inner.material.color.set(phase === 'decision' ? decisionColor : '#c9d4ff')
      reasoningLinks.forEach((connection, index) => {
        // Trace distinct links between arrived inputs, never a rotating spinner.
        const selected = phase === 'reasoning' && index === snapshot.reasoningStep
        connection.material.opacity = selected ? .55 + .45 * Math.sin((snapshot.reasoningProgress * 4 % 1) * Math.PI) : .06
      })
      let index = 0
      ports.forEach(port => {
        port.pulse = Math.max(0, port.pulse - dt * 1.5)
        const weighing = phase === 'reasoning' && index === snapshot.reasoningStep
        port.marker.material.emissiveIntensity = (port.arrived ? .7 : .2) + port.pulse * 2.5 + (weighing ? 1.7 : 0)
        port.marker.scale.setScalar(1 + port.pulse * .5 + (weighing ? .2 : 0))
        port.halo.scale.setScalar(1 + (1 - port.pulse) * 2)
        port.halo.material.opacity = port.pulse * .35
        index++
      })
      return decisions
    },
  }
}
