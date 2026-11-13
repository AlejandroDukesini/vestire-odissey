import { TOKENS, onColor, luminance, sanitizeAppearance } from './palettes.js'

// Aplica la apariencia escribiendo variables CSS en :root. Es el único punto donde se fijan colores.
// Una copia ligera se guarda en localStorage SOLO para pintar el primer fotograma sin parpadeo;
// la fuente de verdad es IndexedDB (tabla settings, clave "appearance").

const MIRROR_KEY = 'odissey.appearance.mirror'

export function applyAppearance(appearance, root = document.documentElement) {
  const a = sanitizeAppearance(appearance)
  for (const t of TOKENS) root.style.setProperty(t.css, a.colors[t.key])
  root.style.setProperty('--c-on-primary', onColor(a.colors.primary))
  root.style.setProperty('--c-on-accent', onColor(a.colors.accent))
  root.dataset.theme = a.theme
  root.dataset.motion = a.motion
  root.style.colorScheme = luminance(a.colors.background) > 0.4 ? 'light' : 'dark'
  return a
}

export function mirrorAppearance(appearance) {
  try { localStorage.setItem(MIRROR_KEY, JSON.stringify(appearance)) } catch { /* modo privado: no es crítico */ }
}

export function readMirror() {
  try { return JSON.parse(localStorage.getItem(MIRROR_KEY) || 'null') } catch { return null }
}

/** ¿Debe reducirse el movimiento según la preferencia guardada y la del sistema? */
export function prefersReducedMotion() {
  const m = document.documentElement.dataset.motion
  if (m === 'reduced') return true
  if (m === 'full') return false
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}
