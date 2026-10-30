import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { drawLid } from './labels.js'

function Environment() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    return () => {
      scene.environment = null
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])
  return null
}

function FitCamera() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    const z = Math.max(1.7 / t, 1.4 / (t * aspect)) + 0.3
    camera.position.set(0, z * 0.3, z)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
  }, [camera, size])
  return null
}

// Une texture par canvas d'étiquette (son intégré ou perso), mise en cache.
function useLabelTexture(canvas, version) {
  const cache = useRef(new WeakMap())
  const tex = useMemo(() => {
    if (!canvas) return null
    let t = cache.current.get(canvas)
    if (!t) {
      t = new THREE.CanvasTexture(canvas)
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 8
      cache.current.set(canvas, t)
    }
    return t
  }, [canvas])
  useEffect(() => {
    if (tex) tex.needsUpdate = true
  }, [tex, version])
  return tex
}

function shadowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128)
  g.addColorStop(0, 'rgba(0,0,0,0.45)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)
  return new THREE.CanvasTexture(c)
}

function MooBox({ labelCanvas, labelVersion, motion }) {
  const outer = useRef()
  const inner = useRef()
  const labelTex = useLabelTexture(labelCanvas, labelVersion)
  const lidTex = useMemo(() => {
    const t = new THREE.CanvasTexture(drawLid(document.createElement('canvas')))
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  const shadowTex = useMemo(shadowTexture, [])

  const tmpQ = useMemo(() => new THREE.Quaternion(), [])
  const tmpE = useMemo(() => new THREE.Euler(), [])

  const green = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: '#3CB23A', roughness: 0.38, clearcoat: 0.4, clearcoatRoughness: 0.3 }),
    []
  )
  const lidTop = useMemo(
    () => new THREE.MeshPhysicalMaterial({ map: lidTex, bumpMap: lidTex, bumpScale: 2, roughness: 0.45, clearcoat: 0.3 }),
    [lidTex]
  )
  const tin = useMemo(() => new THREE.MeshStandardMaterial({ color: '#C9CED2', metalness: 0.9, roughness: 0.28 }), [])
  const label = useMemo(
    () => new THREE.MeshPhysicalMaterial({ roughness: 0.32, metalness: 0.15, clearcoat: 0.8, clearcoatRoughness: 0.18 }),
    []
  )
  useEffect(() => {
    label.map = labelTex
    label.needsUpdate = true
  }, [labelTex, label])

  useFrame((state, dt) => {
    const m = motion.current
    const t = state.clock.elapsedTime
    // orientation cible (capteur ou glisser) → interpolation douce
    tmpE.set(m.angleX, 0, 0)
    tmpQ.setFromEuler(tmpE)
    outer.current.quaternion.slerp(tmpQ, 1 - Math.pow(0.0008, dt))
    // présentation : léger balancement + secousse quand ça meugle
    const now = performance.now()
    const playing = now < m.playingUntil
    const amp = playing ? 0.03 + 0.06 * m.lastK : 0
    inner.current.rotation.y = Math.sin(t * 0.55) * 0.42 + (playing ? Math.sin(t * 46) * amp : 0)
    inner.current.rotation.z = playing ? Math.sin(t * 33) * amp * 0.6 : 0
    const squash = playing ? 1 + Math.sin(t * 18) * (0.015 + 0.03 * m.lastK) : 1
    inner.current.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash))
  })

  return (
    <>
      <group ref={outer}>
        <group ref={inner}>
          {/* corps en tôle imprimée */}
          <mesh material={label}>
            <cylinderGeometry args={[1, 1, 1.9, 96, 1, true, Math.PI, Math.PI * 2]} />
          </mesh>
          {/* fond intérieur (visible si on regarde par en dessous) */}
          <mesh position={[0, -0.95, 0]} rotation={[Math.PI / 2, 0, 0]} material={tin}>
            <circleGeometry args={[1, 64]} />
          </mesh>
          {/* bourrelets de tôle */}
          <mesh position={[0, -0.95, 0]} rotation={[Math.PI / 2, 0, 0]} material={tin}>
            <torusGeometry args={[1.0, 0.035, 16, 96]} />
          </mesh>
          {/* couvercle perforé */}
          <mesh position={[0, 1.07, 0]} material={[green, lidTop, green]}>
            <cylinderGeometry args={[1.045, 1.06, 0.3, 96]} />
          </mesh>
          <mesh position={[0, 1.22, 0]} rotation={[Math.PI / 2, 0, 0]} material={green}>
            <torusGeometry args={[1.0, 0.045, 16, 96]} />
          </mesh>
          {/* socle vert */}
          <mesh position={[0, -1.02, 0]} material={green}>
            <cylinderGeometry args={[1.05, 1.05, 0.12, 96]} />
          </mesh>
        </group>
      </group>
      <mesh position={[0, -1.55, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3, 3]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} />
      </mesh>
    </>
  )
}

export default function Scene(props) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: 32, position: [0, 1, 7] }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
    >
      <Environment />
      <FitCamera />
      <ambientLight intensity={0.25} />
      <directionalLight position={[3, 4, 5]} intensity={1.6} />
      <directionalLight position={[-4, 1, -2]} intensity={0.5} color="#bcd7ff" />
      <MooBox {...props} />
    </Canvas>
  )
}
