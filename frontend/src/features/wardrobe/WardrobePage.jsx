import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { DoorOpen, Plus } from 'lucide-react'
import { db } from '../../db/index.js'
import { listItems } from '../../db/items.js'
import { KINDS } from '../../domain/kinds.js'
import { ZONES, garmentTypeLabel, splitByZone } from '../../domain/wardrobe.js'
import { SECTIONS } from '../../app/nav.js'
import { prefersReducedMotion } from '../../theme/apply.js'
import { formatMoney } from '../../lib/format.js'
import { Button, PageHeader, Skeleton } from '../../components/ui.jsx'
import CollectionToolbar from '../items/CollectionToolbar.jsx'
import { useCollectionQuery } from '../items/useCollectionQuery.js'
import ItemFormDialog from '../items/ItemForm.jsx'
import { useItemActions } from '../items/useItemActions.jsx'
import ItemDetailPanel from '../showcase/ItemDetailPanel.jsx'
import { useCinematicSequence } from '../showcase/useCinematicSequence.js'
import { useMedia } from '../showcase/hooks.js'
import Wardrobe from './Wardrobe.jsx'
import WardrobeShelf from './WardrobeShelf.jsx'
import { useWardrobePrefs } from './wardrobePrefs.jsx'

const KIND = 'garment'
const def = KINDS[KIND]
const section = SECTIONS.vestimenta

/**
 * Secuencia del armario (ms):
 *  0 aparece cerrado y en penumbra · 350 acercamiento · 1300 se liberan los pestillos
 *  · 1500 se abren las puertas · 2200 luz interior y las prendas se organizan estante a estante
 *  · 4300 exploración.
 */
const TIMES = [0, 350, 1300, 1500, 2200, 4300]
const CUES = [['unlatch', 1320], ['door', 1500], ['light', 2200]]

// Ficha de prenda: solo campos con información real (ver showcase/ItemDetailPanel.jsx).
const GARMENT_PANEL = {
  specKeys: ['garmentType', 'brand', 'color', 'size', 'material', 'condition', 'acquiredAt'],
  moneyKeys: ['value'],
  pick: (item, k) => (k === 'garmentType' ? garmentTypeLabel(item.fields) || undefined : undefined),
  eyebrow: (i) => i.fields?.brand,
  heading: (i) => i.fields?.name,
  subline: (i) => [garmentTypeLabel(i.fields), i.fields?.size && `Talla ${i.fields.size}`, i.fields?.color].filter(Boolean).join(' · '),
}

function Summary({ items, zones }) {
  const totals = useMemo(() => {
    const m = new Map()
    for (const i of items) if (i.value != null) m.set(i.currency || 'USD', (m.get(i.currency || 'USD') ?? 0) + i.value)
    return [...m]
  }, [items])
  return (
    <div className="space-y-6">
      <div>
        <span className="mb-4 grid size-12 place-items-center rounded-full border border-primary/30 bg-primary/10">
          <DoorOpen className="size-5 text-primary" aria-hidden />
        </span>
        <p className="eyebrow">Tu guardarropa</p>
        <h2 className="mt-2 font-display text-3xl leading-tight text-fg">Armario personal</h2>
        <p className="mt-2 text-sm text-muted">Pasa el cursor o selecciona una prenda para consultar su ficha.</p>
      </div>
      <dl className="grid grid-cols-3 gap-3 text-center">
        {ZONES.map((z) => (
          <div key={z.key} className="flex flex-col-reverse rounded-xl border border-line bg-fg/[0.02] px-2 py-3">
            <dt className="truncate text-[10px] uppercase tracking-[0.1em] text-muted">{z.short}</dt>
            <dd className="font-display text-3xl text-fg">{zones[z.key].length}</dd>
          </div>
        ))}
      </dl>
      {totals.length > 0 && (
        <div className="border-t border-line pt-5">
          <p className="eyebrow">Valor registrado</p>
          {totals.map(([c, v]) => <p key={c} className="mt-1 font-display text-3xl text-primary">{formatMoney(v, c)}</p>)}
        </div>
      )}
    </div>
  )
}

