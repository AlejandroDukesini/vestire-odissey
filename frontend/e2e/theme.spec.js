import { test, expect } from '@playwright/test'
import { skipSplash } from './helpers.js'

const cssVar = (page, name) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name)

test('temas y paletas: previsualizar, aplicar, guardar, persistir y restaurar', async ({ page }) => {
  await skipSplash(page)
  await page.goto('/ajustes?tab=apariencia')
  await expect(page.getByRole('heading', { name: 'Paletas predefinidas' })).toBeVisible()
  const original = await cssVar(page, '--c-primary')

  await page.getByRole('radio', { name: /Glassmorphism/ }).click()
  await page.getByRole('button', { name: /Ocean Blue/ }).click()
  // La vista previa local cambia al momento; la app aún no.
  await expect(page.getByLabel('Vista previa del tema')).toHaveAttribute('data-theme', 'glass')
  expect(await cssVar(page, '--c-primary')).toBe(original)

  const hex = page.getByLabel('Primario', { exact: true })
  await hex.fill('#7c3aed')
  await expect(hex).toHaveAttribute('aria-invalid', 'false')
  await page.getByLabel('Acento', { exact: true }).fill('zzz')
  await page.getByLabel('Acento', { exact: true }).blur()
  await expect(page.getByText('Código HEX no válido')).toBeVisible()

  await page.getByRole('button', { name: 'Aplicar cambios' }).click()
  await expect.poll(() => cssVar(page, '--c-primary')).toBe('#7C3AED')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'glass')
  await expect(page.getByText('Aplicado sin guardar')).toBeVisible()

  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect.poll(() => cssVar(page, '--c-primary')).toBe(original)

  await page.getByRole('radio', { name: /Glassmorphism/ }).click()
  await page.getByRole('button', { name: /Ocean Blue/ }).click()
  await page.getByLabel('Primario', { exact: true }).fill('#7C3AED')
  await page.getByRole('button', { name: 'Guardar configuración' }).click()
  await expect(page.getByText('Apariencia guardada')).toBeVisible()
  await page.screenshot({ path: 'e2e/screenshots/apariencia.png', fullPage: true })

  // Persistencia en IndexedDB tras recargar (se borra la copia de localStorage para probar la fuente real).
  await page.evaluate(() => localStorage.removeItem('odissey.appearance.mirror'))
  await page.reload()
  await expect.poll(() => cssVar(page, '--c-primary')).toBe('#7C3AED')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'glass')
  const stored = await page.evaluate(async () => {
    const { db } = await import('/src/db/index.js')
    return (await db.settings.get('appearance')).value
  })
  expect(stored).toMatchObject({ theme: 'glass', palette: 'custom', colors: { primary: '#7C3AED', background: '#06121F' } })
  await page.goto('/')
  await page.screenshot({ path: 'e2e/screenshots/dashboard-glass.png' })

  await page.goto('/ajustes?tab=apariencia')
  await page.getByRole('button', { name: 'Restaurar valores predeterminados' }).click()
  await page.getByRole('button', { name: 'Guardar configuración' }).click()
  await expect.poll(() => page.evaluate(async () => {
    const { db } = await import('/src/db/index.js')
    return (await db.settings.get('appearance')).value.colors.primary
  })).toBe('#C9A96A')
  await page.reload()
  await expect.poll(() => cssVar(page, '--c-primary')).toBe('#C9A96A')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'normal')
})

test('paleta clara legible y navegación móvil sin desbordamiento', async ({ page }) => {
  await skipSplash(page)
  await page.goto('/ajustes?tab=apariencia')
  await page.getByRole('button', { name: /Minimal Light/ }).click()
  await page.getByRole('button', { name: 'Guardar configuración' }).click()
  await page.goto('/')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Abrir menú' }).click()
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Configuración' }).click()
  await expect(page.getByRole('heading', { name: 'Configuración', level: 1 })).toBeVisible()
  for (const path of ['/', '/vestimenta', '/propiedades/casas', '/ingresos', '/previsualizaciones', '/ajustes?tab=apariencia']) {
    await page.goto(path)
    await page.waitForTimeout(150)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), path).toBe(false)
  }
  await page.goto('/')
  await page.screenshot({ path: 'e2e/screenshots/movil-claro.png', fullPage: true })
})
