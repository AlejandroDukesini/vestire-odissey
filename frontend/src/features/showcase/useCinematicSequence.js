import { useCallback, useEffect, useRef, useState } from 'react'
import { createVaultSound } from '../vault/vaultSound.js'

/**
 * Director genérico de una secuencia por etapas (bóveda de relojes, armario de vestimenta).
 *
 * Solo decide QUÉ etapa está activa y CUÁNDO; el aspecto de cada etapa vive en CSS. Las etapas
 * son acumulativas: el contenedor recibe las clases de todas las alcanzadas, de modo que el
 * estado final de cada animación se conserva.
 *
 * @param times       ms desde el inicio en que se alcanza cada etapa (times[0] = 0).
 * @param intro       'always' | 'session' | 'never'
 * @param sessionKey  clave de sessionStorage para "una vez por sesión".
 * @param cues        efectos sonoros [[nombre, ms], ...] (ver vaultSound.js).
 */
export function useCinematicSequence({ times, intro, reduced, sound, cues, sessionKey }) {
  const last = times.length - 1
  const shown = () => { try { return sessionStorage.getItem(sessionKey) === '1' } catch { return false } }
  const autoplay = !reduced && (intro === 'always' || (intro === 'session' && !shown()))
  const [stage, setStage] = useState(autoplay ? 0 : last)
  const [instant, setInstant] = useState(!autoplay)
  const timers = useRef([])
  const raf = useRef(0)
  const audio = useRef(null)
  const opts = useRef({ sound, cues, times })
  opts.current = { sound, cues, times }

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
    setStage(last)
  }, [clear, last])

  const play = useCallback(() => {
    clear()
    if (reduced) { skip(); return }
    try { sessionStorage.setItem(sessionKey, '1') } catch { /* modo privado */ }
    // Vuelve al estado cerrado sin animar el cierre y arranca en el siguiente fotograma.
    setInstant(true)
    setStage(0)
    raf.current = requestAnimationFrame(() => {
      raf.current = requestAnimationFrame(() => {
        setInstant(false)
        audio.current = createVaultSound(opts.current.sound)
        audio.current.schedule(opts.current.cues ?? [])
        opts.current.times.forEach((at, i) => { if (i > 0) timers.current.push(setTimeout(() => setStage(i), at)) })
      })
    })
  }, [clear, reduced, skip, sessionKey])

  // Arranque automático al entrar a la sección (una sola vez por montaje).
  useEffect(() => {
    if (autoplay) play()
    return clear
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { stage, instant, last, playing: stage < last, play, skip }
}
