import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/index.js'
import { createSource, updateSource } from '../../db/income.js'
import { listItems } from '../../db/items.js'
import { ValidationError, describeDbError } from '../../db/errors.js'
import { INCOME_CATEGORIES, FREQUENCIES } from '../../domain/income.js'
import { CURRENCIES, KINDS } from '../../domain/kinds.js'
import { useSettings } from '../../app/useSettings.js'
import { Button, Dialog, Field, useConfirm, useToast } from '../../components/ui.jsx'

const LINKABLE = ['physicalBusiness', 'digitalBusiness', 'house', 'yacht', 'car', 'motorcycle']
const SUGGESTED_CATEGORY = { physicalBusiness: 'Empresa', digitalBusiness: 'Negocio digital', house: 'Alquiler', yacht: 'Alquiler' }

const empty = (currency) => ({
  name: '', category: '', customCategory: '', description: '', amount: '', currency, frequency: 'monthly',
  startDate: '', active: true, notes: '', linkedItemId: '',
})

export default function IncomeFormDialog({ open, source, onClose, onSaved, linkTo }) {
  const settings = useSettings()
  const toast = useToast()
  const confirm = useConfirm()
  const items = useLiveQuery(async () => (await listItems(db)).filter((i) => LINKABLE.includes(i.kind)), [])
  const [v, setV] = useState(empty(settings.currency))
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const initial = useRef('')

  useEffect(() => {
    if (!open) return
    let base = source
      ? { ...empty(source.currency), ...source, amount: String(source.amount ?? ''), startDate: source.startDate ?? '', linkedItemId: source.linkedItemId ?? '' }
      : empty(settings.currency)
    if (!source && linkTo) base = { ...base, linkedItemId: linkTo.id, name: `Ingresos de ${linkTo.title}`, category: SUGGESTED_CATEGORY[linkTo.kind] ?? '' }
    setV(base)
    setErrors({})
    initial.current = JSON.stringify(base)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, source?.id, linkTo?.id])

  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const requestClose = async () => {
    if (busy) return
    if (JSON.stringify(v) !== initial.current && !(await confirm({ title: 'Descartar cambios', message: 'Hay cambios sin guardar. ¿Quieres descartarlos?', confirmLabel: 'Descartar', danger: true }))) return
    onClose()
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const saved = source ? await updateSource(db, source.id, v) : await createSource(db, v)
      toast(source ? 'Fuente de ingreso actualizada' : 'Fuente de ingreso creada')
      onSaved?.(saved)
      onClose()
    } catch (err) {
      if (err instanceof ValidationError) { setErrors(err.errors); toast('Revisa los campos marcados', 'danger') } else toast(describeDbError(err), 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={requestClose}
      size="lg"
      title={source ? 'Editar fuente de ingreso' : 'Nueva fuente de ingreso'}
      footer={<><Button onClick={requestClose} disabled={busy}>Cancelar</Button><Button variant="gold" type="submit" form="income-form" busy={busy}>{source ? 'Guardar cambios' : 'Crear'}</Button></>}
    >
      <form id="income-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre *" error={errors.name}><input className="field-input" value={v.name} onChange={set('name')} aria-invalid={!!errors.name} /></Field>
        <Field label="Categoría *" error={errors.category}>
          <select className="field-input" value={v.category} onChange={set('category')} aria-invalid={!!errors.category}>
            <option value="">Selecciona…</option>
            {INCOME_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        {v.category === 'Otra' && <Field label="Categoría personalizada" className="sm:col-span-2"><input className="field-input" value={v.customCategory} onChange={set('customCategory')} /></Field>}
        <Field label="Importe *" error={errors.amount}>
          <div className="flex gap-2">
            <input className="field-input min-w-0 flex-1" inputMode="decimal" value={v.amount} onChange={set('amount')} aria-invalid={!!errors.amount} />
            <select className="field-input w-24" aria-label="Moneda" value={v.currency} onChange={set('currency')}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
          </div>
        </Field>
        <Field label="Frecuencia *" error={errors.frequency}>
          <select className="field-input" value={v.frequency} onChange={set('frequency')}>{FREQUENCIES.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</select>
        </Field>
        <Field label="Fecha de inicio" error={errors.startDate}><input type="date" className="field-input" value={v.startDate} onChange={set('startDate')} /></Field>
        <Field label="Activo vinculado (opcional)">
          <select className="field-input" value={v.linkedItemId} onChange={set('linkedItemId')}>
            <option value="">Ninguno</option>
            {(items ?? []).map((i) => <option key={i.id} value={i.id}>{i.title} · {KINDS[i.kind].label}</option>)}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm text-fg sm:col-span-2">
          <input type="checkbox" checked={v.active} onChange={set('active')} /> Fuente activa
        </label>
        <Field label="Descripción" className="sm:col-span-2"><textarea rows={2} className="field-input" value={v.description} onChange={set('description')} /></Field>
        <Field label="Observaciones" className="sm:col-span-2"><textarea rows={2} className="field-input" value={v.notes} onChange={set('notes')} /></Field>
      </form>
    </Dialog>
  )
}
