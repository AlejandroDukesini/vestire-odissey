import { describe, it, expect } from 'vitest'
import { createDb, SCHEMA_VERSIONS, CURRENT_SCHEMA_VERSION } from '../src/db/schema.js'
import { createItem } from '../src/db/items.js'
import { checkIntegrity } from '../src/db/integrity.js'
import { fakeImage } from './helpers.js'

describe('migraciones de esquema', () => {
  it('las versiones son crecientes y nunca eliminan tablas', () => {
    const seen = new Set()
    let last = 0
    for (const v of SCHEMA_VERSIONS) {
      expect(v.version).toBeGreaterThan(last)
      last = v.version
      for (const t of seen) expect(v.stores[t], `la versión ${v.version} elimina ${t}`).toBeTruthy()
      for (const [t, s] of Object.entries(v.stores)) if (s !== null) seen.add(t)
    }
    expect(CURRENT_SCHEMA_VERSION).toBe(last)
  })

  it('una actualización aditiva conserva todos los datos y binarios', async () => {
    const name = `mig-${Date.now()}`
    const v1 = createDb(name)
    await v1.open()
    const { item } = await createItem(v1, 'car', { brand: 'A', model: 'B' }, { files: [fakeImage()] })
    v1.close()

    // Versión futura simulada: nuevo índice y un campo completado en el upgrade.
    const next = [
      ...SCHEMA_VERSIONS,
      {
        version: CURRENT_SCHEMA_VERSION + 1,
        stores: { ...SCHEMA_VERSIONS.at(-1).stores, items: 'id, kind, [kind+createdAt], updatedAt, value' },
        upgrade: (tx) => tx.table('items').toCollection().modify((i) => { i.tags ??= [] }),
      },
    ]
    const v2 = createDb(name, next)
    await v2.open()
    const migrated = await v2.items.get(item.id)
    expect(migrated.fields).toEqual(item.fields)
    expect(migrated.tags).toEqual([])
    expect(await v2.mediaBlobs.get(item.primaryMediaId)).toBeTruthy()
    expect((await checkIntegrity(v2)).ok).toBe(true)
  })

  it('una versión antigua de la app no destruye datos guardados por una versión más nueva', async () => {
    const name = `mig-new-${Date.now()}`
    const future = createDb(name, [...SCHEMA_VERSIONS, { version: CURRENT_SCHEMA_VERSION + 5, stores: SCHEMA_VERSIONS.at(-1).stores }])
    await future.open()
    await future.items.add({ id: 'x', kind: 'car', fields: {}, createdAt: 1 })
    future.close()
    // Dexie 4 abre en modo compatible si el esquema es compatible; si no, lanza VersionError.
    // En ambos casos los datos deben seguir intactos.
    const old = createDb(name)
    try { await old.open(); old.close() } catch (e) { expect(e.name).toBe('VersionError') }
    await future.open()
    expect(await future.items.get('x')).toBeTruthy()
  })
})
