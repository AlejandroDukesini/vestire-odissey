export class StorageFullError extends Error {
  constructor(cause) {
    super(
      'El almacenamiento del navegador está lleno. No se guardó el cambio. ' +
        'Libera espacio, elimina archivos que no necesites o exporta una copia de seguridad.',
    )
    this.name = 'StorageFullError'
    this.cause = cause
  }
}

export class ValidationError extends Error {
  constructor(errors, message = 'Hay campos con errores') {
    super(message)
    this.name = 'ValidationError'
    this.errors = errors
  }
}

export class NotFoundError extends Error {
  constructor(what) {
    super(`${what} no existe`)
    this.name = 'NotFoundError'
  }
}

export function isQuotaError(e) {
  for (let cur = e, depth = 0; cur && depth < 5; cur = cur.inner || cur.cause, depth++) {
    if (cur.name === 'QuotaExceededError' || cur.code === 22) return true
  }
  return false
}

/** Ejecuta una escritura y convierte errores de cuota en StorageFullError. */
export async function guardWrite(fn) {
  try {
    return await fn()
  } catch (e) {
    if (isQuotaError(e)) throw new StorageFullError(e)
    throw e
  }
}

/** Mensaje comprensible para el usuario a partir de cualquier error de almacenamiento. */
export function describeDbError(e) {
  if (!e) return 'Error desconocido'
  if (e instanceof StorageFullError || isQuotaError(e)) return new StorageFullError().message
  switch (e.name) {
    case 'VersionError':
      return 'Los datos fueron guardados por una versión más reciente de la aplicación. Actualiza el proyecto; tus datos no se han modificado.'
    case 'DatabaseClosedError':
    case 'OpenFailedError':
      return 'No se pudo abrir el almacenamiento local. Comprueba que el navegador no esté en modo privado y que permita guardar datos de sitios.'
    case 'InvalidStateError':
      return 'El navegador bloquea IndexedDB (¿modo privado o datos de sitios deshabilitados?).'
    default:
      return e.message || String(e)
  }
}
