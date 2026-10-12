import * as THREE from 'three'
import { createCameraFocus } from './camera-focus.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export function createScene(container) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#080f1b')
  const camera = new THREE.PerspectiveCamera(43, 1, .1, 200)
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  container.appendChild(renderer.domElement)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = false
  controls.minDistance = 12; controls.maxDistance = 55
  controls.maxPolarAngle = Math.PI / 2.1
  const overview = () => container.clientWidth < 700 ? new THREE.Vector3(0, 36, 40) : new THREE.Vector3(0, 23, 27)
  const focus = createCameraFocus(camera, controls, overview, () => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  function resetCamera() {
    focus.cancel()
    camera.position.copy(overview())
    controls.target.set(0, 0, 0); controls.update()
  }
  resetCamera()
  scene.add(new THREE.HemisphereLight('#c7ddff', '#112032', 2.4))
  const light = new THREE.DirectionalLight('#a1c9ff', 3); light.position.set(4, 14, 8); scene.add(light)
  function resize() {
    const { width, height } = container.getBoundingClientRect()
    camera.aspect = width / Math.max(height, 1); camera.updateProjectionMatrix()
    renderer.setSize(width, height)
  }
  const observer = new ResizeObserver(resize); observer.observe(container); resize()
  return {
    scene, camera, renderer, resetCamera, focus, revision: THREE.REVISION,
    render() { renderer.render(scene, camera) },
    dispose() {
      observer.disconnect(); focus.dispose(); controls.dispose()
      const geometries = new Set(), materials = new Set(), textures = new Set()
      scene.traverse(object => {
        if (object.geometry) geometries.add(object.geometry)
        if (object.material) for (const material of [object.material].flat()) materials.add(material)
      })
      materials.forEach(material => { if (material.map) textures.add(material.map); material.dispose() })
      textures.forEach(texture => texture.dispose()); geometries.forEach(geometry => geometry.dispose())
      renderer.dispose(); renderer.domElement.remove()
    },
  }
}
