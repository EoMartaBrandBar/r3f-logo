import * as THREE from 'three'
import { useEffect, useRef, useMemo } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import { useRoute, useLocation } from 'wouter'
import { easing } from 'maath'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'

export const App = () => (
  <Canvas dpr={[1, 1.5]} camera={{ fov: 70, position: [0, 0, 8] }}>
    <color attach="background" args={['#252528']} />
    <ambientLight intensity={0.7} />
    <directionalLight position={[5, 5, 5]} intensity={1.2} />
    <LogoScene />
  </Canvas>
)

function LogoScene({ q = new THREE.Quaternion(), p = new THREE.Vector3() }) {
  const ref = useRef()
  const clicked = useRef()
  const [, params] = useRoute('/item/:id')
  const [, setLocation] = useLocation()

  useEffect(() => {
    if (!ref.current) return

    clicked.current = params?.id ? ref.current.getObjectByName(params.id) : null

    if (clicked.current) {
      const worldPos = new THREE.Vector3()
      clicked.current.getWorldPosition(worldPos)
      p.set(worldPos.x, worldPos.y, worldPos.z + 2.5)
      const lookAt = worldPos.clone()
      const camQuat = new THREE.Quaternion()
      const m = new THREE.Matrix4()
      m.lookAt(p, lookAt, new THREE.Vector3(0, 1, 0))
      camQuat.setFromRotationMatrix(m)
      q.copy(camQuat)
    } else {
      p.set(0, 0, 8)
      const lookAt = new THREE.Vector3(0, 0, 0)
      const camQuat = new THREE.Quaternion()
      const m = new THREE.Matrix4()
      m.lookAt(p, lookAt, new THREE.Vector3(0, 1, 0))
      camQuat.setFromRotationMatrix(m)
      q.copy(camQuat)
    }
  }, [params, p, q])

  useFrame((state, dt) => {
    easing.damp3(state.camera.position, p, 0.4, dt)
    easing.dampQ(state.camera.quaternion, q, 0.4, dt)
  })

  return (
    <group
      ref={ref}
      onClick={(e) => (e.stopPropagation(), setLocation(clicked.current === e.object ? '/' : '/item/' + e.object.name))}
      onPointerMissed={() => setLocation('/')}>
      <SvgLogo />
    </group>
  )
}

function SvgLogo() {
  const svgData = useLoader(SVGLoader, 'https://pzp683o5wwfgvxj5.public.blob.vercel-storage.com/logo.svg')

  const [, params] = useRoute('/item/:id')
  const [, setLocation] = useLocation()
  const rootRef = useRef()

  const { root, parts } = useMemo(() => {
    const root = new THREE.Group()
    const parts = []

    const getObjectNameForIndex = (i) => {
      if (i >= 0 && i <= 3) return 'Object_2'
      if (i >= 4 && i <= 6) return 'Object_3'
      if (i >= 7 && i <= 8) return 'Object_4'
      if (i >= 9 && i <= 10) return 'Object_5'
      if (i >= 11 && i <= 13) return 'Object_6'
      if (i >= 14 && i <= 17) return 'Object_7'
      if (i >= 18 && i <= 19) return 'Object_8'
      if (i >= 20 && i <= 21) return 'Object_9'
      return null
    }

    const objectGroups = new Map()

    svgData.paths.forEach((path, pathIndex) => {
      const objectName = getObjectNameForIndex(pathIndex)
      const groupName = objectName ?? `part-${pathIndex}`

      let pathGroup
      if (objectName) {
        if (!objectGroups.has(objectName)) {
          const g = new THREE.Group()
          g.name = objectName
          root.add(g)
          objectGroups.set(objectName, g)
          parts.push(g)
        }
        pathGroup = objectGroups.get(objectName)
      } else {
        pathGroup = new THREE.Group()
        pathGroup.name = groupName
        root.add(pathGroup)
        parts.push(pathGroup)
      }

      const shapes = SVGLoader.createShapes(path)
      const originalColor = path.color || '#ffffff'

      shapes.forEach((shape) => {
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: 2, bevelEnabled: false })
        const material = new THREE.MeshStandardMaterial({
          color: new THREE.Color('#736CED'), // alap szín
          metalness: 0.4,
          roughness: 0.3,
          emissive: new THREE.Color(0x000000)
        })
        material.userData.baseColor = new THREE.Color(originalColor)
        const mesh = new THREE.Mesh(geometry, material)
        pathGroup.add(mesh)
      })
    })

    // Pivot fix
    parts.forEach((g) => {
      const box = new THREE.Box3().setFromObject(g)
      const center = new THREE.Vector3()
      box.getCenter(center)
      g.children.forEach((child) => child.position.sub(center))
      g.position.add(center)
    })

    // Center full logo
    const boxAll = new THREE.Box3().setFromObject(root)
    const centerAll = new THREE.Vector3()
    boxAll.getCenter(centerAll)
    root.position.x -= centerAll.x
    root.position.y -= centerAll.y

    return { root, parts }
  }, [svgData])

  useFrame((state, dt) => {
    if (!rootRef.current) return
    const activeId = params?.id

    parts.forEach((g) => {
      const isActive = activeId === g.name
      const hovered = g.userData.hovered

      // scale + z lift
      const base = isActive ? 1.12 : 1
      const targetScale = hovered ? base * 1.08 : base
      easing.damp3(g.scale, [targetScale, targetScale, targetScale], 0.18, dt)
      const targetZ = hovered ? 0.8 : isActive ? 0.5 : 0
      easing.damp(g.position, 'z', targetZ, 0.2, dt)

      // material szín
      g.traverse((child) => {
        if (!child.isMesh) return
        const mat = child.material
        const baseColor = mat.userData.baseColor.clone()

        if (hovered || isActive) {
          easing.dampC(mat.color, baseColor, 0.2, dt) // hover → eredeti szín
        } else {
          easing.dampC(mat.color, new THREE.Color('#5151d6'), 0.2, dt) // alap szín
        }
      })
    })
  })

  useCursor(parts.some((g) => g.userData.hovered))

  return (
    <group
      ref={rootRef}
      scale={[0.001, -0.001, 0.001]}
      position={[0, 0, 0]}
      onClick={(e) => {
        e.stopPropagation()
        const targetGroup = e.object.parent
        if (!targetGroup || !targetGroup.name) return
        setLocation(params?.id === targetGroup.name ? '/' : '/item/' + targetGroup.name)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        const targetGroup = e.object.parent
        if (!targetGroup) return
        targetGroup.userData.hovered = true
      }}
      onPointerOut={(e) => {
        e.stopPropagation()
        const targetGroup = e.object.parent
        if (!targetGroup) return
        targetGroup.userData.hovered = false
      }}>
      <primitive object={root} />
    </group>
  )
}
