import * as THREE from 'three'
import { label, line } from './primitives.js'
import { RETURN_SECONDS } from './data/signals.js'

const COLORS = { clean: '#58e7a0', flagged: '#ff5375' }
export function createReturnFlow(scene, layout, outputRoutes, decisions, onArrival = () => {}) {
  const group = new THREE.Group(); scene.add(group)
  const geometry = new THREE.IcosahedronGeometry(.13, 1)
  const materials = new Map(Object.entries(COLORS).map(([key, color]) => [key, new THREE.MeshBasicMaterial({ color })]))
  const calls = new Map(), active = []
  const byTower = new Map()
  for (const decision of decisions) {
    if (!byTower.has(decision.tower_id)) byTower.set(decision.tower_id, [])
    byTower.get(decision.tower_id).push(decision)
  }
  for (const [towerId, records] of byTower) {
    const tower = layout.towers.find(tower => tower.id === towerId)
    const angle = Math.atan2(tower.position.z, tower.position.x)
    records.forEach((record, i) => {
      const offset = (i - (records.length - 1) / 2) * .14
      // Clipped corner and gold contact pad make the endpoint read as a SIM card.
      const card = new THREE.Shape()
      card.moveTo(-.22, -.32); card.lineTo(.22, -.32); card.lineTo(.22, .17)
      card.lineTo(.07, .32); card.lineTo(-.22, .32); card.closePath()
      const marker = new THREE.Mesh(new THREE.ExtrudeGeometry(card, { depth: .07, bevelEnabled: false }), new THREE.MeshBasicMaterial({ color: '#426174' }))
      const chip = new THREE.Mesh(new THREE.PlaneGeometry(.25, .27), new THREE.MeshBasicMaterial({ color: '#ffe1a0', side: THREE.DoubleSide }))
      chip.position.set(0, -.04, .075); marker.add(chip)
      const backChip = chip.clone(); backChip.position.z = -.005; marker.add(backChip)
      const border = new THREE.LineSegments(new THREE.EdgesGeometry(marker.geometry), new THREE.LineBasicMaterial({ color: '#b5ccd8' })); marker.add(border)
      marker.position.set(Math.cos(angle + offset) * 12.25, .7, Math.sin(angle + offset) * 12.25)
      marker.userData = { ue_id: record.ue_id, decision: record, resolved: false }
      const caption = label(record.ue_id, '#8ba5b8', 1.7); caption.position.copy(marker.position).add(new THREE.Vector3(0, -.6, 0))
      group.add(marker, caption); calls.set(record.ue_id, { marker, caption })
    })
  }
  function clearActive() {
    for (const item of active) { group.remove(item.head, ...item.trail, item.path); item.path.geometry.dispose(); item.path.material.dispose() }
    active.length = 0
  }
  return {
    calls, group,
    emit(decision) {
      const agent = [...decision.contributions].sort((a, b) => b.weight - a.weight)[0].agent_id
      const coreCurve = outputRoutes.get(agent).curve
      const rawCurve = layout.paths.get(`${decision.tower_id}:${agent}`).curve
      const target = calls.get(decision.ue_id).marker
      const getPoint = t => t < .4 ? coreCurve.getPoint(1 - t / .4)
        : t < .9 ? rawCurve.getPoint(1 - (t - .4) / .5)
          : rawCurve.getPoint(0).lerp(target.position, (t - .9) / .1)
      const path = line(Array.from({ length: 121 }, (_, i) => getPoint(i / 120)), COLORS[decision.verdict], .45)
      const head = new THREE.Mesh(geometry, materials.get(decision.verdict)); head.scale.setScalar(1.5)
      const trail = Array.from({ length: 4 }, (_, i) => { const mesh = new THREE.Mesh(geometry, materials.get(decision.verdict)); mesh.scale.setScalar(1 - i * .17); return mesh })
      for (const mesh of [head, ...trail]) { mesh.position.copy(getPoint(0)); group.add(mesh) }
      group.add(path); active.push({ decision, head, trail, path, getPoint, target, progress: 0 })
    },
    update(dt) {
      for (let i = active.length - 1; i >= 0; i--) {
        const item = active[i]; item.progress = Math.min(1, item.progress + dt / RETURN_SECONDS)
        item.head.position.copy(item.getPoint(item.progress))
        item.trail.forEach((mesh, j) => mesh.position.copy(item.getPoint(Math.max(0, item.progress - (j + 1) * .025))))
        if (item.progress >= 1) {
          item.target.userData.resolved = true
          item.target.material.color.set(COLORS[item.decision.verdict]); item.target.scale.setScalar(item.decision.verdict === 'flagged' ? 1.6 : 1.1)
          group.remove(item.head, ...item.trail, item.path); item.path.geometry.dispose(); item.path.material.dispose(); active.splice(i, 1)
          onArrival(item.decision)
        }
      }
    },
    reset() { clearActive(); calls.forEach(({ marker }) => { marker.userData.resolved = false; marker.material.color.set('#426174'); marker.scale.setScalar(1) }) },
    dispose() {
      clearActive(); scene.remove(group); geometry.dispose(); materials.forEach(material => material.dispose())
      calls.forEach(({ marker, caption }) => { marker.traverse(object => { object.geometry?.dispose(); object.material?.dispose() }); caption.material.map.dispose(); caption.material.dispose() }); calls.clear()
    },
  }
}
