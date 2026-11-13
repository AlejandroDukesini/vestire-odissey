// Crea el entorno virtual de Python e instala las dependencias del backend (si existe).
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { BACKEND, VENV, VENV_PY, backendExists, venvReady } from './backend-env.mjs'

if (!backendExists()) {
  console.log('[setup] Esta versión no incluye backend Python. Nada que instalar.')
  process.exit(0)
}

const run = (cmd, args) => spawnSync(cmd, args, { stdio: 'inherit', cwd: BACKEND, shell: false })

if (!venvReady()) {
  const candidates = process.platform === 'win32' ? [['py', ['-3']], ['python', []]] : [['python3', []], ['python', []]]
  let created = false
  for (const [cmd, pre] of candidates) {
    const r = run(cmd, [...pre, '-m', 'venv', VENV])
    if (r.status === 0) { created = true; break }
  }
  if (!created) {
    console.error('[setup] No se encontró Python 3.10+ en el sistema. Instálalo desde python.org y repite: npm run setup')
    process.exit(1)
  }
}

const pip = run(VENV_PY, ['-m', 'pip', 'install', '--upgrade', '-r', join(BACKEND, 'requirements.txt')])
process.exit(pip.status ?? 1)
