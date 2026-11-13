import { db } from '../../db/index.js'
import { itemRelations, purgeItem, restoreItem, setFeatured, trashItem } from '../../db/items.js'
import { describeDbError } from '../../db/errors.js'
import { KINDS } from '../../domain/kinds.js'
import { useConfirm, useToast } from '../../components/ui.jsx'

/** Acciones con confirmación que identifican el objeto y sus relaciones. */
export function useItemActions() {
  const confirm = useConfirm()
  const toast = useToast()

  const trash = async (item) => {
    const rel = await itemRelations(db, item.id)
    const ok = await confirm({
      title: 'Mover a la papelera',
      danger: true,
      confirmLabel: 'Mover a la papelera',
      message: (
        <div className="space-y-2">
          <p>Vas a retirar <strong>{item.title}</strong> ({KINDS[item.kind].label.toLowerCase()}).</p>
          <ul className="list-disc pl-5">
            <li>Se conservan sus {rel.files} archivo(s); podrás restaurarlo desde Configuración → Papelera.</li>
            {rel.compositions.length > 0 && <li>Aparece en {rel.compositions.length} composición(es): mostrarán la referencia como retirada.</li>}
            {rel.incomeSources.length > 0 && <li>Está vinculado a {rel.incomeSources.length} fuente(s) de ingreso, que no se modifican.</li>}
            <li>Deja de contar en el dashboard.</li>
          </ul>
        </div>
      ),
    })
    if (!ok) return false
    try { await trashItem(db, item.id); toast(`${item.title} movido a la papelera`); return true } catch (e) { toast(describeDbError(e), 'danger'); return false }
  }

  const purge = async (item) => {
    const rel = await itemRelations(db, item.id)
    const ok = await confirm({
      title: 'Eliminar definitivamente',
      danger: true,
      confirmLabel: 'Eliminar para siempre',
      message: (
        <p>
          Se borrarán <strong>{item.title}</strong> y sus {rel.files} archivo(s) propios. Esta acción no se puede deshacer.
          Las composiciones y fuentes de ingreso relacionadas no se eliminan.
        </p>
      ),
    })
    if (!ok) return false
    try { await purgeItem(db, item.id); toast('Eliminado definitivamente'); return true } catch (e) { toast(describeDbError(e), 'danger'); return false }
  }

  const restore = async (item) => {
    try { await restoreItem(db, item.id); toast(`${item.title} restaurado`) } catch (e) { toast(describeDbError(e), 'danger') }
  }

  const toggleFeatured = async (item) => {
    try { await setFeatured(db, item.id, !item.featured) } catch (e) { toast(describeDbError(e), 'danger') }
  }

  return { trash, purge, restore, toggleFeatured }
}
