import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, Info, Loader2, X } from 'lucide-react'

const cx = (...c) => c.filter(Boolean).join(' ')

export function Button({ variant = 'ghost', size = 'md', busy, className, children, ...rest }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-300 ease-lux disabled:opacity-40 disabled:pointer-events-none select-none'
  const sizes = { sm: 'h-8 px-3 text-xs', md: 'h-10 px-5 text-sm', lg: 'h-12 px-6 text-sm' }
  const variants = {
    gold: 'bg-gradient-to-b from-gold-soft to-gold text-ink shadow-[0_8px_30px_-12px_rgb(201_169_106/0.7)] hover:brightness-110',
    ghost: 'border border-line-strong text-text hover:border-gold/50 hover:text-gold-soft bg-white/[0.02]',
    danger: 'border border-danger/40 text-danger hover:bg-danger/10',
    quiet: 'text-muted hover:text-text',
  }
  return (
    <button className={cx(base, sizes[size], variants[variant], className)} disabled={busy || rest.disabled} {...rest}>
      {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

export function Panel({ className, children, ...rest }) {
  return (
    <section className={cx('rounded-2xl border border-line bg-panel/70 p-5 sm:p-6', className)} {...rest}>
      {children}
    </section>
  )
}

export function PageHeader({ eyebrow, title, children, actions }) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="font-display text-4xl leading-none text-text sm:text-5xl">{title}</h1>
        {children && <p className="mt-3 max-w-2xl text-sm text-muted">{children}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

export function Notice({ tone = 'info', title, children, className }) {
  const tones = {
    info: ['border-line-strong bg-white/[0.03]', Info, 'text-gold-soft'],
    warn: ['border-warn/30 bg-warn/[0.06]', AlertTriangle, 'text-warn'],
    danger: ['border-danger/40 bg-danger/[0.07]', AlertTriangle, 'text-danger'],
    ok: ['border-ok/30 bg-ok/[0.06]', Check, 'text-ok'],
  }
  const [box, Icon, color] = tones[tone]
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cx('flex gap-3 rounded-xl border p-4 text-sm', box, className)}>
      <Icon className={cx('mt-0.5 size-4 shrink-0', color)} aria-hidden />
      <div className="min-w-0">
        {title && <p className="mb-1 font-medium text-text">{title}</p>}
        <div className="text-muted [&_strong]:text-text">{children}</div>
      </div>
    </div>
  )
}

export function Field({ label, error, hint, children, htmlFor }) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted/70">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  )
}

/** Diálogo modal nativo (<dialog>): accesible, con foco atrapado y cierre con Escape. */
export function Dialog({ open, onClose, title, children, footer, wide }) {
  const ref = useRef(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose?.()}
      className={cx(
        'm-auto w-[calc(100%-2rem)] rounded-2xl border border-line-strong bg-panel p-0 text-text backdrop:bg-black/70 backdrop:backdrop-blur-sm',
        wide ? 'max-w-3xl' : 'max-w-lg',
      )}
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <h2 className="font-display text-2xl">{title}</h2>
            <button onClick={onClose} className="rounded-full p-1 text-muted hover:text-text" aria-label="Cerrar">
              <X className="size-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
        </div>
      )}
    </dialog>
  )
}

const ConfirmCtx = createContext(null)
const ToastCtx = createContext(null)

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [confirmState, setConfirmState] = useState(null)

  const toast = useCallback((message, tone = 'ok') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'danger' ? 8000 : 4000)
  }, [])

  const confirm = useCallback(
    (opts) => new Promise((resolve) => setConfirmState({ ...opts, resolve })),
    [],
  )
  const close = (v) => { confirmState?.resolve(v); setConfirmState(null) }

  return (
    <ToastCtx.Provider value={toast}>
      <ConfirmCtx.Provider value={confirm}>
        {children}
        <Dialog
          open={!!confirmState}
          onClose={() => close(false)}
          title={confirmState?.title ?? 'Confirmar'}
          footer={
            <>
              <Button onClick={() => close(false)}>Cancelar</Button>
              <Button variant={confirmState?.danger ? 'danger' : 'gold'} onClick={() => close(true)}>
                {confirmState?.confirmLabel ?? 'Confirmar'}
              </Button>
            </>
          }
        >
          <div className="text-sm text-muted">{confirmState?.message}</div>
        </Dialog>
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={cx('glass pointer-events-auto max-w-md rounded-xl px-4 py-3 text-sm shadow-2xl', t.tone === 'danger' && 'border-danger/40 text-danger')}>
              {t.message}
            </div>
          ))}
        </div>
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)
export const useConfirm = () => useContext(ConfirmCtx)
