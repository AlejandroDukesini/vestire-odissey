import { test, expect } from '@playwright/test'
import { skipSplash, makePngs } from './helpers.js'

// Capturas de revisión visual con datos de ejemplo en un perfil temporal (nunca los datos reales).
test('revisión visual con datos de ejemplo en ambos temas', async ({ page }) => {
  await skipSplash(page)
  await page.goto('/')
  const pngs = await makePngs(page, ['#3b4a5a', '#7a4b2a', '#2f5d50', '#5a3b6a', '#6a6a2f', '#2a3b7a'])
  await page.evaluate(async (files) => {
    const { db } = await import('/src/db/index.js')
    const { createItem, setFeatured } = await import('/src/db/items.js')
    const { createSource, addEntry } = await import('/src/db/income.js')
    const f = (i) => new File([Uint8Array.from(atob(files[i]), (c) => c.charCodeAt(0))], `f${i}.png`, { type: 'image/png' })
    await createItem(db, 'garment', { name: 'Blazer azul', garmentType: 'Chaqueta', size: '50', color: 'Azul', value: 420, currency: 'EUR' }, { files: [f(0)] })
    await createItem(db, 'garment', { name: 'Camisa Oxford', garmentType: 'Camisa', size: 'M', color: 'Blanco', value: 90, currency: 'EUR' }, { files: [f(1)] })
    const w = await createItem(db, 'watch', { brand: 'Maison', name: 'Diver 300', value: 8500, currency: 'EUR', audience: 'Unisex' }, { files: [f(2)] })
    await setFeatured(db, w.item.id, true)
    await createItem(db, 'car', { brand: 'Marca', model: 'GT', year: 2021, value: 64000, currency: 'EUR', mileage: 18000 }, { files: [f(3)] })
    await createItem(db, 'house', { name: 'Villa del lago', propertyType: 'Villa', value: 850000, currency: 'EUR', location: 'Como' }, { files: [f(4)] })
    await createItem(db, 'physicalBusiness', { name: 'Café Central', premisesType: 'Local comercial', businessType: 'Cafetería', value: 120000, currency: 'USD' }, { files: [f(5)] })
    const s = await createSource(db, { name: 'Salario', category: 'Salario', amount: 4200, currency: 'EUR', frequency: 'monthly' })
    const r = await createSource(db, { name: 'Alquiler villa', category: 'Alquiler', amount: 2500, currency: 'EUR', frequency: 'monthly' })
    for (let m = 0; m < 6; m++) {
      const d = new Date(); d.setMonth(d.getMonth() - m); const iso = d.toISOString().slice(0, 8) + '05'
      await addEntry(db, s.id, { date: iso, amount: 4200, type: 'received' })
      await addEntry(db, r.id, { date: iso, amount: 2500, type: 'expected' })
      if (m > 0) await addEntry(db, r.id, { date: iso, amount: 2300, type: 'received' })
    }
    await db.settings.put({ key: 'currency', value: 'EUR' })
  }, pngs.map((p) => p.buffer.toString('base64')))
  await page.reload()
  await expect(page.locator('.recharts-bar-rectangle').first()).toBeVisible()
  await page.waitForTimeout(900)
  await page.screenshot({ path: 'e2e/screenshots/v-dashboard.png', fullPage: true })
  await page.goto('/vestimenta')
  await page.waitForTimeout(900)
  await page.screenshot({ path: 'e2e/screenshots/v-vestimenta.png' })

  await page.evaluate(async () => {
    const { db } = await import('/src/db/index.js')
    const { PALETTES } = await import('/src/theme/palettes.js')
    await db.settings.put({ key: 'appearance', value: { theme: 'glass', palette: 'royal', colors: PALETTES.royal.colors, motion: 'system' } })
    localStorage.removeItem('odissey.appearance.mirror')
  })
  await page.goto('/')
  await expect(page.locator('.recharts-bar-rectangle').first()).toBeVisible()
  await page.waitForTimeout(900)
  await page.screenshot({ path: 'e2e/screenshots/v-dashboard-glass.png', fullPage: true })
  await page.goto('/propiedades/casas')
  await page.waitForTimeout(900)
  await page.screenshot({ path: 'e2e/screenshots/v-casas-glass.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.waitForTimeout(900)
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
  await page.screenshot({ path: 'e2e/screenshots/v-movil-glass.png', fullPage: true })
})
