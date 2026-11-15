import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, ExternalLink, ImageOff, Images, Pencil, Star, Trash2, X } from 'lucide-react'
import { db } from '../../db/index.js'
import { listMedia } from '../../db/media.js'
import { fieldDef } from '../../domain/kinds.js'
import { formatDate, formatMoney } from '../../lib/format.js'
import { itemPath } from '../../app/nav.js'
import MediaImage from '../../components/MediaImage.jsx'
import { Button, IconButton, cx } from '../../components/ui.jsx'
import './showcase.css'

const filled = (v) => v !== undefined && v !== null && v !== ''

function display(kind, key, value, currency) {
  const def = fieldDef(kind, key)
  if (def?.type === 'money') return formatMoney(value, currency)
  if (def?.type === 'date') return formatDate(value)
  return String(value)
}

/**
 * Ficha de un activo dentro de una vitrina (bóveda, armario…). Solo muestra los campos que tienen
 * información; nunca inventa valores. `config` describe qué mostrar para cada categoría:
 *   specKeys   campos de la cuadrícula de detalles (en orden)
 *   moneyKeys  importes destacados
 *   eyebrow / heading / subline (item) → textos de cabecera
 *   pick(item, key) opcional, para presentar un campo de otra forma
 */
function Details({ item, config, onEdit, onTrash, onFeature }) {
  const photos = useLiveQuery(() => listMedia(db, item.id, 'photo'), [item.id])
  const [shown, setShown] = useState(item.primaryMediaId)
  useEffect(() => setShown(item.primaryMediaId), [item.id, item.primaryMediaId])
  const f = item.fields ?? {}
  const value = (k) => config.pick?.(item, k) ?? f[k]
  const specs = config.specKeys.filter((k) => filled(value(k)))
  const money = config.moneyKeys.filter((k) => filled(f[k]))
  const mainId = photos?.some((p) => p.id === shown) ? shown : item.primaryMediaId
  const eyebrow = config.eyebrow?.(item)
  const subline = config.subline?.(item)

  return (
    <div className="wdp-swap space-y-5">
      <div className="wdp-photo relative overflow-hidden rounded-xl">
        <MediaImage key={mainId} mediaId={mainId} variant="original" fit="contain" lazy={false} alt={item.title} className="aspect-square w-full bg-transparent" placeholder={<ImageOff className="size-8" aria-label="Sin fotografía" />} />
        {item.featured && <span className="absolute left-3 top-3 grid size-7 place-items-center rounded-full bg-primary text-on-primary shadow" aria-label="Destacado"><Star className="size-3.5 fill-current" /></span>}
      </div>
      {photos && photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Fotografías adicionales">
          {photos.map((p) => (
            <button key={p.id} type="button" onClick={() => setShown(p.id)} aria-label={`Ver ${p.name}`} aria-pressed={p.id === mainId}
              className={cx('size-14 shrink-0 overflow-hidden rounded-lg border transition-colors', p.id === mainId ? 'border-primary' : 'border-line hover:border-line-strong')}>
              <MediaImage mediaId={p.id} alt="" className="size-full" />
            </button>
          ))}
        </div>
      )}

      <div>
        {eyebrow && <p className="eyebrow text-primary">{eyebrow}</p>}
        <h2 className="mt-1 font-display text-4xl leading-[1.05] text-fg">{config.heading?.(item) || item.title}</h2>
        {subline && <p className="mt-1 text-sm text-muted">{subline}</p>}
      </div>

      {money.length > 0 && (
        <div className="grid grid-cols-2 gap-3 border-y border-line py-4">
          {money.map((k) => (
            <div key={k} className={money.length === 1 ? 'col-span-2' : ''}>
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted">{fieldDef(item.kind, k).label}</p>
              <p className={cx('mt-1 font-display text-2xl', k === 'value' ? 'text-primary' : 'text-fg')}>{display(item.kind, k, f[k], item.currency)}</p>
            </div>
          ))}
        </div>
      )}

      {f.description && <p className="whitespace-pre-line text-sm leading-relaxed text-fg/90">{f.description}</p>}

      {specs.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {specs.map((k) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs text-muted">{config.labels?.[k] ?? fieldDef(item.kind, k)?.label ?? k}</dt>
              <dd className="mt-0.5 break-words text-fg">{display(item.kind, k, value(k), item.currency)}</dd>
            </div>
          ))}
        </dl>
      )}

      {f.notes && (
        <div className="rounded-xl border border-line bg-fg/[0.02] p-3">
          <p className="text-xs text-muted">Observaciones</p>
          <p className="mt-1 whitespace-pre-line text-sm text-fg">{f.notes}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button variant="gold" size="sm" onClick={() => onEdit(item)}><Pencil className="size-3.5" /> Editar</Button>
        <Link to={itemPath(item)} className="inline-flex h-8 items-center gap-2 rounded-full border border-line-strong px-3 text-xs font-medium text-fg transition-colors hover:border-primary/60 hover:text-primary">
          <ExternalLink className="size-3.5" /> Ficha completa
        </Link>
        {photos && photos.length > 0 && (
          <Link to={itemPath(item)} className="inline-flex h-8 items-center gap-2 rounded-full px-2 text-xs text-muted hover:text-fg">
            <Images className="size-3.5" /> {photos.length} foto{photos.length === 1 ? '' : 's'}
          </Link>
        )}
        <span className="flex-1" />
        <IconButton label={item.featured ? 'Quitar destacado' : 'Destacar'} onClick={() => onFeature(item)}>
          <Star className={cx('size-3.5', item.featured && 'fill-current text-primary')} />
        </IconButton>
        <IconButton label="Mover a la papelera" tone="danger" onClick={() => onTrash(item)}><Trash2 className="size-3.5" /></IconButton>
      </div>
    </div>
  )
}

