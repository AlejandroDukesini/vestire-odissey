// Catálogo de tipos de activo. Es la única fuente de verdad sobre qué campos
// tiene cada categoría; formularios, validación, fichas, filtros y respaldos lo usan.
//
// Cada campo: { key, label, type, required?, options?, min?, max?, integer? }
// type: text | textarea | number | money | date | select | url | urllist

const common = {
  description: { key: 'description', label: 'Descripción', type: 'textarea' },
  notes: { key: 'notes', label: 'Observaciones', type: 'textarea' },
  value: { key: 'value', label: 'Valor registrado', type: 'money', min: 0 },
  acquiredAt: { key: 'acquiredAt', label: 'Fecha de adquisición', type: 'date' },
  brand: { key: 'brand', label: 'Marca', type: 'text' },
  model: { key: 'model', label: 'Modelo', type: 'text' },
  color: { key: 'color', label: 'Color', type: 'text' },
  material: { key: 'material', label: 'Material', type: 'text' },
  location: { key: 'location', label: 'Ubicación', type: 'text' },
  name: { key: 'name', label: 'Nombre', type: 'text', required: true },
  year: { key: 'year', label: 'Año', type: 'number', integer: true, min: 1885, max: new Date().getFullYear() + 1 },
  mileage: { key: 'mileage', label: 'Kilometraje', type: 'number', min: 0 },
}

export const GARMENT_TYPES = [
  'Camiseta', 'Camisa', 'Pantalón', 'Chaqueta', 'Abrigo', 'Zapatos', 'Traje', 'Vestido', 'Otra',
]
export const ACCESSORY_TYPES = [
  'Gafas', 'Bolso', 'Cartera', 'Joya', 'Collar', 'Pulsera', 'Anillo', 'Sombrero', 'Correa', 'Otro',
]

