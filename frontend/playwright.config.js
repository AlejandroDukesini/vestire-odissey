import { defineConfig } from '@playwright/test'

// Cada prueba usa un perfil de navegador nuevo y vacío: nunca toca los datos reales del usuario.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:5173', acceptDownloads: true, viewport: { width: 1360, height: 900 } },
  webServer: {
    command: 'npx vite --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    env: { NO_OPEN: '1' },
  },
})
