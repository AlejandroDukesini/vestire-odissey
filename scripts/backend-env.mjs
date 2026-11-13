// Utilidades compartidas para localizar el backend Python y su entorno virtual.
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const BACKEND = join(ROOT, 'backend')
export const VENV = join(BACKEND, '.venv')
export const VENV_PY = process.platform === 'win32' ? join(VENV, 'Scripts', 'python.exe') : join(VENV, 'bin', 'python')
export const API_HOST = '127.0.0.1'
export const API_PORT = Number(process.env.ODISSEY_API_PORT || 8765)

export const backendExists = () => existsSync(join(BACKEND, 'app', 'main.py')) && existsSync(join(BACKEND, 'requirements.txt'))
export const venvReady = () => existsSync(VENV_PY)
