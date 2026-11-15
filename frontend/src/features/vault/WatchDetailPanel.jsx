import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, ExternalLink, Images, KeyRound, Pencil, Star, Trash2, Watch, X } from 'lucide-react'
import { db } from '../../db/index.js'
import { listMedia } from '../../db/media.js'
import { fieldDef } from '../../domain/kinds.js'
import { formatDate, formatMoney } from '../../lib/format.js'
import { itemPath } from '../../app/nav.js'
import MediaImage from '../../components/MediaImage.jsx'
import { Button, IconButton, cx } from '../../components/ui.jsx'

// Orden de la ficha. Solo se muestran los campos con información; nunca se inventan valores.
const SPEC_KEYS = ['brand', 'model', 'reference', 'movement', 'material', 'strapMaterial', 'color', 'condition', 'audience', 'acquiredAt']
const MONEY_KEYS = ['purchasePrice', 'value']

const filled = (v) => v !== undefined && v !== null && v !== ''

function display(key, value, currency) {
  const def = fieldDef('watch', key)
  if (def?.type === 'money') return formatMoney(value, currency)
  if (def?.type === 'date') return formatDate(value)
  return String(value)
}

function Summary({ items }) {
  const stats = useMemo(() => {
    const byCurrency = new Map()
    for (const i of items) if (i.value != null) byCurrency.set(i.currency || 'USD', (byCurrency.get(i.currency || 'USD') ?? 0) + i.value)
    const brands = new Set(items.map((i) => i.fields?.brand).filter(Boolean))
    return { totals: [...byCurrency], brands: brands.size, featured: items.filter((i) => i.featured).length }
  }, [items])
  return (
    <div className="wdp-swap space-y-6">
      <div>
        <span className="mb-4 grid size-12 place-items-center rounded-full border border-primary/30 bg-primary/10">
          <KeyRound className="size-5 text-primary" aria-hidden />
        </span>
        <p className="eyebrow">Registro de la bóveda</p>
        <h2 className="mt-2 font-display text-3xl leading-tight text-fg">Colección privada</h2>
        <p className="mt-2 text-sm text-muted">Pasa el cursor o selecciona un reloj para consultar su ficha.</p>
      </div>
      <dl className="grid grid-cols-3 gap-3 text-center">
        {[[items.length, items.length === 1 ? 'Reloj' : 'Relojes'], [stats.brands, stats.brands === 1 ? 'Marca' : 'Marcas'], [stats.featured, 'Destacados']].map(([n, l]) => (
          <div key={l} className="flex flex-col-reverse rounded-xl border border-line bg-fg/[0.02] px-2 py-3">
            <dt className="truncate text-[10px] uppercase tracking-[0.1em] text-muted">{l}</dt>
            <dd className="font-display text-3xl text-fg">{n}</dd>
          </div>
        ))}
      </dl>
      {stats.totals.length > 0 && (
        <div className="border-t border-line pt-5">
          <p className="eyebrow">Valor estimado registrado</p>
          {stats.totals.map(([c, v]) => <p key={c} className="mt-1 font-display text-3xl text-primary">{formatMoney(v, c)}</p>)}
        </div>
      )}
    </div>
  )
}

function Details({ item, onEdit, onTrash, onFeature }) {
  const photos = useLiveQuery(() => listMedia(db, item.id, 'photo'), [item.id])
  const [shown, setShown] = useState(item.primaryMediaId)
  useEffect(() => setShown(item.primaryMediaId), [item.id, item.primaryMediaId])
  const f = item.fields ?? {}
  const specs = SPEC_KEYS.filter((k) => filled(f[k]))
  const money = MONEY_KEYS.filter((k) => filled(f[k]))
  const mainId = photos?.some((p) => p.id === shown) ? shown : item.primaryMediaId

  return (
    <div className="wdp-swap space-y-5">
      <div className="wdp-photo relative overflow-hidden rounded-xl">
        <MediaImage key={mainId} mediaId={mainId} variant="original" fit="contain" lazy={false} alt={item.title} className="aspect-square w-full bg-transparent" placeholder={<Watch className="size-8" aria-label="Sin fotografía" />} />
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
        {f.brand && <p className="eyebrow text-primary">{f.brand}</p>}
        <h2 className="mt-1 font-display text-4xl leading-[1.05] text-fg">{f.name || item.title}</h2>
        {(f.model || f.reference) && <p className="mt-1 text-sm text-muted">{[f.model, f.reference && `Ref. ${f.reference}`].filter(Boolean).join(' · ')}</p>}
      </div>

      {money.length > 0 && (
        <div className="grid grid-cols-2 gap-3 border-y border-line py-4">
          {money.map((k) => (
            <div key={k} className={money.length === 1 ? 'col-span-2' : ''}>
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted">{fieldDef('watch', k).label}</p>
              <p className={cx('mt-1 font-display text-2xl', k === 'value' ? 'text-primary' : 'text-fg')}>{display(k, f[k], item.currency)}</p>
            </div>
          ))}
        </div>
      )}

      {f.description && <p className="whitespace-pre-line text-sm leading-relaxed text-fg/90">{f.description}</p>}

      {specs.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {specs.map((k) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs text-muted">{fieldDef('watch', k).label}</dt>
              <dd className="mt-0.5 break-words text-fg">{display(k, f[k], item.currency)}</dd>
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
 * Panel de información del reloj. En escritorio es una columna lateral fija junto a la bóveda;
 * en tableta y móvil (`variant="sheet"`) es una hoja que se desliza sin tapar toda la colección.
 * Al cambiar de reloj el contenido se sustituye con un fundido breve (no se cierra y reabre).
 */
export default function WatchDetailPanel({ item, items, variant = 'side', position, onPrev, onNext, onClose, onEdit, onTrash, onFeature }) {
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
            <IconButton label="Reloj anterior" onClick={onPrev} disabled={!onPrev}><ChevronLeft className="size-4" /></IconButton>
            <IconButton label="Reloj siguiente" onClick={onNext} disabled={!onNext}><ChevronRight className="size-4" /></IconButton>
            {position && <span className="ml-1 text-xs tabular-nums text-muted">{position}</span>}
          </div>
          {onClose && <IconButton label="Cerrar ficha" onClick={onClose}><X className="size-4" /></IconButton>}
        </div>
      )}
      <div key={item?.id ?? 'idle'}>
        {item ? <Details item={item} onEdit={onEdit} onTrash={onTrash} onFeature={onFeature} /> : <Summary items={items ?? []} />}
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
    <aside className="wdp wdp-side rounded-[var(--radius-panel)] p-6" aria-live="polite" aria-label="Información del reloj">
      {body}
    </aside>
  )
}
