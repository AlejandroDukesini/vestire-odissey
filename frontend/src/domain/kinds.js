// Catálogo de tipos de activo. Es la única fuente de verdad sobre qué campos
// tiene cada categoría; formularios, validación, fichas y respaldos lo usan.
//
// Cada campo: { key, label, type, required?, options?, min? }
// type: text | textarea | number | money | date | select | url

const common = {
  description: { key: 'description', label: 'Descripción', type: 'textarea' },
  notes: { key: 'notes', label: 'Observaciones', type: 'textarea' },
  value: { key: 'value', label: 'Valor registrado', type: 'money', min: 0 },
  acquiredAt: { key: 'acquiredAt', label: 'Fecha de adquisición', type: 'date' },
  brand: { key: 'brand', label: 'Marca', type: 'text' },
  color: { key: 'color', label: 'Color', type: 'text' },
  material: { key: 'material', label: 'Material', type: 'text' },
  location: { key: 'location', label: 'Ubicación', type: 'text' },
  name: { key: 'name', label: 'Nombre', type: 'text', required: true },
}

export const GARMENT_TYPES = [
  'Camiseta', 'Camisa', 'Pantalón', 'Chaqueta', 'Abrigo', 'Zapatos', 'Traje', 'Vestido', 'Otra',
]
export const ACCESSORY_TYPES = [
  'Gafas', 'Bolso', 'Cartera', 'Joya', 'Collar', 'Pulsera', 'Anillo', 'Sombrero', 'Correa', 'Otro',
]

export const KINDS = {
  garment: {
    label: 'Prenda', plural: 'Vestimenta', group: 'vestimenta',
    fields: [
      common.name,
      { key: 'garmentType', label: 'Tipo de prenda', type: 'select', options: GARMENT_TYPES, required: true },
      { key: 'customType', label: 'Tipo personalizado', type: 'text' },
      common.color, common.material,
      { key: 'size', label: 'Talla', type: 'text' },
      common.brand, common.value, common.acquiredAt, common.description, common.notes,
    ],
    title: (f) => f.name,
    supports3d: true,
  },
  accessory: {
    label: 'Accesorio', plural: 'Accesorios', group: 'accesorios',
    fields: [
      common.name,
      { key: 'category', label: 'Categoría', type: 'select', options: ACCESSORY_TYPES, required: true },
      common.color, common.material, common.brand, common.value, common.acquiredAt,
      common.description, common.notes,
    ],
    title: (f) => f.name,
    supports3d: true,
  },
  watch: {
    label: 'Reloj', plural: 'Relojes', group: 'relojes',
    fields: [
      { ...common.brand, required: true },
      common.name,
      { key: 'model', label: 'Modelo', type: 'text' },
      common.color, common.material,
      { key: 'audience', label: 'Público', type: 'select', options: ['Hombre', 'Mujer', 'Unisex'] },
      common.value, common.acquiredAt, common.description, common.notes,
    ],
    title: (f) => [f.brand, f.name].filter(Boolean).join(' '),
    supports3d: true,
  },
  yacht: {
    label: 'Yate', plural: 'Yates', group: 'propiedades',
    fields: [
      { ...common.brand, required: true },
      { key: 'model', label: 'Modelo', type: 'text', required: true },
      common.color,
      { key: 'usage', label: 'Uso (horas de motor u otro)', type: 'text' },
      common.value, common.location, common.description, common.notes,
    ],
    title: (f) => [f.brand, f.model].filter(Boolean).join(' '),
    requiresPhoto: true,
  },
  car: {
    label: 'Automóvil', plural: 'Automóviles', group: 'propiedades',
    fields: [
      { ...common.brand, required: true },
      { key: 'model', label: 'Modelo', type: 'text', required: true },
      common.color,
      { key: 'mileage', label: 'Kilometraje', type: 'number', min: 0 },
      common.value, common.location, common.description, common.notes,
    ],
    title: (f) => [f.brand, f.model].filter(Boolean).join(' '),
  },
  motorcycle: {
    label: 'Motocicleta', plural: 'Motocicletas', group: 'propiedades',
    fields: [
      { ...common.brand, required: true },
      { key: 'model', label: 'Modelo', type: 'text', required: true },
      common.color,
      { key: 'mileage', label: 'Kilometraje', type: 'number', min: 0 },
      common.value, common.location, common.description, common.notes,
    ],
    title: (f) => [f.brand, f.model].filter(Boolean).join(' '),
  },
  house: {
    label: 'Casa', plural: 'Casas', group: 'propiedades',
    fields: [
      { ...common.name, label: 'Nombre de la propiedad' },
      { key: 'propertyType', label: 'Tipo de inmueble', type: 'select', required: true,
        options: ['Casa', 'Apartamento', 'Villa', 'Finca', 'Cabaña', 'Penthouse', 'Terreno', 'Otro'] },
      { ...common.color, label: 'Color predominante' },
      common.value, common.location, common.description, common.notes,
    ],
    title: (f) => f.name,
  },
  physicalBusiness: {
    label: 'Empresa física', plural: 'Empresas físicas', group: 'empresas',
    fields: [
      common.name,
      { key: 'businessType', label: 'Tipo de negocio', type: 'text', required: true },
      { key: 'address', label: 'Dirección', type: 'text' },
      common.location,
      { ...common.value, label: 'Valor o inversión registrada' },
      common.description, common.notes,
    ],
    title: (f) => f.name,
  },
  digitalBusiness: {
    label: 'Negocio digital', plural: 'Negocios digitales', group: 'empresas',
    fields: [
      { ...common.name, label: 'Nombre del negocio' },
      { key: 'url', label: 'Dominio o URL', type: 'url' },
      { key: 'businessType', label: 'Tipo de negocio', type: 'text' },
      common.value, common.description, common.notes,
    ],
    title: (f) => f.name,
  },
}

export const KIND_KEYS = Object.keys(KINDS)

export function isKind(kind) {
  return Object.prototype.hasOwnProperty.call(KINDS, kind)
}

const isBlank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '')

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
      const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
      if (!Number.isFinite(n)) { errors[def.key] = `${def.label} debe ser un número`; continue }
      if (def.min !== undefined && n < def.min) { errors[def.key] = `${def.label} no puede ser negativo`; continue }
      v = n
    } else if (def.type === 'date') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) {
        errors[def.key] = `${def.label} no es una fecha válida`; continue
      }
    } else if (def.type === 'select') {
      if (!def.options.includes(v)) { errors[def.key] = `${def.label}: opción no válida`; continue }
    } else if (def.type === 'url') {
      const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`
      try {
        const u = new URL(withProto)
        if (!['http:', 'https:'].includes(u.protocol) || !u.hostname.includes('.')) throw new Error()
        v = u.href
      } catch {
        errors[def.key] = `${def.label} no es una URL válida`; continue
      }
    } else {
      v = String(v)
    }
    fields[def.key] = v
  }
  return { fields, errors }
}

export function itemTitle(kind, fields) {
  const t = KINDS[kind]?.title(fields || {})
  return t && String(t).trim() ? String(t).trim() : 'Sin nombre'
}

export const CURRENCIES = ['USD', 'EUR', 'COP', 'MXN', 'ARS', 'CLP', 'PEN', 'BRL', 'GBP', 'CHF', 'JPY', 'CAD']
