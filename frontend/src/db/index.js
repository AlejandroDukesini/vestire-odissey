// Instancia única de la base de datos de la aplicación y arranque seguro.
import { createDb } from './schema.js'
import { requestPersistence } from './storage.js'
import { runIntegrityCheck } from './integrity.js'

export const db = createDb()

const listeners = new Set()
export function onDbEvent(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const emit = (e) => listeners.forEach((fn) => fn(e))

// Otra pestaña con una versión más nueva del esquema necesita que cerremos la conexión.
db.on('versionchange', () => {
  db.close()
  emit({ type: 'versionchange' })
  return false
})
db.on('blocked', () => emit({ type: 'blocked' }))

/** Abre la base de datos sin borrar ni reiniciar nada. Lanza el error original si falla. */
export async function bootDatabase() {
  await db.open()
  // Pedimos almacenamiento persistente para que el navegador no expulse los datos por falta de espacio.
  requestPersistence()
  const idle = globalThis.requestIdleCallback || ((fn) => setTimeout(fn, 1500))
  idle(() => runIntegrityCheck(db).then((r) => emit({ type: 'integrity', report: r })).catch(() => {}))
  return db
}
