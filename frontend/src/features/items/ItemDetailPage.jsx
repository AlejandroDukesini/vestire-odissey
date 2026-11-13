import { lazy, Suspense, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Box, ExternalLink, Images, Pencil, RotateCcw, ScanEye, Star, Trash2, Upload, Wallet } from 'lucide-react'
import { db } from '../../db/index.js'
import { itemRelations } from '../../db/items.js'
import { deleteMedia, listMedia, setItemModel } from '../../db/media.js'
import { describeDbError } from '../../db/errors.js'
import { KINDS, itemSubtitle } from '../../domain/kinds.js'
import { frequencyLabel } from '../../domain/income.js'
import { formatDate, formatDateTime, formatMoney } from '../../lib/format.js'
import { formatBytes } from '../../lib/files.js'
import { kindListPath } from '../../app/nav.js'
import { useSettings, mb } from '../../app/useSettings.js'
import MediaImage from '../../components/MediaImage.jsx'
import { Badge, Button, Dialog, EmptyState, Notice, Panel, Skeleton, Tabs, useConfirm, useToast } from '../../components/ui.jsx'
import GalleryManager from './GalleryManager.jsx'
import ItemFormDialog from './ItemForm.jsx'
import { useItemActions } from './useItemActions.jsx'

const ModelViewer = lazy(() => import('./ModelViewer.jsx'))

function FieldValue({ def, value, currency }) {
  if (def.type === 'money') return formatMoney(value, currency)
  if (def.type === 'date') return formatDate(value)
  if (def.key === 'mileage') return `${Number(value).toLocaleString('es')} km`
  if (def.type === 'number') return Number(value).toLocaleString('es')
  if (def.type === 'url') {
    return <a href={value} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline">{new URL(value).hostname}<ExternalLink className="size-3" /></a>
  }
  if (def.type === 'urllist') {
    return (
      <ul className="space-y-1">
        {value.map((u) => <li key={u}><a href={u} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">{new URL(u).hostname}<ExternalLink className="size-3" /></a></li>)}
      </ul>
    )
  }
  return String(value)
}

export function BackLink({ fallback, label = 'Volver' }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate(fallback))}
      className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
    >
      <ArrowLeft className="size-4" /> {label}
    </button>
  )
}

function ModelSection({ item }) {
  const settings = useSettings()
  const toast = useToast()
  const confirm = useConfirm()
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const model = useLiveQuery(() => (item.model3dMediaId ? db.media.get(item.model3dMediaId) : null), [item.model3dMediaId])

  const upload = async (file) => {
    if (!file) return
    setBusy(true)
    try { await setItemModel(db, item.id, file, { maxBytes: mb(settings.maxModelMB) }); toast('Modelo 3D incorporado') } catch (e) { toast(e.message || describeDbError(e), 'danger') } finally { setBusy(false) }
  }
  const remove = async () => {
    if (!(await confirm({ title: 'Quitar modelo 3D', danger: true, confirmLabel: 'Eliminar modelo', message: <>Se eliminará el archivo <strong>{model?.name}</strong>. Las fotografías no cambian.</> }))) return
    try { await deleteMedia(db, item.model3dMediaId); toast('Modelo eliminado') } catch (e) { toast(describeDbError(e), 'danger') }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      {model ? (
        <>
          <span className="text-muted">{model.name} · {formatBytes(model.size)}</span>
          <Button size="sm" onClick={() => input.current?.click()} busy={busy}><Upload className="size-3.5" /> Sustituir</Button>
          <Button size="sm" variant="danger" onClick={remove}><Trash2 className="size-3.5" /> Quitar</Button>
        </>
      ) : (
        <>
          <span className="text-muted">Sin modelo 3D. Puedes incorporar un archivo .glb (glTF 2.0) creado externamente.</span>
          <Button size="sm" onClick={() => input.current?.click()} busy={busy}><Box className="size-3.5" /> Incorporar modelo GLB</Button>
        </>
      )}
      <input ref={input} type="file" accept=".glb,model/gltf-binary" className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = '' }} />
    </div>
  )
}

