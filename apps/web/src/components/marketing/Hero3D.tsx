"use client"

import { Canvas } from "@react-three/fiber"
import { Environment, Float, MeshTransmissionMaterial, Sparkles } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { useMemo, useRef } from "react"
import * as THREE from "three"

function Orb({ color }: { color: THREE.Color }) {
  return (
    <Float speed={1.4} rotationIntensity={0.8} floatIntensity={1.2}>
      <mesh>
        <icosahedronGeometry args={[1.25, 3]} />
        <MeshTransmissionMaterial
          thickness={0.3}
          roughness={0.14}
          transmission={1}
          ior={1.25}
          chromaticAberration={0.22}
          anisotropy={0.35}
          distortion={0.35}
          distortionScale={0.35}
          temporalDistortion={0.16}
          clearcoat={0.4}
          attenuationColor={color}
          attenuationDistance={1.2}
        />
      </mesh>
    </Float>
  )
}

function GridRing({
  progress,
  colors
}: {
  progress: number
  colors: { a: string; b: string; c: string }
}) {
  const ring = useRef<THREE.Group>(null)

  useFrame((_state, delta) => {
    if (!ring.current) return
    ring.current.rotation.x += delta * 0.08
    ring.current.rotation.y += delta * (0.11 + progress * 0.08)
  })

  return (
    <group ref={ring} rotation={[-0.35, 0.2, 0]}>
      <mesh>
        <torusGeometry args={[2.1, 0.03, 16, 220]} />
        <meshStandardMaterial color={colors.a} emissive={colors.a} emissiveIntensity={0.35} roughness={0.55} />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[2.1, 0.03, 16, 220]} />
        <meshStandardMaterial color={colors.b} emissive={colors.b} emissiveIntensity={0.25} roughness={0.55} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.1, 0.03, 16, 220]} />
        <meshStandardMaterial color={colors.c} emissive={colors.c} emissiveIntensity={0.18} roughness={0.55} />
      </mesh>
    </group>
  )
}

function CameraRig({
  target,
  lookAt,
  progress
}: {
  target: [number, number, number]
  lookAt: [number, number, number]
  progress: number
}) {
  const targetVec = useMemo(() => new THREE.Vector3(), [])
  const lookVec = useMemo(() => new THREE.Vector3(), [])

  useFrame((state, delta) => {
    const driftX = Math.sin(state.clock.elapsedTime * 0.35) * 0.08
    const driftY = Math.cos(state.clock.elapsedTime * 0.28) * 0.06
    const driftZ = Math.sin(state.clock.elapsedTime * 0.24) * 0.05

    targetVec.set(target[0] + driftX, target[1] + driftY, target[2] + driftZ)
    lookVec.set(lookAt[0], lookAt[1] + progress * 0.05, lookAt[2])

    state.camera.position.lerp(targetVec, delta * 0.9)
    state.camera.lookAt(lookVec)
  })

  return null
}

export function Hero3D({
  progress = 0,
  camera,
  mood
}: {
  progress?: number
  camera: { position: [number, number, number]; lookAt: [number, number, number] }
  mood: { bg: string; orb: string; sparkles: string; ring: { a: string; b: string; c: string } }
}) {
  const orbColor = useMemo(() => new THREE.Color(mood.orb), [mood.orb])

  return (
    <div className="relative h-[520px] w-full overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-950/60">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/3 h-72 w-72 rounded-full bg-blue-500/20 blur-[90px]" />
        <div className="absolute -bottom-28 right-1/3 h-72 w-72 rounded-full bg-violet-500/20 blur-[90px]" />
        <div className="absolute top-1/4 right-10 h-56 w-56 rounded-full bg-emerald-500/10 blur-[90px]" />
      </div>
      <Canvas camera={{ position: [0, 0.5, 5.2], fov: 42 }}>
        <color attach="background" args={[mood.bg]} />
        <fog attach="fog" args={[mood.bg, 7.2, 12.5]} />
        <ambientLight intensity={0.35 + progress * 0.12} />
        <directionalLight position={[6, 6, 6]} intensity={1.05 + progress * 0.35} color={mood.ring.b} />
        <group position={[0, 0.1, 0]}>
          <Orb color={orbColor} />
          <GridRing progress={progress} colors={mood.ring} />
        </group>
        <CameraRig target={camera.position} lookAt={camera.lookAt} progress={progress} />
        <Sparkles count={160} speed={0.35 + progress * 0.2} size={2.1} scale={[10, 6, 6]} color={mood.sparkles} />
        <Environment preset="city" />
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-950/90 to-transparent" />
    </div>
  )
}
