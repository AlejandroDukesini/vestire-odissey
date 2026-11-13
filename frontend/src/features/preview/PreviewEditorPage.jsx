import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { Crosshair, MousePointer2, Save, ScanEye, Trash2, Undo2 } from 'lucide-react'
import { db } from '../../db/index.js'
import { updateComposition } from '../../db/compositions.js'
import { newId } from '../../db/schema.js'
import { describeDbError } from '../../db/errors.js'
import { KINDS } from '../../domain/kinds.js'
import { itemPath } from '../../app/nav.js'
import { useMediaUrl } from '../../components/MediaImage.jsx'
import MediaImage from '../../components/MediaImage.jsx'
import { Badge, Button, EmptyState, IconButton, Notice, Skeleton, cx, useConfirm, useToast } from '../../components/ui.jsx'
import { BackLink } from '../items/ItemDetailPage.jsx'

const WEARABLE = ['garment', 'accessory', 'watch']
const clamp = (n) => Math.min(1, Math.max(0, n))

/**
 * Editor de composición. Las anclas se guardan en coordenadas normalizadas (0–1) respecto a la foto,
 * y los conectores se recalculan con ResizeObserver: permanecen en su sitio al redimensionar.
 */
export default function PreviewEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const comp = useLiveQuery(async () => (await db.compositions.get(id)) ?? null, [id])
  const allItems = useLiveQuery(() => db.items.where('kind').anyOf(WEARABLE).toArray(), [])
  const { url } = useMediaUrl(comp?.photoMediaId, 'original', { lazy: false })

  const [refs, setRefs] = useState(null)
  const [name, setName] = useState('')
  const [tool, setTool] = useState('select')
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [lines, setLines] = useState([])
  const savedRef = useRef('')

  const workspace = useRef(null)
  const stage = useRef(null)
  const labels = useRef(new Map())
  const drag = useRef(null)

  useEffect(() => {
    if (comp && refs === null) {
      setRefs(comp.refs)
      setName(comp.name)
      savedRef.current = JSON.stringify([comp.name, comp.refs])
    }
  }, [comp, refs])

  const itemsById = useMemo(() => new Map((allItems ?? []).map((i) => [i.id, i])), [allItems])
  const options = useMemo(() => (allItems ?? []).filter((i) => !i.deletedAt), [allItems])
  const dirty = refs !== null && JSON.stringify([name, refs]) !== savedRef.current
  const ordered = useMemo(() => [...(refs ?? [])].sort((a, b) => a.anchor.y - b.anchor.y), [refs])

  // Geometría de los conectores en coordenadas del área de trabajo.
  const measure = useCallback(() => {
    const ws = workspace.current?.getBoundingClientRect()
    const st = stage.current?.getBoundingClientRect()
    if (!ws || !st || !refs) return
    const next = []
    for (const r of refs) {
      const el = labels.current.get(r.id)
      if (!el) continue
      const lb = el.getBoundingClientRect()
      const x1 = st.left - ws.left + r.anchor.x * st.width
      const y1 = st.top - ws.top + r.anchor.y * st.height
      const side = lb.left >= st.right - 4 // panel a la derecha (escritorio) o debajo (móvil)
      const x2 = side ? lb.left - ws.left : lb.left - ws.left + lb.width / 2
      const y2 = side ? lb.top - ws.top + Math.min(28, lb.height / 2) : lb.top - ws.top
      const d = side
        ? `M ${x1} ${y1} C ${x1 + (x2 - x1) * 0.55} ${y1}, ${x2 - (x2 - x1) * 0.35} ${y2}, ${x2} ${y2}`
        : `M ${x1} ${y1} C ${x1} ${y1 + (y2 - y1) * 0.55}, ${x2} ${y2 - (y2 - y1) * 0.45}, ${x2} ${y2}`
      next.push({ id: r.id, d, x1, y1 })
    }
    setLines(next)
  }, [refs])

  useLayoutEffect(() => { measure() }, [measure, ordered, url])
  useEffect(() => {
    if (!workspace.current) return
    const ro = new ResizeObserver(() => measure())
    ro.observe(workspace.current)
    if (stage.current) ro.observe(stage.current)
    window.addEventListener('scroll', measure, { passive: true })
    return () => { ro.disconnect(); window.removeEventListener('scroll', measure) }
  }, [measure, url])

  const pointFromEvent = (e) => {
    const r = stage.current.getBoundingClientRect()
    return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) }
  }

  const onStageClick = (e) => {
    if (tool !== 'add' || drag.current?.moved) return
    const ref = { id: newId(), itemId: null, anchor: pointFromEvent(e), note: '' }
    setRefs((rs) => [...rs, ref])
    setSelected(ref.id)
    setTool('select')
  }

  const startDrag = (e, ref) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id: ref.id, moved: false }
    setSelected(ref.id)
  }
  const onDragMove = (e) => {
    if (!drag.current) return
    drag.current.moved = true
    const p = pointFromEvent(e)
    setRefs((rs) => rs.map((r) => (r.id === drag.current.id ? { ...r, anchor: p } : r)))
  }
  const endDrag = () => { setTimeout(() => { drag.current = null }, 0) }

  const onAnchorKey = (e, ref) => {
    const step = e.shiftKey ? 0.05 : 0.01
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeRef(ref.id); return }
    if (!delta) return
    e.preventDefault()
    setRefs((rs) => rs.map((r) => (r.id === ref.id ? { ...r, anchor: { x: clamp(r.anchor.x + delta[0]), y: clamp(r.anchor.y + delta[1]) } } : r)))
  }

  const updateRef = (rid, patch) => setRefs((rs) => rs.map((r) => (r.id === rid ? { ...r, ...patch } : r)))
  const removeRef = (rid) => { setRefs((rs) => rs.filter((r) => r.id !== rid)); setSelected(null) }

  const save = async () => {
    setSaving(true)
    try {
      const saved = await updateComposition(db, id, { name, refs })
      savedRef.current = JSON.stringify([saved.name, saved.refs])
      setRefs(saved.refs)
      toast('Composición guardada')
    } catch (e) { toast(describeDbError(e), 'danger') } finally { setSaving(false) }
  }
  const revert = async () => {
    if (!(await confirm({ title: 'Descartar cambios', message: 'Se volverá a la última versión guardada.', confirmLabel: 'Descartar', danger: true }))) return
    const [n, r] = JSON.parse(savedRef.current)
    setName(n); setRefs(r); setSelected(null)
  }

  if (comp === undefined || refs === null && comp) return <Skeleton className="h-[70dvh]" />
  if (comp === null) return <EmptyState icon={ScanEye} title="Composición no encontrada" action={<Button onClick={() => navigate('/previsualizaciones')}>Ver composiciones</Button>} />

  return (
    <div>
      <BackLink fallback="/previsualizaciones" label="Volver a previsualizaciones" />
      {comp.deletedAt && <Notice tone="warn" className="mb-4">Esta composición está en la papelera. Puedes restaurarla desde Configuración → Papelera.</Notice>}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre de la composición" className="w-full bg-transparent font-display text-4xl text-fg outline-none focus:border-b focus:border-primary sm:w-auto" />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setTool('select')} variant={tool === 'select' ? 'gold' : 'ghost'} size="sm" aria-pressed={tool === 'select'}><MousePointer2 className="size-3.5" /> Seleccionar</Button>
          <Button onClick={() => setTool('add')} variant={tool === 'add' ? 'gold' : 'ghost'} size="sm" aria-pressed={tool === 'add'}><Crosshair className="size-3.5" /> Añadir referencia</Button>
          {dirty && <Button size="sm" onClick={revert}><Undo2 className="size-3.5" /> Descartar</Button>}
          <Button size="sm" variant="gold" onClick={save} busy={saving} disabled={!dirty}><Save className="size-3.5" /> {dirty ? 'Guardar composición' : 'Guardado'}</Button>
        </div>
      </div>
      {tool === 'add' && <p className="mb-3 text-sm text-primary">Pulsa sobre la fotografía en la zona de la prenda o accesorio.</p>}

      <div ref={workspace} className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="panel flex items-center justify-center p-3">
          {url ? (
            <div
              ref={stage}
              className={cx('relative inline-block select-none', tool === 'add' && 'cursor-crosshair')}
              onClick={onStageClick}
              onPointerMove={onDragMove}
              onPointerUp={endDrag}
            >
              <img src={url} alt={comp.name} draggable={false} onLoad={measure} className="block max-h-[78dvh] w-auto max-w-full rounded-lg" />
              {refs.map((r, i) => (
                <button
                  key={r.id}
                  type="button"
                  aria-label={`Referencia ${i + 1}: ${itemsById.get(r.itemId)?.title ?? 'sin asignar'}. Usa las flechas para moverla.`}
                  onPointerDown={(e) => startDrag(e, r)}
                  onKeyDown={(e) => onAnchorKey(e, r)}
                  onClick={(e) => { e.stopPropagation(); setSelected(r.id) }}
                  className={cx(
                    'absolute grid size-6 -translate-x-1/2 -translate-y-1/2 touch-none place-items-center rounded-full border-2 border-white bg-primary text-[10px] font-bold text-on-primary shadow-lg transition-transform',
                    selected === r.id ? 'scale-125 ring-4 ring-primary/40' : 'hover:scale-110',
                  )}
                  style={{ left: `${r.anchor.x * 100}%`, top: `${r.anchor.y * 100}%` }}
                >
                  {ordered.indexOf(r) + 1}
                </button>
              ))}
            </div>
          ) : <Skeleton className="aspect-[3/4] w-full" />}
        </div>

        <aside className="space-y-3" aria-label="Prendas y accesorios de la composición">
          {refs.length === 0 && (
            <div className="panel p-5 text-sm text-muted">
              Aún no hay referencias. Elige <strong className="text-fg">Añadir referencia</strong> y pulsa sobre la foto.
            </div>
          )}
          {ordered.map((r, i) => {
            const it = r.itemId ? itemsById.get(r.itemId) : null
            const status = r.itemId && !it ? 'deleted' : it?.deletedAt ? 'trashed' : null
            return (
              <div
                key={r.id}
                ref={(el) => (el ? labels.current.set(r.id, el) : labels.current.delete(r.id))}
                onClick={() => setSelected(r.id)}
                className={cx('card relative p-3 transition-[border-color,box-shadow]', selected === r.id && 'border-primary shadow-[0_0_0_1px_var(--c-primary)]')}
              >
                <div className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold text-on-primary">{i + 1}</span>
                  {it && <MediaImage mediaId={it.primaryMediaId} className="size-12 shrink-0 rounded-md" alt="" />}
                  <div className="min-w-0 flex-1">
                    {it ? (
                      <Link to={itemPath(it)} className="block truncate text-sm font-medium text-fg hover:text-primary">{it.title}</Link>
                    ) : (
                      <p className="text-sm text-muted">{status === 'deleted' ? 'Elemento eliminado' : 'Sin asignar'}</p>
                    )}
                    {it && <p className="truncate text-xs text-muted">{KINDS[it.kind].label}{it.fields.color ? ` · ${it.fields.color}` : ''}</p>}
                    {status === 'trashed' && <Badge tone="warn" className="mt-1">En la papelera</Badge>}
                  </div>
                  <IconButton label="Eliminar referencia" tone="danger" onClick={(e) => { e.stopPropagation(); removeRef(r.id) }} className="size-7"><Trash2 className="size-3.5" /></IconButton>
                </div>
                {selected === r.id && (
                  <div className="animate-rise mt-3 space-y-2">
                    <select className="field-input" value={r.itemId ?? ''} onChange={(e) => updateRef(r.id, { itemId: e.target.value || null })} aria-label="Elemento asociado">
                      <option value="">Elegir prenda o accesorio…</option>
                      {['garment', 'accessory', 'watch'].map((k) => (
                        <optgroup key={k} label={KINDS[k].plural}>
                          {options.filter((o) => o.kind === k).map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
                        </optgroup>
                      ))}
                    </select>
                    <input className="field-input" placeholder="Nota (opcional)" value={r.note} onChange={(e) => updateRef(r.id, { note: e.target.value })} />
                    {options.length === 0 && <p className="text-xs text-muted">Registra primero prendas o accesorios en Vestimenta y Accesorios.</p>}
                  </div>
                )}
                {selected !== r.id && r.note && <p className="mt-2 text-xs text-muted">{r.note}</p>}
              </div>
            )
          })}
        </aside>

        <svg data-testid="connectors" className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
          {lines.map((l) => (
            <g key={l.id} className={cx('transition-opacity', selected && selected !== l.id ? 'opacity-40' : 'opacity-100')}>
              <path d={l.d} fill="none" stroke="var(--c-bg)" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
              <path d={l.d} fill="none" stroke="var(--c-primary)" strokeWidth="1.6" strokeLinecap="round" />
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}
