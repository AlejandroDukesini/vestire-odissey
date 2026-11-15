import { useEffect, useMemo, useState } from 'react'
import { KINDS, fieldDef, itemSubtitle } from '../../domain/kinds.js'

// Búsqueda, filtros y orden de una colección. Compartido por la cuadrícula general y la bóveda
// de relojes para que ambas vistas trabajen exactamente sobre los mismos registros.

export const SORTS = {
  recent: { label: 'Más recientes', fn: (a, b) => b.createdAt - a.createdAt },
  updated: { label: 'Última edición', fn: (a, b) => b.updatedAt - a.updatedAt },
  oldest: { label: 'Más antiguos', fn: (a, b) => a.createdAt - b.createdAt },
  name: { label: 'Nombre (A-Z)', fn: (a, b) => a.title.localeCompare(b.title, 'es') },
  valueDesc: { label: 'Valor (mayor primero)', fn: (a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity) },
  valueAsc: { label: 'Valor (menor primero)', fn: (a, b) => (a.value ?? Infinity) - (b.value ?? Infinity) },
}

export const norm = (s) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

function haystack(item) {
  return norm([item.title, itemSubtitle(item), ...Object.values(item.fields ?? {}).flat()].join(' '))
}

export function useCollectionQuery(items, kind) {
  const def = kind ? KINDS[kind] : null
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState({})
  const [sort, setSort] = useState('recent')
  const [featuredOnly, setFeaturedOnly] = useState(false)

  useEffect(() => { setFilters({}); setQ(''); setFeaturedOnly(false) }, [kind])

  const filterOptions = useMemo(() => {
    if (!def || !items) return []
    return def.filters.map((key) => {
      const values = [...new Set(items.map((i) => i.fields?.[key]).filter((v) => v !== undefined && v !== null && v !== ''))]
      values.sort((a, b) => (typeof a === 'number' ? b - a : String(a).localeCompare(String(b), 'es')))
      return { key, label: fieldDef(kind, key)?.label ?? key, values }
    }).filter((f) => f.values.length > 0)
  }, [def, items, kind])

  const filtered = useMemo(() => {
    if (!items) return null
    const nq = norm(q.trim())
    return items
      .filter((i) => (!featuredOnly || i.featured))
      .filter((i) => Object.entries(filters).every(([k, v]) => v === '' || String(i.fields?.[k]) === v))
      .filter((i) => !nq || haystack(i).includes(nq))
      .sort(SORTS[sort].fn)
  }, [items, q, filters, sort, featuredOnly])

  const activeFilters = Object.values(filters).filter((v) => v !== '').length + (featuredOnly ? 1 : 0)
  const clear = () => { setFilters({}); setQ(''); setFeaturedOnly(false) }

  return { q, setQ, filters, setFilters, sort, setSort, featuredOnly, setFeaturedOnly, filterOptions, filtered, activeFilters, clear }
}
