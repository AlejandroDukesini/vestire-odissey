import { useCallback, useEffect, useRef, useState } from 'react'
import { createVaultSound } from './vaultSound.js'

/**
 * VaultAnimationController: director de la secuencia cinematográfica de apertura.
 *
 * Solo decide QUÉ etapa está activa y CUÁNDO; el aspecto de cada etapa vive en vault.css
 * (cada estilo de bóveda define su propio mecanismo). Las etapas son acumulativas: la raíz recibe
 * las clases v-s1…v-s5 de todas las etapas alcanzadas, de modo que el estado final de cada
 * animación (dial girado, pernos retraídos, puerta abierta) se conserva.
 *
 *  0 presentación   bóveda cerrada, lejana y en penumbra
 *  1 acercamiento   la cámara avanza en primera persona hasta la cerradura
 *  2 desbloqueo     gira la cerradura y se retraen los pernos
 *  3 apertura       la puerta pivota sobre sus bisagras; la cámara retrocede
 *  4 iluminación    se enciende el interior y aparecen los relojes en cascada
 *  5 exploración    la colección queda disponible; los relojes empiezan a girar
 */
export const STAGE_TIMES = [0, 450, 2100, 3500, 4300, 5600]
export const LAST_STAGE = STAGE_TIMES.length - 1

// Efectos sonoros por estilo (ms desde el inicio de la secuencia).
const CUES = {
  classic: [['dial', 2150], ['dial', 2600], ['bolts', 3150], ['unlatch', 3480], ['door', 3600], ['light', 4300]],
  modern: [['key', 2150], ['key', 2350], ['key', 2550], ['key', 2750], ['granted', 3000], ['bolts', 3200], ['unlatch', 3480], ['door', 3600], ['light', 4300]],
  futuristic: [['scan', 2150], ['granted', 3000], ['bolts', 3200], ['unlatch', 3480], ['door', 3600], ['light', 4300]],
  cabinet: [['key_turn', 2400], ['unlatch', 3480], ['door', 3600], ['light', 4300]],
}

const SESSION_KEY = 'odissey.vaultIntroShown'

function introAlreadyShown() {
  try { return sessionStorage.getItem(SESSION_KEY) === '1' } catch { return false }
}
function markIntroShown() {
  try { sessionStorage.setItem(SESSION_KEY, '1') } catch { /* modo privado */ }
}

export function useVaultSequence({ intro, reduced, sound, style }) {
  const autoplay = !reduced && (intro === 'always' || (intro === 'session' && !introAlreadyShown()))
  const [stage, setStage] = useState(autoplay ? 0 : LAST_STAGE)
  const [instant, setInstant] = useState(!autoplay)
  const timers = useRef([])
  const raf = useRef(0)
  const audio = useRef(null)
  const opts = useRef({ sound, style })
  opts.current = { sound, style }

  const clear = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    cancelAnimationFrame(raf.current)
    audio.current?.stop()
    audio.current = null
  }, [])

  const skip = useCallback(() => {
    clear()
    setInstant(true)
    setStage(LAST_STAGE)
  }, [clear])

  const play = useCallback(() => {
    clear()
    if (reduced) { skip(); return }
    markIntroShown()
    // Vuelve a la bóveda cerrada sin animar el cierre y arranca en el siguiente fotograma.
    setInstant(true)
    setStage(0)
    raf.current = requestAnimationFrame(() => {
      raf.current = requestAnimationFrame(() => {
        setInstant(false)
        audio.current = createVaultSound(opts.current.sound)
        audio.current.schedule(CUES[opts.current.style] ?? CUES.classic)
        STAGE_TIMES.forEach((at, i) => { if (i > 0) timers.current.push(setTimeout(() => setStage(i), at)) })
      })
    })
  }, [clear, reduced, skip])

  // Arranque automático al entrar a la sección (una sola vez por montaje).
  useEffect(() => {
    if (autoplay) play()
    return clear
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { stage, instant, playing: stage < LAST_STAGE, play, skip }
}
