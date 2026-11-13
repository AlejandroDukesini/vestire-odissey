// Ejecuta las pruebas del backend si existe y está instalado.
import { spawnSync } from 'node:child_process'
import { BACKEND, VENV_PY, backendExists, venvReady } from './backend-env.mjs'

if (!backendExists()) { console.log('[test] Sin backend Python en esta versión.'); process.exit(0) }
if (!venvReady()) { console.log('[test] Backend no instalado: ejecuta npm run setup para probarlo.'); process.exit(0) }
const r = spawnSync(VENV_PY, ['-m', 'pytest', '-q'], { cwd: BACKEND, stdio: 'inherit' })
process.exit(r.status ?? 1)
