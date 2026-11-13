// Copias de seguridad completas: registros + archivos binarios (fotos, miniaturas, modelos 3D).
//
// Formato (ZIP):
//   manifest.json                 formato, versiones, recuentos y sha256 de cada archivo
//   data/<tabla>.json             registros de cada tabla (sin binarios)
//   files/originals/<id>.<ext>    archivo original, sin recomprimir
//   files/thumbs/<id>.<ext>       miniatura (opcional; se puede regenerar)
import { Zip, ZipDeflate, ZipPassThrough, unzipSync, strToU8, strFromU8 } from 'fflate'
import { CURRENT_SCHEMA_VERSION } from './schema.js'
import { guardWrite } from './errors.js'
import { setMeta } from './settings.js'
import { sha256Hex, EXT_BY_MIME } from '../lib/files.js'
import { isKind } from '../domain/kinds.js'

export const BACKUP_FORMAT = 'odissey-patrimonio-backup'
export const BACKUP_FORMAT_VERSION = 1
export const EXPORT_TABLES = ['items', 'media', 'compositions', 'incomeSources', 'incomeEntries', 'settings']
const MUTABLE_TABLES = ['items', 'compositions', 'incomeSources', 'incomeEntries']

export class BackupError extends Error {
  constructor(message) { super(message); this.name = 'BackupError' }
}

const extOf = (mime, fallback = 'bin') => EXT_BY_MIME[mime] || fallback

export function backupFileName(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `odissey-respaldo-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}.zip`
}

/** Genera el respaldo completo como Blob ZIP. */
export async function exportBackup(db, { appVersion = 'dev', onProgress } = {}) {
  const snapshot = await db.transaction('r', EXPORT_TABLES.map((t) => db[t]), async () => {
    const out = {}
    for (const t of EXPORT_TABLES) out[t] = await db[t].toArray()
    return out
  })

  const chunks = []
  let zipError = null
  const zip = new Zip((err, chunk) => { if (err) zipError = err; else chunks.push(chunk) })
  const files = {}
  const addFile = async (path, bytes, { compress, role, id }) => {
    files[path] = { sha256: await sha256Hex(bytes), size: bytes.byteLength, role, id }
    const entry = compress ? new ZipDeflate(path, { level: 6 }) : new ZipPassThrough(path)
    zip.add(entry)
    entry.push(bytes, true)
  }

  for (const t of EXPORT_TABLES) {
    await addFile(`data/${t}.json`, strToU8(JSON.stringify(snapshot[t])), { compress: true, role: 'table', id: t })
  }

  const missing = []
  const total = snapshot.media.length
  let done = 0
  for (const m of snapshot.media) {
    // Los binarios se leen uno a uno para no cargar toda la colección en memoria a la vez.
    const original = (await db.mediaBlobs.get(m.id))?.blob
    if (original) {
      await addFile(`files/originals/${m.id}.${extOf(m.mime, m.ext)}`, new Uint8Array(await original.arrayBuffer()), { compress: false, role: 'original', id: m.id })
    } else {
      missing.push(m.id)
    }
    const thumb = (await db.thumbs.get(m.id))?.blob
    if (thumb) {
      await addFile(`files/thumbs/${m.id}.${extOf(thumb.type, 'img')}`, new Uint8Array(await thumb.arrayBuffer()), { compress: false, role: 'thumb', id: m.id })
    }
    onProgress?.(++done / Math.max(1, total))
  }

  const counts = Object.fromEntries(EXPORT_TABLES.map((t) => [t, snapshot[t].length]))
  const manifest = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appVersion,
    createdAt: new Date().toISOString(),
    counts,
    missingOriginals: missing,
    files,
  }
  const mf = new ZipDeflate('manifest.json', { level: 6 })
  zip.add(mf)
  mf.push(strToU8(JSON.stringify(manifest, null, 2)), true)
  zip.end()
  if (zipError) throw new BackupError(`No se pudo crear el ZIP: ${zipError.message}`)

  const blob = new Blob(chunks, { type: 'application/zip' })
  return { blob, manifest }
}

export async function markBackupDone(db, manifest, size) {
  await setMeta(db, 'lastBackup', { at: Date.now(), counts: manifest.counts, size })
}

const isId = (v) => typeof v === 'string' && v.length > 0 && v.length <= 100

/**
 * Lee y valida un respaldo sin tocar la base de datos.
 * Comprueba formato, versión, presencia de archivos y sha256 de cada uno.
 */
