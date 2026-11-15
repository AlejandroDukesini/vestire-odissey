import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Palette, Plus, SearchX, Watch } from 'lucide-react'
import { db } from '../../db/index.js'
import { listItems } from '../../db/items.js'
import { KINDS } from '../../domain/kinds.js'
import { SECTIONS } from '../../app/nav.js'
import { prefersReducedMotion } from '../../theme/apply.js'
import { Button, Dialog, IconButton, PageHeader, Skeleton } from '../../components/ui.jsx'
import CollectionToolbar from '../items/CollectionToolbar.jsx'
import { useCollectionQuery } from '../items/useCollectionQuery.js'
import ItemFormDialog from '../items/ItemForm.jsx'
import { useItemActions } from '../items/useItemActions.jsx'
import WatchVault from './WatchVault.jsx'
import VaultInterior from './VaultInterior.jsx'
import WatchDetailPanel from './WatchDetailPanel.jsx'
import VaultStyleSelector, { useVaultPrefs } from './VaultStyleSelector.jsx'
import { useVaultSequence, LAST_STAGE } from './useVaultSequence.js'
import { computeLayout } from './vaultPrefs.js'

const KIND = 'watch'
const def = KINDS[KIND]
const section = SECTIONS.relojes

// Espacio horizontal que no ocupa el interior: márgenes del escenario + marco de la caja.
// El margen extra cubre el marco algo más ancho del mueble expositor.
function interiorWidth(stageWidth, narrow) {
  const stagePad = narrow ? 14 : 48
  const frame = narrow ? 20 : 34
  const inner = narrow ? 10 : 18
  return Math.max(200, stageWidth - 2 * (stagePad + frame + inner))
}

/** Escala de la cerradura según el tamaño real de la puerta (1 reloj = caja pequeña). */
function lockScale(layout, items, narrow) {
  const n = Math.min(items, layout.perPage) || 1
  const rows = Math.ceil(n / layout.cols)
  const cols = Math.min(n, layout.cols)
  const pad = narrow ? 10 : 18
  const w = cols * layout.cell + (cols - 1) * layout.gap + 2 * pad
  const h = rows * (layout.cell + 50) + (rows - 1) * layout.gap + 2 * pad
  return Math.max(0.5, Math.min(1.15, w / 400, h / 360))
}

