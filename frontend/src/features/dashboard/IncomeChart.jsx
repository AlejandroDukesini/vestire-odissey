import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTheme } from '../../theme/ThemeProvider.jsx'
import { luminance } from '../../theme/palettes.js'
import { formatMoney } from '../../lib/format.js'
import { cx } from '../../components/ui.jsx'

// Serie categórica validada (skill dataviz, paleta de referencia: azul / naranja), pasos claro y oscuro.
const SERIES = {
  light: { expected: '#2a78d6', received: '#eb6834' },
  dark: { expected: '#3987e5', received: '#d95926' },
}
const LABELS = { expected: 'Esperado', received: 'Recibido' }

const monthLabel = (k) => new Intl.DateTimeFormat('es', { month: 'short' }).format(new Date(`${k}-01T00:00:00`)).replace('.', '')

function ChartTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null
  return (
    <div className="overlay rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-medium text-fg">{new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(new Date(`${label}-01T00:00:00`))}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-muted">
          <span className="size-2 rounded-sm" style={{ background: p.color }} />
          {LABELS[p.dataKey]}: <span className="text-fg">{formatMoney(p.value, currency)}</span>
        </p>
      ))}
    </div>
  )
}

/** Evolución mensual de ingresos registrados: esperado frente a recibido, una moneda cada vez. */
export default function IncomeChart({ monthly, currencies, mainCurrency }) {
  const { active } = useTheme()
  const mode = luminance(active.colors.background) > 0.4 ? 'light' : 'dark'
  const colors = SERIES[mode]
  const [currency, setCurrency] = useState(null)
  const cur = currency && currencies.includes(currency) ? currency : currencies.includes(mainCurrency) ? mainCurrency : currencies[0]
  const [showTable, setShowTable] = useState(false)

  const data = useMemo(() => monthly.map((m) => ({ month: m.month, expected: m.expected[cur] ?? 0, received: m.received[cur] ?? 0 })), [monthly, cur])
  const empty = data.every((d) => !d.expected && !d.received)

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-4 text-xs text-muted" aria-label="Leyenda">
          {Object.keys(LABELS).map((k) => (
            <span key={k} className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: colors[k] }} />{LABELS[k]}</span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {currencies.length > 1 && (
            <select value={cur} onChange={(e) => setCurrency(e.target.value)} className="field-input w-auto py-1 text-xs" aria-label="Moneda del gráfico">
              {currencies.map((c) => <option key={c}>{c}</option>)}
            </select>
          )}
          <button type="button" onClick={() => setShowTable((s) => !s)} className="text-xs text-muted underline-offset-2 hover:text-fg hover:underline">{showTable ? 'Ver gráfico' : 'Ver tabla'}</button>
        </div>
      </div>
      {empty ? (
        <p className="py-10 text-center text-sm text-muted">Aún no hay ingresos registrados en los últimos 12 meses.</p>
      ) : showTable ? (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted"><th className="py-1 font-normal">Mes</th><th className="py-1 text-right font-normal">Esperado</th><th className="py-1 text-right font-normal">Recibido</th></tr></thead>
          <tbody>{data.map((d) => <tr key={d.month} className="border-t border-line"><td className="py-1.5 capitalize">{monthLabel(d.month)} {d.month.slice(0, 4)}</td><td className="text-right">{formatMoney(d.expected, cur)}</td><td className="text-right">{formatMoney(d.received, cur)}</td></tr>)}</tbody>
        </table>
      ) : (
        <div className={cx('h-56 w-full')}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--c-border)" strokeDasharray="0" />
              <XAxis dataKey="month" tickFormatter={monthLabel} tickLine={false} axisLine={false} tick={{ fill: 'var(--c-muted)', fontSize: 11 }} />
              <YAxis width={56} tickLine={false} axisLine={false} tick={{ fill: 'var(--c-muted)', fontSize: 11 }} tickFormatter={(v) => new Intl.NumberFormat('es', { notation: 'compact' }).format(v)} />
              <Tooltip cursor={{ fill: 'color-mix(in oklab, var(--c-text) 6%, transparent)' }} content={<ChartTooltip currency={cur} />} />
              <Bar dataKey="expected" fill={colors.expected} radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
              <Bar dataKey="received" fill={colors.received} radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
