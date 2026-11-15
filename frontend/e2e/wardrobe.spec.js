import { test, expect } from '@playwright/test'
import { skipSplash, dbCount } from './helpers.js'

// Armario de vestimenta. Perfil de navegador nuevo y vacío en cada prueba: nunca toca datos reales.

async function seed(page, list) {
  await page.evaluate(async (rows) => {
    const { db } = await import('/src/db/index.js')
    const { createItem } = await import('/src/db/items.js')
    let n = 0
    for (const r of rows) {
      const c = new OffscreenCanvas(500, 640)
      const x = c.getContext('2d')
      x.fillStyle = '#fff'; x.fillRect(0, 0, 500, 640)
      x.fillStyle = `hsl(${n++ * 53} 45% 35%)`; x.fillRect(120, 80, 260, 480)
      const blob = await c.convertToBlob({ type: 'image/png' })
      await createItem(db, 'garment', r, { files: [new File([blob], `${r.name}.png`, { type: 'image/png' })] })
    }
  }, list)
}

const SAMPLE = [
  { name: 'Camiseta blanca', garmentType: 'Camiseta', brand: 'Básicos', size: 'M', color: 'Blanco', condition: 'Excelente', value: 30, currency: 'EUR', notes: 'Algodón orgánico' },
  { name: 'Buzo gris', garmentType: 'Buzo', size: 'L' },
  { name: 'Chaqueta de cuero', garmentType: 'Chaqueta', size: 'M' },
  { name: 'Jeans índigo', garmentType: 'Jeans', size: '32' },
  { name: 'Falda plisada', garmentType: 'Falda', size: 'S' },
  { name: 'Tenis blancos', garmentType: 'Tenis', size: '42' },
  { name: 'Botas Chelsea', garmentType: 'Botas', size: '42' },
  { name: 'Mocasines', garmentType: 'Otra', customType: 'Mocasines', size: '41' },
]

const stage = (page) => page.locator('.wr-stage')
const shelf = (page, zone) => page.locator(`.shelf[data-zone="${zone}"]`)
const errorsOf = (page) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  return errors
}

