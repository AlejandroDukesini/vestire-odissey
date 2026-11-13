import Dexie from 'dexie'

export const DB_NAME = 'odissey-patrimonio'

/**
 * Historial de versiones del esquema. REGLAS (no negociables):
 *  - Nunca se modifica ni se elimina una versión ya publicada; solo se añaden nuevas.
 *  - Una tabla nunca se elimina (no usar `null` en stores) ni se vacía en un upgrade.
 *  - Los `upgrade` solo pueden añadir o completar campos, nunca borrar registros.
 *  - Toda versión nueva debe tener una prueba en tests/migrations.test.js.
 *
 * Tablas:
 *  items          activos patrimoniales (prendas, relojes, casas, empresas...)
 *  media          metadatos de archivos (fotos, modelos 3D, logos, capturas)
 *  mediaBlobs     binario original de cada archivo (separado para que los listados no lo carguen)
 *  thumbs         miniatura derivada (puede faltar; se regenera desde el original)
 *  compositions   composiciones de Previsualización
 *  incomeSources  fuentes de ingreso
 *  incomeEntries  ingresos esperados o recibidos registrados manualmente
 *  settings       preferencias (clave/valor)
 *  meta           metadatos internos: último respaldo, comprobaciones de integridad
 */
export const SCHEMA_VERSIONS = [
  {
    version: 1,
    stores: {
      items: 'id, kind, [kind+createdAt], updatedAt',
      media: 'id, ownerId, [ownerId+role], sha256, role',
      mediaBlobs: 'id',
      thumbs: 'id',
      compositions: 'id, photoMediaId, updatedAt',
      incomeSources: 'id, category, active',
      incomeEntries: 'id, sourceId, date, [sourceId+date], type',
      settings: 'key',
      meta: 'key',
    },
  },
]

export const CURRENT_SCHEMA_VERSION = SCHEMA_VERSIONS.at(-1).version

export const DATA_TABLES = [
  'items', 'media', 'compositions', 'incomeSources', 'incomeEntries', 'settings', 'meta',
]
export const BINARY_TABLES = ['mediaBlobs', 'thumbs']

/** Crea una instancia de la base de datos. `versions` permite a las pruebas simular migraciones. */
export function createDb(name = DB_NAME, versions = SCHEMA_VERSIONS) {
  const db = new Dexie(name)
  for (const v of versions) {
    const def = db.version(v.version).stores(v.stores)
    if (v.upgrade) def.upgrade(v.upgrade)
  }
  return db
}

export const newId = () => crypto.randomUUID()
