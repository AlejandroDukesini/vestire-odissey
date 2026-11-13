import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil, Plus, SearchX, Trash2, Wallet } from 'lucide-react'
import { db } from '../../db/index.js'
import { listSources, trashSource } from '../../db/income.js'
import { describeDbError } from '../../db/errors.js'
import { FREQUENCIES, INCOME_CATEGORIES, frequencyLabel, monthlyEquivalent } from '../../domain/income.js'
import { formatMoney } from '../../lib/format.js'
import { Badge, Button, EmptyState, IconButton, LoadingGrid, PageHeader, SearchInput, Tabs, useConfirm, useToast } from '../../components/ui.jsx'
import IncomeFormDialog from './IncomeForm.jsx'

const norm = (s) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export function useTrashSource() {
  const confirm = useConfirm()
  const toast = useToast()
  return async (s) => {
    const entries = await db.incomeEntries.where('sourceId').equals(s.id).count()
    const ok = await confirm({
      title: 'Mover a la papelera', danger: true, confirmLabel: 'Mover a la papelera',
      message: <>Vas a retirar la fuente <strong>{s.name}</strong> y dejará de contar en el dashboard. Se conservan sus {entries} ingreso(s) registrados; podrás restaurarla desde Configuración → Papelera.</>,
    })
    if (!ok) return false
    try { await trashSource(db, s.id); toast('Fuente movida a la papelera'); return true } catch (e) { toast(describeDbError(e), 'danger'); return false }
  }
}

export default function IncomePage() {
  const sources = useLiveQuery(() => listSources(db), [])
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState('active')
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [frequency, setFrequency] = useState('')
  const [sort, setSort] = useState('name')
  const [editing, setEditing] = useState(null)
  const [linkTo, setLinkTo] = useState(null)
  const trash = useTrashSource()

  useEffect(() => {
    if (params.get('nuevo') !== '1') return
    const link = params.get('vinculo')
    ;(async () => {
      setLinkTo(link ? (await db.items.get(link)) ?? null : null)
      setEditing('new')
    })()
    setParams((p) => { p.delete('nuevo'); p.delete('vinculo'); return p }, { replace: true })
  }, [params, setParams])

  const filtered = useMemo(() => {
    if (!sources) return null
    const nq = norm(q.trim())
    const rows = sources
      .filter((s) => status === 'all' || (status === 'active' ? s.active : !s.active))
      .filter((s) => !category || s.category === category)
      .filter((s) => !frequency || s.frequency === frequency)
      .filter((s) => !nq || norm(`${s.name} ${s.category} ${s.customCategory} ${s.description}`).includes(nq))
    const sorts = {
      name: (a, b) => a.name.localeCompare(b.name, 'es'),
      amount: (a, b) => b.amount - a.amount,
      recent: (a, b) => b.createdAt - a.createdAt,
    }
    return rows.sort(sorts[sort])
  }, [sources, status, q, category, frequency, sort])

  const counts = sources && { active: sources.filter((s) => s.active).length, inactive: sources.filter((s) => !s.active).length, all: sources.length }

  return (
    <>
      <PageHeader
        eyebrow="Finanzas"
        title="Fuentes de ingresos"
        actions={<Button variant="gold" onClick={() => { setLinkTo(null); setEditing('new') }}><Plus className="size-4" /> Agregar fuente</Button>}
      >
        Documenta de dónde provienen tus ingresos y registra manualmente lo esperado y lo recibido. Sin conexiones bancarias.
      </PageHeader>

      {sources && sources.length > 0 && (
        <div className="mb-6 space-y-3">
          <Tabs value={status} onChange={setStatus} className="w-fit max-w-full" tabs={[
            { value: 'active', label: 'Activas', count: counts.active },
            { value: 'inactive', label: 'Inactivas', count: counts.inactive },
            { value: 'all', label: 'Todas', count: counts.all },
          ]} />
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
            <SearchInput value={q} onChange={setQ} placeholder="Buscar fuentes…" aria-label="Buscar fuentes" />
            <select className="field-input" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Categoría">
              <option value="">Todas las categorías</option>
              {INCOME_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select className="field-input" value={frequency} onChange={(e) => setFrequency(e.target.value)} aria-label="Frecuencia">
              <option value="">Todas las frecuencias</option>
              {FREQUENCIES.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
            <select className="field-input" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Ordenar">
              <option value="name">Nombre</option><option value="amount">Importe</option><option value="recent">Más recientes</option>
            </select>
          </div>
        </div>
      )}

      {!sources && <LoadingGrid count={3} />}
      {sources?.length === 0 && (
        <EmptyState icon={Wallet} title="Aún no hay fuentes de ingreso" action={<Button variant="gold" onClick={() => setEditing('new')}><Plus className="size-4" /> Agregar la primera</Button>}>
          Salarios, empresas, negocios digitales, alquileres, inversiones o actividades independientes.
        </EmptyState>
      )}
      {sources?.length > 0 && filtered.length === 0 && <EmptyState icon={SearchX} title="Sin resultados">Ninguna fuente coincide con los filtros.</EmptyState>}
      {filtered?.length > 0 && (
        <ul className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s, i) => {
            const monthly = monthlyEquivalent(s)
            return (
              <li key={s.id} className="card interactive relative p-5" style={{ '--i': i }}>
                <Link to={`/ingresos/${s.id}`} className="block">
                  <div className="flex items-center gap-2">
                    <Badge tone={s.active ? 'ok' : 'default'}>{s.active ? 'Activa' : 'Inactiva'}</Badge>
                    <Badge>{s.category === 'Otra' && s.customCategory ? s.customCategory : s.category}</Badge>
                  </div>
                  <h3 className="mt-3 truncate pr-16 font-display text-2xl text-fg">{s.name}</h3>
                  <p className="mt-1 text-lg text-primary">{formatMoney(s.amount, s.currency)} <span className="text-sm text-muted">· {frequencyLabel(s.frequency).toLowerCase()}</span></p>
                  {monthly > 0 && s.frequency !== 'monthly' && <p className="mt-1 text-xs text-muted">≈ {formatMoney(monthly, s.currency)} al mes (esperado)</p>}
                </Link>
                <div className="absolute right-4 top-4 flex gap-1">
                  <IconButton label="Editar" onClick={() => setEditing(s)}><Pencil className="size-3.5" /></IconButton>
                  <IconButton label="Mover a la papelera" tone="danger" onClick={() => trash(s)}><Trash2 className="size-3.5" /></IconButton>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <IncomeFormDialog open={editing !== null} source={editing && editing !== 'new' ? editing : null} linkTo={editing === 'new' ? linkTo : null} onClose={() => setEditing(null)} />
    </>
  )
}
