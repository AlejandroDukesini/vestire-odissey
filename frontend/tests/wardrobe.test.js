import { describe, expect, it } from 'vitest'
import { garmentTypeLabel, splitByZone, wardrobeZone } from '../src/domain/wardrobe.js'
import { GARMENT_TYPES, validateFields } from '../src/domain/kinds.js'
import { createItem, updateItem } from '../src/db/items.js'
import { sanitizeWardrobe } from '../src/features/wardrobe/wardrobePrefs.jsx'
import { freshDb } from './helpers.js'

describe('estantes del armario', () => {
  it('cada tipo de prenda va a su estante', () => {
    for (const t of ['Camiseta', 'Camisa', 'Buzo', 'Sudadera', 'Chaqueta', 'Abrigo']) expect(wardrobeZone({ garmentType: t })).toBe('top')
    for (const t of ['Pantalón', 'Jeans', 'Bermuda', 'Short', 'Falda']) expect(wardrobeZone({ garmentType: t })).toBe('bottom')
    for (const t of ['Zapatos', 'Tenis', 'Zapatos formales', 'Botas', 'Sandalias']) expect(wardrobeZone({ garmentType: t })).toBe('shoes')
  })
  it('"Otra" se clasifica por el tipo personalizado o el nombre', () => {
    expect(wardrobeZone({ garmentType: 'Otra', customType: 'Mocasines' })).toBe('shoes')
    expect(wardrobeZone({ garmentType: 'Otra', customType: 'Leggings' })).toBe('bottom')
    expect(wardrobeZone({ garmentType: 'Otra', name: 'Pantalón cargo' })).toBe('bottom')
    expect(wardrobeZone({ garmentType: 'Otra', customType: 'Chaleco' })).toBe('top')
    expect(garmentTypeLabel({ garmentType: 'Otra', customType: 'Chaleco' })).toBe('Chaleco')
  })
  it('reparte conservando el orden y sin perder prendas', () => {
    const items = [{ id: 1, fields: { garmentType: 'Botas' } }, { id: 2, fields: { garmentType: 'Camisa' } }, { id: 3, fields: { garmentType: 'Jeans' } }, { id: 4, fields: { garmentType: 'Camiseta' } }]
    const z = splitByZone(items)
    expect(z.top.map((i) => i.id)).toEqual([2, 4])
    expect(z.bottom.map((i) => i.id)).toEqual([3])
    expect(z.shoes.map((i) => i.id)).toEqual([1])
  })
})

describe('catálogo de prendas ampliado', () => {
  it('conserva los tipos existentes y añade los nuevos', () => {
    for (const t of ['Camiseta', 'Camisa', 'Pantalón', 'Chaqueta', 'Abrigo', 'Zapatos', 'Traje', 'Vestido', 'Otra']) expect(GARMENT_TYPES).toContain(t)
    for (const t of ['Buzo', 'Sudadera', 'Jeans', 'Bermuda', 'Short', 'Falda', 'Tenis', 'Botas', 'Sandalias']) expect(GARMENT_TYPES).toContain(t)
  })
  it('estado opcional y validado; los registros antiguos no cambian', async () => {
    const db = await freshDb()
    const { item } = await createItem(db, 'garment', { name: 'Camisa', garmentType: 'Camisa', size: 'M' })
    const edited = await updateItem(db, item.id, { condition: 'Como nuevo' })
    expect(edited.fields).toMatchObject({ name: 'Camisa', garmentType: 'Camisa', size: 'M', condition: 'Como nuevo' })
    expect(validateFields('garment', { name: 'X', garmentType: 'Camisa', condition: 'Roto' }).errors.condition).toBeTruthy()
  })
  it('preferencias del armario: una vez por sesión por defecto', () => {
    expect(sanitizeWardrobe(null)).toEqual({ intro: 'session', sound: true })
    expect(sanitizeWardrobe({ intro: 'never', sound: false })).toEqual({ intro: 'never', sound: false })
  })
})
