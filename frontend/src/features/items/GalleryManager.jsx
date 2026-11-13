import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, ImagePlus, Star, Trash2 } from 'lucide-react'
import { db } from '../../db/index.js'
import { addItemImages, deleteMedia, listMedia, moveMedia, setPrimaryMedia } from '../../db/media.js'
import { describeDbError } from '../../db/errors.js'
import { useSettings, mb } from '../../app/useSettings.js'
import MediaImage from '../../components/MediaImage.jsx'
import { cx, useConfirm, useToast } from '../../components/ui.jsx'

/** Gestión de fotografías de un activo guardado: subir, principal, ordenar y eliminar. */
export default function GalleryManager({ item, compact, onSelect, selectedId }) {
  const photos = useLiveQuery(() => listMedia(db, item.id, 'photo'), [item.id])
  const settings = useSettings()
  const toast = useToast()
  const confirm = useConfirm()
  const input = useRef(null)
  const [busy, setBusy] = useState(false)

  const upload = async (files) => {
    if (!files?.length) return
    setBusy(true)
    try {
      const { added, rejected } = await addItemImages(db, item.id, [...files], { maxBytes: mb(settings.maxImageMB) })
      if (added.length) toast(`${added.length} fotografía(s) guardada(s)`)
      rejected.forEach((r) => toast(r.reason, 'danger'))
    } catch (e) {
      toast(describeDbError(e), 'danger')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (m) => {
    const ok = await confirm({
      title: 'Eliminar fotografía',
      danger: true,
      confirmLabel: 'Eliminar',
      message: <>Se eliminará <strong>{m.name}</strong> de forma definitiva. Las demás fotografías no se modifican.</>,
    })
    if (!ok) return
    try { await deleteMedia(db, m.id); toast('Fotografía eliminada') } catch (e) { toast(describeDbError(e), 'danger') }
  }

  const run = (fn) => fn().catch((e) => toast(describeDbError(e), 'danger'))

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files) }}
    >
      <ul className={cx('grid gap-2', compact ? 'grid-cols-3 sm:grid-cols-5' : 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-6')}>
        {(photos ?? []).map((m, i) => {
          const primary = item.primaryMediaId === m.id
          return (
            <li key={m.id} className={cx('group relative aspect-square overflow-hidden rounded-lg border', selectedId === m.id ? 'border-primary' : 'border-line')}>
              <button type="button" className="size-full" onClick={() => onSelect?.(m.id)} aria-label={`Ver ${m.name}`}>
                <MediaImage mediaId={m.id} alt={m.name} className="size-full" />
              </button>
              {primary && <span className="absolute left-1 top-1 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-on-primary">Principal</span>}
              <div className="absolute inset-x-1 bottom-1 flex justify-between gap-1 rounded-full bg-black/55 p-0.5 opacity-100 backdrop-blur sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                <button type="button" disabled={i === 0} onClick={() => run(() => moveMedia(db, m.id, -1))} className="rounded-full p-1 text-white disabled:opacity-30" aria-label="Mover a la izquierda"><ChevronLeft className="size-3.5" /></button>
                {!primary && <button type="button" onClick={() => run(() => setPrimaryMedia(db, item.id, m.id))} className="rounded-full p-1 text-white" aria-label="Usar como principal"><Star className="size-3.5" /></button>}
                <button type="button" onClick={() => remove(m)} className="rounded-full p-1 text-white" aria-label={`Eliminar ${m.name}`}><Trash2 className="size-3.5" /></button>
                <button type="button" disabled={i === (photos?.length ?? 0) - 1} onClick={() => run(() => moveMedia(db, m.id, 1))} className="rounded-full p-1 text-white disabled:opacity-30" aria-label="Mover a la derecha"><ChevronRight className="size-3.5" /></button>
              </div>
            </li>
          )
        })}
        <li>
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            className="grid aspect-square w-full place-items-center rounded-lg border border-dashed border-line-strong text-muted transition-colors hover:border-primary/60 hover:text-primary"
          >
            <span className="flex flex-col items-center gap-1 text-xs"><ImagePlus className="size-5" />{busy ? 'Guardando…' : 'Añadir'}</span>
          </button>
        </li>
      </ul>
      <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = '' }} />
      {!compact && photos?.length === 0 && <p className="mt-2 text-xs text-muted">Aún no hay fotografías. Arrastra imágenes aquí o pulsa Añadir.</p>}
    </div>
  )
}

