import { describe, it, expect } from 'vitest'
import { freshDb, fakeImage } from './helpers.js'
import { createItem } from '../src/db/items.js'
import { checkIntegrity, repairSafeIssues } from '../src/db/integrity.js'
import { guardWrite, StorageFullError, describeDbError } from '../src/db/errors.js'

describe('integridad', () => {
  it('detecta problemas sin borrar nada y repara solo lo seguro', async () => {
    const db = await freshDb()
    const { item } = await createItem(db, 'watch', { brand: 'A', name: 'B' }, { files: [fakeImage()] })
    await db.mediaBlobs.delete(item.primaryMediaId)
    await db.items.update(item.id, { primaryMediaId: 'no-existe' })
    await db.mediaBlobs.add({ id: 'huerfano', blob: new Blob(['x']) })
    const r = await checkIntegrity(db)
    expect(r.ok).toBe(false)
    expect(r.issues.map((i) => i.type).sort()).toEqual(['broken-primary', 'missing-blob', 'missing-thumb', 'orphan-blob'])
    await repairSafeIssues(db, r)
    expect((await db.items.get(item.id)).primaryMediaId).not.toBe('no-existe')
    expect(await db.mediaBlobs.get('huerfano')).toBeTruthy()
    expect(await db.media.count()).toBe(1)
  })
})

describe('errores de cuota', () => {
  it('se convierten en un mensaje comprensible', async () => {
    const quota = Object.assign(new Error('full'), { name: 'AbortError', inner: { name: 'QuotaExceededError' } })
    await expect(guardWrite(() => Promise.reject(quota))).rejects.toBeInstanceOf(StorageFullError)
    expect(describeDbError({ name: 'VersionError' })).toMatch(/más reciente/)
  })
})
