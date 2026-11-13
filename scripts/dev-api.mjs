// Inicia el backend FastAPI local si está instalado. Si no, informa y termina sin error
// para que `npm run dev:all` siga sirviendo el frontend.
import { spawn } from 'node:child_process'
import { BACKEND, VENV_PY, API_HOST, API_PORT, backendExists, venvReady } from './backend-env.mjs'

if (!backendExists()) {
  console.log('[api] No hay backend Python en esta versión del proyecto. Solo se inicia el frontend.')
  process.exit(0)
}
if (!venvReady()) {
  console.log('[api] El backend existe pero su entorno no está instalado. Ejecuta: npm run setup')
  console.log('[api] El frontend funciona igualmente; las funciones que dependen del backend aparecerán como no disponibles.')
  process.exit(0)
}

// Solo escucha en 127.0.0.1: nunca se expone a la red.
const child = spawn(
  VENV_PY,
  ['-m', 'uvicorn', 'app.main:app', '--host', API_HOST, '--port', String(API_PORT), '--reload', '--reload-dir', 'app'],
  { cwd: BACKEND, stdio: 'inherit', env: { ...process.env, PYTHONUNBUFFERED: '1' } },
)
child.on('error', (e) => { console.error(`[api] No se pudo iniciar el backend: ${e.message}`); process.exit(1) })
child.on('exit', (code, signal) => process.exit(signal ? 0 : code ?? 0))
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig))
