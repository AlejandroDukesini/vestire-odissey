import { describe, it, expect } from 'vitest'
import { freshDb, fakeImage } from './helpers.js'
import { createItem, updateItem, deleteItem, listItems, getItem } from '../src/db/items.js'
import { addItemImages, setPrimaryMedia, deleteMedia, listMedia, getMediaBlob } from '../src/db/media.js'
import { ValidationError } from '../src/db/errors.js'
import { KIND_KEYS, KINDS } from '../src/domain/kinds.js'

export const sample = {
  garment: { name: 'Camisa blanca', garmentType: 'Camisa', color: 'Blanco', size: 'M', value: '120.5' },
  accessory: { name: 'Gafas', category: 'Gafas' },
  watch: { brand: 'Marca', name: 'Diver', audience: 'Unisex', value: 5000 },
  yacht: { brand: 'Astillero', model: 'X50', location: 'Puerto' },
  car: { brand: 'Marca', model: 'GT', mileage: 12000 },
  motorcycle: { brand: 'Marca', model: 'R1', mileage: '800' },
  house: { name: 'Casa del lago', propertyType: 'Villa', value: 900000 },
  physicalBusiness: { name: 'Café', businessType: 'Restaurante', address: 'Calle 1' },
  digitalBusiness: { name: 'Tienda', url: 'tienda.example.com' },
}

describe('activos: crear, editar, eliminar cada tipo', () => {
  for (const kind of KIND_KEYS) {
    it(kind, async () => {
      const db = await freshDb()
      const files = KINDS[kind].requiresPhoto ? [fakeImage()] : []
      const { item } = await createItem(db, kind, { ...sample[kind], currency: 'USD' }, { files })
      expect((await getItem(db, item.id)).kind).toBe(kind)
      expect(item.title).not.toBe('Sin nombre')

      const edited = await updateItem(db, item.id, { ...sample[kind], description: 'editado' })
      expect(edited.fields.description).toBe('editado')
      expect(edited.updatedAt).toBeGreaterThanOrEqual(item.updatedAt)

      await deleteItem(db, item.id)
      expect(await getItem(db, item.id)).toBeUndefined()
      expect(await db.media.count()).toBe(0)
      expect(await db.mediaBlobs.count()).toBe(0)
    })
  }
})

describe('validación', () => {
  it('rechaza campos obligatorios vacíos y valores inválidos', async () => {
    const db = await freshDb()
    await expect(createItem(db, 'garment', { name: '', garmentType: 'Camisa' })).rejects.toBeInstanceOf(ValidationError)
    await expect(createItem(db, 'car', { brand: 'A', model: 'B', mileage: -5 })).rejects.toMatchObject({ errors: { mileage: expect.any(String) } })
    await expect(createItem(db, 'watch', { brand: 'A', name: 'B', audience: 'Niño' })).rejects.toMatchObject({ errors: { audience: expect.any(String) } })
    await expect(createItem(db, 'watch', { brand: 'A', name: 'B', currency: 'XXX' })).rejects.toMatchObject({ errors: { currency: expect.any(String) } })
    expect(await db.items.count()).toBe(0)
  })
  it('normaliza números y URL', async () => {
    const db = await freshDb()
    const { item } = await createItem(db, 'garment', sample.garment)
    expect(item.value).toBe(120.5)
    const d = await createItem(db, 'digitalBusiness', sample.digitalBusiness)
    expect(d.item.fields.url).toBe('https://tienda.example.com/')
    await expect(createItem(db, 'digitalBusiness', { name: 'X', url: 'javascript:alert(1)' })).rejects.toBeInstanceOf(ValidationError)
  })
  it('no admite kilometraje en casas (campos desconocidos se descartan)', async () => {
    const db = await freshDb()
    const { item } = await createItem(db, 'house', { ...sample.house, mileage: 100 })
    expect(item.fields.mileage).toBeUndefined()
  })
  it('un yate exige al menos una fotografía válida y no guarda nada si falta', async () => {
    const db = await freshDb()
    await expect(createItem(db, 'yacht', sample.yacht)).rejects.toBeInstanceOf(ValidationError)
    const notImage = new File([new Uint8Array([1, 2, 3, 4])], 'x.png', { type: 'image/png' })
    await expect(createItem(db, 'yacht', sample.yacht, { files: [notImage] })).rejects.toBeInstanceOf(ValidationError)
    expect(await db.items.count()).toBe(0)
  })
})

describe('fotografías', () => {
  it('guarda original intacto, asigna principal, cambia principal y elimina', async () => {
    const db = await freshDb()
    const f1 = fakeImage('a.png', 1)
    const { item } = await createItem(db, 'garment', sample.garment, { files: [f1] })
    const { added } = await addItemImages(db, item.id, [fakeImage('b.jpg', 2, 'jpg')])
    const media = await listMedia(db, item.id, 'photo')
    expect(media).toHaveLength(2)
    expect((await getItem(db, item.id)).primaryMediaId).toBe(media[0].id)

    const stored = new Uint8Array(await (await getMediaBlob(db, media[0].id)).arrayBuffer())
    expect(stored).toEqual(new Uint8Array(await f1.arrayBuffer()))
    expect(media[1].mime).toBe('image/jpeg')

    await setPrimaryMedia(db, item.id, added[0].id)
    expect((await getItem(db, item.id)).primaryMediaId).toBe(added[0].id)
    await deleteMedia(db, added[0].id)
    expect((await getItem(db, item.id)).primaryMediaId).toBe(media[0].id)
    expect(await db.mediaBlobs.get(added[0].id)).toBeUndefined()
  })
  it('evita duplicados por contenido y rechaza archivos falsos', async () => {
    const db = await freshDb()
    const { item } = await createItem(db, 'watch', sample.watch, { files: [fakeImage('a.png', 1)] })
    const fake = new File([new TextEncoder().encode('<svg></svg>')], 'evil.png', { type: 'image/png' })
    const r = await addItemImages(db, item.id, [fakeImage('copia.png', 1), fake])
    expect(r.added).toHaveLength(0)
    expect(r.rejected).toHaveLength(2)
    expect(await db.media.count()).toBe(1)
  })
  it('respeta el límite de tamaño configurado', async () => {
    const db = await freshDb()
    const { item } = await createItem(db, 'watch', sample.watch)
    const r = await addItemImages(db, item.id, [fakeImage('g.png', 3, 'png', 5000)], { maxBytes: 4000 })
    expect(r.rejected[0].reason).toMatch(/límite/)
  })
  it('las fotos persisten tras cerrar y reabrir la base de datos', async () => {
    const db = await freshDb()
    const { item } = await createItem(db, 'car', sample.car, { files: [fakeImage()] })
    db.close()
    await db.open()
    expect(await listItems(db, 'car')).toHaveLength(1)
    expect(await getMediaBlob(db, item.primaryMediaId)).toBeTruthy()
  })
})
