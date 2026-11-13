import { describe, it, expect } from 'vitest'
import { strToU8, zipSync, unzipSync, strFromU8 } from 'fflate'
import { freshDb, fakeImage, blobBytes } from './helpers.js'
import { createItem } from '../src/db/items.js'
import { addItemImages } from '../src/db/media.js'
import { setSetting } from '../src/db/settings.js'
import { exportBackup, readBackup, applyBackup, BackupError } from '../src/db/backup.js'
import { checkIntegrity } from '../src/db/integrity.js'

async function seed(db) {
  const a = await createItem(db, 'garment', { name: 'Camisa', garmentType: 'Camisa' }, { files: [fakeImage('a.png', 1), fakeImage('b.png', 2)] })
  const y = await createItem(db, 'yacht', { brand: 'A', model: 'B' }, { files: [fakeImage('y.jpg', 3, 'jpg', 50000)] })
  await db.incomeSources.add({ id: 's1', name: 'Salario', amount: 1000, updatedAt: 1 })
  await db.incomeEntries.add({ id: 'e1', sourceId: 's1', date: '2026-01-01', amount: 1000, type: 'received', updatedAt: 1 })
  await db.compositions.add({ id: 'c1', name: 'Look', refs: [{ id: 'r1', itemId: a.item.id, anchor: { x: 0.5, y: 0.3 } }], updatedAt: 1 })
  await setSetting(db, 'currency', 'EUR')
  return { a, y }
}
const asFile = (blob) => new File([blob], 'respaldo.zip', { type: 'application/zip' })
const sortRows = (r) => r.sort((x, y) => String(x.id ?? x.key).localeCompare(String(y.id ?? y.key)))

describe('respaldo completo', () => {
  it('ida y vuelta: registros y binarios idénticos byte a byte', async () => {
    const src = await freshDb()
    await seed(src)
    const { blob, manifest } = await exportBackup(src)
    expect(manifest.counts.media).toBe(3)

    const dst = await freshDb()
    const parsed = await readBackup(asFile(blob))
    await applyBackup(dst, parsed, { mode: 'replace' })

    for (const t of ['items', 'media', 'compositions', 'incomeSources', 'incomeEntries', 'settings']) {
      expect(sortRows(await dst[t].toArray())).toEqual(sortRows(await src[t].toArray()))
    }
    for (const m of await src.media.toArray()) {
      const a = await blobBytes((await src.mediaBlobs.get(m.id)).blob)
      const b = await blobBytes((await dst.mediaBlobs.get(m.id)).blob)
      expect(b).toEqual(a)
      expect((await dst.mediaBlobs.get(m.id)).blob.type).toBe(m.mime)
    }
    expect((await checkIntegrity(dst)).issues.filter((i) => i.type !== 'missing-thumb')).toEqual([])
  })

  it('merge conserva datos locales, no duplica y actualiza solo lo más reciente', async () => {
    const src = await freshDb()
    const { a } = await seed(src)
    const { blob } = await exportBackup(src)

    const dst = await freshDb()
    const local = await createItem(dst, 'watch', { brand: 'Local', name: 'Mío' })
    await setSetting(dst, 'currency', 'COP')
    await applyBackup(dst, await readBackup(asFile(blob)), { mode: 'merge' })
    const again = await applyBackup(dst, await readBackup(asFile(blob)), { mode: 'merge' })

    expect(await dst.items.get(local.item.id)).toBeTruthy()
    expect(await dst.items.count()).toBe(3)
    expect(await dst.media.count()).toBe(3)
    expect(again.added).toBe(0)
    expect((await dst.settings.get('currency')).value).toBe('COP')

    await src.items.update(a.item.id, { title: 'Nuevo', updatedAt: Date.now() + 1000 })
    const r = await applyBackup(dst, await readBackup(asFile((await exportBackup(src)).blob)), { mode: 'merge' })
    expect(r.updated).toBe(1)
    expect((await dst.items.get(a.item.id)).title).toBe('Nuevo')
  })

  it('merge detecta la misma foto con otro id y no la duplica', async () => {
    const src = await freshDb()
    const { item } = await createItem(src, 'watch', { brand: 'X', name: 'Y' })
    const dst = await freshDb()
    await dst.items.add(item)
    await addItemImages(dst, item.id, [fakeImage('z.png', 9)])
    await addItemImages(src, item.id, [fakeImage('z.png', 9)])
    await src.items.update(item.id, { updatedAt: Date.now() + 5000 })
    await applyBackup(dst, await readBackup(asFile((await exportBackup(src)).blob)), { mode: 'merge' })
    expect(await dst.media.count()).toBe(1)
    const merged = await dst.items.get(item.id)
    expect(await dst.media.get(merged.primaryMediaId)).toBeTruthy()
  })

  it('rechaza archivos que no son respaldos o están dañados', async () => {
    await expect(readBackup(asFile(new Blob(['hola'])))).rejects.toBeInstanceOf(BackupError)
    await expect(readBackup(asFile(new Blob([zipSync({ 'x.txt': strToU8('x') })])))).rejects.toThrow(/manifest/)

    const src = await freshDb()
    await seed(src)
    const entries = unzipSync(await blobBytes((await exportBackup(src)).blob))
    const target = Object.keys(entries).find((p) => p.startsWith('files/originals/'))
    const original = entries[target]
    entries[target] = original.slice()
    entries[target][100] ^= 0xff
    await expect(readBackup(asFile(new Blob([zipSync(entries)])))).rejects.toThrow(/dañado/)
    entries[target] = original

    const m = JSON.parse(strFromU8(entries['manifest.json']))
    m.schemaVersion = 999
    entries['manifest.json'] = strToU8(JSON.stringify(m))
    await expect(readBackup(asFile(new Blob([zipSync(entries)])))).rejects.toThrow(/más reciente/)
  })

  it('replace es atómico: si falla a mitad, los datos actuales no cambian', async () => {
    const src = await freshDb()
    await seed(src)
    const parsed = await readBackup(asFile((await exportBackup(src)).blob))
    const dst = await freshDb()
    const keep = await createItem(dst, 'watch', { brand: 'Keep', name: 'Me' })
    parsed.tables.incomeEntries.push({ id: 'e1' }) // id duplicado → add() falla dentro de la transacción
    await expect(applyBackup(dst, parsed, { mode: 'replace' })).rejects.toThrow()
    expect(await dst.items.count()).toBe(1)
    expect(await dst.items.get(keep.item.id)).toBeTruthy()
  })
})