export async function readBackup(file) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let entries
  try {
    entries = unzipSync(bytes)
  } catch {
    throw new BackupError('El archivo no es un ZIP válido o está dañado.')
  }
  if (!entries['manifest.json']) throw new BackupError('El ZIP no contiene manifest.json: no es un respaldo de esta aplicación.')
  let manifest
  try {
    manifest = JSON.parse(strFromU8(entries['manifest.json']))
  } catch {
    throw new BackupError('manifest.json está dañado.')
  }
  if (manifest.format !== BACKUP_FORMAT) throw new BackupError('El archivo no es un respaldo de esta aplicación.')
  if (!(manifest.formatVersion >= 1 && manifest.formatVersion <= BACKUP_FORMAT_VERSION)) {
    throw new BackupError(`Formato de respaldo v${manifest.formatVersion} no compatible. Actualiza la aplicación.`)
  }
  if (manifest.schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new BackupError('El respaldo fue creado por una versión más reciente de la aplicación. Actualízala antes de restaurar.')
  }

  const corrupt = []
  for (const [path, info] of Object.entries(manifest.files || {})) {
    const data = entries[path]
    if (!data) { corrupt.push(`${path} (falta)`); continue }
    if (data.byteLength !== info.size || (await sha256Hex(data)) !== info.sha256) corrupt.push(`${path} (no coincide la suma de verificación)`)
  }
  if (corrupt.length) {
    throw new BackupError(`El respaldo está dañado: ${corrupt.slice(0, 5).join(', ')}${corrupt.length > 5 ? '…' : ''}`)
  }

  const tables = {}
  for (const t of EXPORT_TABLES) {
    const raw = entries[`data/${t}.json`]
    if (!raw) throw new BackupError(`Falta la tabla ${t} en el respaldo.`)
    const arr = JSON.parse(strFromU8(raw))
    if (!Array.isArray(arr)) throw new BackupError(`La tabla ${t} no tiene un formato válido.`)
    tables[t] = arr
  }

  const warnings = []
  const originals = new Map()
  const thumbs = new Map()
  for (const [path, info] of Object.entries(manifest.files)) {
    if (info.role === 'original') originals.set(info.id, path)
    if (info.role === 'thumb') thumbs.set(info.id, path)
  }

  const validItems = tables.items.filter((r) => isId(r?.id) && isKind(r.kind) && r.fields && typeof r.fields === 'object')
  if (validItems.length !== tables.items.length) warnings.push(`${tables.items.length - validItems.length} activo(s) con formato desconocido se omitirán.`)
  tables.items = validItems

  const validMedia = tables.media.filter((m) => isId(m?.id) && isId(m.ownerId) && typeof m.mime === 'string' && originals.has(m.id))
  if (validMedia.length !== tables.media.length) warnings.push(`${tables.media.length - validMedia.length} archivo(s) sin binario original se omitirán.`)
  tables.media = validMedia

  for (const t of ['compositions', 'incomeSources', 'incomeEntries']) tables[t] = tables[t].filter((r) => isId(r?.id))
  tables.settings = tables.settings.filter((r) => typeof r?.key === 'string')

  const totalBytes = Object.values(manifest.files).reduce((s, f) => s + (f.size || 0), 0)
  return {
    manifest, tables, warnings, totalBytes,
    getOriginal: (id, mime) => new Blob([entries[originals.get(id)]], { type: mime }),
    getThumb: (id) => {
      const p = thumbs.get(id)
      return p ? new Blob([entries[p]], { type: p.endsWith('.webp') ? 'image/webp' : 'application/octet-stream' }) : null
    },
  }
}

/**
 * Aplica un respaldo validado.
 *  mode 'merge'   conserva los datos actuales; añade lo nuevo y actualiza solo registros más recientes.
 *  mode 'replace' sustituye todo (requiere confirmación previa en la UI). Es atómico: si falla, no cambia nada.
 */
export async function applyBackup(db, parsed, { mode }) {
  if (!['merge', 'replace'].includes(mode)) throw new BackupError('Modo de restauración no válido')
  const { tables } = parsed
  const stats = { added: 0, updated: 0, skipped: 0, files: 0, duplicates: 0 }
  const writeTables = [...EXPORT_TABLES, 'mediaBlobs', 'thumbs'].map((t) => db[t])

  await guardWrite(() =>
    db.transaction('rw', writeTables, async () => {
      if (mode === 'replace') {
        for (const t of [...EXPORT_TABLES, 'mediaBlobs', 'thumbs']) await db[t].clear()
      }

      for (const t of MUTABLE_TABLES) {
        for (const rec of tables[t]) {
          const existing = mode === 'merge' ? await db[t].get(rec.id) : null
          if (!existing) { await db[t].add(rec); stats.added++ }
          else if ((rec.updatedAt ?? 0) > (existing.updatedAt ?? 0)) { await db[t].put(rec); stats.updated++ }
          else stats.skipped++
        }
      }

      const remap = new Map()
      for (const m of tables.media) {
        const existing = mode === 'merge' ? await db.media.get(m.id) : null
        if (existing) {
          if (!(await db.mediaBlobs.get(m.id))) { await db.mediaBlobs.put({ id: m.id, blob: parsed.getOriginal(m.id, m.mime) }); stats.files++ }
          stats.skipped++
          continue
        }
        if (mode === 'merge') {
          const same = (await db.media.where('[ownerId+role]').equals([m.ownerId, m.role]).toArray()).find((x) => x.sha256 === m.sha256)
          if (same) { remap.set(m.id, same.id); stats.duplicates++; continue }
        }
        await db.media.add(m)
        await db.mediaBlobs.add({ id: m.id, blob: parsed.getOriginal(m.id, m.mime) })
        const thumb = parsed.getThumb(m.id)
        if (thumb) await db.thumbs.add({ id: m.id, blob: thumb })
        stats.files++
      }
      for (const [from, to] of remap) {
        await db.items.where('id').anyOf(tables.items.map((i) => i.id)).modify((i) => {
          if (i.primaryMediaId === from) i.primaryMediaId = to
          if (i.model3dMediaId === from) i.model3dMediaId = to
        })
      }

      for (const s of tables.settings) {
        if (mode === 'replace' || !(await db.settings.get(s.key))) await db.settings.put(s)
      }
    }),
  )
  await setMeta(db, 'lastRestore', { at: Date.now(), mode, stats, backupCreatedAt: parsed.manifest.createdAt })
  return stats
}
