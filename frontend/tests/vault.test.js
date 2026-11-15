import { describe, expect, it } from 'vitest'
import { computeLayout, motionSeed, sanitizeVault, VAULT_DEFAULTS } from '../src/features/vault/vaultPrefs.js'
import { validateFields, KINDS } from '../src/domain/kinds.js'
import { createItem, updateItem } from '../src/db/items.js'
import { getSettings, setSetting } from '../src/db/settings.js'
import { freshDb } from './helpers.js'

describe('distribución de compartimentos', () => {
  const wide = { width: 900, size: 'compact' }
  it('1 reloj: presentación destacada en un único compartimento grande', () => {
    const l = computeLayout(1, wide)
    expect(l).toMatchObject({ cols: 1, rows: 1, pages: 1 })
    expect(l.cell).toBeGreaterThan(210)
  })
  it('distribuciones equilibradas sin huecos de relleno', () => {
    expect(computeLayout(4, wide)).toMatchObject({ cols: 2, rows: 2 })
    expect(computeLayout(6, wide)).toMatchObject({ cols: 3, rows: 2 })
    expect(computeLayout(8, wide)).toMatchObject({ cols: 4, rows: 2 })
    expect(computeLayout(12, wide)).toMatchObject({ cols: 4, rows: 3, pages: 1 })
  })
  it('colecciones grandes se reparten en bandejas sin límite artificial', () => {
    const l = computeLayout(45, wide)
    expect(l.pages).toBe(Math.ceil(45 / l.perPage))
    expect(l.pages).toBeGreaterThan(1)
  })
  it('se adapta al ancho (móvil) y al tamaño elegido', () => {
    expect(computeLayout(7, { width: 330, size: 'compact' }).cols).toBeLessThanOrEqual(2)
    expect(computeLayout(12, { width: 900, size: 'wide' }).perPage).toBeLessThan(computeLayout(12, wide).perPage)
  })
  it('sin relojes no genera compartimentos', () => {
    expect(computeLayout(0, wide)).toMatchObject({ pages: 1 })
  })
  it('cada reloj tiene un giro propio y estable', () => {
    expect(motionSeed('a')).toEqual(motionSeed('a'))
    expect(motionSeed('a').duration).not.toBe(motionSeed('b').duration)
  })
})

describe('preferencias de la bóveda', () => {
  it('normaliza valores desconocidos', () => {
    expect(sanitizeVault(null)).toEqual(VAULT_DEFAULTS)
    expect(sanitizeVault({ style: 'x', size: 'wide', intro: 'never', sound: 'no', extra: 1 })).toEqual({ style: 'classic', size: 'wide', intro: 'never', sound: true })
  })
  it('se guardan en settings, separadas de los relojes', async () => {
    const db = await freshDb()
    const { item } = await createItem(db, 'watch', { brand: 'A', name: 'B' })
    await setSetting(db, 'vault', { style: 'cabinet', size: 'wide', intro: 'session', sound: false })
    expect((await getSettings(db)).vault).toMatchObject({ style: 'cabinet' })
    expect(await db.items.get(item.id)).toMatchObject({ fields: { brand: 'A', name: 'B' } })
  })
})

describe('ficha ampliada del reloj', () => {
  it('acepta los nuevos campos opcionales y conserva los registros antiguos', async () => {
    const db = await freshDb()
    const { item } = await createItem(db, 'watch', { brand: 'A', name: 'B', material: 'Oro' })
    const edited = await updateItem(db, item.id, { reference: '5711', movement: 'Automático', strapMaterial: 'Piel', condition: 'Excelente', purchasePrice: '1200' })
    expect(edited.fields).toMatchObject({ brand: 'A', name: 'B', material: 'Oro', reference: '5711', purchasePrice: 1200 })
  })
  it('valida las opciones de movimiento y estado', () => {
    const { errors } = validateFields('watch', { brand: 'A', movement: 'Vapor', condition: 'Roto' })
    expect(errors).toMatchObject({ movement: expect.any(String), condition: expect.any(String) })
    expect(KINDS.watch.fields.find((f) => f.key === 'material').label).toBe('Material de la caja')
  })
})
