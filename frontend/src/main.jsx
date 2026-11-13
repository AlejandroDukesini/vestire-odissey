import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.jsx'
import { applyAppearance, readMirror } from './theme/apply.js'

// Primer fotograma con los colores guardados (copia ligera); IndexedDB los confirma al arrancar.
applyAppearance(readMirror())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
