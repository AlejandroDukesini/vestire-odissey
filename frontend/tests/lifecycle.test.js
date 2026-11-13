import { describe, it, expect } from 'vitest'
import { freshDb, fakeImage } from './helpers.js'
import { createDb, SCHEMA_VERSIONS } from '../src/db/schema.js'
import {
  createItem, updateItem, trashItem, restoreItem, purgeItem, listItems, listTrashedItems, itemRelations, setFeatured,
} from '../src/db/items.js'
import { addItemImages, listMedia, moveMedia, setItemModel, deleteMedia } from '../src/db/media.js'
import { createComposition, updateComposition, trashComposition, purgeComposition, listCompositions } from '../src/db/compositions.js'
import { createSource, updateSource, addEntry, trashSource, purgeSource, listSources, listEntries } from '../src/db/income.js'
import { recentActivity } from '../src/db/activity.js'
import { exportBackup, readBackup, applyBackup } from '../src/db/backup.js'
import { computeAssetStats, computeIncomeStats, NO_CURRENCY } from '../src/domain/stats.js'
import { monthlyEquivalent } from '../src/domain/income.js'
import { ValidationError } from '../src/db/errors.js'

const shirt = { name: 'Camisa blanca', garmentType: 'Camisa', color: 'Blanco', size: 'M', material: 'Algodón', value: 120 }

function fakeGlb(seed = 1) {
  const bytes = new Uint8Array(64)
  bytes.set([0x67, 0x6c, 0x54, 0x46]) // 'glTF'
  new DataView(bytes.buffer).setUint32(4, 2, true)
  new DataView(bytes.buffer).setUint32(8, 64, true)
  bytes[63] = seed
  return new File([bytes], 'modelo.glb', { type: 'model/gltf-binary' })
}

