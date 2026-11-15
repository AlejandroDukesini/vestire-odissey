import { useEffect, useRef, useState } from 'react'
import { FastForward, RotateCcw } from 'lucide-react'
import VaultDoor from './VaultDoor.jsx'
import { cx } from '../../components/ui.jsx'
import './vault.css'

// Partículas de polvo en el haz de luz: posiciones fijas (sin aleatoriedad por render).
const DUST = Array.from({ length: 16 }, (_, i) => ({
  x: (i * 37) % 100, y: (i * 53) % 90, s: 1 + (i % 3), d: 9 + (i % 5) * 2.2, delay: -(i * 1.7),
}))

/**
 * WatchVault: escenario cinematográfico. Contiene la sala (pared, suelo, haz de luz), la cámara
 * (rig con perspectiva), el cuerpo de la caja fuerte con profundidad real, bisagras, la puerta y
 * el interior que se le pasa como `children`.
 *
 * Mide el ancho útil del interior y lo comunica con `onMeasure` para que la distribución de
 * compartimentos se adapte al espacio real.
 */
export default function WatchVault({ style, size, stage, instant, playing, reduced, lockScale = 1, onSkip, onReplay, onMeasure, children }) {
  const stageRef = useRef(null)
  const [offscreen, setOffscreen] = useState(false)

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => onMeasure?.(el.clientWidth))
      : null
    ro?.observe(el)
    onMeasure?.(el.clientWidth)
    const io = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([e]) => setOffscreen(!e.isIntersecting), { threshold: 0 })
      : null
    io?.observe(el)
    return () => { ro?.disconnect(); io?.disconnect() }
  }, [onMeasure])

  useEffect(() => {
    if (!playing) return
    const onKey = (e) => e.key === 'Escape' && onSkip()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playing, onSkip])

  // Al empezar la secuencia, la cámara "lleva" al usuario: la escena se centra en pantalla.
  useEffect(() => {
    const el = stageRef.current
    if (stage !== 0 || instant || !el) return
    const r = el.getBoundingClientRect()
    if (r.top < 0 || r.top > window.innerHeight * 0.3) el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: r.height > window.innerHeight ? 'start' : 'center' })
  }, [stage, instant, reduced])

  const stageClasses = Array.from({ length: stage }, (_, i) => `v-s${i + 1}`)

  return (
    <section
      ref={stageRef}
      className={cx('vault-stage', ...stageClasses, stage === 0 && 'v-s0', instant && 'v-instant', reduced && 'v-still', offscreen && 'is-offscreen')}
      data-style={style}
      data-size={size}
      data-stage={stage}
      style={{ '--lock-scale': lockScale.toFixed(3) }}
      aria-label="Bóveda de relojes"
      aria-busy={playing}
    >
      <div className="vault-room" aria-hidden>
        <span className="room-wall" />
        <span className="room-floor" />
        <span className="room-beam seq" />
        {!reduced && (
          <span className="room-dust">
            {DUST.map((p, i) => (
              <i key={i} style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s, animationDuration: `${p.d}s`, animationDelay: `${p.delay}s` }} />
            ))}
          </span>
        )}
      </div>

      <div className="vault-rig seq">
        <div className="vault-bob seq">
          <div className="vault-present seq">
            <div className="vault">
              <span className="vault-side vault-side-l" aria-hidden />
              <span className="vault-side vault-side-r" aria-hidden />
              <span className="vault-side vault-side-t" aria-hidden />
              <span className="vault-face" aria-hidden />
              {children}
              <span className="vault-hinges" aria-hidden><i /><i /><i /></span>
              <VaultDoor style={style} />
              <span className="vault-status seq" aria-hidden />
              {style === 'cabinet' && <span className="vault-crown" aria-hidden />}
            </div>
            <span className="vault-shadow" aria-hidden />
          </div>
        </div>
      </div>

      <span className="vault-vignette" aria-hidden />

      {!playing && onReplay && !reduced && (
        <button type="button" className="vault-replay" onClick={onReplay}>
          <RotateCcw className="size-3.5" aria-hidden /> Repetir apertura
        </button>
      )}
      {playing && (
        <button type="button" className="vault-skip" onClick={onSkip}>
          <FastForward className="size-3.5" aria-hidden /> Saltar apertura
        </button>
      )}
    </section>
  )
}
