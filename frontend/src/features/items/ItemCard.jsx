import { Link } from 'react-router'
import { Pencil, Star, Trash2 } from 'lucide-react'
import MediaImage from '../../components/MediaImage.jsx'
import { IconButton, cx } from '../../components/ui.jsx'
import { itemSubtitle, KINDS } from '../../domain/kinds.js'
import { formatMoney } from '../../lib/format.js'
import { itemPath } from '../../app/nav.js'

export default function ItemCard({ item, index = 0, onEdit, onTrash, onFeature, aspect = 'aspect-[4/5]' }) {
  return (
    <article className="card interactive group relative overflow-hidden" style={{ '--i': index }}>
      <Link to={itemPath(item)} className="block focus-visible:outline-offset-[-2px]">
        <MediaImage mediaId={item.primaryMediaId} alt={item.title} className={cx(aspect, 'w-full')} imgClassName="transition-transform duration-700 ease-lux group-hover:scale-[1.04]" />
        <div className="space-y-1 p-4">
          <h3 className="truncate font-display text-xl leading-tight text-fg">{item.title}</h3>
          <p className="truncate text-xs text-muted">{itemSubtitle(item) || KINDS[item.kind].label}</p>
          {item.value != null && <p className="pt-1 text-sm text-primary">{formatMoney(item.value, item.currency)}</p>}
        </div>
      </Link>
      {item.featured && (
        <span className="absolute left-3 top-3 grid size-7 place-items-center rounded-full bg-primary text-on-primary shadow" aria-label="Destacado">
          <Star className="size-3.5 fill-current" />
        </span>
      )}
      <div className="glass-strong absolute right-3 top-3 flex gap-1 rounded-full p-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:duration-300 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <IconButton label="Editar" onClick={() => onEdit(item)} className="size-7 border-transparent"><Pencil className="size-3.5" /></IconButton>
        <IconButton label={item.featured ? 'Quitar destacado' : 'Destacar'} onClick={() => onFeature(item)} className="size-7 border-transparent">
          <Star className={cx('size-3.5', item.featured && 'fill-current text-primary')} />
        </IconButton>
        <IconButton label="Mover a la papelera" tone="danger" onClick={() => onTrash(item)} className="size-7 border-transparent"><Trash2 className="size-3.5" /></IconButton>
      </div>
    </article>
  )
}
