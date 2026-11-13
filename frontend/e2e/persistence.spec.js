import { test, expect } from '@playwright/test'
import { skipSplash } from './helpers.js'

/** Crea en el navegador una foto PNG real (decodificable) y un activo con ella. */
async function createSampleItem(page) {
  return page.evaluate(async () => {
    const { db } = await import('/src/db/index.js')
    const { createItem } = await import('/src/db/items.js')
    const { setItemModel } = await import('/src/db/media.js')
    const c = new OffscreenCanvas(1600, 1200)
    const ctx = c.getContext('2d')
    const g = ctx.createLinearGradient(0, 0, 1600, 1200)
    g.addColorStop(0, '#c9a96a'); g.addColorStop(1, '#101014')
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1600, 1200)
    const blob = await c.convertToBlob({ type: 'image/png' })
    const file = new File([blob], 'reloj.png', { type: 'image/png' })
    const { item } = await createItem(db, 'watch', { brand: 'Prueba', name: 'E2E', value: 1234, audience: 'Unisex' }, { files: [file] })
    const glb = new Uint8Array(64); glb.set([0x67, 0x6c, 0x54, 0x46]); new DataView(glb.buffer).setUint32(4, 2, true)
    const modelId = await setItemModel(db, item.id, new File([glb], 'modelo.glb'))
    const thumb = await db.thumbs.get(item.primaryMediaId)
    const original = await db.mediaBlobs.get(item.primaryMediaId)
    const media = await db.media.get(item.primaryMediaId)
    return { id: item.id, mediaId: item.primaryMediaId, modelId, thumbSize: thumb?.blob.size ?? 0, originalSize: original.blob.size, width: media.width }
  })
}

async function readItem(page, id, mediaId, modelId) {
  return page.evaluate(async ([id, mediaId, modelId]) => {
    const { db } = await import('/src/db/index.js')
    const item = await db.items.get(id)
    const blob = (await db.mediaBlobs.get(mediaId))?.blob
    const model = (await db.mediaBlobs.get(modelId))?.blob
    const bytes = blob ? Array.from(new Uint8Array(await blob.arrayBuffer()).slice(0, 64)) : null
    return { title: item?.title, size: blob?.size ?? 0, head: bytes, model: model?.size ?? 0 }
  }, [id, mediaId, modelId])
}

test('datos, fotos y modelos persisten tras recargar, y el respaldo se restaura en otro perfil', async ({ page, browser }) => {
  await skipSplash(page)
  await page.goto('/ajustes?tab=datos')
  await expect(page.getByRole('heading', { name: 'Copias de seguridad' })).toBeVisible()

  const created = await createSampleItem(page)
  expect(created.thumbSize).toBeGreaterThan(0)
  expect(created.thumbSize).toBeLessThan(created.originalSize)
  expect(created.width).toBe(1600)

  await page.reload()
  const before = await readItem(page, created.id, created.mediaId, created.modelId)
  expect(before.title).toBe('Prueba E2E')
  expect(before.size).toBe(created.originalSize)
  expect(before.model).toBe(64)

  await expect(page.getByText('Aún no has creado ninguna copia de seguridad')).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar todo' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^odissey-respaldo-.*\.zip$/)
  const zipPath = await download.path()
  await expect(page.getByText('Aún no has creado ninguna copia de seguridad')).toBeHidden()

  const other = await browser.newContext()
  const page2 = await other.newPage()
  await skipSplash(page2)
  await page2.goto('/ajustes?tab=datos')
  await page2.locator('input[type=file]').setInputFiles(zipPath)
  await expect(page2.getByText('Respaldo válido')).toBeVisible()
  await expect(page2.getByRole('button', { name: 'Reemplazar todo' })).toBeDisabled()
  await page2.getByRole('button', { name: 'Combinar con mis datos' }).click()
  await expect(page2.getByText(/Restauración completada/)).toBeVisible()

  expect(await readItem(page2, created.id, created.mediaId, created.modelId)).toEqual(before)
  await page2.reload()
  expect(await readItem(page2, created.id, created.mediaId, created.modelId)).toEqual(before)
  await other.close()
})