export const KINDS = {
  garment: {
    label: 'Prenda', plural: 'Prendas', group: 'vestimenta', path: '/vestimenta',
    fields: [
      common.name,
      { key: 'garmentType', label: 'Tipo de prenda', type: 'select', options: GARMENT_TYPES, required: true },
      { key: 'customType', label: 'Tipo personalizado', type: 'text', showIf: (f) => f.garmentType === 'Otra' },
      common.brand, common.color, common.material,
      { key: 'size', label: 'Talla', type: 'text' },
      common.value, common.acquiredAt, common.description, common.notes,
    ],
    filters: ['garmentType', 'size', 'color', 'material', 'brand'],
    subtitle: (f) => [f.garmentType === 'Otra' ? f.customType || 'Otra' : f.garmentType, f.size && `Talla ${f.size}`, f.color].filter(Boolean).join(' · '),
    title: (f) => f.name,
    supports3d: true, wearable: true,
  },
  accessory: {
    label: 'Accesorio', plural: 'Accesorios', group: 'accesorios', path: '/accesorios',
    fields: [
      common.name,
      { key: 'category', label: 'Categoría', type: 'select', options: ACCESSORY_TYPES, required: true },
      { key: 'customCategory', label: 'Categoría personalizada', type: 'text', showIf: (f) => f.category === 'Otro' },
      common.brand, common.color, common.material, common.value, common.acquiredAt,
      common.description, common.notes,
    ],
    filters: ['category', 'color', 'material', 'brand'],
    subtitle: (f) => [f.category === 'Otro' ? f.customCategory || 'Otro' : f.category, f.color, f.material].filter(Boolean).join(' · '),
    title: (f) => f.name,
    supports3d: true, wearable: true,
  },
  watch: {
    label: 'Reloj', plural: 'Relojes', group: 'relojes', path: '/relojes',
    fields: [
      { ...common.brand, required: true },
      common.name,
      common.model,
      common.color, common.material,
      { key: 'audience', label: 'Público', type: 'select', options: ['Hombre', 'Mujer', 'Unisex'] },
      common.value, common.acquiredAt, common.description, common.notes,
    ],
    filters: ['brand', 'model', 'audience', 'material'],
    subtitle: (f) => [f.model, f.material, f.audience].filter(Boolean).join(' · '),
    title: (f) => [f.brand, f.name].filter(Boolean).join(' '),
    supports3d: true, wearable: true,
  },
  yacht: {
    label: 'Yate', plural: 'Yates', group: 'propiedades', path: '/propiedades/yates',
    fields: [
      { ...common.brand, required: true },
      { ...common.model, required: true },
      common.year,
      { key: 'length', label: 'Eslora (m)', type: 'number', min: 0 },
      common.color,
      { key: 'usage', label: 'Uso (horas de motor u otro)', type: 'text' },
      common.value, common.location, common.description, common.notes,
    ],
    filters: ['brand', 'year', 'location'],
    subtitle: (f) => [f.year, f.length && `${f.length} m`, f.location].filter(Boolean).join(' · '),
    title: (f) => [f.brand, f.model].filter(Boolean).join(' '),
    requiresPhoto: true,
  },
  car: {
    label: 'Automóvil', plural: 'Automóviles', group: 'propiedades', path: '/propiedades/automoviles',
    fields: [
      { ...common.brand, required: true },
      { ...common.model, required: true },
      common.year,
      { key: 'bodyType', label: 'Tipo', type: 'select', options: ['Sedán', 'Coupé', 'Descapotable', 'SUV', 'Pickup', 'Hatchback', 'Familiar', 'Deportivo', 'Clásico', 'Otro'] },
      common.color, common.mileage,
      common.value, common.location, common.description, common.notes,
    ],
    filters: ['brand', 'year', 'bodyType', 'color', 'location'],
    subtitle: (f) => [f.year, f.bodyType, f.mileage != null && `${Number(f.mileage).toLocaleString('es')} km`].filter(Boolean).join(' · '),
    title: (f) => [f.brand, f.model].filter(Boolean).join(' '),
  },
  motorcycle: {
    label: 'Motocicleta', plural: 'Motocicletas', group: 'propiedades', path: '/propiedades/motocicletas',
    fields: [
      { ...common.brand, required: true },
      { ...common.model, required: true },
      common.year,
      { key: 'bodyType', label: 'Tipo', type: 'select', options: ['Deportiva', 'Naked', 'Custom', 'Touring', 'Trail', 'Scooter', 'Café racer', 'Clásica', 'Otra'] },
      common.color, common.mileage,
      common.value, common.location, common.description, common.notes,
    ],
    filters: ['brand', 'year', 'bodyType', 'color', 'location'],
    subtitle: (f) => [f.year, f.bodyType, f.mileage != null && `${Number(f.mileage).toLocaleString('es')} km`].filter(Boolean).join(' · '),
    title: (f) => [f.brand, f.model].filter(Boolean).join(' '),
  },
  house: {
    label: 'Casa', plural: 'Casas', group: 'propiedades', path: '/propiedades/casas',
    fields: [
      { ...common.name, label: 'Nombre de la propiedad' },
      { key: 'propertyType', label: 'Tipo de inmueble', type: 'select', required: true,
        options: ['Casa', 'Apartamento', 'Villa', 'Finca', 'Cabaña', 'Penthouse', 'Terreno', 'Otro'] },
      { key: 'area', label: 'Superficie (m²)', type: 'number', min: 0 },
      { ...common.color, label: 'Color predominante' },
      common.value, common.location, common.description, common.notes,
    ],
    filters: ['propertyType', 'location'],
    subtitle: (f) => [f.propertyType, f.area && `${f.area} m²`, f.location].filter(Boolean).join(' · '),
    title: (f) => f.name,
  },
  physicalBusiness: {
    label: 'Empresa física', plural: 'Empresas físicas', group: 'empresas', path: '/empresas/fisicas',
    fields: [
      common.name,
      { key: 'premisesType', label: 'Tipo de inmueble', type: 'select', required: true,
        options: ['Empresa', 'Local comercial', 'Edificio', 'Oficina', 'Nave industrial', 'Restaurante', 'Otro'] },
      { key: 'businessType', label: 'Actividad del negocio', type: 'text', required: true },
      { key: 'address', label: 'Dirección', type: 'text' },
      common.location,
      { ...common.value, label: 'Valor o inversión registrada' },
      common.description, common.notes,
    ],
    filters: ['premisesType', 'businessType', 'location'],
    subtitle: (f) => [f.premisesType, f.businessType, f.location].filter(Boolean).join(' · '),
    title: (f) => f.name,
  },
  digitalBusiness: {
    label: 'Negocio digital', plural: 'Negocios digitales', group: 'empresas', path: '/empresas/digitales',
    fields: [
      { ...common.name, label: 'Nombre del negocio' },
      { key: 'url', label: 'Dominio o URL principal', type: 'url' },
      { key: 'otherUrls', label: 'Otros sitios web asociados (uno por línea)', type: 'urllist' },
      { key: 'businessType', label: 'Tipo de negocio', type: 'text' },
      { ...common.value, label: 'Valor registrado (opcional)' },
      common.description, common.notes,
    ],
    filters: ['businessType'],
    subtitle: (f) => [f.businessType, f.url && new URL(f.url).hostname].filter(Boolean).join(' · '),
    title: (f) => f.name,
  },
}

