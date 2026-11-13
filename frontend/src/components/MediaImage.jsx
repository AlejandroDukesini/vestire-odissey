import { useEffect, useRef, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { db } from '../db/index.js'
import { getMediaBlob } from '../db/media.js'
import { cx } from './ui.jsx'

/**
 * Carga un Blob de IndexedDB solo cuando el elemento se acerca a la pantalla y crea una URL de
 * objeto temporal para mostrarlo. La URL se libera al desmontar o al cambiar de imagen.
 * Las URLs nunca se guardan: la persistencia es siempre el Blob en IndexedDB.
 */
export function useMediaUrl(mediaId, variant = 'thumb', { lazy = true } = {}) {
  const [url, setUrl] = useState(null)
  const [state, setState] = useState(mediaId ? 'idle' : 'empty')
  const ref = useRef(null)
  const [visible, setVisible] = useState(!lazy)

  useEffect(() => {
    if (!lazy || visible) return
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect() }
    }, { rootMargin: '300px' })
    io.observe(el)
    return () => io.disconnect()
  }, [lazy, visible])

  useEffect(() => {
    if (!mediaId) { setUrl(null); setState('empty'); return }
    if (!visible) return
    let objectUrl = null
    let cancelled = false
    setState('loading')
    getMediaBlob(db, mediaId, variant).then(
      (blob) => {
        if (cancelled) return
        if (!blob) { setState('missing'); return }
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
        setState('ready')
      },
      () => !cancelled && setState('missing'),
    )
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [mediaId, variant, visible])

  return { url, state, ref }
}

export default function MediaImage({ mediaId, variant = 'thumb', alt = '', className, imgClassName, fit = 'cover', lazy = true, placeholder, onLoad, imgRef }) {
  const { url, state, ref } = useMediaUrl(mediaId, variant, { lazy })
  return (
    <div ref={ref} className={cx('relative overflow-hidden bg-fg/[0.04]', className)}>
      {state === 'ready' && (
        <img
          ref={imgRef}
          src={url}
          alt={alt}
          onLoad={onLoad}
          draggable={false}
          className={cx('animate-fade size-full', fit === 'cover' ? 'object-cover' : 'object-contain', imgClassName)}
        />
      )}
      {(state === 'loading' || state === 'idle') && mediaId && <div className="skeleton absolute inset-0" aria-hidden />}
      {(state === 'empty' || state === 'missing') && (
        <div className="absolute inset-0 grid place-items-center text-muted/70">
          {placeholder ?? <ImageOff className="size-6" aria-label={state === 'missing' ? 'Archivo no disponible' : 'Sin imagen'} />}
        </div>
      )}
    </div>
  )
}
