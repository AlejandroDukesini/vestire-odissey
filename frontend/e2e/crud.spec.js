import { test, expect } from '@playwright/test'
import { skipSplash, makePngs, dbCount } from './helpers.js'

test.describe('CRUD completo desde la interfaz', () => {
  test.beforeEach(async ({ page }) => { await skipSplash(page) })

  test('prenda: crear con fotos, consultar, editar sin perder fotos, papelera, restaurar y dashboard', async ({ page }) => {
    await page.goto('/vestimenta')
    await expect(page.getByText('Aún no hay prendas')).toBeVisible()
    await page.getByRole('button', { name: 'Agregar prenda' }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Nuevo: prenda' })).toBeVisible()

    // Validación: no guarda sin obligatorios.
    await dialog.getByRole('button', { name: 'Agregar', exact: true }).click()
    await expect(dialog.getByText('Nombre es obligatorio')).toBeVisible()

    await dialog.getByLabel('Nombre *').fill('Camisa de lino')
    await dialog.getByLabel('Tipo de prenda *').selectOption('Camisa')
    await dialog.getByLabel('Talla').fill('M')
    await dialog.getByLabel('Color').fill('Blanco')
    await dialog.getByLabel('Material').fill('Lino')
    await dialog.getByLabel('Valor registrado').fill('150')
    await dialog.locator('input[type=file]').setInputFiles(await makePngs(page, ['#334455', '#884422']))
    await expect(dialog.locator('img')).toHaveCount(2)
    await page.screenshot({ path: 'e2e/screenshots/formulario.png' })
    await dialog.getByRole('button', { name: 'Agregar', exact: true }).click()
    await expect(page.getByText('Camisa de lino agregado')).toBeVisible()

    // Aparece colgada en el estante de prendas superiores del armario.
    const card = page.locator('.shelf[data-zone="top"] .garment', { hasText: 'Camisa de lino' })
    await expect(card).toBeVisible()
    await expect(card.locator('img')).toBeVisible()
    await page.screenshot({ path: 'e2e/screenshots/vestimenta.png' })

    // Ficha individual: desde el panel de la prenda.
    await card.locator('.garment-btn').click()
    await page.getByRole('complementary', { name: 'Información de la prenda' }).getByRole('link', { name: 'Ficha completa' }).click()
    await expect(page.getByRole('heading', { name: 'Camisa de lino', level: 1 })).toBeVisible()
    await expect(page.getByText('Lino', { exact: true })).toBeVisible()
    await expect(page.getByText('Valor declarado por ti')).toBeVisible()
    await page.screenshot({ path: 'e2e/screenshots/ficha.png', fullPage: true })

    // Edición parcial: cambia el color; las fotos y demás campos se mantienen.
    await page.getByRole('button', { name: 'Editar' }).click()
    const edit = page.getByRole('dialog')
    await edit.getByLabel('Color').fill('Marfil')
    await edit.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByText('Camisa de lino actualizado')).toBeVisible()
    await expect(page.getByText('Marfil', { exact: true })).toBeVisible()
    await expect(page.getByText('Lino', { exact: true })).toBeVisible()
    expect(await dbCount(page, 'media')).toBe(2)

    // Persistencia tras recargar.
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Camisa de lino', level: 1 })).toBeVisible()
    await expect(page.getByText('Marfil', { exact: true })).toBeVisible()

    // Dashboard refleja el registro real.
    await page.goto('/')
    const kpi = page.getByLabel('Indicadores principales').locator('a', { hasText: 'Prendas' }).first()
    await expect(kpi).toContainText('1')
    await expect(page.getByText(/150,00/).first()).toBeVisible()

    // Eliminación con confirmación que identifica el objeto.
    await page.goto('/vestimenta')
    await page.locator('.garment', { hasText: 'Camisa de lino' }).locator('.garment-btn').click()
    await page.getByRole('complementary', { name: 'Información de la prenda' }).getByRole('button', { name: 'Mover a la papelera' }).click()
    const confirm = page.getByRole('dialog')
    await expect(confirm).toContainText('Camisa de lino')
    await confirm.getByRole('button', { name: 'Mover a la papelera' }).click()
    await expect(page.getByText('Aún no hay prendas')).toBeVisible()
    expect(await dbCount(page, 'mediaBlobs')).toBe(2)

    await page.goto('/')
    await expect(page.getByLabel('Indicadores principales').locator('a', { hasText: 'Prendas' }).first()).toContainText('0')

    // Restaurar desde la papelera.
    await page.goto('/ajustes?tab=papelera')
    await expect(page.getByText('Camisa de lino')).toBeVisible()
    await page.getByRole('button', { name: 'Restaurar' }).click()
    await expect(page.getByText('Camisa de lino restaurado')).toBeVisible()
    await expect(page.getByText('La papelera está vacía')).toBeVisible()
    await page.goto('/vestimenta')
    await expect(page.locator('.garment', { hasText: 'Camisa de lino' })).toBeVisible()
  })

  test('formularios específicos: yate exige foto, vehículo con año, propiedad, empresa, reloj y accesorio', async ({ page }) => {
    await page.goto('/propiedades/yates')
    await page.getByRole('button', { name: 'Agregar yate' }).first().click()
    let d = page.getByRole('dialog')
    await d.getByLabel('Marca *').fill('Astillero')
    await d.getByLabel('Modelo *').fill('Azure 60')
    await d.getByRole('button', { name: 'Agregar', exact: true }).click()
    await expect(d.getByText('Es obligatorio subir al menos una fotografía válida')).toBeVisible()
    await d.locator('input[type=file]').setInputFiles(await makePngs(page, ['#0a3d62']))
    await d.getByRole('button', { name: 'Agregar', exact: true }).click()
    await expect(page.locator('article', { hasText: 'Astillero Azure 60' })).toBeVisible()

    await page.getByRole('tab', { name: /Automóviles/ }).click()
    await page.getByRole('button', { name: 'Agregar automóvil' }).first().click()
    d = page.getByRole('dialog')
    await expect(d.getByLabel('Kilometraje')).toBeVisible()
    await d.getByLabel('Marca *').fill('Marca')
    await d.getByLabel('Modelo *').fill('GT')
    await d.getByLabel('Año').fill('1700')
    await d.getByRole('button', { name: 'Agregar', exact: true }).click()
    await expect(d.getByText('Año debe ser al menos 1885')).toBeVisible()
    await d.getByLabel('Año').fill('2022')
    await d.getByLabel('Tipo').selectOption('Coupé')
    await d.getByRole('button', { name: 'Agregar', exact: true }).click()
    await expect(page.locator('article', { hasText: 'Marca GT' })).toContainText('2022')

    await page.getByRole('tab', { name: /Casas/ }).click()
    await page.getByRole('button', { name: 'Agregar casa' }).first().click()
    d = page.getByRole('dialog')
    await expect(d.getByLabel('Kilometraje')).toHaveCount(0)
    await d.getByLabel('Nombre de la propiedad *').fill('Villa del lago')
    await d.getByLabel('Tipo de inmueble *').selectOption('Villa')
    await d.getByLabel('Ubicación').fill('Lago')
    await d.getByRole('button', { name: 'Agregar', exact: true }).click()
    await expect(page.locator('article', { hasText: 'Villa del lago' })).toBeVisible()

    await page.goto('/empresas/fisicas')
    await page.getByRole('button', { name: 'Agregar empresa física' }).first().click()
    d = page.getByRole('dialog')
    await d.getByLabel('Nombre *').fill('Café Central')
    await d.getByLabel('Tipo de inmueble *').selectOption('Local comercial')
    await d.getByLabel('Actividad del negocio *').fill('Cafetería')
    await d.getByRole('button', { name: 'Agregar', exact: true }).click()
    await expect(page.locator('article', { hasText: 'Café Central' })).toBeVisible()

    await page.getByRole('tab', { name: /Negocios digitales/ }).click()
    await page.getByRole('button', { name: 'Agregar negocio digital' }).first().click()
    d = page.getByRole('dialog')
    await d.getByLabel('Nombre del negocio *').fill('Tienda online')
    await d.getByLabel('Dominio o URL principal').fill('tienda.example.com')
    await d.getByLabel(/Otros sitios web/).fill('blog.example.com')
    await d.getByRole('button', { name: 'Agregar', exact: true }).click()
    await page.locator('article', { hasText: 'Tienda online' }).getByRole('link').click()
    await expect(page.getByRole('link', { name: /tienda\.example\.com/ })).toHaveAttribute('rel', /noopener/)
    await expect(page.getByRole('link', { name: /blog\.example\.com/ })).toBeVisible()

    await page.goto('/relojes')
    await page.getByRole('button', { name: 'Agregar reloj' }).first().click()
    d = page.getByRole('dialog')
    await d.getByLabel('Marca *').fill('Maison')
    await d.getByLabel('Nombre *').fill('Diver')
    await d.getByLabel('Público').selectOption('Unisex')
    await d.getByRole('button', { name: 'Agregar', exact: true }).click()
    await expect(page.locator('.cell', { hasText: 'Diver' })).toBeVisible()

    await page.goto('/accesorios')
    await page.getByRole('button', { name: 'Agregar accesorio' }).first().click()
    d = page.getByRole('dialog')
    await d.getByLabel('Nombre *').fill('Gafas de sol')
    await d.getByLabel('Categoría *').selectOption('Gafas')
    await d.getByRole('button', { name: 'Agregar', exact: true }).click()
    await expect(page.locator('article', { hasText: 'Gafas de sol' })).toBeVisible()

    // Búsqueda y filtros por atributos de la categoría.
    await page.goto('/propiedades/automoviles')
    await page.getByRole('button', { name: /Filtros/ }).click()
    await page.getByLabel('Año').selectOption('2022')
    await expect(page.locator('article')).toHaveCount(1)
    await page.getByLabel('Buscar').fill('inexistente')
    await expect(page.getByText('Sin resultados')).toBeVisible()

    await page.goto('/')
    await expect(page.getByLabel('Indicadores principales').locator('a', { hasText: 'Vehículos y yates' })).toContainText('2')
    await expect(page.getByLabel('Indicadores principales').locator('a', { hasText: 'Empresas' }).first()).toContainText('2')
    await page.getByLabel('Búsqueda global').fill('villa')
    await page.getByRole('option', { name: /Villa del lago/ }).click()
    await expect(page.getByRole('heading', { name: 'Villa del lago', level: 1 })).toBeVisible()
  })

  test('fuentes de ingreso: crear, registrar recibido y reflejarlo en el dashboard', async ({ page }) => {
    await page.goto('/?')
    await page.getByRole('link', { name: /Fuente de ingreso/ }).click()
    const d = page.getByRole('dialog')
    await d.getByLabel('Nombre *').fill('Salario principal')
    await d.getByLabel('Categoría *').selectOption('Salario')
    await d.getByLabel('Importe *').fill('3000')
    await d.getByLabel('Frecuencia *').selectOption('biweekly')
    await d.getByRole('button', { name: 'Crear' }).click()
    await page.getByRole('link', { name: /Salario principal/ }).click()
    await page.getByRole('button', { name: 'Registrar' }).click()
    await expect(page.getByText('Ingreso registrado')).toBeVisible()
    await expect(page.locator('li', { hasText: 'Recibido' }).first()).toContainText('3000')
    await page.goto('/')
    await expect(page.locator('.card', { hasText: 'Recibido este mes' })).toContainText('3000')
    await expect(page.locator('.card', { hasText: 'equivalente mensual' })).toContainText('6000')
    await expect(page.getByLabel('Indicadores principales').locator('a', { hasText: 'Fuentes de ingreso' }).first()).toContainText('1/1')
    await expect(page.locator('.recharts-surface')).toBeVisible()
    await expect(page.locator('.recharts-bar-rectangle').first()).toBeVisible()
    await page.screenshot({ path: 'e2e/screenshots/dashboard.png', fullPage: true })
  })

  test('previsualización: referencias con conectores que persisten y se mantienen al redimensionar', async ({ page }) => {
    await page.goto('/vestimenta?nuevo=1')
    const d = page.getByRole('dialog')
    await d.getByLabel('Nombre *').fill('Camisa blanca')
    await d.getByLabel('Tipo de prenda *').selectOption('Camisa')
    await d.getByRole('button', { name: 'Agregar', exact: true }).click()
    await expect(page.locator('article', { hasText: 'Camisa blanca' })).toBeVisible()

    await page.goto('/previsualizaciones?nuevo=1')
    const nd = page.getByRole('dialog')
    await nd.getByLabel('Nombre').fill('Look de prueba')
    await nd.locator('input[type=file]').setInputFiles(await makePngs(page, ['#556677']))
    await nd.getByRole('button', { name: 'Crear y editar' }).click()
    await expect(page.getByLabel('Nombre de la composición')).toHaveValue('Look de prueba')

    await page.getByRole('button', { name: 'Añadir referencia' }).click()
    const img = page.locator('img[alt="Look de prueba"]')
    const box = await img.boundingBox()
    await img.click({ position: { x: box.width * 0.5, y: box.height * 0.3 } })
    await page.getByLabel('Elemento asociado').selectOption({ label: 'Camisa blanca' })
    await expect(page.getByTestId('connectors').locator('path')).toHaveCount(2) // trazo + halo
    await page.getByRole('button', { name: 'Guardar composición' }).click()
    await expect(page.getByText('Composición guardada')).toBeVisible()

    await page.reload()
    const anchor = page.getByRole('button', { name: /Referencia 1: Camisa blanca/ })
    await expect(anchor).toBeVisible()
    const rel = async () => {
      const a = await anchor.boundingBox()
      const b = await img.boundingBox()
      return [((a.x + a.width / 2 - b.x) / b.width).toFixed(2), ((a.y + a.height / 2 - b.y) / b.height).toFixed(2)]
    }
    expect(await rel()).toEqual(['0.50', '0.30'])
    await page.screenshot({ path: 'e2e/screenshots/previsualizacion.png' })
    await page.setViewportSize({ width: 820, height: 900 })
    await expect.poll(rel).toEqual(['0.50', '0.30'])
    const path = await page.getByTestId('connectors').locator('path').nth(1).getAttribute('d')
    const a = await anchor.boundingBox()
    const ws = await page.getByTestId('connectors').boundingBox()
    const [, x1, y1] = path.match(/^M ([\d.]+) ([\d.]+)/)
    expect(Math.abs(Number(x1) - (a.x + a.width / 2 - ws.x))).toBeLessThan(2)
    expect(Math.abs(Number(y1) - (a.y + a.height / 2 - ws.y))).toBeLessThan(2)

    // La relación se ve desde la ficha de la prenda.
    await page.goto('/vestimenta')
    await page.locator('.garment', { hasText: 'Camisa blanca' }).locator('.garment-btn').click()
    // Columna lateral o panel inferior según el ancho de la ventana.
    await page.getByRole('link', { name: 'Ficha completa' }).click()
    await expect(page.getByRole('link', { name: 'Look de prueba' })).toBeVisible()
  })
})
