import { guardWrite } from './errors.js'
import { setMeta } from './settings.js'

/**
 * Comprueba la coherencia de los datos SIN borrar nada. Devuelve un informe con incidencias.
 * Tipos de incidencia:
 *  missing-blob       metadato de archivo sin binario original (pérdida real de datos)
 *  orphan-media       archivo cuyo propietario ya no existe
 *  orphan-blob        binario sin metadato (espacio ocupado sin uso)
 *  broken-primary     activo cuya imagen principal no existe (reparable)
 *  missing-thumb      miniatura ausente (reparable regenerándola)
 *  broken-ref         referencia de composición a un elemento eliminado (informativa)
 *  orphan-entry       ingreso registrado de una fuente inexistente
 */
export async function checkIntegrity(db) {
  return db.transaction('r', db.tables, async () => {
    const [items, media, blobIds, thumbIds, compositions, sources, entries] = await Promise.all([
      db.items.toArray(),
      db.media.toArray(),
      db.mediaBlobs.toCollection().primaryKeys(),
      db.thumbs.toCollection().primaryKeys(),
      db.compositions.toArray(),
      db.incomeSources.toArray(),
      db.incomeEntries.toArray(),
    ])
    const issues = []
    const itemIds = new Set(items.map((i) => i.id))
    const compIds = new Set(compositions.map((c) => c.id))
    const mediaIds = new Set(media.map((m) => m.id))
    const blobSet = new Set(blobIds)
    const thumbSet = new Set(thumbIds)
    const sourceIds = new Set(sources.map((s) => s.id))

    for (const m of media) {
      if (!blobSet.has(m.id)) issues.push({ type: 'missing-blob', id: m.id, detail: m.name })
      const ownerOk = m.ownerType === 'composition' ? compIds.has(m.ownerId) : itemIds.has(m.ownerId)
      if (!ownerOk) issues.push({ type: 'orphan-media', id: m.id, detail: m.name })
      if (m.mime?.startsWith('image/') && !thumbSet.has(m.id)) issues.push({ type: 'missing-thumb', id: m.id })
    }
    for (const id of blobIds) if (!mediaIds.has(id)) issues.push({ type: 'orphan-blob', id })
    for (const i of items) {
      if (i.primaryMediaId && !mediaIds.has(i.primaryMediaId)) issues.push({ type: 'broken-primary', id: i.id, detail: i.title })
    }
    for (const c of compositions) {
      for (const r of c.refs || []) {
        if (r.itemId && !itemIds.has(r.itemId)) issues.push({ type: 'broken-ref', id: c.id, detail: r.id })
      }
    }
    for (const e of entries) if (!sourceIds.has(e.sourceId)) issues.push({ type: 'orphan-entry', id: e.id })

    const serious = issues.filter((i) => ['missing-blob', 'orphan-media', 'orphan-entry'].includes(i.type))
    return {
      checkedAt: Date.now(),
      ok: serious.length === 0,
      counts: {
        items: items.length, media: media.length, compositions: compositions.length,
        incomeSources: sources.length, incomeEntries: entries.length,
      },
      issues,
    }
  })
}

/** Ejecuta la comprobación y guarda el resultado resumido. */
export async function runIntegrityCheck(db) {
  const report = await checkIntegrity(db)
  const summary = { checkedAt: report.checkedAt, ok: report.ok, issues: report.issues.length, counts: report.counts }
  try { await setMeta(db, 'lastIntegrityCheck', summary) } catch { /* el informe sigue siendo válido aunque no se guarde */ }
  return report
}

/** Reparaciones seguras: nunca eliminan información del usuario. */
export async function repairSafeIssues(db, report, { makeThumb } = {}) {
  let fixed = 0
  for (const issue of report.issues) {
    if (issue.type === 'broken-primary') {
      await guardWrite(() =>
        db.transaction('rw', db.items, db.media, async () => {
          const next = (await db.media.where('ownerId').equals(issue.id).sortBy('createdAt')).find((m) => m.role === 'photo')
          await db.items.update(issue.id, { primaryMediaId: next?.id ?? null })
        }),
      )
      fixed++
    } else if (issue.type === 'missing-thumb' && makeThumb) {
      const row = await db.mediaBlobs.get(issue.id)
      if (!row) continue
      const t = await makeThumb(row.blob)
      if (t) { await guardWrite(() => db.thumbs.put({ id: issue.id, blob: t.blob })); fixed++ }
    }
  }
  return fixed
}
