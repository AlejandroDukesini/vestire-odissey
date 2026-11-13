import { test, expect } from '@playwright/test'

/** Crea en el navegador una foto PNG real (decodificable) y un activo con ella. */
async function createSampleItem(page) {
  return page.evaluate(async () => {
    const { db } = await import('/src/db/index.js')
    const { createItem } = await import('/src/db/items.js')
    const c = new OffscreenCanvas(1600, 1200)
    const ctx = c.getContext('2d')
    const g = ctx.createLinearGradient(0, 0, 1600, 1200)
    g.addColorStop(0, '#c9a96a'); g.addColorStop(1, '#101014')
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1600, 1200)
    const blob = await c.convertToBlob({ type: 'image/png' })
    const file = new File([blob], 'reloj.png', { type: 'image/png' })
    const { item } = await createItem(db, 'watch', { brand: 'Prueba', name: 'E2E', value: 1234, audience: 'Unisex' }, { files: [file] })
    const thumb = await db.thumbs.get(item.primaryMediaId)
    const original = await db.mediaBlobs.get(item.primaryMediaId)
    const media = await db.media.get(item.primaryMediaId)
    return { id: item.id, mediaId: item.primaryMediaId, thumbSize: thumb?.blob.size ?? 0, originalSize: original.blob.size, width: media.width }
  })
}

async function readItem(page, id, mediaId) {
  return page.evaluate(async ([id, mediaId]) => {
    const { db } = await import('/src/db/index.js')
    const item = await db.items.get(id)
    const blob = (await db.mediaBlobs.get(mediaId))?.blob
    const bytes = blob ? Array.from(new Uint8Array(await blob.arrayBuffer()).slice(0, 64)) : null
    return { title: item?.title, size: blob?.size ?? 0, head: bytes }
  }, [id, mediaId])
}

test('los datos y fotos persisten tras recargar, y el respaldo se restaura en otro perfil', async ({ page, browser }) => {
  await page.goto('/ajustes')
  await expect(page.getByRole('heading', { name: 'Copias de seguridad' })).toBeVisible()

  const created = await createSampleItem(page)
  expect(created.thumbSize).toBeGreaterThan(0)
  expect(created.thumbSize).toBeLessThan(created.originalSize)
  expect(created.width).toBe(1600)

  await page.reload()
  const before = await readItem(page, created.id, created.mediaId)
  expect(before.title).toBe('Prueba E2E')
  expect(before.size).toBe(created.originalSize)

  await expect(page.getByText('Aún no has creado ninguna copia de seguridad')).toBeVisible()
  await page.screenshot({ path: 'e2e/screenshots/ajustes.png', fullPage: true })

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar todo' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^odissey-respaldo-.*\.zip$/)
  const zipPath = await download.path()
  await expect(page.getByText('Aún no has creado ninguna copia de seguridad')).toBeHidden()

  // Otro "dispositivo": contexto nuevo con IndexedDB vacío.
  const other = await browser.newContext()
  const page2 = await other.newPage()
  await page2.goto('/ajustes')
  await page2.locator('input[type=file]').setInputFiles(zipPath)
  await expect(page2.getByText('Respaldo válido')).toBeVisible()
  await expect(page2.getByRole('button', { name: 'Reemplazar todo' })).toBeDisabled()
  await page2.screenshot({ path: 'e2e/screenshots/restaurar.png' })
  await page2.getByRole('button', { name: 'Combinar con mis datos' }).click()
  await expect(page2.getByText(/Restauración completada/)).toBeVisible()

  const after = await readItem(page2, created.id, created.mediaId)
  expect(after).toEqual(before)
  await page2.reload()
  expect(await readItem(page2, created.id, created.mediaId)).toEqual(before)
  await other.close()
})

test('la navegación muestra los módulos pendientes sin simular funcionalidad', async ({ page }) => {
  await page.goto('/relojes')
  await expect(page.getByText('todavía no está implementado')).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Abrir menú' }).click()
  await page.getByRole('link', { name: 'Ajustes' }).click()
  await expect(page.getByRole('heading', { name: 'Ajustes', level: 1 })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(overflow).toBe(false)
  await page.screenshot({ path: 'e2e/screenshots/movil.png', fullPage: true })
})