export default function ItemDetailPage() {
  const { id } = useParams()
  const item = useLiveQuery(async () => (await db.items.get(id)) ?? null, [id])
  const photos = useLiveQuery(() => listMedia(db, id, 'photo'), [id])
  const relations = useLiveQuery(() => itemRelations(db, id), [id])
  const actions = useItemActions()
  const navigate = useNavigate()
  const [selected, setSelected] = useState(null)
  const [view, setView] = useState('photos')
  const [editing, setEditing] = useState(false)
  const [lightbox, setLightbox] = useState(false)

  if (item === undefined) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Skeleton className="aspect-[4/3]" />
        <Skeleton className="h-96" />
      </div>
    )
  }
  if (item === null) {
    return <EmptyState icon={Images} title="Elemento no encontrado" action={<Button onClick={() => navigate('/')}>Ir al dashboard</Button>}>Puede que se haya eliminado definitivamente.</EmptyState>
  }

  const def = KINDS[item.kind]
  const listPath = kindListPath(item.kind)
  const shownId = photos?.some((p) => p.id === selected) ? selected : item.primaryMediaId
  const detailFields = def.fields.filter((f) => !['description', 'notes', 'value', 'name'].includes(f.key) && item.fields[f.key] != null && item.fields[f.key] !== '')

  return (
    <div>
      <BackLink fallback={listPath} label={`Volver a ${def.plural.toLowerCase()}`} />
      {item.deletedAt && (
        <Notice tone="warn" title="Este elemento está en la papelera" className="mb-6">
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="gold" onClick={() => actions.restore(item)}><RotateCcw className="size-3.5" /> Restaurar</Button>
            <Button size="sm" variant="danger" onClick={async () => (await actions.purge(item)) && navigate(listPath)}>Eliminar definitivamente</Button>
          </div>
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-4">
          {item.model3dMediaId && (
            <Tabs value={view} onChange={setView} tabs={[{ value: 'photos', label: 'Fotografías', icon: Images }, { value: 'model', label: 'Modelo 3D', icon: Box }]} />
          )}
          <div className="panel animate-rise relative aspect-[4/3] overflow-hidden p-0">
            {view === 'model' && item.model3dMediaId ? (
              <Suspense fallback={<div className="skeleton size-full" />}>
                <ModelViewer key={item.model3dMediaId} mediaId={item.model3dMediaId} />
              </Suspense>
            ) : (
              <button type="button" className="size-full cursor-zoom-in" onClick={() => shownId && setLightbox(true)} aria-label="Ampliar fotografía">
                <MediaImage key={shownId} mediaId={shownId} variant="original" fit="contain" lazy={false} alt={item.title} className="size-full" />
              </button>
            )}
          </div>
          {!item.deletedAt && <GalleryManager item={item} onSelect={(mid) => { setSelected(mid); setView('photos') }} selectedId={shownId} />}
          {!item.deletedAt && (
            <Panel className="p-4 sm:p-4">
              <p className="eyebrow mb-3">Modelo 3D</p>
              <ModelSection item={item} />
            </Panel>
          )}
        </div>

        <div className="space-y-4">
          <Panel className="animate-rise">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{def.label}</Badge>
              {item.featured && <Badge tone="gold"><Star className="size-3 fill-current" /> Destacado</Badge>}
            </div>
            <h1 className="mt-3 font-display text-4xl leading-tight text-fg sm:text-5xl">{item.title}</h1>
            {itemSubtitle(item) && <p className="mt-2 text-sm text-muted">{itemSubtitle(item)}</p>}
            <div className="mt-5 border-t border-line pt-5">
              <p className="eyebrow">Valor registrado</p>
              <p className="mt-1 font-display text-3xl text-primary">{item.value != null ? formatMoney(item.value, item.currency) : 'Sin valor registrado'}</p>
              <p className="mt-1 text-xs text-muted">Valor declarado por ti. No es una valoración de mercado.</p>
            </div>
            {!item.deletedAt && (
              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="gold" onClick={() => setEditing(true)}><Pencil className="size-4" /> Editar</Button>
                <Button onClick={() => actions.toggleFeatured(item)}><Star className={item.featured ? 'size-4 fill-current' : 'size-4'} /> {item.featured ? 'Quitar destacado' : 'Destacar'}</Button>
                <Button variant="danger" onClick={async () => (await actions.trash(item)) && navigate(listPath)}><Trash2 className="size-4" /> Eliminar</Button>
              </div>
            )}
          </Panel>

          <Panel className="animate-rise">
            <h2 className="eyebrow mb-4">Información</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
              {item.fields.name && item.kind !== 'garment' && item.kind !== 'accessory' && item.kind !== 'house' && (
                <div><dt className="text-xs text-muted">Nombre</dt><dd className="mt-0.5 text-fg">{item.fields.name}</dd></div>
              )}
              {detailFields.map((f) => (
                <div key={f.key} className={f.type === 'urllist' ? 'col-span-2' : ''}>
                  <dt className="text-xs text-muted">{f.label}</dt>
                  <dd className="mt-0.5 break-words text-fg"><FieldValue def={f} value={item.fields[f.key]} currency={item.currency} /></dd>
                </div>
              ))}
              <div><dt className="text-xs text-muted">Creado</dt><dd className="mt-0.5 text-fg">{formatDateTime(item.createdAt)}</dd></div>
              <div><dt className="text-xs text-muted">Actualizado</dt><dd className="mt-0.5 text-fg">{formatDateTime(item.updatedAt)}</dd></div>
            </dl>
            {item.fields.description && (
              <div className="mt-5 border-t border-line pt-4"><h3 className="text-xs text-muted">Descripción</h3><p className="mt-1 whitespace-pre-line text-sm text-fg">{item.fields.description}</p></div>
            )}
            {item.fields.notes && (
              <div className="mt-4"><h3 className="text-xs text-muted">Observaciones</h3><p className="mt-1 whitespace-pre-line text-sm text-fg">{item.fields.notes}</p></div>
            )}
          </Panel>

          <Panel className="animate-rise">
            <h2 className="eyebrow mb-3">Relaciones</h2>
            <ul className="space-y-2 text-sm">
              {relations?.compositions.map((c) => (
                <li key={c.id}><Link to={`/previsualizaciones/${c.id}`} className="inline-flex items-center gap-2 text-fg hover:text-primary"><ScanEye className="size-4 text-muted" /> {c.name}</Link></li>
              ))}
              {relations?.incomeSources.map((s) => (
                <li key={s.id}><Link to={`/ingresos/${s.id}`} className="inline-flex items-center gap-2 text-fg hover:text-primary"><Wallet className="size-4 text-muted" /> {s.name} · {formatMoney(s.amount, s.currency)} {frequencyLabel(s.frequency).toLowerCase()}</Link></li>
              ))}
              {relations && relations.compositions.length + relations.incomeSources.length === 0 && <li className="text-muted">Sin composiciones ni fuentes de ingreso vinculadas.</li>}
            </ul>
            {['physicalBusiness', 'digitalBusiness', 'house'].includes(item.kind) && !item.deletedAt && (
              <Button size="sm" className="mt-4" onClick={() => navigate(`/ingresos?nuevo=1&vinculo=${item.id}`)}><Wallet className="size-3.5" /> Vincular fuente de ingreso</Button>
            )}
          </Panel>
        </div>
      </div>

      <ItemFormDialog kind={item.kind} item={item} open={editing} onClose={() => setEditing(false)} />
      <Dialog open={lightbox} onClose={() => setLightbox(false)} title={item.title} size="xl">
        <MediaImage mediaId={shownId} variant="original" fit="contain" lazy={false} alt={item.title} className="h-[70dvh] w-full rounded-xl" />
      </Dialog>
    </div>
  )
}
