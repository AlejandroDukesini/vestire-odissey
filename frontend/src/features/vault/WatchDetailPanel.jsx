import { useMemo } from 'react'
import { KeyRound } from 'lucide-react'
import { formatMoney } from '../../lib/format.js'
import ItemDetailPanel from '../showcase/ItemDetailPanel.jsx'

// Ficha de reloj: configuración del panel compartido (showcase/ItemDetailPanel.jsx).
// Orden de la ficha. Solo se muestran los campos con información; nunca se inventan valores.
const WATCH_PANEL = {
  specKeys: ['brand', 'model', 'reference', 'movement', 'material', 'strapMaterial', 'color', 'condition', 'audience', 'acquiredAt'],
  moneyKeys: ['purchasePrice', 'value'],
  eyebrow: (i) => i.fields?.brand,
  heading: (i) => i.fields?.name,
  subline: (i) => [i.fields?.model, i.fields?.reference && `Ref. ${i.fields.reference}`].filter(Boolean).join(' · '),
}

function Summary({ items }) {
  const stats = useMemo(() => {
    const byCurrency = new Map()
    for (const i of items) if (i.value != null) byCurrency.set(i.currency || 'USD', (byCurrency.get(i.currency || 'USD') ?? 0) + i.value)
    const brands = new Set(items.map((i) => i.fields?.brand).filter(Boolean))
    return { totals: [...byCurrency], brands: brands.size, featured: items.filter((i) => i.featured).length }
  }, [items])
  return (
    <div className="space-y-6">
      <div>
        <span className="mb-4 grid size-12 place-items-center rounded-full border border-primary/30 bg-primary/10">
          <KeyRound className="size-5 text-primary" aria-hidden />
        </span>
        <p className="eyebrow">Registro de la bóveda</p>
        <h2 className="mt-2 font-display text-3xl leading-tight text-fg">Colección privada</h2>
        <p className="mt-2 text-sm text-muted">Pasa el cursor o selecciona un reloj para consultar su ficha.</p>
      </div>
      <dl className="grid grid-cols-3 gap-3 text-center">
        {[[items.length, items.length === 1 ? 'Reloj' : 'Relojes'], [stats.brands, stats.brands === 1 ? 'Marca' : 'Marcas'], [stats.featured, 'Destacados']].map(([n, l]) => (
          <div key={l} className="flex flex-col-reverse rounded-xl border border-line bg-fg/[0.02] px-2 py-3">
            <dt className="truncate text-[10px] uppercase tracking-[0.1em] text-muted">{l}</dt>
            <dd className="font-display text-3xl text-fg">{n}</dd>
          </div>
        ))}
      </dl>
      {stats.totals.length > 0 && (
        <div className="border-t border-line pt-5">
          <p className="eyebrow">Valor estimado registrado</p>
          {stats.totals.map(([c, v]) => <p key={c} className="mt-1 font-display text-3xl text-primary">{formatMoney(v, c)}</p>)}
        </div>
      )}
    </div>
  )
}

/** Panel del reloj: columna lateral en escritorio, hoja en tableta y móvil. */
export default function WatchDetailPanel({ items, ...props }) {
  return <ItemDetailPanel {...props} config={WATCH_PANEL} label="Información del reloj" summary={<Summary items={items ?? []} />} />
}
