import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { garmentTypeLabel } from '../../domain/wardrobe.js'
import { cx } from '../../components/ui.jsx'
import GarmentItem from './GarmentItem.jsx'

/**
 * Un estante del armario: placa con el nombre y el total, indicadores de categoría (filtran solo
 * este estante), barra o balda, y una fila horizontal desplazable con flechas, rueda, arrastre
 * táctil y teclado. Si no hay prendas muestra un estado vacío integrado en el mueble.
 */
function WardrobeShelf({ zone, row, items, activeId, onHover, onSelect, onCreate }) {
  const track = useRef(null)
  const [type, setType] = useState('')
  const [edges, setEdges] = useState({ left: false, right: false })

  const types = useMemo(() => {
    const m = new Map()
    for (const i of items) { const t = garmentTypeLabel(i.fields); if (t) m.set(t, (m.get(t) ?? 0) + 1) }
    return [...m]
  }, [items])
  const visible = useMemo(() => (type ? items.filter((i) => garmentTypeLabel(i.fields) === type) : items), [items, type])
  useEffect(() => { if (type && !types.some(([t]) => t === type)) setType('') }, [types, type])

  const measure = useCallback(() => {
    const el = track.current
    if (!el) return
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
  }, [])

  useEffect(() => {
    const el = track.current
    if (!el) return
    measure()
    el.addEventListener('scroll', measure, { passive: true })
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el)
    return () => { el.removeEventListener('scroll', measure); ro?.disconnect() }
  }, [measure, visible.length])

  const scroll = (dir) => {
    const el = track.current
    if (el) el.scrollBy({ left: dir * Math.max(200, el.clientWidth * 0.8), behavior: 'smooth' })
  }

  const onKeyDown = (e) => {
    const delta = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
    if (!delta) return
    const btns = [...(track.current?.querySelectorAll('.garment-btn') ?? [])]
    const i = btns.indexOf(document.activeElement)
    if (i < 0) return
    e.preventDefault()
    btns[Math.min(btns.length - 1, Math.max(0, i + delta))]?.focus()
  }

  return (
    <section className="shelf" data-zone={zone.key} style={{ '--row': row }} aria-label={zone.label}>
      <header className="shelf-head">
        <p className="shelf-plaque"><b>{zone.label}</b><span>{items.length}</span></p>
        {types.length > 1 && (
          <div className="shelf-chips" role="group" aria-label={`Categorías de ${zone.short.toLowerCase()}`}>
            <button type="button" className={cx('chip', !type && 'is-on')} aria-pressed={!type} onClick={() => setType('')}>Todas</button>
            {types.map(([t, n]) => (
              <button key={t} type="button" className={cx('chip', type === t && 'is-on')} aria-pressed={type === t} onClick={() => setType(type === t ? '' : t)}>
                {t} <span>{n}</span>
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="shelf-body">
        {zone.key !== 'shoes' && <span className="shelf-rail" aria-hidden />}
        {items.length === 0 ? (
          <div className="shelf-empty">
            <span className="shelf-empty-ghost" aria-hidden />
            <p>{zone.empty}</p>
            <button type="button" className="chip is-on" onClick={onCreate}><Plus className="size-3" /> Agregar prenda</button>
          </div>
        ) : (
          <>
            <button type="button" className={cx('shelf-arrow is-left', edges.left && 'is-shown')} onClick={() => scroll(-1)} aria-label={`Desplazar ${zone.short.toLowerCase()} a la izquierda`} tabIndex={edges.left ? 0 : -1}>
              <ChevronLeft className="size-4" />
            </button>
            <div ref={track} className={cx('shelf-track', edges.left && 'fade-l', edges.right && 'fade-r')} role="group" aria-label={`${zone.label}: ${visible.length}`} onKeyDown={onKeyDown}>
              {visible.map((item, i) => (
                <GarmentItem key={item.id} item={item} zone={zone.key} index={i} active={item.id === activeId} onHover={onHover} onSelect={onSelect} />
              ))}
            </div>
            <button type="button" className={cx('shelf-arrow is-right', edges.right && 'is-shown')} onClick={() => scroll(1)} aria-label={`Desplazar ${zone.short.toLowerCase()} a la derecha`} tabIndex={edges.right ? 0 : -1}>
              <ChevronRight className="size-4" />
            </button>
          </>
        )}
      </div>
      <span className="shelf-board" aria-hidden><i className="shelf-led" /></span>
    </section>
  )
}

export default memo(WardrobeShelf)
