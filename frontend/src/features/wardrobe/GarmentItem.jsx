import { memo } from 'react'
import { Footprints, Shirt, Star } from 'lucide-react'
import { useMediaUrl } from '../../components/MediaImage.jsx'
import { garmentTypeLabel } from '../../domain/wardrobe.js'

/** Percha de hombros (prendas superiores). */
function ShoulderHanger() {
  return (
    <svg className="hanger" viewBox="0 0 120 40" aria-hidden>
      <path className="hanger-hook" d="M60 16 V10 a6 6 0 1 1 6 -6" />
      <path className="hanger-body" d="M60 16 L8 34 Q4 36 8 37 H112 Q116 36 112 34 Z" />
    </svg>
  )
}

/** Percha de pinzas (pantalones y faldas). */
function ClipHanger() {
  return (
    <svg className="hanger" viewBox="0 0 120 40" aria-hidden>
      <path className="hanger-hook" d="M60 22 V10 a6 6 0 1 1 6 -6" />
      <rect className="hanger-bar" x="10" y="22" width="100" height="5" rx="2.5" />
      <rect className="hanger-clip" x="18" y="25" width="10" height="13" rx="2" />
      <rect className="hanger-clip" x="92" y="25" width="10" height="13" rx="2" />
    </svg>
  )
}

/**
 * Representación de una prenda dentro del armario. Usa la fotografía principal original (miniatura),
 * completa (object-fit: contain) y sin deformar. Las superiores e inferiores cuelgan de una percha;
 * el calzado descansa sobre una peana del estante.
 */
function GarmentItem({ item, zone, index, active, onHover, onSelect }) {
  const { url, state, ref } = useMediaUrl(item.primaryMediaId, 'thumb', { lazy: true })
  const f = item.fields ?? {}
  const meta = [garmentTypeLabel(f), f.size && `Talla ${f.size}`].filter(Boolean).join(' · ')
  const Fallback = zone === 'shoes' ? Footprints : Shirt
  return (
    <article className={active ? 'garment is-active' : 'garment'} data-zone={zone} style={{ '--i': index }} data-garment-id={item.id}>
      <button
        type="button"
        className="garment-btn"
        aria-label={`${item.title}${meta ? `, ${meta}` : ''}. Ver información`}
        aria-pressed={active}
        onPointerEnter={(e) => e.pointerType === 'mouse' && onHover(item.id)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && onHover(null)}
        onFocus={() => onHover(item.id, { focus: true })}
        onBlur={() => onHover(null, { focus: true })}
        onClick={() => onSelect(item)}
      >
        <span className="garment-swing">
          {zone === 'top' && <ShoulderHanger />}
          {zone === 'bottom' && <ClipHanger />}
          <span ref={ref} className="garment-card">
            <LazyPhoto url={url} state={state} alt={item.title} Fallback={Fallback} />
            {item.featured && <span className="garment-star" aria-label="Destacado"><Star className="size-3 fill-current" /></span>}
          </span>
        </span>
        <span className="garment-tag">
          <b>{f.name || item.title}</b>
          {meta && <span>{meta}</span>}
        </span>
      </button>
    </article>
  )
}

function LazyPhoto({ url, state, alt, Fallback }) {
  if (state === 'ready') return <img src={url} alt={alt} draggable={false} decoding="async" className="garment-img" />
  if (state === 'empty' || state === 'missing') {
    return <span className="garment-missing"><Fallback className="size-7" aria-hidden /><span>{state === 'missing' ? 'Archivo no disponible' : 'Sin fotografía'}</span></span>
  }
  return <span className="garment-loading" aria-hidden />
}

export default memo(GarmentItem)
