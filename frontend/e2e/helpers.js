// Utilidades de pruebas e2e. Cada prueba usa un perfil de navegador nuevo y vacío.

/** Evita la presentación en pruebas que no la evalúan (marca la sesión como ya presentada). */
export async function skipSplash(page) {
  await page.addInitScript(() => { try { sessionStorage.setItem('odissey.splashShown', '1') } catch { /* noop */ } })
}

/** Genera PNG reales (decodificables) en el navegador y los devuelve como archivos para setInputFiles. */
export async function makePngs(page, colors) {
  const list = await page.evaluate(async (cs) => {
    const out = []
    for (const color of cs) {
      const c = new OffscreenCanvas(900, 1200)
      const ctx = c.getContext('2d')
      ctx.fillStyle = color
      ctx.fillRect(0, 0, 900, 1200)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(300, 300, 300, 500)
      const blob = await c.convertToBlob({ type: 'image/png' })
      const buf = new Uint8Array(await blob.arrayBuffer())
      let bin = ''
      for (const b of buf) bin += String.fromCharCode(b)
      out.push(btoa(bin))
    }
    return out
  }, colors)
  return list.map((b64, i) => ({ name: `foto-${i + 1}.png`, mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') }))
}

export async function dbCount(page, table, filter) {
  return page.evaluate(async ([t, f]) => {
    const { db } = await import('/src/db/index.js')
    const rows = await db[t].toArray()
    return f === 'live' ? rows.filter((r) => !r.deletedAt).length : rows.length
  }, [table, filter])
}
