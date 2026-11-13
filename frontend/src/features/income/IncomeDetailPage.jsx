import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil, Plus, Trash2, Wallet, X } from 'lucide-react'
import { db } from '../../db/index.js'
import { addEntry, deleteEntry, listEntries } from '../../db/income.js'
import { ValidationError, describeDbError } from '../../db/errors.js'
import { ENTRY_TYPES, frequencyLabel, monthlyEquivalent } from '../../domain/income.js'
import { KINDS } from '../../domain/kinds.js'
import { formatDate, formatDateTime, formatMoney } from '../../lib/format.js'
import { itemPath } from '../../app/nav.js'
import { Badge, Button, EmptyState, Field, IconButton, Notice, Panel, Skeleton, useConfirm, useToast } from '../../components/ui.jsx'
import { BackLink } from '../items/ItemDetailPage.jsx'
import IncomeFormDialog from './IncomeForm.jsx'
import { useTrashSource } from './IncomePage.jsx'

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

function EntryForm({ source }) {
  const toast = useToast()
  const [v, setV] = useState({ type: 'received', date: today(), amount: String(source.amount ?? ''), note: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }))
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await addEntry(db, source.id, { ...v, currency: source.currency })
      setErrors({})
      setV((s) => ({ ...s, note: '' }))
      toast('Ingreso registrado')
    } catch (err) {
      if (err instanceof ValidationError) setErrors(err.errors)
      else toast(describeDbError(err), 'danger')
    } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} noValidate className="grid gap-3 sm:grid-cols-[auto_auto_1fr_1.4fr_auto] sm:items-end">
      <Field label="Tipo"><select className="field-input" value={v.type} onChange={set('type')}>{Object.entries(ENTRY_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
      <Field label="Fecha" error={errors.date}><input type="date" className="field-input" value={v.date} onChange={set('date')} /></Field>
      <Field label={`Importe (${source.currency})`} error={errors.amount}><input className="field-input" inputMode="decimal" value={v.amount} onChange={set('amount')} /></Field>
      <Field label="Nota"><input className="field-input" value={v.note} onChange={set('note')} placeholder="Opcional" /></Field>
      <Button type="submit" variant="gold" busy={busy}><Plus className="size-4" /> Registrar</Button>
    </form>
  )
}

export default function IncomeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const trash = useTrashSource()
  const source = useLiveQuery(async () => (await db.incomeSources.get(id)) ?? null, [id])
  const entries = useLiveQuery(() => listEntries(db, id), [id])
  const linked = useLiveQuery(async () => (source?.linkedItemId ? (await db.items.get(source.linkedItemId)) ?? null : null), [source?.linkedItemId])
  const [editing, setEditing] = useState(false)

  if (source === undefined) return <Skeleton className="h-96" />
  if (source === null) return <EmptyState icon={Wallet} title="Fuente no encontrada" action={<Button onClick={() => navigate('/ingresos')}>Ver fuentes</Button>} />

  const sum = (type) => (entries ?? []).filter((e) => e.type === type).reduce((s, e) => s + e.amount, 0)
  const removeEntry = async (e) => {
    if (!(await confirm({ title: 'Eliminar registro', danger: true, confirmLabel: 'Eliminar', message: <>Se eliminará el ingreso {ENTRY_TYPES[e.type].toLowerCase()} de <strong>{formatMoney(e.amount, e.currency)}</strong> del {formatDate(e.date)}.</> }))) return
    try { await deleteEntry(db, e.id); toast('Registro eliminado') } catch (err) { toast(describeDbError(err), 'danger') }
  }

  return (
    <div>
      <BackLink fallback="/ingresos" label="Volver a fuentes de ingresos" />
      {source.deletedAt && <Notice tone="warn" className="mb-6">Esta fuente está en la papelera. Puedes restaurarla desde Configuración → Papelera.</Notice>}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Panel className="animate-rise">
          <div className="flex flex-wrap gap-2">
            <Badge tone={source.active ? 'ok' : 'default'}>{source.active ? 'Activa' : 'Inactiva'}</Badge>
            <Badge>{source.category === 'Otra' && source.customCategory ? source.customCategory : source.category}</Badge>
          </div>
          <h1 className="mt-3 font-display text-4xl text-fg">{source.name}</h1>
          <p className="mt-3 font-display text-3xl text-primary">{formatMoney(source.amount, source.currency)}</p>
          <p className="text-sm text-muted">{frequencyLabel(source.frequency)}{monthlyEquivalent(source) > 0 && source.frequency !== 'monthly' ? ` · ≈ ${formatMoney(monthlyEquivalent(source), source.currency)} al mes` : ''}</p>
          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-5 text-sm">
            <div><dt className="text-xs text-muted">Inicio</dt><dd className="mt-0.5">{source.startDate ? formatDate(source.startDate) : '—'}</dd></div>
            <div><dt className="text-xs text-muted">Activo vinculado</dt><dd className="mt-0.5">{linked ? <Link className="text-primary hover:underline" to={itemPath(linked)}>{linked.title} · {KINDS[linked.kind].label}</Link> : '—'}</dd></div>
            <div><dt className="text-xs text-muted">Creada</dt><dd className="mt-0.5">{formatDateTime(source.createdAt)}</dd></div>
            <div><dt className="text-xs text-muted">Actualizada</dt><dd className="mt-0.5">{formatDateTime(source.updatedAt)}</dd></div>
          </dl>
          {source.description && <p className="mt-4 whitespace-pre-line text-sm text-fg">{source.description}</p>}
          {source.notes && <p className="mt-2 whitespace-pre-line text-sm text-muted">{source.notes}</p>}
          {!source.deletedAt && (
            <div className="mt-6 flex flex-wrap gap-2">
              <Button variant="gold" onClick={() => setEditing(true)}><Pencil className="size-4" /> Editar</Button>
              <Button variant="danger" onClick={async () => (await trash(source)) && navigate('/ingresos')}><Trash2 className="size-4" /> Eliminar</Button>
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Panel className="p-4 sm:p-5"><p className="eyebrow">Recibido</p><p className="mt-2 font-display text-3xl text-ok">{formatMoney(sum('received'), source.currency)}</p><p className="text-xs text-muted">Suma de ingresos efectivamente recibidos</p></Panel>
            <Panel className="p-4 sm:p-5"><p className="eyebrow">Esperado</p><p className="mt-2 font-display text-3xl text-fg">{formatMoney(sum('expected'), source.currency)}</p><p className="text-xs text-muted">Suma de ingresos esperados registrados</p></Panel>
          </div>
          {!source.deletedAt && <Panel><h2 className="eyebrow mb-3">Registrar ingreso</h2><EntryForm source={source} /></Panel>}
          <Panel>
            <h2 className="eyebrow mb-3">Historial</h2>
            {entries?.length === 0 && <p className="text-sm text-muted">Aún no hay registros.</p>}
            <ul className="divide-y divide-line">
              {entries?.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-3 text-sm">
                  <Badge tone={e.type === 'received' ? 'ok' : 'default'}>{ENTRY_TYPES[e.type]}</Badge>
                  <span className="w-28 text-muted">{formatDate(e.date)}</span>
                  <span className="flex-1 truncate text-muted">{e.note}</span>
                  <span className="text-fg">{formatMoney(e.amount, e.currency)}</span>
                  {!source.deletedAt && <IconButton label="Eliminar registro" tone="danger" onClick={() => removeEntry(e)}><X className="size-3.5" /></IconButton>}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
      <IncomeFormDialog open={editing} source={source} onClose={() => setEditing(false)} />
    </div>
  )
}
