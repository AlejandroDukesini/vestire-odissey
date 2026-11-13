import { useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import Layout from './Layout.jsx'
import { ALL_ROUTES } from './nav.js'
import { bootDatabase } from '../db/index.js'
import { describeDbError } from '../db/errors.js'
import { FeedbackProvider, Notice } from '../components/ui.jsx'
import SettingsPage from '../features/settings/SettingsPage.jsx'
import Pending from '../features/placeholder/Pending.jsx'

// Módulos implementados. Las rutas que no estén aquí muestran la página "Pendiente".
const IMPLEMENTED = {
  '/ajustes': SettingsPage,
}

function DbGate({ children }) {
  const [state, setState] = useState({ status: 'loading' })
  useEffect(() => {
    bootDatabase().then(
      () => setState({ status: 'ready' }),
      (error) => setState({ status: 'error', error }),
    )
  }, [])
  if (state.status === 'loading') {
    return <div className="grid min-h-dvh place-items-center text-sm text-muted">Abriendo tu patrimonio…</div>
  }
  if (state.status === 'error') {
    return (
      <div className="mx-auto grid min-h-dvh max-w-xl place-items-center px-4">
        <Notice tone="danger" title="No se pudo abrir el almacenamiento local">
          <p>{describeDbError(state.error)}</p>
          <p className="mt-2">No se ha borrado ni modificado ningún dato. Detalle técnico: {state.error?.name}</p>
        </Notice>
      </div>
    )
  }
  return children
}

export default function App() {
  return (
    <FeedbackProvider>
      <DbGate>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              {ALL_ROUTES.map(({ to, label, phase }) => {
                const Page = IMPLEMENTED[to]
                return <Route key={to} path={to} element={Page ? <Page /> : <Pending title={label} phase={phase} />} />
              })}
              <Route path="*" element={<Pending title="Página no encontrada" phase="—" />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </DbGate>
    </FeedbackProvider>
  )
}
