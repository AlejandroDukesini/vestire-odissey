import { memo } from 'react'
import { Watch } from 'lucide-react'
import { useMediaUrl } from '../../components/MediaImage.jsx'
import { cx } from '../../components/ui.jsx'

/**
 * Representación visual de un reloj sobre su cojín. Gira la IMAGEN (rotación suave sobre su eje
 * vertical, como en un expositor giratorio); los datos del reloj no se tocan.
 *
 * La fotografía original se muestra completa (object-fit: contain, sin deformar). Sobre el cojín
 * claro se funde en modo multiply, de modo que un fondo blanco de estudio desaparece sin editar
 * el archivo. Si existe un recorte (PNG con transparencia) se usa tal cual.
 */
function WatchItem({ mediaId, cutout, alt, seed }) {
  const { url, state } = useMediaUrl(mediaId, 'thumb', { lazy: false })
  return (
    <span className="watch-zoom">
      <span
        className="watch-turn"
        style={{ '--turn-dur': `${seed.duration.toFixed(2)}s`, '--turn-delay': `${seed.delay.toFixed(2)}s` }}
      >
        <span className="watch-cushion" aria-hidden />
        {state === 'ready' && (
          <img src={url} alt={alt} draggable={false} decoding="async" className={cx('watch-img', cutout && 'is-cutout')} />
        )}
        {(state === 'loading' || state === 'idle') && <span className="watch-loading" aria-hidden />}
        {(state === 'empty' || state === 'missing') && (
          <span className="watch-missing"><Watch className="size-7" aria-hidden /><span>{state === 'missing' ? 'Archivo no disponible' : 'Sin fotografía'}</span></span>
        )}
      </span>
    </span>
  )
}

export default memo(WatchItem)
