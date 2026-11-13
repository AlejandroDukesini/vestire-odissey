import { useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Star, X } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/index.js'
import { createItem, updateItem } from '../../db/items.js'
import { ValidationError, describeDbError } from '../../db/errors.js'
import { KINDS, CURRENCIES } from '../../domain/kinds.js'
import { useSettings, mb } from '../../app/useSettings.js'
import { Button, Dialog, Field, Notice, cx, useConfirm, useToast } from '../../components/ui.jsx'
import GalleryManager from './GalleryManager.jsx'

const toFormValue = (def, v) => {
  if (v == null) return ''
  if (def.type === 'urllist') return Array.isArray(v) ? v.join('\n') : String(v)
  return String(v)
}

function FieldInput({ def, value, onChange, error, currency, onCurrency }) {
  const id = `f-${def.key}`
  const common = { id, name: def.key, value, 'aria-invalid': !!error, onChange: (e) => onChange(e.target.value), className: 'field-input' }
  let control
  if (def.type === 'textarea' || def.type === 'urllist') {
    control = <textarea rows={def.type === 'urllist' ? 3 : 3} {...common} placeholder={def.type === 'urllist' ? 'https://…' : ''} />
  } else if (def.type === 'select') {
    control = (
      <select {...common}>
        <option value="">{def.required ? 'Selecciona…' : '—'}</option>
        {def.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  } else if (def.type === 'money') {
    control = (
      <div className="flex gap-2">
        <input {...common} inputMode="decimal" placeholder="0" className="field-input min-w-0 flex-1" />
        <select aria-label="Moneda" value={currency} onChange={(e) => onCurrency(e.target.value)} className="field-input w-24">
          {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
    )
  } else {
    const type = { number: 'text', date: 'date', url: 'url' }[def.type] ?? 'text'
    control = <input type={type} inputMode={def.type === 'number' ? 'decimal' : undefined} {...common} />
  }
  const wide = def.type === 'textarea' || def.type === 'urllist'
  return (
    <Field label={`${def.label}${def.required ? ' *' : ''}`} error={error} htmlFor={id} className={wide ? 'sm:col-span-2' : ''}>
      {control}
    </Field>
  )
}

/** Fotos elegidas antes de crear el activo (aún no guardadas). La primera será la principal. */
function PendingPhotos({ files, setFiles, required, error }) {
  const input = useRef(null)
  const add = (list) => {
    const next = [...list].map((file) => ({ file, url: URL.createObjectURL(file), key: `${file.name}-${file.size}-${Math.random()}` }))
    setFiles((f) => [...f, ...next])
  }
  const remove = (key) => setFiles((f) => {
    const x = f.find((p) => p.key === key)
    if (x) URL.revokeObjectURL(x.url)
    return f.filter((p) => p.key !== key)
  })
  const makePrimary = (key) => setFiles((f) => [f.find((p) => p.key === key), ...f.filter((p) => p.key !== key)])
  return (
    <div className="sm:col-span-2">
      <p className="mb-1.5 text-xs font-medium text-muted">Fotografías{required ? ' *' : ''}</p>
      <div
        className={cx('rounded-xl border border-dashed p-3 transition-colors', error ? 'border-danger/60' : 'border-line-strong')}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); add(e.dataTransfer.files) }}
      >
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {files.map((p, i) => (
            <div key={p.key} className="group relative aspect-square overflow-hidden rounded-lg border border-line">
              <img src={p.url} alt={p.file.name} className="size-full object-cover" />
              {i === 0 && <span className="absolute left-1 top-1 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-on-primary">Principal</span>}
              <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                {i !== 0 ? (
                  <button type="button" onClick={() => makePrimary(p.key)} className="rounded-full bg-black/60 p-1 text-white" aria-label="Usar como principal"><Star className="size-3.5" /></button>
                ) : <span />}
                <button type="button" onClick={() => remove(p.key)} className="rounded-full bg-black/60 p-1 text-white" aria-label={`Quitar ${p.file.name}`}><X className="size-3.5" /></button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => input.current?.click()} className="grid aspect-square place-items-center rounded-lg border border-line text-muted transition-colors hover:border-primary/60 hover:text-primary">
            <span className="flex flex-col items-center gap-1 text-xs"><ImagePlus className="size-5" />Añadir</span>
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">Arrastra imágenes aquí o pulsa Añadir. JPG, PNG, WEBP, GIF o AVIF. Se guardan los originales sin modificar.</p>
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { add(e.target.files); e.target.value = '' }} />
    </div>
  )
}

/**
 * Formulario de alta y edición. Los campos salen del catálogo de cada categoría (domain/kinds.js),
 * por lo que cada tipo tiene su propio formulario y su propia validación.
 */
export default function ItemFormDialog({ kind, item, open, onClose, onSaved }) {
  const def = KINDS[kind]
  const settings = useSettings()
  const toast = useToast()
  const confirm = useConfirm()
  const [values, setValues] = useState({})
  const [currency, setCurrency] = useState(settings.currency)
  const [files, setFiles] = useState([])
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const initial = useRef('')
  const liveItem = useLiveQuery(() => (item ? db.items.get(item.id) : null), [item?.id])

  useEffect(() => {
    if (!open) return
    const v = Object.fromEntries(def.fields.map((f) => [f.key, toFormValue(f, item?.fields?.[f.key])]))
    const cur = item?.currency ?? settings.currency
    setValues(v)
    setCurrency(cur)
    setFiles([])
    setErrors({})
    initial.current = JSON.stringify([v, cur])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id, kind])

  // Libera las previsualizaciones temporales al cerrar el formulario o desmontarlo.
  const filesRef = useRef(files)
  filesRef.current = files
  useEffect(() => {
    if (open) return
    filesRef.current.forEach((f) => URL.revokeObjectURL(f.url))
  }, [open])
  useEffect(() => () => filesRef.current.forEach((f) => URL.revokeObjectURL(f.url)), [])

  const visibleFields = useMemo(() => def.fields.filter((f) => !f.showIf || f.showIf(values)), [def, values])
  const dirty = JSON.stringify([values, currency]) !== initial.current || files.length > 0

  const requestClose = async () => {
    if (busy) return
    if (dirty && !(await confirm({ title: 'Descartar cambios', message: 'Hay cambios sin guardar. ¿Quieres descartarlos?', confirmLabel: 'Descartar', danger: true }))) return
    onClose()
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    // Los campos ocultos (p. ej. "tipo personalizado" si no se eligió "Otra") se vacían a propósito.
    const input = Object.fromEntries(def.fields.map((f) => [f.key, visibleFields.includes(f) ? values[f.key] : '']))
    try {
      if (item) {
        const saved = await updateItem(db, item.id, { ...input, currency })
        toast(`${saved.title} actualizado`)
        onSaved?.(saved)
      } else {
        const { item: created, rejected } = await createItem(db, kind, { ...input, currency }, { files: files.map((f) => f.file), maxBytes: mb(settings.maxImageMB) })
        toast(`${created.title} agregado${rejected.length ? ` · ${rejected.length} archivo(s) no válidos` : ''}`, rejected.length ? 'danger' : 'ok')
        rejected.forEach((r) => toast(r.reason, 'danger'))
        onSaved?.(created)
      }
      onClose()
    } catch (err) {
      if (err instanceof ValidationError) {
        setErrors(err.errors)
        toast(err.errors.photos ?? 'Revisa los campos marcados', 'danger')
      } else toast(describeDbError(err), 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={requestClose}
      size="lg"
      title={item ? `Editar ${def.label.toLowerCase()}` : `Nuevo: ${def.label.toLowerCase()}`}
      footer={
        <>
          <Button onClick={requestClose} disabled={busy}>Cancelar</Button>
          <Button variant="gold" type="submit" form="item-form" busy={busy}>{item ? 'Guardar cambios' : 'Agregar'}</Button>
        </>
      }
    >
      <form id="item-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        {def.requiresPhoto && !item && (
          <Notice className="sm:col-span-2">Para registrar un {def.label.toLowerCase()} es obligatorio subir al menos una fotografía.</Notice>
        )}
        {visibleFields.map((f) => (
          <FieldInput
            key={f.key}
            def={f}
            value={values[f.key] ?? ''}
            error={errors[f.key]}
            onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
            currency={currency}
            onCurrency={setCurrency}
          />
        ))}
        {errors.currency && <p className="text-xs text-danger sm:col-span-2">{errors.currency}</p>}
        {item ? (
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-xs font-medium text-muted">Fotografías (los cambios en la galería se guardan al momento)</p>
            <GalleryManager item={liveItem ?? item} compact />
          </div>
        ) : (
          <PendingPhotos files={files} setFiles={setFiles} required={def.requiresPhoto} error={errors.photos} />
        )}
      </form>
    </Dialog>
  )
}