describe('edición sin pérdidas', () => {
  it('una edición parcial conserva los demás campos, fotos y modelo', async () => {
    const db = await freshDb()
    const { item } = await createItem(db, 'garment', { ...shirt, currency: 'EUR' }, { files: [fakeImage('a.png', 1), fakeImage('b.png', 2)] })
    await setItemModel(db, item.id, fakeGlb())
    const edited = await updateItem(db, item.id, { color: 'Marfil' })
    expect(edited.fields).toMatchObject({ name: 'Camisa blanca', size: 'M', material: 'Algodón', color: 'Marfil', value: 120 })
    expect(edited.currency).toBe('EUR')
    expect(edited.primaryMediaId).toBe(item.primaryMediaId)
    expect(edited.model3dMediaId).toBeTruthy()
    expect(await listMedia(db, item.id, 'photo')).toHaveLength(2)
  })
  it('solo un valor vacío explícito borra un campo opcional; los obligatorios no se pueden vaciar', async () => {
    const db = await freshDb()
    const { item } = await createItem(db, 'garment', shirt)
    const e = await updateItem(db, item.id, { material: '' })
    expect(e.fields.material).toBeUndefined()
    await expect(updateItem(db, item.id, { name: '' })).rejects.toBeInstanceOf(ValidationError)
    expect((await db.items.get(item.id)).fields.name).toBe('Camisa blanca')
  })
  it('valida año y tipo de vehículo', async () => {
    const db = await freshDb()
    await expect(createItem(db, 'car', { brand: 'A', model: 'B', year: 1700 })).rejects.toBeInstanceOf(ValidationError)
    await expect(createItem(db, 'car', { brand: 'A', model: 'B', year: 2020.5 })).rejects.toBeInstanceOf(ValidationError)
    const { item } = await createItem(db, 'motorcycle', { brand: 'A', model: 'B', year: '2019', bodyType: 'Naked' })
    expect(item.fields.year).toBe(2019)
  })
  it('valida la lista de sitios asociados', async () => {
    const db = await freshDb()
    const { item } = await createItem(db, 'digitalBusiness', { name: 'X', otherUrls: 'a.example.com\nhttps://b.example.com\na.example.com' })
    expect(item.fields.otherUrls).toEqual(['https://a.example.com/', 'https://b.example.com/'])
    await expect(createItem(db, 'digitalBusiness', { name: 'X', otherUrls: 'no es url' })).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('papelera y relaciones', () => {
  it('mover a la papelera oculta el activo sin borrar fotos; restaurar lo recupera', async () => {
    const db = await freshDb()
    const { item } = await createItem(db, 'watch', { brand: 'A', name: 'B' }, { files: [fakeImage()] })
    await trashItem(db, item.id)
    expect(await listItems(db, 'watch')).toHaveLength(0)
    expect(await listTrashedItems(db)).toHaveLength(1)
    expect(await db.mediaBlobs.count()).toBe(1)
    await restoreItem(db, item.id)
    expect(await listItems(db, 'watch')).toHaveLength(1)
  })
  it('eliminar definitivamente no toca composiciones ni archivos de otros objetos', async () => {
    const db = await freshDb()
    const a = (await createItem(db, 'garment', shirt, { files: [fakeImage('a.png', 1)] })).item
    const b = (await createItem(db, 'accessory', { name: 'Gafas', category: 'Gafas' }, { files: [fakeImage('a.png', 1)] })).item
    const comp = await createComposition(db, { name: 'Look', file: fakeImage('look.png', 5) })
    await updateComposition(db, comp.id, { refs: [{ itemId: a.id, anchor: { x: 0.4, y: 0.3 } }, { itemId: b.id, anchor: { x: 2, y: -1 } }] })
    const src = await createSource(db, { name: 'Alquiler', category: 'Alquiler', amount: 100, currency: 'USD', frequency: 'monthly', linkedItemId: a.id })

    const rel = await itemRelations(db, a.id)
    expect(rel.compositions.map((c) => c.id)).toEqual([comp.id])
    expect(rel.incomeSources.map((s) => s.id)).toEqual([src.id])

    await purgeItem(db, a.id)
    const c = await db.compositions.get(comp.id)
    expect(c.refs).toHaveLength(2)
    expect(c.refs[1].anchor).toEqual({ x: 1, y: 0 })
    expect(await db.media.where('ownerId').equals(b.id).count()).toBe(1)
    expect(await db.mediaBlobs.get(c.photoMediaId)).toBeTruthy()
    expect((await db.incomeSources.get(src.id)).linkedItemId).toBe(a.id)
  })
  it('composiciones: papelera y eliminación definitiva solo de su propia foto', async () => {
    const db = await freshDb()
    const comp = await createComposition(db, { name: 'Look', file: fakeImage('look.png', 5) })
    await trashComposition(db, comp.id)
    expect(await listCompositions(db)).toHaveLength(0)
    await purgeComposition(db, comp.id)
    expect(await db.media.count()).toBe(0)
    expect(await db.mediaBlobs.count()).toBe(0)
  })
  it('destacar un activo', async () => {
    const db = await freshDb()
    const { item } = await createItem(db, 'house', { name: 'Villa', propertyType: 'Villa' })
    await setFeatured(db, item.id, true)
    expect((await db.items.get(item.id)).featured).toBe(true)
  })
})

describe('fotografías: orden y modelos', () => {
  it('reordena las fotos y conserva el orden tras añadir más', async () => {
    const db = await freshDb()
    const { item } = await createItem(db, 'garment', shirt, { files: [fakeImage('1.png', 1), fakeImage('2.png', 2), fakeImage('3.png', 3)] })
    let m = await listMedia(db, item.id, 'photo')
    await moveMedia(db, m[2].id, -1)
    m = await listMedia(db, item.id, 'photo')
    expect(m.map((x) => x.name)).toEqual(['1.png', '3.png', '2.png'])
    await addItemImages(db, item.id, [fakeImage('4.png', 4)])
    expect((await listMedia(db, item.id, 'photo')).map((x) => x.name)).toEqual(['1.png', '3.png', '2.png', '4.png'])
  })
  it('incorpora un modelo GLB, rechaza otros formatos y lo conserva en el respaldo', async () => {
    const db = await freshDb()
    const { item } = await createItem(db, 'watch', { brand: 'A', name: 'B' })
    await expect(setItemModel(db, item.id, fakeImage())).rejects.toBeInstanceOf(ValidationError)
    const id = await setItemModel(db, item.id, fakeGlb())
    expect((await db.items.get(item.id)).model3dMediaId).toBe(id)
    const dst = await freshDb()
    const blob = (await exportBackup(db)).blob
    await applyBackup(dst, await readBackup(new File([blob], 'r.zip')), { mode: 'replace' })
    const restored = await dst.mediaBlobs.get(id)
    expect(restored.blob.size).toBe(64)
    expect(restored.blob.type).toBe('model/gltf-binary')
    await deleteMedia(db, id)
    expect((await db.items.get(item.id)).model3dMediaId).toBeNull()
  })
})

describe('fuentes de ingreso', () => {
  it('crea, edita, registra ingresos y elimina', async () => {
    const db = await freshDb()
    await expect(createSource(db, { name: '', category: 'Salario', amount: 1, currency: 'USD', frequency: 'monthly' })).rejects.toBeInstanceOf(ValidationError)
    const s = await createSource(db, { name: 'Salario', category: 'Salario', amount: '3000', currency: 'USD', frequency: 'monthly', startDate: '2026-01-01' })
    expect(s.amount).toBe(3000)
    const e = await updateSource(db, s.id, { amount: 3200 })
    expect(e.name).toBe('Salario')
    expect(e.frequency).toBe('monthly')
    await addEntry(db, s.id, { date: '2026-10-30', amount: 3200, type: 'received' })
    await addEntry(db, s.id, { date: '2026-11-30', amount: 3200, type: 'expected' })
    expect(await listEntries(db, s.id)).toHaveLength(2)
    await trashSource(db, s.id)
    expect(await listSources(db)).toHaveLength(0)
    await purgeSource(db, s.id)
    expect(await db.incomeEntries.count()).toBe(0)
  })
  it('equivalente mensual por frecuencia', () => {
    const base = { active: true, amount: 1200 }
    expect(monthlyEquivalent({ ...base, frequency: 'yearly' })).toBe(100)
    expect(monthlyEquivalent({ ...base, frequency: 'biweekly' })).toBe(2400)
    expect(monthlyEquivalent({ ...base, frequency: 'once' })).toBe(0)
    expect(monthlyEquivalent({ ...base, frequency: 'monthly', active: false })).toBe(0)
  })
})

describe('indicadores del dashboard', () => {
  it('cuentan solo registros vigentes y nunca suman monedas distintas', async () => {
    const db = await freshDb()
    await createItem(db, 'garment', { ...shirt, currency: 'USD' })
    await createItem(db, 'watch', { brand: 'A', name: 'B', value: 5000, currency: 'EUR' })
    await createItem(db, 'car', { brand: 'A', model: 'B', value: 30000, currency: 'USD' })
    await createItem(db, 'house', { name: 'Casa', propertyType: 'Casa', value: 10 })
    const gone = (await createItem(db, 'car', { brand: 'X', model: 'Y', value: 999, currency: 'USD' })).item
    await trashItem(db, gone.id)
    const s = computeAssetStats(await db.items.toArray())
    expect(s.total).toBe(4)
    expect(s.valueByCurrency).toEqual({ USD: 30120, EUR: 5000, [NO_CURRENCY]: 10 })
    expect(s.byKind.car).toBe(1)
    expect(s.groups.find((g) => g.key === 'vehiculos').count).toBe(1)
    expect(s.unvalued).toBe(0)
  })
  it('ingresos: esperado mensual, recibido por mes y fuentes en papelera excluidas', async () => {
    const db = await freshDb()
    const a = await createSource(db, { name: 'Sueldo', category: 'Salario', amount: 1000, currency: 'USD', frequency: 'biweekly' })
    const b = await createSource(db, { name: 'Renta', category: 'Alquiler', amount: 1200, currency: 'EUR', frequency: 'yearly', active: false })
    const c = await createSource(db, { name: 'Vieja', category: 'Otra', amount: 5, currency: 'USD', frequency: 'monthly' })
    await addEntry(db, a.id, { date: '2026-11-02', amount: 1000, type: 'received' })
    await addEntry(db, a.id, { date: '2026-10-02', amount: 900, type: 'received' })
    await addEntry(db, b.id, { date: '2026-11-05', amount: 100, type: 'expected' })
    await addEntry(db, c.id, { date: '2026-11-05', amount: 5, type: 'received' })
    await trashSource(db, c.id)
    const st = computeIncomeStats(await db.incomeSources.toArray(), await db.incomeEntries.toArray(), { now: new Date(2026, 10, 13) })
    expect(st.total).toBe(2)
    expect(st.active).toBe(1)
    expect(st.expectedMonthly).toEqual({ USD: 2000 })
    expect(st.receivedThisMonth).toEqual({ USD: 1000 })
    expect(st.expectedThisMonth).toEqual({ EUR: 100 })
    expect(st.monthly.at(-2).received).toEqual({ USD: 900 })
    expect(st.monthly).toHaveLength(12)
  })
})

describe('historial de actividad', () => {
  it('registra operaciones reales en orden', async () => {
    const db = await freshDb()
    const { item } = await createItem(db, 'garment', shirt)
    await updateItem(db, item.id, { color: 'Negro' })
    await addItemImages(db, item.id, [fakeImage()])
    const types = (await recentActivity(db)).map((a) => a.type)
    expect(types).toEqual(['media.added', 'item.updated', 'item.created'])
  })
})

describe('migración real v1 → v2', () => {
  it('conserva registros y asigna orden a las fotos existentes', async () => {
    const name = `v1to2-${Date.now()}`
    const v1 = createDb(name, SCHEMA_VERSIONS.slice(0, 1))
    await v1.open()
    await v1.items.add({ id: 'i1', kind: 'garment', fields: { name: 'X', garmentType: 'Camisa' }, title: 'X', createdAt: 1, updatedAt: 1, primaryMediaId: 'm2' })
    await v1.media.bulkAdd([
      { id: 'm1', ownerId: 'i1', ownerType: 'item', role: 'photo', createdAt: 20, sha256: 'a' },
      { id: 'm2', ownerId: 'i1', ownerType: 'item', role: 'photo', createdAt: 10, sha256: 'b' },
    ])
    await v1.mediaBlobs.bulkAdd([{ id: 'm1', blob: new Blob(['1']) }, { id: 'm2', blob: new Blob(['2']) }])
    await v1.settings.put({ key: 'currency', value: 'COP' })
    v1.close()

    const v2 = createDb(name)
    await v2.open()
    expect(v2.verno).toBe(2)
    expect((await listMedia(v2, 'i1')).map((m) => [m.id, m.order])).toEqual([['m2', 0], ['m1', 1]])
    expect(await listItems(v2, 'garment')).toHaveLength(1)
    expect((await v2.settings.get('currency')).value).toBe('COP')
    expect(await v2.mediaBlobs.count()).toBe(2)
    expect(await v2.activity.count()).toBe(0)
  })
})
