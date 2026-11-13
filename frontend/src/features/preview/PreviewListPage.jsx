import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { ImagePlus, Plus, ScanEye, Trash2 } from 'lucide-react'
import { db } from '../../db/index.js'
import { createComposition, listCompositions, trashComposition } from '../../db/compositions.js'
import { ValidationError, describeDbError } from '../../db/errors.js'
import { formatDateTime } from '../../lib/format.js'
import { useSettings, mb } from '../../app/useSettings.js'
import MediaImage from '../../components/MediaImage.jsx'
import { Button, Dialog, EmptyState, Field, IconButton, LoadingGrid, PageHeader, useConfirm, useToast } from '../../components/ui.jsx'

function NewCompositionDialog({ open, onClose }) {
  const settings = useSettings()
  const toast = useToast()
  const navigate = useNavigate()
  const input = useRef(null)
  const [name, setName] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (open) { setName(''); setFile(null); setError(null) } }, [open])
  useEffect(() => {
    if (!file) { setPreview(null); return }
    const u = URL.createObjectURL(file)
    setPreview(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const c = await createComposition(db, { name, file, maxBytes: mb(settings.maxImageMB) })
      onClose()
      navigate(`/previsualizaciones/${c.id}`)
    } catch (err) {
      if (err instanceof ValidationError) setError(err.message)
      else toast(describeDbError(err), 'danger')
    } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Nueva previsualización"
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="gold" type="submit" form="comp-form" busy={busy} disabled={!file}>Crear y editar</Button></>}>
      <form id="comp-form" onSubmit={submit} className="space-y-4">
        <Field label="Nombre"><input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Cena de gala" /></Field>
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">Fotografía con tu combinación *</p>
          <button type="button" onClick={() => input.current?.click()} className="grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-xl border border-dashed border-line-strong text-muted hover:border-primary/60">
            {preview ? <img src={preview} alt="" className="size-full object-contain" /> : <span className="flex flex-col items-center gap-2 text-sm"><ImagePlus className="size-6" /> Seleccionar fotografía</span>}
          </button>
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
          <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = '' }} />
        </div>
      </form>
    </Dialog>
  )
}

export default function PreviewListPage() {
  const comps = useLiveQuery(() => listCompositions(db), [])
  const [params, setParams] = useSearchParams()
  const [creating, setCreating] = useState(false)
  const confirm = useConfirm()
  const toast = useToast()

  useEffect(() => {
    if (params.get('nuevo') === '1') { setCreating(true); setParams((p) => { p.delete('nuevo'); return p }, { replace: true }) }
  }, [params, setParams])

  const trash = async (c) => {
    if (!(await confirm({ title: 'Mover a la papelera', danger: true, confirmLabel: 'Mover a la papelera', message: <>La composición <strong>{c.name}</strong> irá a la papelera con su fotografía. Las prendas y accesorios referenciados no se modifican.</> }))) return
    try { await trashComposition(db, c.id); toast('Composición movida a la papelera') } catch (e) { toast(describeDbError(e), 'danger') }
  }

  return (
    <>
      <PageHeader eyebrow="Guardarropa" title="Previsualizaciones" actions={<Button variant="gold" onClick={() => setCreating(true)}><Plus className="size-4" /> Nueva previsualización</Button>}>
        Sube una fotografía tuya y marca manualmente cada prenda y accesorio con conectores y etiquetas.
      </PageHeader>
      {!comps && <LoadingGrid count={3} />}
      {comps?.length === 0 && (
        <EmptyState icon={ScanEye} title="Aún no hay composiciones" action={<Button variant="gold" onClick={() => setCreating(true)}><Plus className="size-4" /> Crear la primera</Button>}>
          Las referencias se crean a mano: la aplicación no reconoce prendas automáticamente.
        </EmptyState>
      )}
      {comps?.length > 0 && (
        <ul className="stagger grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {comps.map((c, i) => (
            <li key={c.id} className="card interactive group relative overflow-hidden" style={{ '--i': i }}>
              <Link to={`/previsualizaciones/${c.id}`} className="block">
                <MediaImage mediaId={c.photoMediaId} alt={c.name} className="aspect-[3/4] w-full" />
                <div className="p-4">
                  <h3 className="truncate font-display text-xl text-fg">{c.name}</h3>
                  <p className="text-xs text-muted">{c.refs.length} referencia(s) · {formatDateTime(c.updatedAt)}</p>
                </div>
              </Link>
              <IconButton label="Mover a la papelera" tone="danger" onClick={() => trash(c)} className="glass-strong absolute right-3 top-3 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"><Trash2 className="size-3.5" /></IconButton>
            </li>
          ))}
        </ul>
      )}
      <NewCompositionDialog open={creating} onClose={() => setCreating(false)} />
    </>
  )
}