function useMedia(query) {
  const get = () => globalThis.matchMedia?.(query).matches ?? false
  const [match, setMatch] = useState(get)
  useEffect(() => {
    const mq = globalThis.matchMedia?.(query)
    if (!mq) return
    const on = () => setMatch(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return match
}

function useViewportHeight() {
  const [h, setH] = useState(() => globalThis.innerHeight || 900)
  useEffect(() => {
    let t = 0
    const on = () => { clearTimeout(t); t = setTimeout(() => setH(window.innerHeight), 150) }
    window.addEventListener('resize', on)
    return () => { clearTimeout(t); window.removeEventListener('resize', on) }
  }, [])
  return h
}

/** Escena de la bóveda: separada de la página para montarla solo cuando las preferencias están cargadas. */
function VaultScene({ prefs, items, total, onCreate, onEdit, onClear, styleChangedRef }) {
  const actions = useItemActions()
  const reduced = useMemo(() => prefersReducedMotion(), [])
  const seq = useVaultSequence({ intro: prefs.intro, reduced, sound: prefs.sound, style: prefs.style })
  const wideScreen = useMedia('(min-width: 1280px)')
  const narrow = useMedia('(max-width: 559px)')
  const canHover = useMedia('(hover: hover) and (pointer: fine)')

  const [stageWidth, setStageWidth] = useState(0)
  const [page, setPage] = useState(0)
  const [hoverId, setHoverId] = useState(null)
  const [pinnedId, setPinnedId] = useState(null)
  const leaveTimer = useRef(0)
  const focusAfterPage = useRef(null)

  // Recortes (PNG con transparencia) si el usuario los subió: se prefieren a la foto principal.
  const cutoutRows = useLiveQuery(() => db.media.where('role').equals('cutout').toArray(), [])
  const cutouts = useMemo(() => {
    const m = new Map()
    for (const r of (cutoutRows ?? []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) if (!m.has(r.ownerId)) m.set(r.ownerId, r.id)
    return m
  }, [cutoutRows])

  const viewportH = useViewportHeight()
  const layout = useMemo(() => {
    const l = computeLayout(items.length, { width: interiorWidth(stageWidth || 900, narrow), size: prefs.size })
    // Que la bóveda abierta quepa en pantalla: limita el compartimento por la altura disponible.
    const byHeight = Math.floor((viewportH - (narrow ? 200 : 250)) / l.rows - 62 - l.gap)
    return { ...l, cell: Math.max(narrow ? 120 : 130, Math.min(l.cell, byHeight)) }
  }, [items.length, stageWidth, prefs.size, narrow, viewportH])
  const pages = layout.pages
  const safePage = Math.min(page, pages - 1)
  const pageItems = useMemo(() => items.slice(safePage * layout.perPage, (safePage + 1) * layout.perPage), [items, safePage, layout.perPage])

  // Cambiar el estilo desde el selector vuelve a mostrar la apertura con el nuevo diseño.
  useEffect(() => {
    if (!styleChangedRef.current) return
    styleChangedRef.current = false
    if (prefs.intro !== 'never') seq.play()
  })

  useEffect(() => { if (page !== safePage) setPage(safePage) }, [page, safePage])
  useEffect(() => () => clearTimeout(leaveTimer.current), [])

  // Si el reloj seleccionado desaparece (eliminado o filtrado), se cierra su ficha.
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const shownId = (hoverId && byId.has(hoverId) ? hoverId : null) ?? (pinnedId && byId.has(pinnedId) ? pinnedId : null)
  const shown = shownId ? byId.get(shownId) : null

  const onHover = useCallback((id, { focus } = {}) => {
    if (!focus && !canHover) return
    clearTimeout(leaveTimer.current)
    if (id) setHoverId(id)
    else leaveTimer.current = setTimeout(() => setHoverId(null), 220) // evita parpadeos al cruzar entre compartimentos
  }, [canHover])

  const onSelect = useCallback((item) => setPinnedId(item.id), [])

  const goPage = useCallback((p, focus) => {
    focusAfterPage.current = focus ?? null
    setPage(p)
  }, [])

  useEffect(() => {
    const where = focusAfterPage.current
    if (!where) return
    focusAfterPage.current = null
    const btns = document.querySelectorAll('.vault-tray .cell-btn')
    ;(where === 'last' ? btns[btns.length - 1] : btns[0])?.focus()
  }, [safePage])

  const step = (delta) => {
    if (!shown) return
    const i = items.findIndex((x) => x.id === shown.id)
    const next = items[i + delta]
    if (!next) return
    setHoverId(null)
    setPinnedId(next.id)
    setPage(Math.floor((i + delta) / layout.perPage))
  }
  const index = shown ? items.findIndex((x) => x.id === shown.id) : -1

  const trash = async (item) => {
    if (await actions.trash(item)) { setPinnedId(null); setHoverId(null) }
  }

  const empty = total === 0 ? (
    <div className="flex flex-col items-center gap-3 text-center">
      <Watch className="size-8 opacity-70" aria-hidden />
      <p className="font-display text-2xl">La bóveda está vacía</p>
      <p className="max-w-xs text-sm opacity-75">Registra tu primer reloj y aparecerá aquí, en su propio compartimento.</p>
      <Button variant="gold" onClick={onCreate}><Plus className="size-4" /> Agregar el primero</Button>
    </div>
  ) : (
    <div className="flex flex-col items-center gap-3 text-center">
      <SearchX className="size-8 opacity-70" aria-hidden />
      <p className="font-display text-2xl">Sin coincidencias</p>
      <Button onClick={onClear}>Limpiar búsqueda y filtros</Button>
    </div>
  )

  const panelProps = {
    item: shown,
    items,
    position: shown ? `${index + 1} / ${items.length}` : null,
    onPrev: index > 0 ? () => step(-1) : null,
    onNext: index >= 0 && index < items.length - 1 ? () => step(1) : null,
    onEdit,
    onTrash: trash,
    onFeature: actions.toggleFeatured,
  }

  return (
    <>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <WatchVault
            style={prefs.style}
            size={prefs.size}
            stage={seq.stage}
            instant={seq.instant}
            playing={seq.playing}
            reduced={reduced}
            onSkip={seq.skip}
            onReplay={seq.play}
            onMeasure={setStageWidth}
            lockScale={lockScale(layout, items.length, narrow)}
          >
            <VaultInterior
              items={pageItems}
              layout={layout}
              page={safePage}
              activeId={shownId}
              cutouts={cutouts}
              onHover={onHover}
              onSelect={onSelect}
              onPage={goPage}
              empty={empty}
            />
          </WatchVault>
          {pages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3" role="navigation" aria-label="Bandejas de la bóveda">
              <IconButton label="Bandeja anterior" onClick={() => goPage(safePage - 1)} disabled={safePage === 0}><ChevronLeft className="size-4" /></IconButton>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: pages }, (_, p) => (
                  <button key={p} type="button" onClick={() => goPage(p)} aria-label={`Bandeja ${p + 1}`} aria-current={p === safePage}
                    className={p === safePage ? 'h-1.5 w-6 rounded-full bg-primary transition-all' : 'size-1.5 rounded-full bg-fg/25 transition-all hover:bg-fg/50'} />
                ))}
              </div>
              <span className="text-xs tabular-nums text-muted">Bandeja {safePage + 1} de {pages}</span>
              <IconButton label="Bandeja siguiente" onClick={() => goPage(safePage + 1)} disabled={safePage >= pages - 1}><ChevronRight className="size-4" /></IconButton>
            </div>
          )}
        </div>
        {wideScreen && (
          <div className="sticky top-6">
            <WatchDetailPanel {...panelProps} onClose={pinnedId ? () => { setPinnedId(null); setHoverId(null) } : null} />
          </div>
        )}
      </div>
      {!wideScreen && seq.stage >= LAST_STAGE - 1 && (
        <WatchDetailPanel {...panelProps} item={pinnedId ? byId.get(pinnedId) ?? null : null} variant="sheet" onClose={() => setPinnedId(null)} />
      )}
    </>
  )
}

