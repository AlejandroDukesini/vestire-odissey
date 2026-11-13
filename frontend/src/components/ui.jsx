import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, Info, Loader2, X, Search } from 'lucide-react'

export const cx = (...c) => c.filter(Boolean).join(' ')

export function Button({ variant = 'ghost', size = 'md', busy, className, children, ...rest }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[transform,background-color,border-color,color,filter,box-shadow] duration-200 ease-lux active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none select-none whitespace-nowrap'
  const sizes = { xs: 'h-7 px-2.5 text-xs', sm: 'h-8 px-3 text-xs', md: 'h-10 px-5 text-sm', lg: 'h-12 px-6 text-sm' }
  const variants = {
    gold: 'bg-primary text-on-primary shadow-[0_10px_30px_-14px_var(--c-primary)] hover:brightness-110 hover:-translate-y-px',
    ghost: 'border border-line-strong text-fg bg-fg/[0.02] hover:border-primary/60 hover:text-primary',
    danger: 'border border-danger/40 text-danger hover:bg-danger/10',
    quiet: 'text-muted hover:text-fg',
  }
  return (
    <button type="button" className={cx(base, sizes[size], variants[variant], className)} disabled={busy || rest.disabled} {...rest}>
      {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

export function IconButton({ label, className, children, tone, ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      data-tip={label}
      className={cx(
        'tooltip grid size-8 place-items-center rounded-full border border-line text-muted transition-colors duration-200 hover:border-primary/60 hover:text-primary disabled:opacity-30',
        tone === 'danger' && 'hover:border-danger/60 hover:text-danger',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Panel({ className, children, as: Tag = 'section', ...rest }) {
  return <Tag className={cx('panel p-5 sm:p-6', className)} {...rest}>{children}</Tag>
}

export function PageHeader({ eyebrow, title, children, actions, back }) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back}
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="font-display text-4xl leading-none text-fg sm:text-5xl">{title}</h1>
        {children && <div className="mt-3 max-w-2xl text-sm text-muted">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

export function Notice({ tone = 'info', title, children, className }) {
  const tones = {
    info: ['border-line-strong bg-fg/[0.03]', Info, 'text-primary'],
    warn: ['border-warn/30 bg-warn/[0.07]', AlertTriangle, 'text-warn'],
    danger: ['border-danger/40 bg-danger/[0.07]', AlertTriangle, 'text-danger'],
    ok: ['border-ok/30 bg-ok/[0.07]', Check, 'text-ok'],
  }
  const [box, Icon, color] = tones[tone]
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cx('flex gap-3 rounded-xl border p-4 text-sm', box, className)}>
      <Icon className={cx('mt-0.5 size-4 shrink-0', color)} aria-hidden />
      <div className="min-w-0">
        {title && <p className="mb-1 font-medium text-fg">{title}</p>}
        <div className="text-muted [&_strong]:text-fg">{children}</div>
      </div>
    </div>
  )
}

export function Field({ label, error, hint, children, htmlFor, className }) {
  return (
    <label className={cx('block', className)} htmlFor={htmlFor}>
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted/80">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  )
}

export function Badge({ children, tone = 'default', className }) {
  const tones = {
    default: 'border-line text-muted',
    gold: 'border-primary/40 text-primary bg-primary/10',
    ok: 'border-ok/40 text-ok bg-ok/10',
    warn: 'border-warn/40 text-warn bg-warn/10',
    danger: 'border-danger/40 text-danger bg-danger/10',
  }
  return <span className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', tones[tone], className)}>{children}</span>
}

export function SearchInput({ value, onChange, placeholder = 'Buscar…', className, inputRef, ...rest }) {
  return (
    <div className={cx('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input ref={inputRef} type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="field-input pl-9" {...rest} />
    </div>
  )
}

export function Tabs({ tabs, value, onChange, className, label = 'Secciones' }) {
  return (
    <div role="tablist" aria-label={label} className={cx('flex gap-1 overflow-x-auto rounded-full border border-line bg-fg/[0.02] p-1', className)}>
      {tabs.map((t) => {
        const active = t.value === value
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cx(
              'relative flex shrink-0 items-center gap-2 rounded-full px-4 py-1.5 text-sm transition-[background-color,color] duration-300 ease-lux',
              active ? 'bg-primary text-on-primary' : 'text-muted hover:text-fg',
            )}
          >
            {t.icon && <t.icon className="size-4" aria-hidden />}
            {t.label}
            {t.count != null && <span className={cx('text-xs', active ? 'opacity-80' : 'text-muted')}>{t.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="panel animate-rise flex flex-col items-center px-6 py-16 text-center">
      {Icon && (
        <span className="mb-5 grid size-14 place-items-center rounded-full border border-primary/30 bg-primary/10">
          <Icon className="size-6 text-primary" aria-hidden />
        </span>
      )}
      <h2 className="font-display text-3xl text-fg">{title}</h2>
      {children && <p className="mt-2 max-w-md text-sm text-muted">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }) {
  return <div className={cx('skeleton rounded-xl', className)} aria-hidden />
}

export function LoadingGrid({ count = 6 }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4" role="status" aria-label="Cargando">
      {Array.from({ length: count }, (_, i) => <Skeleton key={i} className="aspect-[4/5]" />)}
    </div>
  )
}

/** Diálogo modal nativo (<dialog>): accesible, con foco atrapado y cierre con Escape. */
export function Dialog({ open, onClose, title, children, footer, wide, size }) {
  const ref = useRef(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  const widths = { md: 'max-w-lg', lg: 'max-w-3xl', xl: 'max-w-5xl' }
  return (
    <dialog
      ref={ref}
      // Solo cierres iniciados por el usuario: Escape (cancel), clic fuera y botón X.
      // No se escucha el evento nativo 'close' porque también se dispara al cerrar por código.
      onCancel={(e) => { e.preventDefault(); onClose?.() }}
      onClick={(e) => e.target === ref.current && onClose?.()}
      className={cx(
        'overlay m-auto w-[calc(100%-1.5rem)] rounded-2xl p-0 text-fg shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm',
        widths[size ?? (wide ? 'lg' : 'md')],
      )}
    >
      {open && (
        <div className="flex max-h-[88dvh] flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
            <h2 className="font-display text-2xl">{title}</h2>
            <button type="button" onClick={onClose} className="rounded-full p-1 text-muted hover:text-fg" aria-label="Cerrar">
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

  const confirm = useCallback((opts) => new Promise((resolve) => setConfirmState({ ...opts, resolve })), [])
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
          <div className="text-sm text-muted [&_strong]:text-fg">{confirmState?.message}</div>
        </Dialog>
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={cx('glass-strong animate-rise pointer-events-auto max-w-md rounded-xl px-4 py-3 text-sm text-fg shadow-2xl', t.tone === 'danger' && 'text-danger')}>
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