export const KIND_KEYS = Object.keys(KINDS)

export const isKind = (kind) => Object.prototype.hasOwnProperty.call(KINDS, kind)

export const fieldDef = (kind, key) => KINDS[kind]?.fields.find((f) => f.key === key)

/** Grupos para el dashboard y la distribución del patrimonio. */
export const ASSET_GROUPS = [
  { key: 'vestimenta', label: 'Vestimenta', kinds: ['garment'] },
  { key: 'accesorios', label: 'Accesorios', kinds: ['accessory'] },
  { key: 'relojes', label: 'Relojes', kinds: ['watch'] },
  { key: 'vehiculos', label: 'Vehículos', kinds: ['car', 'motorcycle', 'yacht'] },
  { key: 'inmuebles', label: 'Propiedades', kinds: ['house'] },
  { key: 'empresas', label: 'Empresas', kinds: ['physicalBusiness', 'digitalBusiness'] },
]
export const groupOfKind = (kind) => ASSET_GROUPS.find((g) => g.kinds.includes(kind))

const isBlank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '')

function normalizeUrl(v) {
  const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`
  const u = new URL(withProto)
  if (!['http:', 'https:'].includes(u.protocol) || !u.hostname.includes('.')) throw new Error('url')
  return u.href
}

/**
 * Normaliza y valida los campos de un activo.
 * Devuelve { fields, errors }: fields solo contiene claves conocidas y tipadas.
 */
export function validateFields(kind, input = {}) {
  if (!isKind(kind)) return { fields: {}, errors: { _kind: `Tipo desconocido: ${kind}` } }
  const fields = {}
  const errors = {}
  for (const def of KINDS[kind].fields) {
    let v = input[def.key]
    if (typeof v === 'string') v = v.trim()
    if (isBlank(v)) {
      if (def.required) errors[def.key] = `${def.label} es obligatorio`
      continue
    }
    if (def.type === 'number' || def.type === 'money') {
      const n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'))
      if (!Number.isFinite(n)) { errors[def.key] = `${def.label} debe ser un número`; continue }
      if (def.integer && !Number.isInteger(n)) { errors[def.key] = `${def.label} debe ser un número entero`; continue }
      if (def.min !== undefined && n < def.min) { errors[def.key] = def.min === 0 ? `${def.label} no puede ser negativo` : `${def.label} debe ser al menos ${def.min}`; continue }
      if (def.max !== undefined && n > def.max) { errors[def.key] = `${def.label} no puede superar ${def.max}`; continue }
      v = n
    } else if (def.type === 'date') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) {
        errors[def.key] = `${def.label} no es una fecha válida`; continue
      }
    } else if (def.type === 'select') {
      if (!def.options.includes(v)) { errors[def.key] = `${def.label}: opción no válida`; continue }
    } else if (def.type === 'url') {
      try { v = normalizeUrl(v) } catch { errors[def.key] = `${def.label} no es una URL válida`; continue }
    } else if (def.type === 'urllist') {
      const lines = (Array.isArray(v) ? v : String(v).split(/\r?\n/)).map((s) => String(s).trim()).filter(Boolean)
      const out = []
      let bad = null
      for (const l of lines) { try { out.push(normalizeUrl(l)) } catch { bad = l; break } }
      if (bad) { errors[def.key] = `"${bad}" no es una URL válida`; continue }
      if (!out.length) continue
      v = [...new Set(out)]
    } else {
      v = String(v).slice(0, def.type === 'textarea' ? 5000 : 300)
    }
    fields[def.key] = v
  }
  return { fields, errors }
}

export function itemTitle(kind, fields) {
  const t = KINDS[kind]?.title(fields || {})
  return t && String(t).trim() ? String(t).trim() : 'Sin nombre'
}

export function itemSubtitle(item) {
  try { return KINDS[item.kind]?.subtitle?.(item.fields || {}) || '' } catch { return '' }
}

export const CURRENCIES = ['USD', 'EUR', 'COP', 'MXN', 'ARS', 'CLP', 'PEN', 'BRL', 'GBP', 'CHF', 'JPY', 'CAD']