/**
 * WatchesPage: la colección de relojes presentada como una bóveda privada.
 * Usa los mismos registros y el mismo CRUD que el resto de Odissey (tabla items, kind "watch").
 */
export default function WatchesPage() {
  const items = useLiveQuery(() => listItems(db, KIND), [])
  const { prefs, loaded } = useVaultPrefs()
  const query = useCollectionQuery(items, KIND)
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState(null) // null | 'new' | item
  const [customizing, setCustomizing] = useState(false)
  const styleAtOpen = useRef(null)
  const styleChanged = useRef(false)

  useEffect(() => {
    if (params.get('nuevo') === '1') {
      setEditing('new')
      setParams((p) => { p.delete('nuevo'); return p }, { replace: true })
    }
  }, [params, setParams])

  const openCustomize = () => { styleAtOpen.current = prefs.style; setCustomizing(true) }
  const closeCustomize = () => {
    setCustomizing(false)
    if (styleAtOpen.current && styleAtOpen.current !== prefs.style) styleChanged.current = true
  }

  return (
    <>
      <PageHeader
        eyebrow={section.eyebrow}
        title={section.title}
        actions={
          <>
            <Button onClick={openCustomize}><Palette className="size-4" /> Personalizar bóveda</Button>
            <Button variant="gold" onClick={() => setEditing('new')}><Plus className="size-4" /> Agregar {def.label.toLowerCase()}</Button>
          </>
        }
      >
        {items ? `${items.length} ${items.length === 1 ? def.label.toLowerCase() : def.plural.toLowerCase()} registrados` : 'Cargando…'}
      </PageHeader>

      {items && items.length > 0 && (
        <CollectionToolbar query={query} total={items.length} placeholder="Buscar por marca, modelo, referencia…" className="mb-5" />
      )}

      {!items || !loaded || !query.filtered ? (
        <Skeleton className="h-[560px] w-full" />
      ) : (
        <VaultScene
          prefs={prefs}
          items={query.filtered}
          total={items.length}
          onCreate={() => setEditing('new')}
          onEdit={setEditing}
          onClear={query.clear}
          styleChangedRef={styleChanged}
        />
      )}

      <ItemFormDialog kind={KIND} open={editing !== null} item={editing && editing !== 'new' ? editing : null} onClose={() => setEditing(null)} />
      <Dialog open={customizing} onClose={closeCustomize} title="Personalizar la bóveda" size="xl"
        footer={<Button variant="gold" onClick={closeCustomize}>Listo</Button>}>
        <VaultStyleSelector />
      </Dialog>
    </>
  )
}
