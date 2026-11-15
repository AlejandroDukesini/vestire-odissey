import { memo } from 'react'

// Puerta de la bóveda: un sólido con cara frontal, canto y cara trasera que pivota sobre las
// bisagras (transform-origin en el borde izquierdo). Toda la animación vive en vault.css y se
// activa con las clases de etapa del contenedor; este componente solo describe la geometría.

const BOLTS = [0, 1, 2, 3]

function Bolts({ count = 4 }) {
  return (
    <div className="door-bolts" aria-hidden>
      {BOLTS.slice(0, count).map((b) => (
        <span key={b} className="bolt-slot" style={{ '--b': b }}>
          <span className="bolt seq" />
          <span className="bolt-housing" />
        </span>
      ))}
    </div>
  )
}

function ClassicLock() {
  return (
    <div className="lock lock-classic" aria-hidden>
      <span className="dial-index" />
      <span className="dial-bezel">
        <span className="dial seq">
          <span className="dial-ticks" />
          <span className="dial-numbers">
            {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map((n, i) => (
              <i key={n} style={{ '--a': `${i * 36}deg` }}>{n}</i>
            ))}
          </span>
          <span className="dial-knob" />
        </span>
      </span>
      <span className="wheel seq">
        {[0, 120, 240].map((a) => <span key={a} className="spoke" style={{ '--a': `${a}deg` }}><i /></span>)}
        <span className="wheel-hub" />
      </span>
      <span className="plate">
        <b>ODISSEY</b>
        <small>Colección privada</small>
      </span>
    </div>
  )
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '✱', '0', '#']
const PRESSED = { 7: 0, 2: 1, 10: 2, 5: 3 } // índice de tecla → orden de pulsación

function ModernLock() {
  return (
    <div className="lock lock-modern" aria-hidden>
      <span className="keypad">
        <span className="lcd">
          <span className="lcd-code">{[0, 1, 2, 3].map((p) => <i key={p} className="lcd-dot seq" style={{ '--p': p }} />)}</span>
          <span className="lcd-ok seq">ACCESO</span>
        </span>
        <span className="keys">
          {KEYS.map((k, i) => (
            <i key={k} className={PRESSED[i] !== undefined ? 'key seq is-pressed' : 'key'} style={PRESSED[i] !== undefined ? { '--p': PRESSED[i] } : undefined}>{k}</i>
          ))}
        </span>
        <span className="led seq" />
      </span>
      <span className="lever seq"><i /></span>
    </div>
  )
}

function FuturisticLock() {
  return (
    <div className="lock lock-future" aria-hidden>
      <span className="iris">
        <span className="ring ring-a seq" />
        <span className="ring ring-b seq" />
        <span className="ring ring-c seq" />
        <span className="iris-core seq" />
      </span>
      <span className="future-label seq">
        <i className="scan-text">VERIFICANDO</i>
        <i className="ok-text">ACCESO CONCEDIDO</i>
      </span>
    </div>
  )
}

function CabinetLock() {
  return (
    <div className="lock lock-cabinet" aria-hidden>
      <span className="escutcheon">
        <span className="keyhole" />
        <span className="key seq"><i className="key-bow" /><i className="key-shaft" /></span>
      </span>
    </div>
  )
}

const LOCKS = { classic: ClassicLock, modern: ModernLock, futuristic: FuturisticLock, cabinet: CabinetLock }

function DoorBack({ style }) {
  if (style === 'cabinet') return <div className="door-face door-back"><span className="glass" /></div>
  return (
    <div className="door-face door-back" aria-hidden>
      <span className="mech">
        <span className="mech-bar" style={{ '--y': '22%' }} />
        <span className="mech-bar" style={{ '--y': '50%' }} />
        <span className="mech-bar" style={{ '--y': '78%' }} />
        <span className="mech-rod" />
        <span className="mech-gear" />
      </span>
    </div>
  )
}

function VaultDoor({ style }) {
  const Lock = LOCKS[style] ?? ClassicLock
  return (
    <div className="vault-door seq" aria-hidden>
      <div className="door-face door-front">
        {style === 'cabinet' && <span className="glass" />}
        <span className="door-inset" />
        {style === 'futuristic' && <span className="door-seams"><i /><i /><i /><span className="sweep seq" /></span>}
        <Lock />
        {style !== 'cabinet' && <Bolts />}
      </div>
      <div className="door-edge door-edge-r" />
      <div className="door-edge door-edge-t" />
      <div className="door-edge door-edge-b" />
      <DoorBack style={style} />
    </div>
  )
}

export default memo(VaultDoor)
