import { newId } from './schema.js'
import { guardWrite, NotFoundError } from './errors.js'
import { inspectImage, makeThumbnail, FileValidationError } from '../lib/files.js'

export const MEDIA_ROLES = ['photo', 'model3d', 'logo', 'screenshot', 'composition', 'cutout']
const PHOTO_LIKE = new Set(['photo', 'cutout'])

/**
 * Valida y prepara imágenes FUERA de cualquier transacción (decodificar y hashear es asíncrono
 * y no puede ocurrir dentro de una transacción de IndexedDB).
 */
export async function prepareImages(files, { maxBytes } = {}) {
  const prepared = []
  const rejected = []
  for (const file of files) {
    try {
      const info = await inspectImage(file, { maxBytes })
      const original = new Blob([info.bytes], { type: info.mime })
      const thumb = await makeThumbnail(original)
      prepared.push({
        id: newId(),
        name: (file.name || `imagen.${info.ext}`).slice(0, 200),
        mime: info.mime,
        ext: info.ext,
        size: info.size,
        sha256: info.sha256,
        width: thumb?.width ?? null,
        height: thumb?.height ?? null,
        original,
        thumb: thumb?.blob ?? null,
      })
    } catch (e) {
      if (e instanceof FileValidationError) rejected.push({ name: e.fileName, reason: e.message })
      else rejected.push({ name: file.name || 'archivo', reason: 'No se pudo leer el archivo' })
    }
  }
  return { prepared, rejected }
}

/**
 * Escribe imágenes preparadas dentro de la transacción activa. Omite duplicados (mismo sha256
 * para el mismo propietario y rol). Debe llamarse dentro de db.transaction(...).
 */
export async function writePreparedMedia(db, { ownerId, ownerType, role }, prepared) {
  const existing = await db.media.where('[ownerId+role]').equals([ownerId, role]).toArray()
  const seen = new Set(existing.map((m) => m.sha256))
  const added = []
  const duplicates = []
  const now = Date.now()
  for (const p of prepared) {
    if (seen.has(p.sha256)) { duplicates.push({ name: p.name, reason: `"${p.name}" ya estaba guardada` }); continue }
    seen.add(p.sha256)
    const record = {
      id: p.id, ownerId, ownerType, role, name: p.name, mime: p.mime, ext: p.ext, size: p.size,
      sha256: p.sha256, width: p.width, height: p.height, createdAt: now + added.length,
    }
    await db.media.add(record)
    await db.mediaBlobs.add({ id: p.id, blob: p.original })
    if (p.thumb) await db.thumbs.add({ id: p.id, blob: p.thumb })
    added.push(record)
  }
  return { added, duplicates }
}

/** Añade imágenes a un activo existente. Asigna imagen principal si no tenía. */
export async function addItemImages(db, itemId, files, { role = 'photo', maxBytes } = {}) {
  const { prepared, rejected } = await prepareImages(files, { maxBytes })
  const result = await guardWrite(() =>
    db.transaction('rw', db.items, db.media, db.mediaBlobs, db.thumbs, async () => {
      const item = await db.items.get(itemId)
      if (!item) throw new NotFoundError('El activo')
      const r = await writePreparedMedia(db, { ownerId: itemId, ownerType: 'item', role }, prepared)
      const patch = { updatedAt: Date.now() }
      if (PHOTO_LIKE.has(role) && !item.primaryMediaId && r.added.length) patch.primaryMediaId = r.added[0].id
      await db.items.update(itemId, patch)
      return r
    }),
  )
  return { added: result.added, rejected: [...rejected, ...result.duplicates] }
}

export async function setPrimaryMedia(db, itemId, mediaId) {
  await guardWrite(() =>
    db.transaction('rw', db.items, db.media, async () => {
      const m = await db.media.get(mediaId)
      if (!m || m.ownerId !== itemId || !PHOTO_LIKE.has(m.role)) throw new NotFoundError('La fotografía')
      await db.items.update(itemId, { primaryMediaId: mediaId, updatedAt: Date.now() })
    }),
  )
}

/** Elimina un archivo (acción explícita del usuario). Reasigna la imagen principal si hace falta. */
export async function deleteMedia(db, mediaId) {
  await guardWrite(() =>
    db.transaction('rw', db.items, db.media, db.mediaBlobs, db.thumbs, async () => {
      const m = await db.media.get(mediaId)
      if (!m) return
      await db.media.delete(mediaId)
      await db.mediaBlobs.delete(mediaId)
      await db.thumbs.delete(mediaId)
      if (m.ownerType === 'item') {
        const item = await db.items.get(m.ownerId)
        if (item && (item.primaryMediaId === mediaId || item.model3dMediaId === mediaId)) {
          const patch = { updatedAt: Date.now() }
          if (item.primaryMediaId === mediaId) {
            const next = (await db.media.where('ownerId').equals(item.id).sortBy('createdAt')).find((x) => PHOTO_LIKE.has(x.role))
            patch.primaryMediaId = next?.id ?? null
          }
          if (item.model3dMediaId === mediaId) patch.model3dMediaId = null
          await db.items.update(item.id, patch)
        }
      }
    }),
  )
}

export async function listMedia(db, ownerId, role) {
  const rows = role
    ? await db.media.where('[ownerId+role]').equals([ownerId, role]).toArray()
    : await db.media.where('ownerId').equals(ownerId).toArray()
  return rows.sort((a, b) => a.createdAt - b.createdAt)
}

/** Devuelve el Blob de un archivo. variant 'thumb' cae al original si no hay miniatura. */
export async function getMediaBlob(db, mediaId, variant = 'original') {
  if (variant === 'thumb') {
    const t = await db.thumbs.get(mediaId)
    if (t) return t.blob
  }
  return (await db.mediaBlobs.get(mediaId))?.blob ?? null
}
