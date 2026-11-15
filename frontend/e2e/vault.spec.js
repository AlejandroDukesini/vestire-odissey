import { test, expect } from '@playwright/test'
import { skipSplash, dbCount } from './helpers.js'

// Bóveda de relojes. Perfil de navegador nuevo y vacío en cada prueba: nunca toca datos reales.

/** Crea relojes de prueba (PNG con fondo blanco) directamente con la API de datos de la app. */
async function seedWatches(page, count, start = 0) {
  await page.evaluate(async ([n, s]) => {
    const { db } = await import('/src/db/index.js')
    const { createItem } = await import('/src/db/items.js')
    for (let i = s; i < s + n; i++) {
      const c = new OffscreenCanvas(600, 750)
      const x = c.getContext('2d')
      x.fillStyle = '#fff'; x.fillRect(0, 0, 600, 750)
      x.fillStyle = '#222'; x.fillRect(250, 20, 100, 710)
      x.beginPath(); x.arc(300, 375, 170, 0, 7); x.fillStyle = `hsl(${i * 47} 40% 30%)`; x.fill()
      const blob = await c.convertToBlob({ type: 'image/png' })
      await createItem(db, 'watch', {
        brand: `Marca${i}`, name: `Reloj ${i}`, reference: `R-${i}`, movement: 'Automático', value: 1000 + i, currency: 'EUR',
      }, { files: [new File([blob], `r${i}.png`, { type: 'image/png' })] })
    }
  }, [count, start])
}

const stage = (page) => page.locator('.vault-stage')
const errorsOf = (page) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  return errors
}

