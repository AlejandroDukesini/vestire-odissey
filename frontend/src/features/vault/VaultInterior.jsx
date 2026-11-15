import { memo, useRef } from 'react'
import WatchCompartment from './WatchCompartment.jsx'

/**
 * Interior de la bóveda: una bandeja con los compartimentos de la página actual.
 * Los compartimentos se generan a partir de los registros reales; nunca hay huecos de relleno
 * (la última fila incompleta se centra). Flechas del teclado: moverse entre relojes.
 */
function VaultInterior({ items, layout, page, activeId, cutouts, onHover, onSelect, onPage, empty }) {
  const tray = useRef(null)

  const onKeyDown = (e) => {
    const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: layout.cols, ArrowUp: -layout.cols }[e.key]
    if (!delta) return
    const buttons = [...(tray.current?.querySelectorAll('.cell-btn') ?? [])]
    const i = buttons.indexOf(document.activeElement)
    if (i < 0) return
    e.preventDefault()
    const j = i + delta
    if (j >= 0 && j < buttons.length) buttons[j].focus()
    else if (j >= buttons.length && page < layout.pages - 1) onPage(page + 1, 'first')
    else if (j < 0 && page > 0) onPage(page - 1, 'last')
  }

  return (
    <div className="vault-opening" style={{ '--cols': layout.cols, '--cell': `${layout.cell}px`, '--gap': `${layout.gap}px` }}>
      <span className="vault-led" aria-hidden />
      <span className="vault-glow" aria-hidden />
      {items.length === 0 ? (
        <div className="vault-empty">{empty}</div>
      ) : (
        <div ref={tray} key={page} className="vault-tray" role="group" aria-label="Relojes de la bandeja" onKeyDown={onKeyDown}>
          {items.map((item, i) => (
            <WatchCompartment
              key={item.id}
              item={item}
              index={i}
              active={item.id === activeId}
              cutoutId={cutouts?.get(item.id)}
              onHover={onHover}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
      <span className="vault-dark seq" aria-hidden />
    </div>
  )
}

export default memo(VaultInterior)
