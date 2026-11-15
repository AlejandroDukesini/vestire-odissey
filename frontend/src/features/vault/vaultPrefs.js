// Preferencias visuales de la bóveda de relojes. Se guardan en la tabla `settings` (clave "vault"),
// separadas por completo de los registros de relojes: cambiar el estilo nunca toca un activo.

export const VAULT_STYLES = {
  classic: {
    label: 'Classic Luxury',
    tagline: 'Colección privada tradicional',
    description: 'Puerta lacada en negro, filetes dorados, dial de combinación y volante de tres radios. Interior de ante burdeos con luz cálida.',
    swatch: ['#0d0d0f', '#2a2a2e', '#c9a45c'],
  },
  modern: {
    label: 'Modern Vault',
    tagline: 'Alta seguridad contemporánea',
    description: 'Acero grafito cepillado, aristas biseladas, teclado digital y palanca. Interior de fieltro carbón con tira LED fría.',
    swatch: ['#15171a', '#3a3e44', '#d4d9e0'],
  },
  futuristic: {
    label: 'Futuristic Vault',
    tagline: 'Bóveda tecnológica',
    description: 'Paneles con juntas luminosas, cerradura de anillos concéntricos y escaneo de luz. Compartimentos con iluminación individual.',
    swatch: ['#05080c', '#0f1a24', '#47e3ff'],
  },
  cabinet: {
    label: 'Luxury Watch Cabinet',
    tagline: 'Exhibición privada de relojería',
    description: 'Mueble de nogal oscuro con puerta de cristal, cerradura de llave en latón y terciopelo marfil bajo focos cálidos.',
    swatch: ['#26140a', '#5a3620', '#d8c49d'],
  },
}

export const VAULT_SIZES = {
  compact: { label: 'Compacta', hint: 'Más relojes por bandeja' },
  wide: { label: 'Amplia', hint: 'Compartimentos grandes' },
}

export const VAULT_INTROS = {
  always: 'Cada vez que entro a Relojes',
  session: 'Una vez por sesión',
  never: 'Nunca (abrir directamente)',
}

export const VAULT_DEFAULTS = { style: 'classic', size: 'compact', intro: 'always', sound: true }

/** Normaliza lo guardado: claves desconocidas se ignoran y los valores no válidos vuelven al predeterminado. */
export function sanitizeVault(v) {
  const src = v && typeof v === 'object' ? v : {}
  return {
    style: src.style in VAULT_STYLES ? src.style : VAULT_DEFAULTS.style,
    size: src.size in VAULT_SIZES ? src.size : VAULT_DEFAULTS.size,
    intro: src.intro in VAULT_INTROS ? src.intro : VAULT_DEFAULTS.intro,
    sound: typeof src.sound === 'boolean' ? src.sound : VAULT_DEFAULTS.sound,
  }
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

/**
 * Distribución de compartimentos según la cantidad REAL de relojes y el ancho disponible.
 * Nunca crea compartimentos vacíos de relleno: si la última fila queda incompleta se centra.
 * Si la colección supera la capacidad de una bandeja, se reparte en varias bandejas (páginas).
 *
 * Devuelve { cols, rows, perPage, pages, cell, gap }.
 */
export function computeLayout(count, { width = 900, size = 'compact' } = {}) {
  const wide = size === 'wide'
  const narrow = width < 520
  const gap = narrow ? 10 : wide ? 18 : 14
  const minCell = narrow ? 128 : wide ? 196 : 150
  const maxCell = wide ? 260 : 210
  const maxCols = clamp(Math.floor((width + gap) / (minCell + gap)), 1, wide ? 4 : 6)
  const maxRows = narrow ? 3 : wide ? 2 : 3
  const n = Math.max(0, Math.floor(count))

  let cols
  let rows
  if (n <= 1) {
    cols = 1; rows = 1
  } else if (n > maxCols * maxRows) {
    cols = maxCols; rows = maxRows
  } else {
    // Busca la cuadrícula más equilibrada (proporción cercana a 4:3) con el menor número de huecos.
    let best = null
    for (let r = 1; r <= maxRows; r++) {
      const c = Math.ceil(n / r)
      if (c > maxCols) continue
      const empty = c * r - n
      const score = Math.abs(c / r - 1.35) + empty * 0.35
      if (!best || score < best.score) best = { c, r, score }
    }
    cols = best?.c ?? maxCols
    rows = best?.r ?? Math.ceil(n / cols)
  }

  const perPage = cols * rows
  const pages = n === 0 ? 1 : Math.ceil(n / perPage)
  const featured = n === 1
  const fit = Math.floor((width - gap * (cols - 1)) / cols)
  const cell = clamp(fit, Math.min(minCell, fit), featured ? (wide ? 340 : 300) : maxCell)
  return { cols, rows, perPage, pages, cell, gap }
}

/** Velocidad y desfase de giro distintos (y estables) para cada reloj, a partir de su id. */
export function motionSeed(id = '') {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619) }
  const u = (h >>> 0) / 4294967295
  return { duration: 7 + u * 4.5, delay: -(u * 9), winder: 16 + u * 10 }
}
