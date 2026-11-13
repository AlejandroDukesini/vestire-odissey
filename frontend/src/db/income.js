import { newId } from './schema.js'
import { guardWrite, NotFoundError, ValidationError } from './errors.js'
import { logActivity } from './activity.js'
import { validateSource, validateEntry } from '../domain/income.js'

const T = (db) => [db.incomeSources, db.incomeEntries, db.activity]

export async function createSource(db, input) {
  const { data, errors } = validateSource(input)
  if (Object.keys(errors).length) throw new ValidationError(errors)
  const now = Date.now()
  const source = { id: newId(), ...data, createdAt: now, updatedAt: now, deletedAt: null }
  await guardWrite(() =>
    db.transaction('rw', T(db), async () => {
      await db.incomeSources.add(source)
      await logActivity(db, { type: 'income.created', entityId: source.id, title: source.name })
    }),
  )
  return source
}

/** Edita fusionando con los valores actuales (las claves ausentes se conservan). */
export async function updateSource(db, id, input) {
  return guardWrite(() =>
    db.transaction('rw', T(db), async () => {
      const current = await db.incomeSources.get(id)
      if (!current) throw new NotFoundError('La fuente de ingreso')
      const { data, errors } = validateSource({ ...current, ...input })
      if (Object.keys(errors).length) throw new ValidationError(errors)
      const next = { ...current, ...data, updatedAt: Date.now() }
      await db.incomeSources.put(next)
      await logActivity(db, { type: 'income.updated', entityId: id, title: next.name })
      return next
    }),
  )
}

export async function trashSource(db, id) {
  await guardWrite(() =>
    db.transaction('rw', T(db), async () => {
      const s = await db.incomeSources.get(id)
      if (!s) throw new NotFoundError('La fuente de ingreso')
      await db.incomeSources.update(id, { deletedAt: Date.now() })
      await logActivity(db, { type: 'income.trashed', entityId: id, title: s.name })
    }),
  )
}

export async function restoreSource(db, id) {
  await guardWrite(() =>
    db.transaction('rw', T(db), async () => {
      const s = await db.incomeSources.get(id)
      if (!s) throw new NotFoundError('La fuente de ingreso')
      await db.incomeSources.update(id, { deletedAt: null, updatedAt: Date.now() })
      await logActivity(db, { type: 'income.restored', entityId: id, title: s.name })
    }),
  )
}

/** Eliminación definitiva: la fuente y su historial de ingresos. */
export async function purgeSource(db, id) {
  await guardWrite(() =>
    db.transaction('rw', T(db), async () => {
      const s = await db.incomeSources.get(id)
      if (!s) return
      await db.incomeEntries.where('sourceId').equals(id).delete()
      await db.incomeSources.delete(id)
      await logActivity(db, { type: 'income.purged', entityId: id, title: s.name })
    }),
  )
}

export async function listSources(db, { includeDeleted = false } = {}) {
  const rows = await db.incomeSources.toArray()
  return rows.filter((s) => includeDeleted || !s.deletedAt).sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export async function addEntry(db, sourceId, input) {
  return guardWrite(() =>
    db.transaction('rw', T(db), async () => {
      const source = await db.incomeSources.get(sourceId)
      if (!source) throw new NotFoundError('La fuente de ingreso')
      const { data, errors } = validateEntry({ currency: source.currency, ...input })
      if (Object.keys(errors).length) throw new ValidationError(errors)
      const now = Date.now()
      const entry = { id: newId(), sourceId, ...data, createdAt: now, updatedAt: now }
      await db.incomeEntries.add(entry)
      await logActivity(db, { type: 'entry.created', entityId: sourceId, title: source.name, detail: { amount: entry.amount, currency: entry.currency, type: entry.type } })
      return entry
    }),
  )
}

export async function deleteEntry(db, entryId) {
  await guardWrite(() =>
    db.transaction('rw', T(db), async () => {
      const e = await db.incomeEntries.get(entryId)
      if (!e) return
      const source = await db.incomeSources.get(e.sourceId)
      await db.incomeEntries.delete(entryId)
      await logActivity(db, { type: 'entry.deleted', entityId: e.sourceId, title: source?.name ?? '' })
    }),
  )
}

export async function listEntries(db, sourceId) {
  const rows = sourceId ? await db.incomeEntries.where('sourceId').equals(sourceId).toArray() : await db.incomeEntries.toArray()
  return rows.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
}
