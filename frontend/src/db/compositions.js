import { newId } from './schema.js'
import { guardWrite, NotFoundError, ValidationError } from './errors.js'
import { prepareImages, writePreparedMedia } from './media.js'
import { logActivity } from './activity.js'

// Composición de Previsualización: una foto propia + referencias manuales a prendas/accesorios.
// refs: [{ id, itemId, anchor: { x, y } (0–1, relativo a la foto), note }]
// Las coordenadas normalizadas mantienen los conectores en su sitio al cambiar el tamaño.

const T = (db) => [db.compositions, db.media, db.mediaBlobs, db.thumbs, db.activity]
const clamp01 = (n) => Math.min(1, Math.max(0, Number(n)))

export function sanitizeRefs(refs = []) {
  if (!Array.isArray(refs)) throw new ValidationError({ refs: 'Referencias no válidas' })
  return refs.map((r) => {
    if (!Number.isFinite(Number(r?.anchor?.x)) || !Number.isFinite(Number(r?.anchor?.y))) {
      throw new ValidationError({ refs: 'Una referencia no tiene posición válida' })
    }
    return {
      id: typeof r.id === 'string' && r.id ? r.id : newId(),
      itemId: r.itemId ? String(r.itemId) : null,
      anchor: { x: clamp01(r.anchor.x), y: clamp01(r.anchor.y) },
      note: String(r.note ?? '').slice(0, 200),
    }
  })
}

export async function createComposition(db, { name, file, maxBytes }) {
  const title = String(name ?? '').trim() || 'Composición sin título'
  const { prepared, rejected } = await prepareImages(file ? [file] : [], { maxBytes })
  if (!prepared.length) throw new ValidationError({ photo: rejected[0]?.reason ?? 'Selecciona una fotografía' }, rejected[0]?.reason ?? 'Selecciona una fotografía')
  const now = Date.now()
  const comp = { id: newId(), name: title.slice(0, 200), photoMediaId: prepared[0].id, refs: [], createdAt: now, updatedAt: now, deletedAt: null }
  await guardWrite(() =>
    db.transaction('rw', T(db), async () => {
      await db.compositions.add(comp)
      await writePreparedMedia(db, { ownerId: comp.id, ownerType: 'composition', role: 'composition' }, prepared)
      await logActivity(db, { type: 'composition.created', entityId: comp.id, title: comp.name })
    }),
  )
  return comp
}

export async function updateComposition(db, id, { name, refs }) {
  return guardWrite(() =>
    db.transaction('rw', T(db), async () => {
      const c = await db.compositions.get(id)
      if (!c) throw new NotFoundError('La composición')
      const patch = { updatedAt: Date.now() }
      if (name !== undefined) patch.name = String(name).trim().slice(0, 200) || c.name
      if (refs !== undefined) patch.refs = sanitizeRefs(refs)
      await db.compositions.update(id, patch)
      await logActivity(db, { type: 'composition.updated', entityId: id, title: patch.name ?? c.name })
      return { ...c, ...patch }
    }),
  )
}

async function setDeleted(db, id, deletedAt, type) {
  await guardWrite(() =>
    db.transaction('rw', T(db), async () => {
      const c = await db.compositions.get(id)
      if (!c) throw new NotFoundError('La composición')
      await db.compositions.update(id, { deletedAt, ...(deletedAt ? {} : { updatedAt: Date.now() }) })
      await logActivity(db, { type, entityId: id, title: c.name })
    }),
  )
}
export const trashComposition = (db, id) => setDeleted(db, id, Date.now(), 'composition.trashed')
export const restoreComposition = (db, id) => setDeleted(db, id, null, 'composition.restored')

/** Elimina definitivamente la composición y SU fotografía. Los activos referenciados no se tocan. */
export async function purgeComposition(db, id) {
  await guardWrite(() =>
    db.transaction('rw', T(db), async () => {
      const c = await db.compositions.get(id)
      if (!c) return
      const ids = await db.media.where('ownerId').equals(id).primaryKeys()
      await db.mediaBlobs.bulkDelete(ids)
      await db.thumbs.bulkDelete(ids)
      await db.media.bulkDelete(ids)
      await db.compositions.delete(id)
      await logActivity(db, { type: 'composition.purged', entityId: id, title: c.name })
    }),
  )
}

export async function listCompositions(db, { includeDeleted = false } = {}) {
  const rows = await db.compositions.toArray()
  return rows.filter((c) => includeDeleted || !c.deletedAt).sort((a, b) => b.updatedAt - a.updatedAt)
}
