import { useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { Compass } from 'lucide-react'
import Layout from './Layout.jsx'
import Splash, { shouldShowSplash } from './Splash.jsx'
import { bootDatabase, db } from '../db/index.js'
import { describeDbError } from '../db/errors.js'
import { getSettings } from '../db/settings.js'
import { applyAppearance, mirrorAppearance } from '../theme/apply.js'
import { ThemeProvider } from '../theme/ThemeProvider.jsx'
import { Button, EmptyState, FeedbackProvider } from '../components/ui.jsx'
import DashboardPage from '../features/dashboard/DashboardPage.jsx'
import CollectionPage from '../features/items/CollectionPage.jsx'
import WatchesPage from '../features/vault/WatchesPage.jsx'
import ItemDetailPage from '../features/items/ItemDetailPage.jsx'
import IncomePage from '../features/income/IncomePage.jsx'
import IncomeDetailPage from '../features/income/IncomeDetailPage.jsx'
import PreviewListPage from '../features/preview/PreviewListPage.jsx'
import PreviewEditorPage from '../features/preview/PreviewEditorPage.jsx'
import SettingsPage from '../features/settings/SettingsPage.jsx'

function NotFound() {
  return <EmptyState icon={Compass} title="Página no encontrada" action={<Button onClick={() => window.history.back()}>Volver</Button>}>La dirección no corresponde a ninguna sección.</EmptyState>
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="vestimenta" element={<CollectionPage sectionKey="vestimenta" />} />
          <Route path="vestimenta/:id" element={<ItemDetailPage />} />
          <Route path="accesorios" element={<CollectionPage sectionKey="accesorios" />} />
          <Route path="accesorios/:id" element={<ItemDetailPage />} />
          <Route path="relojes" element={<WatchesPage />} />
          <Route path="relojes/:id" element={<ItemDetailPage />} />
          <Route path="propiedades" element={<Navigate to="/propiedades/yates" replace />} />
          <Route path="propiedades/:type" element={<CollectionPage sectionKey="propiedades" />} />
          <Route path="propiedades/:type/:id" element={<ItemDetailPage />} />
          <Route path="empresas" element={<Navigate to="/empresas/fisicas" replace />} />
          <Route path="empresas/:type" element={<CollectionPage sectionKey="empresas" />} />
          <Route path="empresas/:type/:id" element={<ItemDetailPage />} />
          <Route path="ingresos" element={<IncomePage />} />
          <Route path="ingresos/:id" element={<IncomeDetailPage />} />
          <Route path="previsualizaciones" element={<PreviewListPage />} />
          <Route path="previsualizaciones/:id" element={<PreviewEditorPage />} />
          <Route path="ajustes" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

/**
 * Arranque: abre IndexedDB (sin borrar ni reiniciar nada), carga la apariencia guardada y
 * monta la aplicación. La presentación se superpone y desaparece cuando ambas cosas están listas.
 */
export default function App() {
  const [boot, setBoot] = useState({ status: 'loading', appearance: null, error: null })
  const [splash, setSplash] = useState(shouldShowSplash)

  const start = useCallback(async () => {
    setBoot({ status: 'loading', appearance: null, error: null })
    try {
      await bootDatabase()
      const settings = await getSettings(db)
      applyAppearance(settings.appearance)
      if (settings.appearance) mirrorAppearance(settings.appearance)
      try { localStorage.setItem('odissey.splash', settings.splash === false ? '0' : '1') } catch { /* opcional */ }
      setBoot({ status: 'ready', appearance: settings.appearance, error: null })
    } catch (error) {
      setBoot({ status: 'error', appearance: null, error: { name: error?.name ?? 'Error', message: describeDbError(error) } })
    }
  }, [])

  useEffect(() => { start() }, [start])

  const ready = boot.status === 'ready'
  return (
    <FeedbackProvider>
      {ready && (
        <ThemeProvider initial={boot.appearance}>
          <AppRoutes />
        </ThemeProvider>
      )}
      {(splash || boot.status === 'error') && (
        <Splash ready={ready} error={boot.error} onRetry={start} onDone={() => setSplash(false)} />
      )}
      {!splash && boot.status === 'loading' && (
        <div className="grid min-h-dvh place-items-center text-sm text-muted" role="status">Abriendo tu patrimonio…</div>
      )}
    </FeedbackProvider>
  )
}
