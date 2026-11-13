// Cálculos del dashboard. Funciones puras sobre los registros reales: no hay cifras de demostración.
// Regla: nunca se suman importes de monedas distintas. Todo se agrupa por moneda.
import { ASSET_GROUPS, KIND_KEYS } from './kinds.js'
import { monthlyEquivalent, FREQUENCIES } from './income.js'

export const NO_CURRENCY = '—'

const addTo = (obj, cur, n) => { obj[cur] = (obj[cur] ?? 0) + n; return obj }

export function computeAssetStats(items) {
  const live = items.filter((i) => !i.deletedAt)
  const byKind = Object.fromEntries(KIND_KEYS.map((k) => [k, 0]))
  const valueByCurrency = {}
  let valued = 0
  for (const i of live) {
    byKind[i.kind] = (byKind[i.kind] ?? 0) + 1
    if (Number.isFinite(i.value)) { addTo(valueByCurrency, i.currency || NO_CURRENCY, i.value); valued++ }
  }
  const groups = ASSET_GROUPS.map((g) => {
    const rows = live.filter((i) => g.kinds.includes(i.kind))
    const vbc = {}
    for (const i of rows) if (Number.isFinite(i.value)) addTo(vbc, i.currency || NO_CURRENCY, i.value)
    return { key: g.key, label: g.label, count: rows.length, valueByCurrency: vbc }
  })
  return {
    total: live.length,
    byKind,
    groups,
    valueByCurrency,
    valued,
    unvalued: live.length - valued,
    vehicles: byKind.car + byKind.motorcycle + byKind.yacht,
    properties: byKind.house + byKind.yacht + byKind.car + byKind.motorcycle,
    companies: byKind.physicalBusiness + byKind.digitalBusiness,
  }
}

/** Moneda con mayor peso para mostrar como cifra principal: la elegida en Ajustes si existe. */
export function orderCurrencies(byCurrency, main) {
  return Object.keys(byCurrency).sort((a, b) => (a === main ? -1 : b === main ? 1 : byCurrency[b] - byCurrency[a]))
}

const monthKey = (iso) => iso.slice(0, 7)

export function lastMonths(n, now = new Date()) {
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

export function computeIncomeStats(sources, entries, { now = new Date(), months = 12 } = {}) {
  const live = sources.filter((s) => !s.deletedAt)
  const liveIds = new Set(live.map((s) => s.id))
  const validEntries = entries.filter((e) => liveIds.has(e.sourceId))
  const active = live.filter((s) => s.active)

  const expectedMonthly = {}
  for (const s of active) {
    const m = monthlyEquivalent(s)
    if (m) addTo(expectedMonthly, s.currency, m)
  }

  const byCategory = {}
  for (const s of live) {
    const c = (byCategory[s.category] ??= { category: s.category, count: 0, active: 0, monthlyByCurrency: {} })
    c.count++
    if (s.active) c.active++
    const m = monthlyEquivalent(s)
    if (m) addTo(c.monthlyByCurrency, s.currency, m)
  }

  const byFrequency = Object.fromEntries(FREQUENCIES.map((f) => [f.key, 0]))
  for (const s of active) byFrequency[s.frequency] = (byFrequency[s.frequency] ?? 0) + 1

  const keys = lastMonths(months, now)
  const monthly = keys.map((k) => ({ month: k, received: {}, expected: {} }))
  const idx = Object.fromEntries(keys.map((k, i) => [k, i]))
  const receivedTotal = {}
  const expectedTotal = {}
  for (const e of validEntries) {
    const i = idx[monthKey(e.date)]
    const bucket = e.type === 'received' ? 'received' : 'expected'
    addTo(bucket === 'received' ? receivedTotal : expectedTotal, e.currency, e.amount)
    if (i !== undefined) addTo(monthly[i][bucket], e.currency, e.amount)
  }
  const current = monthly.at(-1)

  return {
    total: live.length,
    active: active.length,
    expectedMonthly,
    byCategory: Object.values(byCategory).sort((a, b) => b.count - a.count),
    byFrequency,
    monthly,
    receivedThisMonth: current.received,
    expectedThisMonth: current.expected,
    receivedTotal,
    expectedTotal,
    recentEntries: [...validEntries].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 6),
  }
}
