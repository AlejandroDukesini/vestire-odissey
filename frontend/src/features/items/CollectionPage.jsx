import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, SearchX } from 'lucide-react'
import { db } from '../../db/index.js'
import { listItems } from '../../db/items.js'
import { KINDS } from '../../domain/kinds.js'
import { SECTIONS } from '../../app/nav.js'
import { Button, EmptyState, LoadingGrid, PageHeader, Tabs, cx } from '../../components/ui.jsx'
import CollectionToolbar from './CollectionToolbar.jsx'
import { useCollectionQuery } from './useCollectionQuery.js'
import ItemCard from './ItemCard.jsx'
import ItemFormDialog from './ItemForm.jsx'
import { useItemActions } from './useItemActions.jsx'

const PAGE = 24

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

  const query = useCollectionQuery(items, kind)
  const { filtered, clear } = query
  const [limit, setLimit] = useState(PAGE)
  const [editing, setEditing] = useState(null) // null | 'new' | item
  const sentinel = useRef(null)

  useEffect(() => { setLimit(PAGE) }, [kind])
  useEffect(() => {
    if (params.get('nuevo') === '1') {
      setEditing('new')
      setParams((p) => { p.delete('nuevo'); return p }, { replace: true })
    }
  }, [params, setParams])

  useEffect(() => {
    const el = sentinel.current
    if (!el || !filtered || filtered.length <= limit) return
    const io = new IntersectionObserver((e) => e[0].isIntersecting && setLimit((l) => l + PAGE), { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [filtered, limit])

  if (!tab) return <Navigate to={`${section.path}/${section.tabs[0].slug}`} replace />

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
        <CollectionToolbar query={query} total={items.length} placeholder={`Buscar en ${def.plural.toLowerCase()}…`} />
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
