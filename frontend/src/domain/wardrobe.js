// Organización del armario: a qué estante pertenece cada prenda. Es una regla de presentación
// derivada del tipo de prenda ya registrado; no se guarda nada nuevo en los registros.

export const ZONES = [
  { key: 'top', label: 'Prendas superiores', short: 'Superiores', empty: 'Este estante está esperando nuevas prendas' },
  { key: 'bottom', label: 'Pantalones y prendas inferiores', short: 'Inferiores', empty: 'Esta barra está esperando nuevas prendas' },
  { key: 'shoes', label: 'Calzado', short: 'Calzado', empty: 'Este estante está esperando nuevo calzado' },
]

const TYPE_ZONE = {
  Camiseta: 'top', Camisa: 'top', Buzo: 'top', Sudadera: 'top', Chaqueta: 'top', Abrigo: 'top', Traje: 'top', Vestido: 'top',
  'Pantalón': 'bottom', Jeans: 'bottom', Bermuda: 'bottom', Short: 'bottom', Falda: 'bottom',
  Zapatos: 'shoes', Tenis: 'shoes', 'Zapatos formales': 'shoes', Botas: 'shoes', Sandalias: 'shoes',
}

const norm = (s) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

// Para "Otra": se deduce del tipo personalizado (o del nombre) por palabras clave.
const SHOES_RE = /\b(zapat|zapatill|tenis|sneaker|bota|botin|sandalia|chancla|mocasin|calzado|tacon|alpargata|loafer|pantufla)/
const BOTTOM_RE = /\b(pantalon|jean|vaquero|bermuda|short|falda|legging|jogger|chino|cargo|calza)/

/** Estante del armario para una prenda: 'top' | 'bottom' | 'shoes'. */
export function wardrobeZone(fields = {}) {
  const direct = TYPE_ZONE[fields.garmentType]
  if (direct) return direct
  const text = norm(`${fields.customType ?? ''} ${fields.name ?? ''}`)
  if (SHOES_RE.test(text)) return 'shoes'
  if (BOTTOM_RE.test(text)) return 'bottom'
  return 'top'
}

/** Tipo visible de la prenda (el personalizado si eligió "Otra"). */
export function garmentTypeLabel(fields = {}) {
  if (fields.garmentType === 'Otra') return fields.customType || 'Otra'
  return fields.garmentType || ''
}

/** Reparte una lista (ya filtrada y ordenada) en los tres estantes, conservando el orden. */
export function splitByZone(items) {
  const out = { top: [], bottom: [], shoes: [] }
  for (const i of items) out[wardrobeZone(i.fields)].push(i)
  return out
}
