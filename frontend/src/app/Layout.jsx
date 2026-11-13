import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { Menu, X, Gem } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { NAV } from './nav.js'
import { db, onDbEvent } from '../db/index.js'
import { Notice } from '../components/ui.jsx'
import { relativeDays } from '../lib/format.js'

function Brand() {
  return (
    <div className="flex items-center gap-3 px-2">
      <span className="grid size-9 place-items-center rounded-full border border-gold/40 bg-gradient-to-br from-gold/20 to-transparent">
        <Gem className="size-4 text-gold-soft" aria-hidden />
      </span>
      <div className="leading-tight">
        <p className="font-display text-2xl tracking-wide text-text">Odissey</p>
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted">Patrimonio privado</p>
      </div>
    </div>
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
                    `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-300 ${
                      isActive ? 'bg-gold/10 text-gold-soft' : 'text-muted hover:bg-white/[0.03] hover:text-text'
                    }`
                  }
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {label}
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
      {days === null
        ? 'Aún no has creado ninguna copia de seguridad. '
        : `Tu última copia de seguridad tiene ${days} días. `}
      Tus datos solo existen en este navegador. <NavLink to="/ajustes" className="text-gold-soft underline">Crear copia ahora</NavLink>.
    </Notice>
  )
}

export default function Layout() {
  const [open, setOpen] = useState(false)
  const [dbNotice, setDbNotice] = useState(null)
  const { pathname } = useLocation()

  useEffect(() => setOpen(false), [pathname])
  useEffect(
    () =>
      onDbEvent((e) => {
        if (e.type === 'versionchange') setDbNotice('Se abrió una versión más nueva de la aplicación en otra pestaña. Recarga esta página para seguir trabajando.')
        if (e.type === 'integrity' && !e.report.ok) setDbNotice('La comprobación de integridad encontró incidencias. Revísalas en Ajustes → Integridad.')
      }),
    [],
  )

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-8 overflow-y-auto border-r border-line bg-ink-2/60 px-4 py-6 lg:flex">
        <Brand />
        <NavList />
      </aside>

      <header className="glass sticky top-0 z-30 flex items-center justify-between border-x-0 border-t-0 px-4 py-3 lg:hidden">
        <Brand />
        <button onClick={() => setOpen(true)} className="rounded-full p-2 text-text" aria-label="Abrir menú">
          <Menu className="size-5" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col gap-8 overflow-y-auto border-r border-line bg-ink-2 px-4 py-6">
            <div className="flex items-center justify-between">
              <Brand />
              <button onClick={() => setOpen(false)} className="rounded-full p-2 text-muted" aria-label="Cerrar menú">
                <X className="size-5" />
              </button>
            </div>
            <NavList onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 lg:py-12">
        {dbNotice && <Notice tone="warn" className="mb-6">{dbNotice}</Notice>}
        <BackupReminder />
        <Outlet />
      </main>
    </div>
  )
}
