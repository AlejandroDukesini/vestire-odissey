import { lazy, Suspense, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Building2, Car, Gem, Glasses, Home, Landmark, Plus, ScanEye, Settings, Shirt, Sparkles, Star, Wallet, Watch,
} from 'lucide-react'
import { db } from '../../db/index.js'
import { ACTIVITY_LABELS, recentActivity } from '../../db/activity.js'
import { computeAssetStats, computeIncomeStats, orderCurrencies, NO_CURRENCY } from '../../domain/stats.js'
import { ENTRY_TYPES, FREQUENCIES } from '../../domain/income.js'
import { KINDS } from '../../domain/kinds.js'
import { formatDate, formatMoney } from '../../lib/format.js'
import { itemPath, kindListPath } from '../../app/nav.js'
import { useSettings } from '../../app/useSettings.js'
import MediaImage from '../../components/MediaImage.jsx'
import { Badge, Panel, Skeleton, Tabs, cx } from '../../components/ui.jsx'
import GlobalSearch from './GlobalSearch.jsx'
// El gráfico (Recharts) se carga bajo demanda para no penalizar la apertura.
const IncomeChart = lazy(() => import('./IncomeChart.jsx'))

const QUICK = [
  { label: 'Prenda', icon: Shirt, to: kindListPath('garment', { create: true }) },
  { label: 'Accesorio', icon: Glasses, to: kindListPath('accessory', { create: true }) },
  { label: 'Reloj', icon: Watch, to: kindListPath('watch', { create: true }) },
  { label: 'Vehículo', icon: Car, to: kindListPath('car', { create: true }) },
  { label: 'Propiedad', icon: Home, to: kindListPath('house', { create: true }) },
  { label: 'Empresa', icon: Building2, to: kindListPath('physicalBusiness', { create: true }) },
  { label: 'Fuente de ingreso', icon: Wallet, to: '/ingresos?nuevo=1' },
  { label: 'Previsualización', icon: ScanEye, to: '/previsualizaciones?nuevo=1' },
]

function greeting(d = new Date()) {
  const h = d.getHours()
  return h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches'
}


/** Importes agrupados por moneda: la principal destacada y el resto debajo. Nunca se suman entre sí. */
function MoneyStack({ byCurrency, main, size = 'lg' }) {
  const keys = orderCurrencies(byCurrency, main)
  if (!keys.length) return <p className={cx('font-display text-fg', size === 'lg' ? 'text-3xl' : 'text-2xl')}>—</p>
  const [first, ...rest] = keys
  return (
    <div>
      <p className={cx('font-display leading-tight text-primary', size === 'lg' ? 'text-3xl' : 'text-2xl')}>
        {first === NO_CURRENCY ? byCurrency[first].toLocaleString('es') : formatMoney(byCurrency[first], first)}
      </p>
      {rest.length > 0 && (
        <p className="mt-1 text-xs text-muted">
          {rest.map((c) => (c === NO_CURRENCY ? `${byCurrency[c].toLocaleString('es')} sin moneda` : formatMoney(byCurrency[c], c))).join(' · ')}
        </p>
      )}
    </div>
  )
}

function Kpi({ label, value, icon: Icon, to, index }) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">{label}</span>
        <Icon className="size-4 text-muted" aria-hidden />
      </div>
      <p className="mt-2 font-display text-3xl leading-none text-fg">{value}</p>
    </>
  )
  return to ? (
    <Link to={to} className="card interactive block p-4" style={{ '--i': index }}>{body}</Link>
  ) : <div className="card p-4" style={{ '--i': index }}>{body}</div>
}

