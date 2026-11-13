import Dexie from 'dexie'
import { newId } from './schema.js'
import { guardWrite, NotFoundError, ValidationError } from './errors.js'
import { prepareImages, writePreparedMedia } from './media.js'
import { logActivity } from './activity.js'
import { KINDS, isKind, itemTitle, validateFields, CURRENCIES } from '../domain/kinds.js'

const ITEM_TABLES = (db) => [db.items, db.media, db.mediaBlobs, db.thumbs, db.activity]

function checkCurrency(currency, errors) {
  if (currency != null && !CURRENCIES.includes(currency)) errors.currency = 'Moneda no válida'
}

/**
 * Crea un activo, opcionalmente con fotografías, en una sola transacción.
 * Si la categoría exige foto (yates) y no hay ninguna válida, no se guarda nada.
 */
export async function createItem(db, kind, input, { files = [], maxBytes } = {}) {
  if (!isKind(kind)) throw new ValidationError({ _kind: 'Tipo desconocido' })
  const { fields, errors } = validateFields(kind, input)
  const currency = input.currency ?? null
  checkCurrency(currency, errors)
  if (Object.keys(errors).length) throw new ValidationError(errors)

  const { prepared, rejected } = await prepareImages(files, { maxBytes })
  if (KINDS[kind].requiresPhoto && prepared.length === 0) {
    throw new ValidationError(
      { photos: 'Es obligatorio subir al menos una fotografía válida' },
      rejected.length ? rejected.map((r) => r.reason).join('. ') : 'Es obligatorio subir al menos una fotografía válida',
    )
  }

  const now = Date.now()
  const item = {
    id: newId(), kind, fields, title: itemTitle(kind, fields),
    value: fields.value ?? null, currency, featured: false,
    primaryMediaId: null, model3dMediaId: null, createdAt: now, updatedAt: now, deletedAt: null,
  }
  const dup = await guardWrite(() =>
    db.transaction('rw', ITEM_TABLES(db), async () => {
      await db.items.add(item)
      const r = await writePreparedMedia(db, { ownerId: item.id, ownerType: 'item', role: 'photo' }, prepared)
      if (r.added.length) {
        item.primaryMediaId = r.added[0].id
        await db.items.update(item.id, { primaryMediaId: item.primaryMediaId })
      }
      await logActivity(db, { type: 'item.created', entityId: item.id, kind, title: item.title })
      return r.duplicates
    }),
  )
  return { item, rejected: [...rejected, ...dup] }
}

/**
 * Edita un activo. Fusiona con los campos actuales: una clave AUSENTE en `input` conserva su valor;
 * solo una clave presente con valor vacío ('' o null) borra el campo de forma explícita.
 * Las fotografías, el modelo 3D y las relaciones no se tocan.
 */
export async function updateItem(db, id, input) {
  return guardWrite(() =>
    db.transaction('rw', db.items, db.activity, async () => {
      const current = await db.items.get(id)
      if (!current) throw new NotFoundError('El activo')
      const merged = { ...current.fields, ...input }
      const { fields, errors } = validateFields(current.kind, merged)
      const currency = 'currency' in input ? input.currency || null : current.currency
      checkCurrency(currency, errors)
      if (Object.keys(errors).length) throw new ValidationError(errors)
      const patch = {
        fields, title: itemTitle(current.kind, fields), value: fields.value ?? null, currency, updatedAt: Date.now(),
      }
      await db.items.update(id, patch)
      await logActivity(db, { type: 'item.updated', entityId: id, kind: current.kind, title: patch.title })
      return { ...current, ...patch }
    }),
  )
}

export async function setFeatured(db, id, featured) {
  await guardWrite(() => db.items.update(id, { featured: !!featured, updatedAt: Date.now() }))
}

/** Papelera: eliminación lógica. Conserva fotos, modelo y relaciones para poder restaurar. */
export async function trashItem(db, id) {
  await guardWrite(() =>
    db.transaction('rw', db.items, db.activity, async () => {
      const item = await db.items.get(id)
      if (!item) throw new NotFoundError('El activo')
      await db.items.update(id, { deletedAt: Date.now() })
      await logActivity(db, { type: 'item.trashed', entityId: id, kind: item.kind, title: item.title })
    }),
  )
}

export async function restoreItem(db, id) {
  await guardWrite(() =>
    db.transaction('rw', db.items, db.activity, async () => {
      const item = await db.items.get(id)
      if (!item) throw new NotFoundError('El activo')
      await db.items.update(id, { deletedAt: null, updatedAt: Date.now() })
      await logActivity(db, { type: 'item.restored', entityId: id, kind: item.kind, title: item.title })
    }),
  )
}

/**
 * Eliminación definitiva (solo desde la papelera y con confirmación).
 * Borra únicamente los archivos cuyo propietario es este activo. Las composiciones que lo
 * referencian NO se modifican: muestran el elemento como eliminado.
 */
export async function purgeItem(db, id) {
  await guardWrite(() =>
    db.transaction('rw', ITEM_TABLES(db), async () => {
      const item = await db.items.get(id)
      if (!item) return
      const mediaIds = await db.media.where('ownerId').equals(id).primaryKeys()
      await db.mediaBlobs.bulkDelete(mediaIds)
      await db.thumbs.bulkDelete(mediaIds)
      await db.media.bulkDelete(mediaIds)
      await db.items.delete(id)
      await logActivity(db, { type: 'item.purged', entityId: id, kind: item.kind, title: item.title })
    }),
  )
}

export const getItem = (db, id) => db.items.get(id)

/** Activos vigentes (excluye la papelera), del más reciente al más antiguo. */
export async function listItems(db, kind, { includeDeleted = false } = {}) {
  const q = kind
    ? db.items.where('[kind+createdAt]').between([kind, Dexie.minKey], [kind, Dexie.maxKey])
    : db.items.toCollection()
  const rows = await q.toArray()
  return rows.filter((i) => includeDeleted || !i.deletedAt).sort((a, b) => b.createdAt - a.createdAt)
}

export async function listTrashedItems(db) {
  return (await db.items.toArray()).filter((i) => i.deletedAt).sort((a, b) => b.deletedAt - a.deletedAt)
}

/** Relaciones de un activo con el resto de registros (para la ficha y la confirmación de borrado). */
export async function itemRelations(db, id) {
  const [compositions, incomeSources, photos] = await Promise.all([
    db.compositions.filter((c) => (c.refs || []).some((r) => r.itemId === id)).toArray(),
    db.incomeSources.filter((s) => s.linkedItemId === id).toArray(),
    db.media.where('ownerId').equals(id).count(),
  ])
  return {
    compositions: compositions.filter((c) => !c.deletedAt),
    incomeSources: incomeSources.filter((s) => !s.deletedAt),
    files: photos,
  }
}
