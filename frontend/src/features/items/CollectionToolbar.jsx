import { useState } from 'react'
import { SlidersHorizontal, Star } from 'lucide-react'
import { Button, SearchInput } from '../../components/ui.jsx'
import { SORTS } from './useCollectionQuery.js'

/** Barra de búsqueda, orden y filtros de una colección (ver useCollectionQuery). */
export default function CollectionToolbar({ query, total, placeholder, extra, className = 'mb-6' }) {
  const [showFilters, setShowFilters] = useState(false)
  const { q, setQ, sort, setSort, filters, setFilters, featuredOnly, setFeaturedOnly, filterOptions, filtered, activeFilters, clear } = query
  return (
    <div className={`${className} space-y-3`}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <SearchInput value={q} onChange={setQ} placeholder={placeholder} className="flex-1" aria-label="Buscar" />
        <div className="flex flex-wrap gap-2">
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="field-input w-auto" aria-label="Ordenar">
            {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
          <Button onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
            <SlidersHorizontal className="size-4" /> Filtros{activeFilters ? ` (${activeFilters})` : ''}
          </Button>
          {extra}
        </div>
      </div>
      {showFilters && (
        <div className="panel animate-rise grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {filterOptions.map((f) => (
            <label key={f.key} className="block">
              <span className="mb-1 block text-xs text-muted">{f.label}</span>
              <select value={filters[f.key] ?? ''} onChange={(e) => setFilters((s) => ({ ...s, [f.key]: e.target.value }))} className="field-input">
                <option value="">Todos</option>
                {f.values.map((v) => <option key={String(v)} value={String(v)}>{String(v)}</option>)}
              </select>
            </label>
          ))}
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-muted">
            <input type="checkbox" checked={featuredOnly} onChange={(e) => setFeaturedOnly(e.target.checked)} />
            <Star className="size-3.5" /> Solo destacados
          </label>
          {activeFilters > 0 && <Button size="sm" variant="quiet" className="self-end" onClick={clear}>Limpiar filtros</Button>}
        </div>
      )}
      {(q || activeFilters > 0) && filtered && (
        <p className="text-xs text-muted">{filtered.length} de {total} resultados</p>
      )}
    </div>
  )
}
