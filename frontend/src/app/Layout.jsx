import { Component, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { Menu, X, Gem, AlertTriangle } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { NAV } from './nav.js'
import { db, onDbEvent } from '../db/index.js'
import { Button, Notice } from '../components/ui.jsx'
import { relativeDays } from '../lib/format.js'

function Brand() {
  return (
    <NavLink to="/" className="flex items-center gap-3 px-2" aria-label="Odissey, ir al dashboard">
      <span className="grid size-9 place-items-center rounded-full border border-primary/40 bg-primary/10">
        <Gem className="size-4 text-primary" aria-hidden />
      </span>
      <span className="leading-tight">
        <span className="block font-display text-2xl tracking-wide text-fg">Odissey</span>
        <span className="block text-[10px] uppercase tracking-[0.3em] text-muted">Patrimonio privado</span>
      </span>
    </NavLink>
  )
}

function NavList({ onNavigate }) {
  return (
    <nav aria-label="Principal" className="flex flex-col gap-6">
      {NAV.map((g, i) => (
        <div key={g.group ?? `g${i}`}>
          {g.group && <p className="eyebrow mb-2 px-3">{g.group}</p>}
          <ul className="flex flex-col gap-0.5">
            {g.items.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-300 ${
                      isActive ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-fg/[0.04] hover:text-fg'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className={`absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary transition-transform duration-300 ease-lux ${isActive ? 'scale-y-100' : 'scale-y-0'}`} aria-hidden />
                      <Icon className="size-4 shrink-0" aria-hidden />
                      {label}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function BackupReminder() {
  const state = useLiveQuery(async () => {
    const [items, last] = await Promise.all([db.items.count(), db.meta.get('lastBackup')])
    return { items, lastAt: last?.value?.at ?? null }
  }, [])
  if (!state || state.items === 0) return null
  const days = relativeDays(state.lastAt)
  if (days !== null && days < 14) return null
  return (
    <Notice tone="warn" className="mb-6">
      {days === null ? 'Aún no has creado ninguna copia de seguridad. ' : `Tu última copia de seguridad tiene ${days} días. `}
      Tus datos solo existen en este navegador. <NavLink to="/ajustes?tab=datos" className="text-primary underline">Crear copia ahora</NavLink>.
    </Notice>
  )
}

/** Error recuperable de una pantalla: no tumba la aplicación entera ni toca los datos. */
class PageBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }) }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="panel mx-auto max-w-lg p-6 text-center">
        <AlertTriangle className="mx-auto size-6 text-danger" />
        <h1 className="mt-3 font-display text-3xl">Esta sección no se pudo mostrar</h1>
        <p className="mt-2 text-sm text-muted">Tus datos no se han modificado. Detalle: {this.state.error.message}</p>
        <Button className="mt-5" onClick={() => this.setState({ error: null })}>Reintentar</Button>
      </div>
    )
  }
}

export default function Layout() {
  const [open, setOpen] = useState(false)
  const [dbNotice, setDbNotice] = useState(null)
  const { pathname } = useLocation()
  const section = pathname.split('/')[1] || 'dashboard'

  useEffect(() => { setOpen(false); window.scrollTo({ top: 0 }) }, [pathname])
  useEffect(
    () =>
      onDbEvent((e) => {
        if (e.type === 'versionchange') setDbNotice('Se abrió una versión más nueva de la aplicación en otra pestaña. Recarga esta página para seguir trabajando.')
        if (e.type === 'integrity' && !e.report.ok) setDbNotice('La comprobación de integridad encontró incidencias. Revísalas en Configuración → General → Integridad.')
      }),
    [],
  )

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <div className="app-backdrop" />
      <aside className="sticky top-0 hidden h-dvh flex-col gap-8 overflow-y-auto border-r border-line bg-surface/60 px-4 py-6 backdrop-blur-xl lg:flex">
        <Brand />
        <NavList />
      </aside>

      <header className="glass-strong sticky top-0 z-30 flex items-center justify-between border-x-0 border-t-0 px-4 py-3 lg:hidden">
        <Brand />
        <button type="button" onClick={() => setOpen(true)} className="rounded-full p-2 text-fg" aria-label="Abrir menú">
          <Menu className="size-5" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <div className="animate-fade absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="animate-drawer absolute inset-y-0 left-0 flex w-72 flex-col gap-8 overflow-y-auto border-r border-line bg-surface px-4 py-6">
            <div className="flex items-center justify-between">
              <Brand />
              <button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 text-muted" aria-label="Cerrar menú">
                <X className="size-5" />
              </button>
            </div>
            <NavList onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <main className="mx-auto w-full min-w-0 max-w-7xl px-4 py-8 sm:px-8 lg:py-12">
        {dbNotice && <Notice tone="warn" className="mb-6">{dbNotice}</Notice>}
        <BackupReminder />
        <PageBoundary resetKey={pathname}>
          <div key={section === 'ajustes' ? section : pathname} className="animate-page">
            <Outlet />
          </div>
        </PageBoundary>
      </main>
    </div>
  )
}
