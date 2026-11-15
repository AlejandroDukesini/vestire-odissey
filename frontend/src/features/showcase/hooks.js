import { useEffect, useState } from 'react'

/** Coincidencia reactiva de una media query (p. ej. ancho de pantalla o capacidad de hover). */
export function useMedia(query) {
  const get = () => globalThis.matchMedia?.(query).matches ?? false
  const [match, setMatch] = useState(get)
  useEffect(() => {
    const mq = globalThis.matchMedia?.(query)
    if (!mq) return
    const on = () => setMatch(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return match
}

/** Altura de la ventana, con un pequeño retardo al redimensionar. */
export function useViewportHeight() {
  const [h, setH] = useState(() => globalThis.innerHeight || 900)
  useEffect(() => {
    let t = 0
    const on = () => { clearTimeout(t); t = setTimeout(() => setH(window.innerHeight), 150) }
    window.addEventListener('resize', on)
    return () => { clearTimeout(t); window.removeEventListener('resize', on) }
  }, [])
  return h
}
