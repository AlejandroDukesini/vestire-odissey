export function formatMoney(value, currency) {
  if (value == null || !Number.isFinite(value)) return '—'
  try {
    return new Intl.NumberFormat('es', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2 }).format(value)
  } catch {
    return `${value.toLocaleString('es')} ${currency ?? ''}`.trim()
  }
}

export function formatDateTime(ts) {
  if (!ts) return '—'
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ts))
}

export function formatDate(isoOrTs) {
  if (!isoOrTs) return '—'
  const d = typeof isoOrTs === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(isoOrTs) ? new Date(`${isoOrTs}T00:00:00`) : new Date(isoOrTs)
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(d)
}

export function relativeDays(ts) {
  if (!ts) return null
  return Math.floor((Date.now() - ts) / 86_400_000)
}
