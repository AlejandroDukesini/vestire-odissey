import { useEffect, useRef } from 'react'
import { FastForward, RotateCcw } from 'lucide-react'
import { cx } from '../../components/ui.jsx'
import './wardrobe.css'

/** Hoja de puerta: sólido con frente (moldura, cristal ahumado y tirador), canto y dorso (espejo). */
function Door({ side }) {
  return (
    <div className={`wr-door wr-door-${side} seq`} aria-hidden>
      <div className="wr-door-face wr-door-front">
        <span className="wr-door-molding" />
        <span className="wr-door-glass" />
        <span className="wr-door-handle seq" />
      </div>
      <div className="wr-door-edge" />
      <div className="wr-door-face wr-door-back">
        <span className="wr-mirror" />
      </div>
    </div>
  )
}

/**
 * Escenario del armario: sala, cámara, mueble con profundidad (laterales, cornisa y zócalo),
 * dos puertas batientes y el interior (los estantes llegan como `children`).
 *
 * Clases de etapa acumulativas (useCinematicSequence): .w-s1 acercamiento, .w-s2 desbloqueo,
 * .w-s3 apertura, .w-s4 luz y organización de prendas, .w-s5 exploración.
 */
export default function Wardrobe({ stage, instant, playing, reduced, onSkip, onReplay, children }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!playing) return
    const onKey = (e) => e.key === 'Escape' && onSkip()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playing, onSkip])

  // Al empezar la apertura la escena se centra en pantalla si está fuera de vista.
  useEffect(() => {
    const el = ref.current
    if (stage !== 0 || instant || !el) return
    const r = el.getBoundingClientRect()
    if (r.top < 0 || r.top > window.innerHeight * 0.35) el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  }, [stage, instant, reduced])

  const stages = Array.from({ length: stage }, (_, i) => `w-s${i + 1}`)
  return (
    <section
      ref={ref}
      className={cx('wr-stage', ...stages, stage === 0 && 'w-s0', instant && 'w-instant', reduced && 'w-still')}
      data-stage={stage}
      aria-label="Armario de vestimenta"
      aria-busy={playing}
    >
      <div className="wr-room" aria-hidden>
        <span className="wr-wall" />
        <span className="wr-floor" />
        <span className="wr-spot seq" />
      </div>

      <div className="wr-rig seq">
        <div className="wr-present seq">
          <div className="wardrobe">
            <span className="wr-crown" aria-hidden />
            <span className="wr-side wr-side-l" aria-hidden />
            <span className="wr-side wr-side-r" aria-hidden />
            <div className="wr-interior">
              <span className="wr-back" aria-hidden />
              <span className="wr-glow seq" aria-hidden />
              {children}
              <span className="wr-dark seq" aria-hidden />
            </div>
            <Door side="l" />
            <Door side="r" />
            <span className="wr-plinth" aria-hidden />
          </div>
          <span className="wr-shadow" aria-hidden />
        </div>
      </div>

      {!playing && onReplay && !reduced && (
        <button type="button" className="wr-ctl wr-replay" onClick={onReplay}>
          <RotateCcw className="size-3.5" aria-hidden /> Repetir apertura
        </button>
      )}
      {playing && (
        <button type="button" className="wr-ctl wr-skip" onClick={onSkip}>
          <FastForward className="size-3.5" aria-hidden /> Saltar apertura
        </button>
      )}
    </section>
  )
}
