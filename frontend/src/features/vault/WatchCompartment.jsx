import { memo } from 'react'
import { Star } from 'lucide-react'
import WatchItem from './WatchItem.jsx'
import { motionSeed } from './vaultPrefs.js'

/** Compartimento individual: hueco acolchado, foco propio, enrollador y placa grabada. */
function WatchCompartment({ item, index, active, cutoutId, onHover, onSelect, tabIndex }) {
  const seed = motionSeed(item.id)
  const brand = item.fields?.brand
  const name = item.fields?.name || item.fields?.model
  return (
    <article className={active ? 'cell is-active' : 'cell'} style={{ '--i': index, '--winder-dur': `${seed.winder.toFixed(1)}s` }} data-watch-id={item.id}>
      <button
        type="button"
        className="cell-btn"
        tabIndex={tabIndex}
        aria-label={`${item.title}. Ver información`}
        aria-pressed={active}
        onPointerEnter={(e) => e.pointerType === 'mouse' && onHover(item.id)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && onHover(null)}
        onFocus={() => onHover(item.id, { focus: true })}
        onBlur={() => onHover(null, { focus: true })}
        onClick={() => onSelect(item)}
      >
        <span className="cell-light" aria-hidden />
        <span className="cell-pocket">
          <span className="cell-winder" aria-hidden />
          <WatchItem mediaId={cutoutId ?? item.primaryMediaId} cutout={!!cutoutId} alt={item.title} seed={seed} />
          {item.featured && <span className="cell-star" aria-label="Destacado"><Star className="size-3 fill-current" /></span>}
        </span>
        <span className="cell-plate">
          {brand && <b>{brand}</b>}
          {name && <span>{name}</span>}
        </span>
      </button>
    </article>
  )
}

export default memo(WatchCompartment)
