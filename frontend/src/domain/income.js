import { CURRENCIES } from './kinds.js'

export const INCOME_CATEGORIES = [
  'Salario', 'Empresa', 'Negocio digital', 'Alquiler', 'Inversión', 'Actividad independiente', 'Otra',
]
export const FREQUENCIES = [
  { key: 'once', label: 'Única', perMonth: 0 },
  { key: 'daily', label: 'Diaria', perMonth: 365.25 / 12 },
  { key: 'weekly', label: 'Semanal', perMonth: 52 / 12 },
  { key: 'biweekly', label: 'Quincenal', perMonth: 2 },
  { key: 'monthly', label: 'Mensual', perMonth: 1 },
  { key: 'yearly', label: 'Anual', perMonth: 1 / 12 },
]
export const frequencyLabel = (k) => FREQUENCIES.find((f) => f.key === k)?.label ?? k
export const ENTRY_TYPES = { expected: 'Esperado', received: 'Recibido' }

const blank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '')
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))
const toNum = (v) => (typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.')))

/** Valida una fuente de ingreso. Devuelve { data, errors }. */
export function validateSource(input = {}) {
  const errors = {}
  const data = {}
  const name = String(input.name ?? '').trim()
  if (!name) errors.name = 'El nombre es obligatorio'
  data.name = name.slice(0, 200)

  if (!INCOME_CATEGORIES.includes(input.category)) errors.category = 'Selecciona una categoría'
  data.category = input.category
  data.customCategory = input.category === 'Otra' ? String(input.customCategory ?? '').trim().slice(0, 100) : ''

  const amount = toNum(input.amount)
  if (blank(input.amount) || !Number.isFinite(amount)) errors.amount = 'El importe es obligatorio y debe ser numérico'
  else if (amount < 0) errors.amount = 'El importe no puede ser negativo'
  data.amount = amount

  if (!CURRENCIES.includes(input.currency)) errors.currency = 'Moneda no válida'
  data.currency = input.currency

  if (!FREQUENCIES.some((f) => f.key === input.frequency)) errors.frequency = 'Selecciona una frecuencia'
  data.frequency = input.frequency

  if (!blank(input.startDate) && !isDate(input.startDate)) errors.startDate = 'Fecha no válida'
  data.startDate = blank(input.startDate) ? null : input.startDate

  data.active = input.active !== false && input.active !== 'false'
  data.description = String(input.description ?? '').trim().slice(0, 5000)
  data.notes = String(input.notes ?? '').trim().slice(0, 5000)
  data.linkedItemId = blank(input.linkedItemId) ? null : String(input.linkedItemId)
  return { data, errors }
}

export function validateEntry(input = {}) {
  const errors = {}
  const amount = toNum(input.amount)
  if (blank(input.amount) || !Number.isFinite(amount) || amount < 0) errors.amount = 'Importe no válido'
  if (!isDate(input.date)) errors.date = 'Fecha no válida'
  if (!(input.type in ENTRY_TYPES)) errors.type = 'Tipo no válido'
  if (!CURRENCIES.includes(input.currency)) errors.currency = 'Moneda no válida'
  return {
    data: { amount, date: input.date, type: input.type, currency: input.currency, note: String(input.note ?? '').trim().slice(0, 500) },
    errors,
  }
}

/** Equivalente mensual esperado de una fuente activa y recurrente (0 si es única o inactiva). */
export function monthlyEquivalent(source) {
  if (!source.active) return 0
  const f = FREQUENCIES.find((x) => x.key === source.frequency)
  return f ? source.amount * f.perMonth : 0
}