test.describe('Bóveda de relojes', () => {
  test.beforeEach(async ({ page }) => { await skipSplash(page) })

  test('apertura automática, puerta en bisagras, luz interior, repetir y saltar', async ({ page }) => {
    const errors = errorsOf(page)
    await page.goto('/')
    await seedWatches(page, 4)
    await page.goto('/relojes')

    // 1. Apertura automática: arranca cerrada y recorre todas las etapas.
    await expect(stage(page)).toHaveAttribute('data-stage', /[0-2]/)
    await expect(page.getByRole('button', { name: 'Saltar apertura' })).toBeVisible()

    // 5. Antes de abrirse el interior está a oscuras.
    await expect(stage(page)).toHaveAttribute('data-stage', '3', { timeout: 6000 })
    expect(Number(await page.locator('.vault-dark').evaluate((el) => getComputedStyle(el).opacity))).toBeGreaterThan(0.9)

    await expect(stage(page)).toHaveAttribute('data-stage', '5', { timeout: 8000 })
    await page.waitForTimeout(900)
    await page.screenshot({ path: 'e2e/screenshots/boveda-abierta.png' })

    // 4. La puerta rota en 3D alrededor de su borde izquierdo (bisagras), no se desvanece.
    const door = await page.locator('.vault-door').evaluate((el) => {
      const cs = getComputedStyle(el)
      const m = new DOMMatrix(cs.transform)
      return { origin: cs.transformOrigin, angle: Math.round(Math.atan2(-m.m13, m.m11) * 180 / Math.PI), opacity: cs.opacity, is3d: !m.is2D }
    })
    expect(door.origin.startsWith('0px')).toBe(true)
    expect(door.is3d).toBe(true)
    expect(Math.abs(door.angle)).toBeGreaterThan(95)
    expect(door.opacity).toBe('1')
    // 5. Tras la apertura la luz interior está encendida.
    expect(Number(await page.locator('.vault-dark').evaluate((el) => getComputedStyle(el).opacity))).toBeLessThan(0.05)
    expect(Number(await page.locator('.vault-led').evaluate((el) => getComputedStyle(el).opacity))).toBeGreaterThan(0.5)
    await expect(page.locator('.cell')).toHaveCount(4)

    // 2. Repetir la animación.
    await page.getByRole('button', { name: 'Repetir apertura' }).click()
    await expect(stage(page)).not.toHaveAttribute('data-stage', '5')
    // 3. Saltarla: estado final inmediato.
    await page.getByRole('button', { name: 'Saltar apertura' }).click()
    await expect(stage(page)).toHaveAttribute('data-stage', '5')
    await expect(stage(page)).toHaveClass(/v-instant/)
    await expect(page.locator('.cell').first()).toBeVisible()

    // Pasar el cursor entre relojes no vuelve a reproducir la secuencia.
    await page.locator('.cell-btn').nth(0).hover()
    await page.locator('.cell-btn').nth(1).hover()
    await expect(stage(page)).toHaveAttribute('data-stage', '5')

    // 15. Sin errores críticos en consola.
    expect(errors).toEqual([])
  })

  test('CRUD reflejado en la caja: registrar, distribuir, panel, editar y eliminar', async ({ page }) => {
    const errors = errorsOf(page)
    await page.goto('/')
    // Sin intro: las pruebas de gestión no necesitan esperar la secuencia.
    await page.evaluate(async () => {
      const { db } = await import('/src/db/index.js')
      await db.settings.put({ key: 'vault', value: { style: 'classic', size: 'compact', intro: 'never', sound: false } })
    })
    await page.goto('/relojes')
    await expect(page.getByText('La bóveda está vacía')).toBeVisible()

    // 6. Registrar un reloj desde el formulario existente → aparece en su compartimento.
    await page.getByRole('button', { name: 'Agregar reloj' }).first().click()
    const d = page.getByRole('dialog')
    await d.getByLabel('Marca *').fill('Maison')
    await d.getByLabel('Nombre *').fill('Diver')
    await d.getByLabel('Referencia').fill('D-300')
    await d.getByLabel('Tipo de movimiento').selectOption('Automático')
    await d.getByLabel('Estado de conservación').selectOption('Excelente')
    await d.getByLabel('Precio de compra').fill('4000')
    await d.getByLabel('Valor estimado actual').fill('5200')
    await d.getByRole('button', { name: 'Agregar', exact: true }).click()
    await expect(page.locator('.cell', { hasText: 'Maison' })).toBeVisible()
    await expect(page.locator('.cell')).toHaveCount(1)

    // 7. Varios relojes → distribución equilibrada (8 = 4 × 2 en escritorio).
    await seedWatches(page, 7)
    await expect(page.locator('.cell')).toHaveCount(8)
    const cols = await page.locator('.vault-opening').evaluate((el) => getComputedStyle(el).getPropertyValue('--cols').trim())
    expect(Number(cols)).toBeGreaterThanOrEqual(3)
    await page.screenshot({ path: 'e2e/screenshots/boveda-8.png' })

    // 8. Hover → panel lateral con los datos reales.
    const panel = page.getByRole('complementary', { name: 'Información del reloj' })
    await page.locator('.cell', { hasText: 'Maison' }).locator('.cell-btn').hover()
    await expect(panel.getByRole('heading', { name: 'Diver' })).toBeVisible()
    await expect(panel.getByText('Ref. D-300')).toBeVisible()
    await expect(panel.getByText('Excelente')).toBeVisible()
    await expect(panel.getByText('Precio de compra')).toBeVisible()
    await expect(page.locator('.cell', { hasText: 'Maison' })).toHaveClass(/is-active/)
    // Campos vacíos no se muestran.
    await expect(panel.getByText('Material de la correa')).toHaveCount(0)

    // 9. Cambiar de reloj actualiza el panel.
    await page.locator('.cell', { hasText: 'Marca3' }).locator('.cell-btn').hover()
    await expect(panel.getByRole('heading', { name: 'Reloj 3' })).toBeVisible()
    await expect(panel.getByRole('heading', { name: 'Diver' })).toHaveCount(0)

    // 10. Editar desde el panel.
    await page.locator('.cell', { hasText: 'Maison' }).locator('.cell-btn').click()
    await page.mouse.move(5, 5)
    await expect(panel.getByRole('heading', { name: 'Diver' })).toBeVisible()
    await panel.getByRole('button', { name: 'Editar' }).click()
    const e = page.getByRole('dialog')
    await e.getByLabel('Nombre *').fill('Diver Pro')
    await e.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.locator('.cell', { hasText: 'Diver Pro' })).toBeVisible()
    await expect(panel.getByRole('heading', { name: 'Diver Pro' })).toBeVisible()

    // 11. Eliminar desde el panel → desaparece de la caja (papelera, recuperable).
    await panel.getByRole('button', { name: 'Mover a la papelera' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Mover a la papelera' }).click()
    await expect(page.locator('.cell', { hasText: 'Diver Pro' })).toHaveCount(0)
    await expect(page.locator('.cell')).toHaveCount(7)
    expect(await dbCount(page, 'items', 'live')).toBe(7)
    expect(await dbCount(page, 'items')).toBe(8)

    // Búsqueda dentro de la colección.
    await page.getByLabel('Buscar').fill('R-5')
    await expect(page.locator('.cell')).toHaveCount(1)
    await page.getByLabel('Buscar').fill('')
    expect(errors).toEqual([])
  })

  test('estilo personalizado persistente tras cerrar y reabrir', async ({ page, context }) => {
    await page.goto('/')
    await seedWatches(page, 3)
    await page.goto('/relojes')
    await page.getByRole('button', { name: 'Saltar apertura' }).click()

    // 12. Cambiar el estilo.
    await page.getByRole('button', { name: 'Personalizar bóveda' }).click()
    const dlg = page.getByRole('dialog')
    await dlg.getByRole('radio', { name: /Futuristic Vault/ }).click()
    await dlg.getByRole('radio', { name: 'Amplia' }).click()
    await expect(stage(page)).toHaveAttribute('data-style', 'futuristic')
    await dlg.getByRole('button', { name: 'Listo' }).click()
    await expect(stage(page)).toHaveAttribute('data-size', 'wide')

    // 13. Cerrar y volver a abrir la aplicación.
    await page.close()
    const again = await context.newPage()
    await again.goto('/relojes')
    await expect(again.locator('.vault-stage')).toHaveAttribute('data-style', 'futuristic')
    await expect(again.locator('.vault-stage')).toHaveAttribute('data-size', 'wide')
    expect(await dbCount(again, 'items', 'live')).toBe(3)
  })

  test('móvil: selección táctil y ficha en panel inferior', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, baseURL: 'http://127.0.0.1:5173' })
    const page = await context.newPage()
    await skipSplash(page)
    const errors = errorsOf(page)
    await page.goto('/')
    await seedWatches(page, 7)
    await page.goto('/relojes')
    await expect(stage(page)).toHaveAttribute('data-stage', '5', { timeout: 9000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)

    // 14. Toque → hoja inferior con la ficha (sin depender del hover).
    await page.locator('.cell-btn').first().tap()
    const sheet = page.getByRole('dialog', { name: /Ficha de/ })
    await expect(sheet).toBeVisible()
    await expect(sheet.getByRole('button', { name: 'Editar' })).toBeVisible()
    await page.screenshot({ path: 'e2e/screenshots/boveda-movil.png' })
    await sheet.getByRole('button', { name: 'Cerrar ficha' }).tap()
    await expect(sheet).toHaveCount(0)

    // Varias bandejas cuando la colección no cabe.
    await expect(page.getByRole('navigation', { name: 'Bandejas de la bóveda' })).toBeVisible()
    await page.getByRole('button', { name: 'Bandeja siguiente' }).tap()
    await expect(page.getByText('Bandeja 2 de')).toBeVisible()
    expect(errors).toEqual([])
    await context.close()
  })
})