/**
 * Panel de información. En escritorio es una columna lateral fija junto a la vitrina; en tableta
 * y móvil (`variant="sheet"`) es una hoja que se desliza sin tapar toda la colección. Al cambiar
 * de objeto el contenido se sustituye con un fundido breve (no se cierra y reabre).
 */
export default function ItemDetailPanel({ item, config, summary, label, variant = 'side', position, onPrev, onNext, onClose, onEdit, onTrash, onFeature }) {
  const sheet = variant === 'sheet'
  useEffect(() => {
    if (!sheet || !item) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheet, item, onClose])

  if (sheet && !item) return null

  const body = (
    <>
      {item && (
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <IconButton label="Anterior" onClick={onPrev} disabled={!onPrev}><ChevronLeft className="size-4" /></IconButton>
            <IconButton label="Siguiente" onClick={onNext} disabled={!onNext}><ChevronRight className="size-4" /></IconButton>
            {position && <span className="ml-1 text-xs tabular-nums text-muted">{position}</span>}
          </div>
          {onClose && <IconButton label="Cerrar ficha" onClick={onClose}><X className="size-4" /></IconButton>}
        </div>
      )}
      <div key={item?.id ?? 'idle'}>
        {item ? <Details item={item} config={config} onEdit={onEdit} onTrash={onTrash} onFeature={onFeature} /> : <div className="wdp-swap">{summary}</div>}
      </div>
    </>
  )

  if (sheet) {
    return (
      <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={`Ficha de ${item.title}`}>
        <div className="animate-fade absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
        <aside className="wdp wdp-sheet absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-y-auto rounded-t-3xl p-5 sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:max-h-none sm:w-[420px] sm:rounded-none sm:rounded-l-3xl sm:p-6">
          <span className="mx-auto mb-4 block h-1 w-10 rounded-full bg-fg/20 sm:hidden" aria-hidden />
          {body}
        </aside>
      </div>
    )
  }

  return (
    <aside className="wdp wdp-side rounded-[var(--radius-panel)] p-6" aria-live="polite" aria-label={label}>
      {body}
    </aside>
  )
}
