import { Link } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { RotateCcw, Trash2 } from 'lucide-react'
import { db } from '../../db/index.js'
import { listTrashedItems } from '../../db/items.js'
import { listCompositions, purgeComposition, restoreComposition } from '../../db/compositions.js'
import { listSources, purgeSource, restoreSource } from '../../db/income.js'
import { describeDbError } from '../../db/errors.js'
import { KINDS } from '../../domain/kinds.js'
import { formatDateTime } from '../../lib/format.js'
import { itemPath } from '../../app/nav.js'
import MediaImage from '../../components/MediaImage.jsx'
import { Button, EmptyState, Panel, useConfirm, useToast } from '../../components/ui.jsx'
import { useItemActions } from '../items/useItemActions.jsx'

function Row({ media, title, subtitle, to, onRestore, onPurge }) {
  return (
    <li className="flex items-center gap-3 py-3">
      {media !== undefined && <MediaImage mediaId={media} className="size-12 shrink-0 rounded-md" alt="" />}
      <div className="min-w-0 flex-1">
        {to ? <Link to={to} className="block truncate text-sm text-fg hover:text-primary">{title}</Link> : <p className="truncate text-sm text-fg">{title}</p>}
        <p className="truncate text-xs text-muted">{subtitle}</p>
      </div>
      <Button size="sm" onClick={onRestore}><RotateCcw className="size-3.5" /> Restaurar</Button>
      <Button size="sm" variant="danger" onClick={onPurge}><Trash2 className="size-3.5" /><span className="hidden sm:inline">Eliminar</span></Button>
    </li>
  )
}

export default function TrashPanel() {
  const items = useLiveQuery(() => listTrashedItems(db), [])
  const comps = useLiveQuery(async () => (await listCompositions(db, { includeDeleted: true })).filter((c) => c.deletedAt), [])
  const sources = useLiveQuery(async () => (await listSources(db, { includeDeleted: true })).filter((s) => s.deletedAt), [])
  const actions = useItemActions()
  const confirm = useConfirm()
  const toast = useToast()

  const run = async (fn, msg) => { try { await fn(); toast(msg) } catch (e) { toast(describeDbError(e), 'danger') } }
  const purgeWith = async (title, what, fn) => {
    if (!(await confirm({ title: 'Eliminar definitivamente', danger: true, confirmLabel: 'Eliminar para siempre', message: <>Se borrará <strong>{title}</strong>{what}. No se puede deshacer.</> }))) return
    run(fn, 'Eliminado definitivamente')
  }

  if (!items || !comps || !sources) return null
  if (items.length + comps.length + sources.length === 0) {
    return <EmptyState icon={Trash2} title="La papelera está vacía">Los elementos que elimines aparecerán aquí y podrás restaurarlos.</EmptyState>
  }
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">Los elementos en la papelera conservan sus fotografías y relaciones, y no cuentan en el dashboard. La eliminación definitiva solo borra los archivos propios de cada elemento.</p>
      {items.length > 0 && (
        <Panel>
          <h2 className="eyebrow mb-2">Activos ({items.length})</h2>
          <ul className="divide-y divide-line">
            {items.map((i) => (
              <Row key={i.id} media={i.primaryMediaId} title={i.title} to={itemPath(i)}
                subtitle={`${KINDS[i.kind].label} · en la papelera desde ${formatDateTime(i.deletedAt)}`}
                onRestore={() => actions.restore(i)} onPurge={() => actions.purge(i)} />
            ))}
          </ul>
        </Panel>
      )}
      {comps.length > 0 && (
        <Panel>
          <h2 className="eyebrow mb-2">Composiciones ({comps.length})</h2>
          <ul className="divide-y divide-line">
            {comps.map((c) => (
              <Row key={c.id} media={c.photoMediaId} title={c.name} to={`/previsualizaciones/${c.id}`} subtitle={`${c.refs.length} referencia(s) · ${formatDateTime(c.deletedAt)}`}
                onRestore={() => run(() => restoreComposition(db, c.id), 'Composición restaurada')}
                onPurge={() => purgeWith(c.name, ' y su fotografía', () => purgeComposition(db, c.id))} />
            ))}
          </ul>
        </Panel>
      )}
      {sources.length > 0 && (
        <Panel>
          <h2 className="eyebrow mb-2">Fuentes de ingreso ({sources.length})</h2>
          <ul className="divide-y divide-line">
            {sources.map((s) => (
              <Row key={s.id} title={s.name} to={`/ingresos/${s.id}`} subtitle={`${s.category} · ${formatDateTime(s.deletedAt)}`}
                onRestore={() => run(() => restoreSource(db, s.id), 'Fuente restaurada')}
                onPurge={() => purgeWith(s.name, ' y todo su historial de ingresos', () => purgeSource(db, s.id))} />
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
