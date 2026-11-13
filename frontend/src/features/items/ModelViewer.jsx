import { Component, Suspense, useEffect, useState } from 'react'
import { Canvas, useLoader } from '@react-three/fiber'
import { Bounds, Center, OrbitControls } from '@react-three/drei'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RotateCw } from 'lucide-react'
import { db } from '../../db/index.js'
import { getMediaBlob } from '../../db/media.js'
import { prefersReducedMotion } from '../../theme/apply.js'

// Visor de modelos GLB guardados en IndexedDB.
// - Sin peticiones externas: no se usan entornos HDR remotos ni decodificadores Draco de CDN.
// - Renderizado bajo demanda (frameloop "demand"): no consume GPU mientras no se interactúa.
// - Al desmontar se liberan geometrías, materiales, texturas y la URL temporal.

function disposeScene(root) {
  root.traverse((o) => {
    o.geometry?.dispose?.()
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []
    for (const m of mats) {
      for (const v of Object.values(m)) if (v?.isTexture) v.dispose()
      m.dispose?.()
    }
  })
}

function Model({ url }) {
  const gltf = useLoader(GLTFLoader, url)
  useEffect(() => () => { disposeScene(gltf.scene); useLoader.clear(GLTFLoader, url) }, [gltf, url])
  return <Center><primitive object={gltf.scene} /></Center>
}

class ViewerBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div className="grid size-full place-items-center p-6 text-center text-sm text-muted">
          No se pudo mostrar el modelo. Puede estar dañado o usar compresión Draco/Meshopt, que esta versión no decodifica sin conexión.
        </div>
      )
    }
    return this.props.children
  }
}

export default function ModelViewer({ mediaId }) {
  const [url, setUrl] = useState(null)
  const [missing, setMissing] = useState(false)
  const [spin, setSpin] = useState(false)

  useEffect(() => {
    let u = null
    let cancelled = false
    getMediaBlob(db, mediaId).then((blob) => {
      if (cancelled) return
      if (!blob) { setMissing(true); return }
      u = URL.createObjectURL(blob)
      setUrl(u)
    })
    return () => { cancelled = true; if (u) URL.revokeObjectURL(u) }
  }, [mediaId])

  if (missing) return <div className="grid size-full place-items-center text-sm text-muted">El archivo del modelo no está disponible.</div>
  if (!url) return <div className="skeleton size-full" aria-label="Cargando modelo" />

  return (
    <div className="relative size-full">
      <ViewerBoundary>
        <Canvas frameloop={spin ? 'always' : 'demand'} dpr={[1, 1.75]} camera={{ position: [2.5, 1.6, 2.5], fov: 40 }} gl={{ antialias: true, preserveDrawingBuffer: false }}>
          <ambientLight intensity={0.55} />
          <hemisphereLight args={['#ffffff', '#202020', 0.6]} />
          <directionalLight position={[4, 6, 3]} intensity={1.4} />
          <directionalLight position={[-4, 2, -3]} intensity={0.5} />
          <Suspense fallback={null}>
            <Bounds fit clip observe margin={1.2}>
              <Model url={url} />
            </Bounds>
          </Suspense>
          <OrbitControls makeDefault enableDamping autoRotate={spin} autoRotateSpeed={1.2} />
        </Canvas>
      </ViewerBoundary>
      <button
        type="button"
        onClick={() => setSpin((s) => !s)}
        disabled={prefersReducedMotion()}
        className="glass-strong absolute bottom-3 right-3 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-fg disabled:opacity-40"
      >
        <RotateCw className="size-3.5" /> {spin ? 'Detener rotación' : 'Rotación automática'}
      </button>
      <p className="pointer-events-none absolute bottom-3 left-3 text-[11px] text-muted">Arrastra para rotar · rueda o pellizco para ampliar</p>
    </div>
  )
}