/** Barra horizontal de una sola serie (magnitud): un tono, porcentaje y valor rotulados. */
function BarList({ rows, format = (v) => v, emptyText }) {
  const max = Math.max(0, ...rows.map((r) => r.value))
  const total = rows.reduce((s, r) => s + r.value, 0)
  if (!total) return <p className="py-6 text-sm text-muted">{emptyText}</p>
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key} title={`${r.label}: ${format(r.value)} (${Math.round((r.value / total) * 100)} %)`}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            {r.to ? <Link to={r.to} className="text-fg hover:text-primary">{r.label}</Link> : <span className="text-fg">{r.label}</span>}
            <span className="text-xs text-muted">{format(r.value)} · {Math.round((r.value / total) * 100)} %</span>
          </div>
          <div className="h-2 rounded-full bg-fg/[0.06]">
            <div className="h-full rounded-full bg-primary transition-[width] duration-700 ease-lux" style={{ width: `${Math.max(r.value ? 2 : 0, (r.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function Gallery({ items, empty }) {
  if (!items.length) return <p className="py-4 text-sm text-muted">{empty}</p>
  return (
    <ul className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((i, n) => (
        <li key={i.id} style={{ '--i': n }}>
          <Link to={itemPath(i)} className="card interactive group block overflow-hidden">
            <MediaImage mediaId={i.primaryMediaId} alt={i.title} className="aspect-square w-full" imgClassName="transition-transform duration-700 ease-lux group-hover:scale-105" />
            <div className="p-2.5">
              <p className="truncate text-sm text-fg">{i.title}</p>
              <p className="truncate text-[11px] text-muted">{KINDS[i.kind].label}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function SectionTitle({ eyebrow, title, action }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-1 font-display text-3xl text-fg">{title}</h2>
      </div>
      {action}
    </div>
  )
}

export default function DashboardPage() {
  const settings = useSettings()
  const main = settings.currency
  const data = useLiveQuery(async () => {
    const [items, sources, entries, comps, activity] = await Promise.all([
      db.items.toArray(), db.incomeSources.toArray(), db.incomeEntries.toArray(), db.compositions.toArray(), recentActivity(db, 10),
    ])
    return { items, sources, entries, comps: comps.filter((c) => !c.deletedAt).sort((a, b) => b.updatedAt - a.updatedAt), activity }
  }, [])
  const [valueCurrency, setValueCurrency] = useState(null)
  const [highlight, setHighlight] = useState('recent')

  const stats = useMemo(() => data && computeAssetStats(data.items), [data])
  const income = useMemo(() => data && computeIncomeStats(data.sources, data.entries), [data])

  const now = new Date()
  const header = (
    <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="eyebrow">{new Intl.DateTimeFormat('es', { dateStyle: 'full' }).format(now)}</p>
        <h1 className="mt-2 font-display text-4xl leading-none text-fg sm:text-5xl">{greeting(now)}</h1>
        <p className="mt-2 text-sm text-muted">Este es el estado de tu patrimonio registrado.</p>
      </div>
      <div className="flex items-center gap-2">
        <GlobalSearch />
        <Link to="/ajustes" aria-label="Configuración" className="grid size-10 shrink-0 place-items-center rounded-full border border-line-strong text-muted transition-colors hover:border-primary/60 hover:text-primary">
          <Settings className="size-4" />
        </Link>
      </div>
    </header>
  )

  if (!data) {
    return (
      <>
        {header}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>
      </>
    )
  }

  const live = data.items.filter((i) => !i.deletedAt)
  const valueCurrencies = Object.keys(stats.valueByCurrency).filter((c) => c !== NO_CURRENCY)
  const vc = valueCurrency && valueCurrencies.includes(valueCurrency) ? valueCurrency : valueCurrencies.includes(main) ? main : valueCurrencies[0]
  const incomeCurrencies = [...new Set(data.entries.map((e) => e.currency))]
  const featured = live.filter((i) => i.featured)
  const highlights = {
    recent: [...live].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6),
    watches: [...live.filter((i) => i.kind === 'watch')].sort((a, b) => Number(b.featured) - Number(a.featured) || (b.value ?? 0) - (a.value ?? 0)).slice(0, 6),
    properties: [...live.filter((i) => ['house', 'yacht', 'car', 'motorcycle'].includes(i.kind))].sort((a, b) => Number(b.featured) - Number(a.featured) || b.createdAt - a.createdAt).slice(0, 6),
    featured: featured.slice(0, 6),
  }

  return (
    <>
      {header}

      <nav aria-label="Accesos rápidos" className="mb-8 flex gap-2 overflow-x-auto pb-1">
        {QUICK.map((q) => (
          <Link key={q.label} to={q.to} className="flex shrink-0 items-center gap-2 rounded-full border border-line-strong bg-fg/[0.02] px-4 py-2 text-sm text-fg transition-colors hover:border-primary/60 hover:text-primary">
            <Plus className="size-3.5" /><q.icon className="size-4" /> {q.label}
          </Link>
        ))}
      </nav>

      {stats.total === 0 && income.total === 0 && (
        <Panel className="animate-rise mb-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <span className="grid size-12 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/10"><Sparkles className="size-5 text-primary" /></span>
          <div>
            <p className="font-display text-2xl text-fg">Tu patrimonio está vacío</p>
            <p className="text-sm text-muted">Usa los accesos rápidos para registrar tu primer objeto. Todos los indicadores se calculan a partir de tus registros reales.</p>
          </div>
        </Panel>
      )}

      <section aria-label="Indicadores principales" className="stagger mb-10 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <div className="card col-span-2 p-4 md:col-span-4 xl:col-span-2 xl:row-span-2" style={{ '--i': 0 }}>
          <div className="flex items-center justify-between"><span className="text-xs text-muted">Valor total registrado</span><Gem className="size-4 text-muted" /></div>
          <div className="mt-3"><MoneyStack byCurrency={stats.valueByCurrency} main={main} /></div>
          <p className="mt-3 text-xs text-muted">Suma de los valores declarados por ti, separada por moneda. No es una valoración de mercado ni se convierte entre monedas.{stats.unvalued ? ` ${stats.unvalued} objeto(s) sin valor registrado.` : ''}</p>
          <p className="mt-4 font-display text-5xl leading-none text-fg">{stats.total}</p>
          <p className="text-xs text-muted">objetos registrados</p>
        </div>
        <Kpi index={1} label="Prendas" value={stats.byKind.garment} icon={Shirt} to="/vestimenta" />
        <Kpi index={2} label="Accesorios" value={stats.byKind.accessory} icon={Glasses} to="/accesorios" />
        <Kpi index={3} label="Relojes" value={stats.byKind.watch} icon={Watch} to="/relojes" />
        <Kpi index={4} label="Vehículos y yates" value={stats.vehicles} icon={Car} to="/propiedades/automoviles" />
        <Kpi index={5} label="Inmuebles" value={stats.byKind.house} icon={Home} to="/propiedades/casas" />
        <Kpi index={6} label="Empresas" value={stats.companies} icon={Building2} to="/empresas" />
        <Kpi index={7} label="Fuentes de ingreso" value={`${income.active}/${income.total}`} icon={Wallet} to="/ingresos" />
        <Kpi index={8} label="Previsualizaciones" value={data.comps.length} icon={ScanEye} to="/previsualizaciones" />
      </section>

      <section className="mb-10 grid gap-6 lg:grid-cols-2">
        <Panel className="animate-rise">
          <SectionTitle eyebrow="Patrimonio" title="Distribución de activos" />
          <BarList
            emptyText="Aún no hay objetos registrados."
            format={(v) => `${v} ${v === 1 ? 'objeto' : 'objetos'}`}
            rows={stats.groups.map((g) => ({ key: g.key, label: g.label, value: g.count }))}
          />
        </Panel>
        <Panel className="animate-rise">
          <SectionTitle
            eyebrow="Patrimonio"
            title="Valor registrado por categoría"
            action={valueCurrencies.length > 1 && (
              <select value={vc} onChange={(e) => setValueCurrency(e.target.value)} className="field-input w-auto py-1 text-xs" aria-label="Moneda">
                {valueCurrencies.map((c) => <option key={c}>{c}</option>)}
              </select>
            )}
          />
          <BarList
            emptyText="Aún no hay valores registrados."
            format={(v) => formatMoney(v, vc)}
            rows={stats.groups.map((g) => ({ key: g.key, label: g.label, value: g.valueByCurrency[vc] ?? 0 }))}
          />
          {vc && <p className="mt-4 text-xs text-muted">Solo objetos registrados en {vc}. Valor declarado, no de mercado.</p>}
        </Panel>
      </section>

      <section className="mb-10">
        <SectionTitle eyebrow="Finanzas" title="Fuentes de ingreso" action={<Link to="/ingresos" className="text-sm text-muted hover:text-primary">Ver todas</Link>} />
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="card p-4">
            <p className="text-xs text-muted">Ingreso recurrente esperado (equivalente mensual)</p>
            <div className="mt-2"><MoneyStack byCurrency={income.expectedMonthly} main={main} size="md" /></div>
            <p className="mt-1 text-[11px] text-muted">Según importe y frecuencia de las fuentes activas.</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-muted">Recibido este mes</p>
            <div className="mt-2"><MoneyStack byCurrency={income.receivedThisMonth} main={main} size="md" /></div>
            <p className="mt-1 text-[11px] text-muted">Ingresos registrados como recibidos.</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-muted">Esperado registrado este mes</p>
            <div className="mt-2"><MoneyStack byCurrency={income.expectedThisMonth} main={main} size="md" /></div>
            <p className="mt-1 text-[11px] text-muted">Movimientos registrados como esperados.</p>
          </div>
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]">
          <Panel>
            <h3 className="eyebrow mb-4">Evolución de ingresos registrados · últimos 12 meses</h3>
            {incomeCurrencies.length ? <Suspense fallback={<Skeleton className="h-56" />}><IncomeChart monthly={income.monthly} currencies={incomeCurrencies} mainCurrency={main} /></Suspense> : <p className="py-10 text-center text-sm text-muted">Registra ingresos en una fuente para ver su evolución.</p>}
          </Panel>
          <div className="space-y-6">
            <Panel>
              <h3 className="eyebrow mb-4">Por categoría</h3>
              <BarList emptyText="Aún no hay fuentes de ingreso." format={(v) => `${v} ${v === 1 ? 'fuente' : 'fuentes'}`}
                rows={income.byCategory.map((c) => ({ key: c.category, label: c.category, value: c.count }))} />
              {income.active > 0 && (
                <p className="mt-4 text-xs text-muted">Frecuencias activas: {FREQUENCIES.filter((f) => income.byFrequency[f.key]).map((f) => `${f.label.toLowerCase()} (${income.byFrequency[f.key]})`).join(', ')}</p>
              )}
            </Panel>
            <Panel>
              <h3 className="eyebrow mb-3">Últimos movimientos</h3>
              {income.recentEntries.length === 0 && <p className="text-sm text-muted">Sin movimientos registrados.</p>}
              <ul className="divide-y divide-line">
                {income.recentEntries.map((e) => {
                  const s = data.sources.find((x) => x.id === e.sourceId)
                  return (
                    <li key={e.id} className="flex items-center gap-2 py-2 text-sm">
                      <Badge tone={e.type === 'received' ? 'ok' : 'default'}>{ENTRY_TYPES[e.type]}</Badge>
                      <Link to={`/ingresos/${e.sourceId}`} className="min-w-0 flex-1 truncate text-fg hover:text-primary">{s?.name}</Link>
                      <span className="text-xs text-muted">{formatDate(e.date)}</span>
                      <span className="text-fg">{formatMoney(e.amount, e.currency)}</span>
                    </li>
                  )
                })}
              </ul>
            </Panel>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <SectionTitle eyebrow="Colección" title="Destacados" />
        <Tabs className="mb-4 w-fit max-w-full" value={highlight} onChange={setHighlight} tabs={[
          { value: 'recent', label: 'Últimos registrados', icon: Sparkles },
          { value: 'featured', label: 'Destacados', icon: Star, count: featured.length },
          { value: 'watches', label: 'Relojes', icon: Watch },
          { value: 'properties', label: 'Propiedades', icon: Landmark },
        ]} />
        <div key={highlight} className="animate-page">
          <Gallery items={highlights[highlight]} empty={highlight === 'featured' ? 'Marca objetos con la estrella para verlos aquí.' : 'Aún no hay elementos en esta sección.'} />
        </div>
      </section>

      <section className="grid items-start gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Panel>
          <SectionTitle eyebrow="Guardarropa" title="Composiciones recientes" action={<Link to="/previsualizaciones" className="text-sm text-muted hover:text-primary">Ver todas</Link>} />
          {data.comps.length === 0 && <p className="text-sm text-muted">Aún no hay composiciones.</p>}
          <ul className="grid grid-cols-3 gap-3">
            {data.comps.slice(0, 3).map((c) => (
              <li key={c.id}>
                <Link to={`/previsualizaciones/${c.id}`} className="card interactive block overflow-hidden">
                  <MediaImage mediaId={c.photoMediaId} alt={c.name} className="aspect-[3/4] w-full" />
                  <p className="truncate p-2 text-xs text-fg">{c.name}</p>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <SectionTitle eyebrow="Historial" title="Actividad reciente" />
          {data.activity.length === 0 && <p className="text-sm text-muted">Todavía no hay actividad registrada. Los cambios aparecerán aquí a medida que ocurran.</p>}
          <ol className="relative space-y-3 border-l border-line pl-4">
            {data.activity.map((a) => (
              <li key={a.id} className="relative text-sm">
                <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primary" aria-hidden />
                <p className="text-fg">
                  <span className="text-muted">{ACTIVITY_LABELS[a.type] ?? a.type}</span>
                  {a.title ? <> · {a.title}</> : null}
                  {a.kind && KINDS[a.kind] ? <span className="text-muted"> ({KINDS[a.kind].label.toLowerCase()})</span> : null}
                  {a.type === 'media.added' && a.detail?.count ? <span className="text-muted"> · {a.detail.count}</span> : null}
                  {a.type === 'entry.created' && a.detail ? <span className="text-muted"> · {formatMoney(a.detail.amount, a.detail.currency)} {ENTRY_TYPES[a.detail.type]?.toLowerCase()}</span> : null}
                </p>
                <p className="text-[11px] text-muted">{new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(a.at)}</p>
              </li>
            ))}
          </ol>
        </Panel>
      </section>
    </>
  )
}

