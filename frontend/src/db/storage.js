// Estado del almacenamiento del navegador (cuota y persistencia).

export const LOW_SPACE_BYTES = 300 * 1024 * 1024
export const HIGH_USAGE_RATIO = 0.85

export async function getStorageStatus() {
  const sm = globalThis.navigator?.storage
  const status = { supported: !!sm?.estimate, persisted: null, usage: null, quota: null, low: false }
  if (!sm) return status
  try {
    if (sm.persisted) status.persisted = await sm.persisted()
    if (sm.estimate) {
      const { usage, quota } = await sm.estimate()
      status.usage = usage ?? null
      status.quota = quota ?? null
      if (usage != null && quota) status.low = quota - usage < LOW_SPACE_BYTES || usage / quota > HIGH_USAGE_RATIO
    }
  } catch { /* algunos navegadores lo bloquean; no es crítico */ }
  return status
}

/**
 * Solicita almacenamiento persistente: el navegador no borrará los datos por presión de espacio.
 * No impide que el usuario los borre manualmente.
 */
export async function requestPersistence() {
  try {
    return (await globalThis.navigator?.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}

/** Comprueba si cabe un volumen adicional de bytes. Devuelve null si no se puede estimar. */
export async function hasRoomFor(bytes) {
  const s = await getStorageStatus()
  if (s.usage == null || !s.quota) return null
  return s.quota - s.usage > bytes * 1.1
}
