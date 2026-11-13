import { newId } from './schema.js'

// Historial de actividad real. Solo se registra lo que ocurre; nunca se inventan entradas.
// Debe llamarse dentro de una transacción que incluya db.activity.

export const ACTIVITY_LABELS = {
  'item.created': 'Agregado',
  'item.updated': 'Editado',
  'item.trashed': 'Movido a la papelera',
  'item.restored': 'Restaurado',
  'item.purged': 'Eliminado definitivamente',
  'media.added': 'Nuevas fotografías',
  'model.added': 'Modelo 3D incorporado',
  'composition.created': 'Nueva composición',
  'composition.updated': 'Composición editada',
  'composition.trashed': 'Composición a la papelera',
  'composition.restored': 'Composición restaurada',
  'composition.purged': 'Composición eliminada',
  'income.created': 'Nueva fuente de ingreso',
  'income.updated': 'Fuente de ingreso editada',
  'income.trashed': 'Fuente de ingreso a la papelera',
  'income.restored': 'Fuente de ingreso restaurada',
  'income.purged': 'Fuente de ingreso eliminada',
  'entry.created': 'Ingreso registrado',
  'entry.deleted': 'Ingreso eliminado',
  'settings.appearance': 'Apariencia actualizada',
  'settings.currency': 'Moneda principal cambiada',
  'backup.restored': 'Respaldo restaurado',
}

export async function logActivity(db, { type, entityId = null, kind = null, title = '', detail = null }) {
  await db.activity.add({ id: newId(), at: Date.now(), type, entityId, kind, title, detail })
}

export async function recentActivity(db, limit = 12) {
  return db.activity.orderBy('at').reverse().limit(limit).toArray()
}
