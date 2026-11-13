// Tokens de color de la aplicación. Todos los componentes usan estas variables (nunca colores fijos).

export const TOKENS = [
  { key: 'primary', label: 'Primario', css: '--c-primary' },
  { key: 'secondary', label: 'Secundario', css: '--c-secondary' },
  { key: 'accent', label: 'Acento', css: '--c-accent' },
  { key: 'background', label: 'Fondo', css: '--c-bg' },
  { key: 'surface', label: 'Superficies', css: '--c-surface' },
  { key: 'card', label: 'Tarjetas', css: '--c-card' },
  { key: 'text', label: 'Texto principal', css: '--c-text' },
  { key: 'muted', label: 'Texto secundario', css: '--c-muted' },
  { key: 'border', label: 'Bordes', css: '--c-border' },
  { key: 'success', label: 'Éxito', css: '--c-success' },
  { key: 'warning', label: 'Advertencia', css: '--c-warning' },
  { key: 'error', label: 'Error', css: '--c-error' },
]

export const PALETTES = {
  midnight: {
    name: 'Midnight Luxury',
    colors: { primary: '#C9A96A', secondary: '#2A2A33', accent: '#E7D6A8', background: '#09090B', surface: '#15151A', card: '#1C1C23', text: '#ECE8E1', muted: '#8F8A82', border: '#2A2A31', success: '#7FBF9A', warning: '#E2B55C', error: '#E0796B' },
  },
  royal: {
    name: 'Royal Gold',
    colors: { primary: '#D4AF37', secondary: '#1E1B4B', accent: '#A78BFA', background: '#0E0B1F', surface: '#17142E', card: '#201C3D', text: '#F3F0FF', muted: '#A39FC2', border: '#2F2A55', success: '#4ADE80', warning: '#FBBF24', error: '#F87171' },
  },
  light: {
    name: 'Minimal Light',
    colors: { primary: '#1F2937', secondary: '#E7E5E4', accent: '#A47E3B', background: '#F7F6F3', surface: '#FFFFFF', card: '#FFFFFF', text: '#1C1B1A', muted: '#6B6760', border: '#E3E0DA', success: '#2F855A', warning: '#B7791F', error: '#C53030' },
  },
  graphite: {
    name: 'Graphite',
    colors: { primary: '#E4E4E7', secondary: '#3F3F46', accent: '#A1A1AA', background: '#111113', surface: '#1A1A1D', card: '#222226', text: '#F4F4F5', muted: '#A1A1AA', border: '#2E2E33', success: '#86EFAC', warning: '#FCD34D', error: '#FCA5A5' },
  },
  ocean: {
    name: 'Ocean Blue',
    colors: { primary: '#38BDF8', secondary: '#0C4A6E', accent: '#67E8F9', background: '#06121F', surface: '#0C1D2E', card: '#11263B', text: '#E6F1FA', muted: '#8AA4BA', border: '#1C3550', success: '#4ADE80', warning: '#FACC15', error: '#FB7185' },
  },
  emerald: {
    name: 'Emerald',
    colors: { primary: '#34D399', secondary: '#064E3B', accent: '#D4AF37', background: '#05130F', surface: '#0B1F19', card: '#102A22', text: '#E7F5EF', muted: '#8DB3A4', border: '#1A3A30', success: '#6EE7B7', warning: '#FCD34D', error: '#FCA5A5' },
  },
  rose: {
    name: 'Rose',
    colors: { primary: '#F472B6', secondary: '#4A1D33', accent: '#FBCFE8', background: '#160B11', surface: '#22111A', card: '#2C1622', text: '#FBEFF5', muted: '#C29AAE', border: '#3D1F2E', success: '#86EFAC', warning: '#FDE68A', error: '#FDA4AF' },
  },
  mono: {
    name: 'Monochrome',
    colors: { primary: '#FAFAFA', secondary: '#262626', accent: '#A3A3A3', background: '#000000', surface: '#0F0F0F', card: '#171717', text: '#FAFAFA', muted: '#8A8A8A', border: '#262626', success: '#9AE6B4', warning: '#F6E05E', error: '#FC8181' },
  },
}

export const THEMES = { normal: 'Normal', glass: 'Glassmorphism' }
export const MOTION = { system: 'Según el sistema', full: 'Completas', reduced: 'Reducidas' }

export const DEFAULT_APPEARANCE = {
  theme: 'normal',
  palette: 'midnight',
  colors: { ...PALETTES.midnight.colors },
  motion: 'system',
}

const HEX = /^#[0-9a-f]{6}$/i

export function normalizeHex(v) {
  let s = String(v ?? '').trim()
  if (!s.startsWith('#')) s = `#${s}`
  if (/^#[0-9a-f]{3}$/i.test(s)) s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`
  return HEX.test(s) ? s.toUpperCase() : null
}

/** Completa y sanea una configuración guardada (tolera versiones antiguas o incompletas). */
export function sanitizeAppearance(a) {
  const base = DEFAULT_APPEARANCE
  if (!a || typeof a !== 'object') return structuredClone(base)
  const palette = a.palette in PALETTES || a.palette === 'custom' ? a.palette : base.palette
  const fallback = PALETTES[palette]?.colors ?? base.colors
  const colors = {}
  for (const t of TOKENS) colors[t.key] = normalizeHex(a.colors?.[t.key]) ?? fallback[t.key]
  return {
    theme: a.theme in THEMES ? a.theme : base.theme,
    palette,
    colors,
    motion: a.motion in MOTION ? a.motion : base.motion,
  }
}

function channel(c) {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
export function luminance(hex) {
  const h = normalizeHex(hex)
  if (!h) return 0
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}
/** Color de texto legible sobre un fondo dado. */
export const onColor = (hex) => (contrast(hex, '#0B0B0C') >= contrast(hex, '#FFFFFF') ? '#0B0B0C' : '#FFFFFF')

/** Problemas de legibilidad de una paleta (WCAG AA 4.5:1 para texto normal). */
export function legibilityIssues(colors) {
  const checks = [
    ['text', 'background', 'Texto sobre fondo', 4.5],
    ['text', 'surface', 'Texto sobre superficies', 4.5],
    ['text', 'card', 'Texto sobre tarjetas', 4.5],
    ['muted', 'surface', 'Texto secundario sobre superficies', 3],
  ]
  return checks
    .map(([f, b, label, min]) => ({ label, ratio: contrast(colors[f], colors[b]), min }))
    .filter((c) => c.ratio < c.min)
}