test.describe('Armario de vestimenta', () => {
  test.beforeEach(async ({ page }) => { await skipSplash(page) })

  test('apertura, orden de estantes, izquierda a derecha y clasificación', async ({ page }) => {
    const errors = errorsOf(page)
    await page.goto('/')
    await seed(page, SAMPLE)
    await page.goto('/vestimenta')

    // 1. Empieza cerrado y las puertas giran sobre sus bisagras exteriores.
    await expect(stage(page)).toHaveAttribute('data-stage', /[0-2]/)
    await expect(page.getByRole('button', { name: 'Saltar apertura' })).toBeVisible()
    const closed = await page.locator('.wr-door-l').evaluate((el) => getComputedStyle(el).opacity)
    expect(closed).toBe('1')

    // 2–3. Durante la organización: el estante superior empieza antes que el medio y éste antes
    // que el calzado; dentro de cada estante, cada prenda empieza después de la anterior.
    await expect(stage(page)).toHaveAttribute('data-stage', '4', { timeout: 6000 })
    const delays = await page.evaluate(() => [...document.querySelectorAll('.shelf')].map((s) =>
      [...s.querySelectorAll('.garment')].map((g) => parseFloat(getComputedStyle(g).animationDelay) * 1000)))
    const firsts = delays.map((d) => d[0])
    expect(firsts[0]).toBeLessThan(firsts[1])
    expect(firsts[1]).toBeLessThan(firsts[2])
    for (const row of delays) for (let i = 1; i < row.length; i++) expect(row[i]).toBeGreaterThan(row[i - 1])
    // Las prendas entran desde la izquierda (desplazamiento negativo en X al inicio).
    const name = await page.locator('.shelf[data-zone="top"] .garment').first().evaluate((el) => getComputedStyle(el).animationName)
    expect(name).toBe('g-in')

    await expect(stage(page)).toHaveAttribute('data-stage', '5', { timeout: 6000 })
    await page.waitForTimeout(1200)
    const door = await page.locator('.wr-door-l').evaluate((el) => {
      const cs = getComputedStyle(el); const m = new DOMMatrix(cs.transform)
      return { origin: cs.transformOrigin, angle: Math.round(Math.atan2(-m.m13, m.m11) * 180 / Math.PI), is3d: !m.is2D }
    })
    expect(door.origin.startsWith('0px')).toBe(true)
    expect(door.is3d).toBe(true)
    expect(Math.abs(door.angle)).toBeGreaterThan(140)
    expect(Number(await page.locator('.wr-dark').evaluate((el) => getComputedStyle(el).opacity))).toBeLessThan(0.05)
    await page.screenshot({ path: 'e2e/screenshots/armario-abierto.png' })

    // 4. Cada estante recibe sus prendas (incluida "Otra: Mocasines" → calzado).
    await expect(shelf(page, 'top').locator('.garment')).toHaveCount(3)
    await expect(shelf(page, 'bottom').locator('.garment')).toHaveCount(2)
    await expect(shelf(page, 'shoes').locator('.garment')).toHaveCount(3)
    await expect(shelf(page, 'shoes').getByText('Mocasines', { exact: true })).toBeVisible()
    // Distribución horizontal: las prendas de una fila están a la misma altura y crecen en X.
    const boxes = await shelf(page, 'top').locator('.garment').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => [r.x, r.y]))
    for (let i = 1; i < boxes.length; i++) { expect(boxes[i][0]).toBeGreaterThan(boxes[i - 1][0]); expect(Math.abs(boxes[i][1] - boxes[0][1])).toBeLessThan(2) }

    // 5. Fotografías originales cargadas sin deformar (object-fit: contain).
    const img = shelf(page, 'top').locator('.garment img').first()
    await expect(img).toBeVisible()
    expect(await img.evaluate((el) => el.naturalWidth > 0 && getComputedStyle(el).objectFit === 'contain')).toBe(true)

    // Indicadores de categoría: filtran solo su estante.
    await shelf(page, 'shoes').locator('.shelf-chips').getByRole('button', { name: /^Botas/ }).click()
    await expect(shelf(page, 'shoes').locator('.garment')).toHaveCount(1)
    await expect(shelf(page, 'top').locator('.garment')).toHaveCount(3)
    await shelf(page, 'shoes').getByRole('button', { name: 'Todas' }).click()

    // Volver a entrar en la misma sesión no repite la animación (preferencia predeterminada).
    await page.goto('/')
    await page.goto('/vestimenta')
    await expect(stage(page)).toHaveAttribute('data-stage', '5')
    await expect(stage(page)).toHaveClass(/w-instant/)
    // …pero se puede repetir a voluntad y saltar.
    await page.getByRole('button', { name: 'Repetir apertura' }).click()
    await expect(stage(page)).not.toHaveAttribute('data-stage', '5')
    await page.getByRole('button', { name: 'Saltar apertura' }).click()
    await expect(stage(page)).toHaveAttribute('data-stage', '5')

    // 13. Sin errores de consola.
    expect(errors).toEqual([])
  })

  test('ficha completa y CRUD reflejado en el armario', async ({ page }) => {
    const errors = errorsOf(page)
    await page.goto('/')
    await seed(page, SAMPLE.slice(0, 2))
    await page.goto('/vestimenta')
    await page.getByRole('button', { name: 'Saltar apertura' }).click()

    // Estado vacío integrado en los estantes sin prendas.
    await expect(shelf(page, 'bottom').getByText('Esta barra está esperando nuevas prendas')).toBeVisible()
    await expect(shelf(page, 'shoes').getByText('Este estante está esperando nuevo calzado')).toBeVisible()

    // 6. Seleccionar una prenda muestra su información real (y no muestra campos vacíos).
    const panel = page.getByRole('complementary', { name: 'Información de la prenda' })
    await shelf(page, 'top').locator('.garment', { hasText: 'Camiseta blanca' }).locator('.garment-btn').click()
    await expect(panel.getByRole('heading', { name: 'Camiseta blanca' })).toBeVisible()
    for (const t of ['Básicos', 'Blanco', 'Excelente', 'Algodón orgánico', 'Valor registrado']) await expect(panel.getByText(t, { exact: true }).first()).toBeVisible()
    await expect(panel.getByText('Fecha de adquisición')).toHaveCount(0)
    await expect(panel.getByText('Material', { exact: true })).toHaveCount(0)
    // Hover sobre otra prenda actualiza el panel.
    await shelf(page, 'top').locator('.garment', { hasText: 'Buzo gris' }).locator('.garment-btn').hover()
    await expect(panel.getByRole('heading', { name: 'Buzo gris' })).toBeVisible()
    await page.mouse.move(5, 5)

    // 7. Crear una prenda desde el formulario → aparece en su estante.
    await page.getByRole('button', { name: 'Agregar prenda' }).first().click()
    let d = page.getByRole('dialog')
    await d.getByLabel('Nombre *').fill('Bermuda lino')
    await d.getByLabel('Tipo de prenda *').selectOption('Bermuda')
    await d.getByLabel('Estado').selectOption('Nuevo')
    await d.getByRole('button', { name: 'Agregar', exact: true }).click()
    await expect(shelf(page, 'bottom').locator('.garment', { hasText: 'Bermuda lino' })).toBeVisible()
    await expect(shelf(page, 'bottom').getByText('Esta barra está esperando nuevas prendas')).toHaveCount(0)

    // 8. Editar: cambiar el tipo la mueve de estante y actualiza su etiqueta.
    await shelf(page, 'bottom').locator('.garment', { hasText: 'Bermuda lino' }).locator('.garment-btn').click()
    await panel.getByRole('button', { name: 'Editar' }).click()
    d = page.getByRole('dialog')
    await d.getByLabel('Nombre *').fill('Sandalias lino')
    await d.getByLabel('Tipo de prenda *').selectOption('Sandalias')
    await d.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(shelf(page, 'shoes').locator('.garment', { hasText: 'Sandalias lino' })).toBeVisible()
    await expect(shelf(page, 'bottom').locator('.garment')).toHaveCount(0)
    await expect(panel.getByRole('heading', { name: 'Sandalias lino' })).toBeVisible()

    // 9. Eliminar: sale del armario (queda en la papelera, recuperable).
    await panel.getByRole('button', { name: 'Mover a la papelera' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Mover a la papelera' }).click()
    await expect(shelf(page, 'shoes').locator('.garment')).toHaveCount(0)
    // 10. No se pierde información: 3 registros, 2 vigentes, fotos intactas.
    expect(await dbCount(page, 'items')).toBe(3)
    expect(await dbCount(page, 'items', 'live')).toBe(2)
    expect(await dbCount(page, 'mediaBlobs')).toBe(2)

    // Búsqueda existente sigue funcionando sobre el armario.
    await page.getByLabel('Buscar').fill('buzo')
    await expect(page.locator('.garment')).toHaveCount(1)
    expect(errors).toEqual([])
  })

  for (const vp of [{ name: 'tableta', width: 1024, height: 768 }, { name: 'móvil', width: 390, height: 844 }]) {
    test(`12. ${vp.name}: estantes independientes, sin desbordes y ficha táctil`, async ({ browser, baseURL }) => {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: true, isMobile: vp.width < 600, baseURL })
      const page = await context.newPage()
      await skipSplash(page)
      const errors = errorsOf(page)
      await page.goto('/')
      await seed(page, [...SAMPLE, ...SAMPLE.slice(0, 3).map((r) => ({ ...r, name: `${r.name} 2` }))])
      await page.goto('/vestimenta')
      await expect(stage(page)).toHaveAttribute('data-stage', '5', { timeout: 9000 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)

      // Las prendas no se superponen dentro de su fila.
      const xs = await shelf(page, 'top').locator('.garment').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.right] }))
      for (let i = 1; i < xs.length; i++) expect(xs[i][0]).toBeGreaterThanOrEqual(xs[i - 1][1])

      // Desplazamiento horizontal independiente por estante.
      const track = shelf(page, 'top').locator('.shelf-track')
      const before = await shelf(page, 'bottom').locator('.shelf-track').evaluate((el) => el.scrollLeft)
      await shelf(page, 'top').getByRole('button', { name: /a la derecha/ }).tap()
      await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)
      expect(await shelf(page, 'bottom').locator('.shelf-track').evaluate((el) => el.scrollLeft)).toBe(before)

      // Toque → hoja con la ficha y sus acciones.
      await shelf(page, 'shoes').locator('.garment-btn').first().tap()
      const sheet = page.getByRole('dialog', { name: /Ficha de/ })
      await expect(sheet).toBeVisible()
      await expect(sheet.getByRole('button', { name: 'Editar' })).toBeVisible()
      await page.screenshot({ path: `e2e/screenshots/armario-${vp.width}.png` })
      await sheet.getByRole('button', { name: 'Cerrar ficha' }).tap()
      await expect(sheet).toHaveCount(0)
      expect(errors).toEqual([])
      await context.close()
    })
  }
})
