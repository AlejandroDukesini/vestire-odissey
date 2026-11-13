import { test, expect } from '@playwright/test'

test('presentación: al menos 2 s en la primera apertura de la sesión y no en recargas', async ({ page }) => {
  const t0 = Date.now()
  await page.goto('/')
  await expect(page.getByTestId('splash')).toBeVisible()
  await expect(page.getByTestId('splash').getByRole('heading', { name: 'Odissey' })).toBeVisible()
  await page.screenshot({ path: 'e2e/screenshots/splash.png' })
  await expect(page.getByTestId('splash')).toBeHidden({ timeout: 10_000 })
  expect(Date.now() - t0).toBeGreaterThanOrEqual(2000)
  await expect(page.getByRole('heading', { level: 1, name: /Buen/ })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: /Buen/ })).toBeVisible()
  await expect(page.getByTestId('splash')).toHaveCount(0)

  // Navegar entre secciones no vuelve a mostrarla.
  await page.getByRole('link', { name: 'Vestimenta' }).click()
  await expect(page.getByTestId('splash')).toHaveCount(0)
})

test('movimiento reducido: presentación sin animaciones y transiciones anuladas', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const t0 = Date.now()
  await page.goto('/')
  await expect(page.getByTestId('splash')).toBeHidden({ timeout: 10_000 })
  expect(Date.now() - t0).toBeGreaterThanOrEqual(2000)
  const duration = await page.evaluate(() => getComputedStyle(document.querySelector('.animate-page')).animationDuration)
  expect(parseFloat(duration)).toBeLessThan(0.01)
  await ctx.close()
})

test('un error de inicialización se muestra y permite reintentar sin bloquear', async ({ page }) => {
  await page.addInitScript(() => {
    const realOpen = indexedDB.open.bind(indexedDB)
    let fail = true
    window.__allowDb = () => { fail = false }
    indexedDB.open = (...args) => {
      if (fail) throw Object.assign(new Error('bloqueado'), { name: 'InvalidStateError' })
      return realOpen(...args)
    }
  })
  await page.goto('/')
  await expect(page.getByText('No se pudo abrir el almacenamiento local')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('No se ha borrado ni modificado ningún dato')).toBeVisible()
  await page.evaluate(() => window.__allowDb())
  await page.getByRole('button', { name: 'Reintentar' }).click()
  await expect(page.getByRole('heading', { level: 1, name: /Buen/ })).toBeVisible({ timeout: 10_000 })
})
