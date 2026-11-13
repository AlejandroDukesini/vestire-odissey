import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { prefersReducedMotion } from '../theme/apply.js'

export const MIN_SPLASH_MS = 2000
const SESSION_KEY = 'odissey.splashShown'
const PREF_KEY = 'odissey.splash'

/** La presentación se muestra una vez por sesión del navegador (y solo si el usuario no la desactivó). */
export function shouldShowSplash() {
  try {
    if (localStorage.getItem(PREF_KEY) === '0') return false
    return sessionStorage.getItem(SESSION_KEY) !== '1'
  } catch {
    return true
  }
}
const markShown = () => { try { sessionStorage.setItem(SESSION_KEY, '1') } catch { /* opcional */ } }

function Emblem() {
  return (
    <svg viewBox="0 0 120 120" className="size-28" aria-hidden>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--c-accent)" />
          <stop offset="1" stopColor="var(--c-primary)" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="54" fill="none" stroke="color-mix(in oklab, var(--c-text) 10%, transparent)" strokeWidth="1" />
      <circle className="splash-ring" cx="60" cy="60" r="54" fill="none" stroke="url(#sg)" strokeWidth="1.5" strokeLinecap="round" transform="rotate(-90 60 60)" />
      <g className="splash-orbit">
        <circle cx="60" cy="6" r="2.5" fill="var(--c-primary)" />
      </g>
      <g className="splash-logo" style={{ transformOrigin: '60px 60px' }}>
        <path d="M60 30 L82 50 L60 92 L38 50 Z" fill="none" stroke="url(#sg)" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M38 50 H82 M50 50 L60 30 L70 50 L60 92 L50 50" fill="none" stroke="url(#sg)" strokeWidth="1" strokeLinejoin="round" opacity="0.7" />
      </g>
    </svg>
  )
}

/**
 * Pantalla de presentación.
 * - Dura al menos MIN_SPLASH_MS; si los datos tardan más, espera a que estén listos.
 * - El indicador es indeterminado: no simula un porcentaje.
 * - Si falla la inicialización, muestra el error y permite reintentar (nunca bloquea).
 */
export default function Splash({ ready, error, onRetry, onDone }) {
  const [minElapsed, setMinElapsed] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [slow, setSlow] = useState(false)
  const started = useRef(performance.now())

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), MIN_SPLASH_MS)
    const s = setTimeout(() => setSlow(true), 10_000)
    return () => { clearTimeout(t); clearTimeout(s) }
  }, [])

  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const finish = () => onDoneRef.current(performance.now() - started.current)

  useEffect(() => {
    if (!ready || !minElapsed || leaving) return
    markShown()
    if (prefersReducedMotion()) finish()
    else setLeaving(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, minElapsed, leaving])

  useEffect(() => {
    if (!leaving) return
    const t = setTimeout(finish, 520)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving])

  return (
    <div
      className={`splash fixed inset-0 z-[100] grid place-items-center overflow-hidden ${leaving ? 'splash-leave' : ''}`}
      style={{ background: 'var(--c-bg)', perspective: '800px' }}
      role="status"
      aria-live="polite"
      aria-label={error ? 'Error al iniciar' : 'Cargando Odissey'}
      data-testid="splash"
    >
      <div className="app-backdrop" />
      <div className="relative flex flex-col items-center px-6 text-center">
        <Emblem />
        <h1 className="splash-title mt-6 font-display text-4xl uppercase text-fg sm:text-5xl" style={{ letterSpacing: '0.32em' }}>Odissey</h1>
        <p className="splash-sub mt-3 text-[11px] uppercase tracking-[0.3em] text-muted">Patrimonio privado</p>

        {!error && (
          <>
            <div className="splash-bar mt-10 h-px w-48 overflow-hidden rounded-full bg-fg/10" aria-hidden>
              <span className="block h-full w-1/3 rounded-full bg-primary" />
            </div>
            <p className="splash-sub mt-4 text-xs text-muted">
              {slow ? 'La carga está tardando más de lo habitual. Tus datos siguen intactos.' : ready ? 'Bienvenido de nuevo' : 'Abriendo tu colección en este dispositivo…'}
            </p>
          </>
        )}

        {error && (
          <div className="panel mt-10 max-w-md p-5 text-left">
            <p className="flex items-center gap-2 font-medium text-danger"><AlertTriangle className="size-4" /> No se pudo abrir el almacenamiento local</p>
            <p className="mt-2 text-sm text-muted">{error.message}</p>
            <p className="mt-2 text-xs text-muted">No se ha borrado ni modificado ningún dato. Detalle técnico: {error.name}</p>
            <button type="button" onClick={onRetry} className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-on-primary">
              <RotateCw className="size-4" /> Reintentar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