function WardrobeScene({ prefs, items, onCreate, onEdit }) {
  const actions = useItemActions()
  const reduced = useMemo(() => prefersReducedMotion(), [])
  const seq = useCinematicSequence({ times: TIMES, intro: prefs.intro, reduced, sound: prefs.sound, cues: CUES, sessionKey: 'odissey.wardrobeIntroShown' })
  const wideScreen = useMedia('(min-width: 1280px)')
  const canHover = useMedia('(hover: hover) and (pointer: fine)')

  const [hoverId, setHoverId] = useState(null)
  const [pinnedId, setPinnedId] = useState(null)
  const leaveTimer = useRef(0)
  useEffect(() => () => clearTimeout(leaveTimer.current), [])

  const zones = useMemo(() => splitByZone(items), [items])
  // Orden de navegación anterior/siguiente: superiores → inferiores → calzado.
  const ordered = useMemo(() => [...zones.top, ...zones.bottom, ...zones.shoes], [zones])
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const shownId = (hoverId && byId.has(hoverId) ? hoverId : null) ?? (pinnedId && byId.has(pinnedId) ? pinnedId : null)
  const shown = shownId ? byId.get(shownId) : null
  const index = shown ? ordered.findIndex((x) => x.id === shown.id) : -1

  const onHover = useCallback((id, { focus } = {}) => {
    if (!focus && !canHover) return
    clearTimeout(leaveTimer.current)
    if (id) setHoverId(id)
    else leaveTimer.current = setTimeout(() => setHoverId(null), 220)
  }, [canHover])
  const onSelect = useCallback((item) => setPinnedId(item.id), [])

  const step = (delta) => {
    const next = ordered[index + delta]
    if (!next) return
    setHoverId(null)
    setPinnedId(next.id)
    document.querySelector(`[data-garment-id="${next.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }
  const trash = async (item) => {
    if (await actions.trash(item)) { setPinnedId(null); setHoverId(null) }
  }

  const panelProps = {
    item: shown,
    config: GARMENT_PANEL,
    label: 'Información de la prenda',
    summary: <Summary items={items} zones={zones} />,
    position: shown ? `${index + 1} / ${ordered.length}` : null,
    onPrev: index > 0 ? () => step(-1) : null,
    onNext: index >= 0 && index < ordered.length - 1 ? () => step(1) : null,
    onEdit,
    onTrash: trash,
    onFeature: actions.toggleFeatured,
  }

  return (
    <>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <Wardrobe stage={seq.stage} instant={seq.instant} playing={seq.playing} reduced={reduced} onSkip={seq.skip} onReplay={seq.play}>
            {ZONES.map((z, row) => (
              <WardrobeShelf key={z.key} zone={z} row={row} items={zones[z.key]} activeId={shownId} onHover={onHover} onSelect={onSelect} onCreate={onCreate} />
            ))}
          </Wardrobe>
        </div>
        {wideScreen && (
          <div className="sticky top-6">
            <ItemDetailPanel {...panelProps} onClose={pinnedId ? () => { setPinnedId(null); setHoverId(null) } : null} />
          </div>
        )}
      </div>
      {!wideScreen && seq.stage >= seq.last - 1 && (
        <ItemDetailPanel {...panelProps} item={pinnedId ? byId.get(pinnedId) ?? null : null} variant="sheet" onClose={() => setPinnedId(null)} />
      )}
    </>
  )
}

/**
 * WardrobePage: la vestimenta presentada como un armario personal. Usa los mismos registros y el
 * mismo CRUD que el resto de Odissey (tabla items, kind "garment"); los estantes se derivan del
 * tipo de prenda (domain/wardrobe.js), sin estructuras de datos paralelas.
 */
export default function WardrobePage() {
  const items = useLiveQuery(() => listItems(db, KIND), [])
  const { prefs, loaded } = useWardrobePrefs()
  const query = useCollectionQuery(items, KIND)
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState(null) // null | 'new' | item

  useEffect(() => {
    if (params.get('nuevo') === '1') {
      setEditing('new')
      setParams((p) => { p.delete('nuevo'); return p }, { replace: true })
    }
  }, [params, setParams])

  const count = items?.length ?? 0
  return (
    <>
      <PageHeader
        eyebrow={section.eyebrow}
        title={section.title}
        actions={<Button variant="gold" onClick={() => setEditing('new')}><Plus className="size-4" /> Agregar {def.label.toLowerCase()}</Button>}
      >
        {!items ? 'Cargando…' : count === 0 ? 'Aún no hay prendas en tu armario. Registra la primera y se colgará en su estante.' : `${count} ${count === 1 ? 'prenda registrada' : 'prendas registradas'}`}
      </PageHeader>

      {count > 0 && (
        <CollectionToolbar query={query} total={count} placeholder="Buscar por nombre, marca, color, talla…" className="mb-5" />
      )}

      {!items || !loaded || !query.filtered ? (
        <Skeleton className="h-[640px] w-full" />
      ) : (
        <WardrobeScene prefs={prefs} items={query.filtered} onCreate={() => setEditing('new')} onEdit={setEditing} />
      )}

      <ItemFormDialog kind={KIND} open={editing !== null} item={editing && editing !== 'new' ? editing : null} onClose={() => setEditing(null)} />
    </>
  )
}
