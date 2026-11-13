import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, SearchX, SlidersHorizontal, Star } from 'lucide-react'
import { db } from '../../db/index.js'
import { listItems } from '../../db/items.js'
import { KINDS, fieldDef, itemSubtitle } from '../../domain/kinds.js'
import { SECTIONS } from '../../app/nav.js'
import { Button, EmptyState, LoadingGrid, PageHeader, SearchInput, Tabs, cx } from '../../components/ui.jsx'
import ItemCard from './ItemCard.jsx'
import ItemFormDialog from './ItemForm.jsx'
import { useItemActions } from './useItemActions.jsx'

const PAGE = 24
const SORTS = {
  recent: { label: 'Más recientes', fn: (a, b) => b.createdAt - a.createdAt },
  updated: { label: 'Última edición', fn: (a, b) => b.updatedAt - a.updatedAt },
  oldest: { label: 'Más antiguos', fn: (a, b) => a.createdAt - b.createdAt },
  name: { label: 'Nombre (A-Z)', fn: (a, b) => a.title.localeCompare(b.title, 'es') },
  valueDesc: { label: 'Valor (mayor primero)', fn: (a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity) },
  valueAsc: { label: 'Valor (menor primero)', fn: (a, b) => (a.value ?? Infinity) - (b.value ?? Infinity) },
}

const norm = (s) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

function haystack(item) {
  return norm([item.title, itemSubtitle(item), ...Object.values(item.fields ?? {}).flat()].join(' '))
}

export default function CollectionPage({ sectionKey }) {
  const section = SECTIONS[sectionKey]
  const { type } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = section.tabs.find((t) => t.slug === (type ?? null))
  const kind = tab?.kind
  const def = kind ? KINDS[kind] : null

  const items = useLiveQuery(() => (kind ? listItems(db, kind) : []), [kind])
  const counts = useLiveQuery(
    () => Promise.all(section.tabs.map((t) => db.items.where('kind').equals(t.kind).filter((i) => !i.deletedAt).count())),
    [sectionKey],
  )
  const actions = useItemActions()

  const [q, setQ] = useState('')
  const [filters, setFilters] = useState({})
  const [sort, setSort] = useState('recent')
  const [featuredOnly, setFeaturedOnly] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  const [editing, setEditing] = useState(null) // null | 'new' | item
  const sentinel = useRef(null)

  useEffect(() => { setFilters({}); setQ(''); setLimit(PAGE); setFeaturedOnly(false) }, [kind])
  useEffect(() => {
    if (params.get('nuevo') === '1') {
      setEditing('new')
      setParams((p) => { p.delete('nuevo'); return p }, { replace: true })
    }
  }, [params, setParams])

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

  useEffect(() => {
    const el = sentinel.current
    if (!el || !filtered || filtered.length <= limit) return
    const io = new IntersectionObserver((e) => e[0].isIntersecting && setLimit((l) => l + PAGE), { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [filtered, limit])

  if (!tab) return <Navigate to={`${section.path}/${section.tabs[0].slug}`} replace />

  const activeFilters = Object.values(filters).filter((v) => v !== '').length + (featuredOnly ? 1 : 0)
  const clear = () => { setFilters({}); setQ(''); setFeaturedOnly(false) }

  return (
    <>
      <PageHeader
        eyebrow={section.eyebrow}
        title={section.title}
        actions={
          <Button variant="gold" onClick={() => setEditing('new')}>
            <Plus className="size-4" /> Agregar {def.label.toLowerCase()}
          </Button>
        }
      >
        {items ? `${items.length} ${items.length === 1 ? def.label.toLowerCase() : def.plural.toLowerCase()} registrados` : 'Cargando…'}
      </PageHeader>

      {section.tabs.length > 1 && (
        <Tabs
          className="mb-6 w-fit max-w-full"
          value={tab.slug}
          onChange={(slug) => navigate(`${section.path}/${slug}`)}
          tabs={section.tabs.map((t, i) => ({ value: t.slug, label: KINDS[t.kind].plural, icon: t.icon, count: counts?.[i] }))}
        />
      )}

      {items && items.length > 0 && (
        <div className="mb-6 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchInput value={q} onChange={setQ} placeholder={`Buscar en ${def.plural.toLowerCase()}…`} className="flex-1" aria-label="Buscar" />
            <div className="flex gap-2">
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="field-input w-auto" aria-label="Ordenar">
                {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
              </select>
              <Button onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
                <SlidersHorizontal className="size-4" /> Filtros{activeFilters ? ` (${activeFilters})` : ''}
              </Button>
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
            <p className="text-xs text-muted">{filtered.length} de {items.length} resultados</p>
          )}
        </div>
      )}

      {!items && <LoadingGrid />}
      {items && items.length === 0 && (
        <EmptyState
          icon={tab.icon}
          title={`Aún no hay ${def.plural.toLowerCase()}`}
          action={<Button variant="gold" onClick={() => setEditing('new')}><Plus className="size-4" /> Agregar el primero</Button>}
        >
          Registra tu primer elemento con sus datos y fotografías. Todo se guarda solo en este dispositivo.
        </EmptyState>
      )}
      {items && items.length > 0 && filtered.length === 0 && (
        <EmptyState icon={SearchX} title="Sin resultados" action={<Button onClick={clear}>Limpiar búsqueda y filtros</Button>}>
          Ningún elemento coincide con la búsqueda o los filtros actuales.
        </EmptyState>
      )}
      {filtered && filtered.length > 0 && (
        <>
          <div key={kind} className={cx('stagger grid gap-4', kind === 'house' || kind === 'yacht' || kind === 'physicalBusiness' || kind === 'digitalBusiness' || kind === 'car' || kind === 'motorcycle' ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3' : 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4')}>
            {filtered.slice(0, limit).map((item, i) => (
              <ItemCard
                key={item.id}
                item={item}
                index={i % PAGE}
                aspect={['house', 'yacht', 'physicalBusiness', 'digitalBusiness', 'car', 'motorcycle'].includes(kind) ? 'aspect-[16/10]' : 'aspect-[4/5]'}
                onEdit={setEditing}
                onTrash={actions.trash}
                onFeature={actions.toggleFeatured}
              />
            ))}
          </div>
          {filtered.length > limit && (
            <div ref={sentinel} className="mt-8 flex justify-center">
              <Button onClick={() => setLimit((l) => l + PAGE)}>Cargar más ({filtered.length - limit} restantes)</Button>
            </div>
          )}
        </>
      )}

      <ItemFormDialog
        kind={kind}
        open={editing !== null}
        item={editing && editing !== 'new' ? editing : null}
        onClose={() => setEditing(null)}
      />
    </>
  )
}
