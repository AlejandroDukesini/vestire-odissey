import Dexie from 'dexie'
import { newId } from './schema.js'
import { guardWrite, NotFoundError, ValidationError } from './errors.js'
import { prepareImages, writePreparedMedia } from './media.js'
import { KINDS, isKind, itemTitle, validateFields, CURRENCIES } from '../domain/kinds.js'

function buildRecordParts(kind, input) {
  const { fields, errors } = validateFields(kind, input)
  const currency = input.currency ?? null
  if (currency !== null && !CURRENCIES.includes(currency)) errors.currency = 'Moneda no válida'
  return { fields, errors, currency }
}

/**
 * Crea un activo, opcionalmente con fotografías, en una sola transacción.
 * Si la categoría exige foto (yates) y no hay ninguna válida, no se guarda nada.
 */
export async function createItem(db, kind, input, { files = [], maxBytes } = {}) {
  if (!isKind(kind)) throw new ValidationError({ _kind: 'Tipo desconocido' })
  const { fields, errors, currency } = buildRecordParts(kind, input)
  if (Object.keys(errors).length) throw new ValidationError(errors)

  const { prepared, rejected } = await prepareImages(files, { maxBytes })
  if (KINDS[kind].requiresPhoto && prepared.length === 0) {
    throw new ValidationError(
      { photos: 'Es obligatorio subir al menos una fotografía válida' },
      rejected.length ? rejected.map((r) => r.reason).join('. ') : undefined,
    )
  }

  const now = Date.now()
  const item = {
    id: newId(), kind, fields, title: itemTitle(kind, fields),
    value: fields.value ?? null, currency,
    primaryMediaId: null, model3dMediaId: null, createdAt: now, updatedAt: now,
  }
  const dup = await guardWrite(() =>
    db.transaction('rw', db.items, db.media, db.mediaBlobs, db.thumbs, async () => {
      await db.items.add(item)
      const r = await writePreparedMedia(db, { ownerId: item.id, ownerType: 'item', role: 'photo' }, prepared)
      if (r.added.length) {
        item.primaryMediaId = r.added[0].id
        await db.items.update(item.id, { primaryMediaId: item.primaryMediaId })
      }
      return r.duplicates
    }),
  )
  return { item, rejected: [...rejected, ...dup] }
}

export async function updateItem(db, id, input) {
  return guardWrite(() =>
    db.transaction('rw', db.items, async () => {
      const current = await db.items.get(id)
      if (!current) throw new NotFoundError('El activo')
      const { fields, errors, currency } = buildRecordParts(current.kind, { ...input, currency: input.currency ?? current.currency })
      if (Object.keys(errors).length) throw new ValidationError(errors)
      const patch = {
        fields, title: itemTitle(current.kind, fields), value: fields.value ?? null, currency, updatedAt: Date.now(),
      }
      await db.items.update(id, patch)
      return { ...current, ...patch }
    }),
  )
}

/** Elimina un activo y sus archivos. Solo se invoca tras confirmación explícita del usuario. */
export async function deleteItem(db, id) {
  await guardWrite(() =>
    db.transaction('rw', db.items, db.media, db.mediaBlobs, db.thumbs, async () => {
      const mediaIds = await db.media.where('ownerId').equals(id).primaryKeys()
      await db.mediaBlobs.bulkDelete(mediaIds)
      await db.thumbs.bulkDelete(mediaIds)
      await db.media.bulkDelete(mediaIds)
      await db.items.delete(id)
    }),
  )
}

export const getItem = (db, id) => db.items.get(id)

export async function listItems(db, kind) {
  const q = kind ? db.items.where('[kind+createdAt]').between([kind, Dexie.minKey], [kind, Dexie.maxKey]) : db.items.toCollection()
  return (await q.toArray()).sort((a, b) => b.createdAt - a.createdAt)
}
