import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { Database, Download, HardDrive, Palette, ShieldCheck, SlidersHorizontal, Trash2, Upload } from 'lucide-react'
import { db } from '../../db/index.js'
import { getSettings, setSetting, SETTING_DEFAULTS } from '../../db/settings.js'
import { exportBackup, readBackup, applyBackup, markBackupDone, backupFileName } from '../../db/backup.js'
import { getStorageStatus, requestPersistence, hasRoomFor } from '../../db/storage.js'
import { runIntegrityCheck, repairSafeIssues } from '../../db/integrity.js'
import { describeDbError } from '../../db/errors.js'
import { CURRENCIES } from '../../domain/kinds.js'
import { formatBytes, makeThumbnail } from '../../lib/files.js'
import { formatDateTime } from '../../lib/format.js'
import { saveBlob } from '../../lib/download.js'
import VaultStyleSelector from '../vault/VaultStyleSelector.jsx'
import { Button, Dialog, Field, Notice, PageHeader, Panel, Tabs, useConfirm, useToast } from '../../components/ui.jsx'
import { logActivity } from '../../db/activity.js'
import AppearanceEditor from './AppearanceEditor.jsx'
import TrashPanel from './TrashPanel.jsx'
import pkg from '../../../package.json'

const ISSUE_LABELS = {
  'missing-blob': 'Archivo sin contenido original',
  'orphan-media': 'Archivo de un elemento que ya no existe',
  'orphan-blob': 'Binario sin uso (ocupa espacio)',
  'broken-primary': 'Imagen principal inexistente (reparable)',
  'missing-thumb': 'Miniatura ausente (reparable)',
  'broken-ref': 'Composición que apunta a un elemento eliminado',
  'orphan-entry': 'Ingreso de una fuente inexistente',
}

function PreferencesPanel() {
  const settings = useLiveQuery(() => getSettings(db), [])
  const toast = useToast()
  if (!settings) return null
  const save = async (key, value) => {
    try {
      await setSetting(db, key, value)
      if (key === 'currency') await logActivity(db, { type: 'settings.currency', title: value })
      if (key === 'splash') { try { localStorage.setItem('odissey.splash', value ? '1' : '0') } catch { /* opcional */ } }
      toast('Ajuste guardado')
    } catch (e) { toast(describeDbError(e), 'danger') }
  }
  return (
    <Panel>
      <h2 className="font-display text-2xl">Preferencias</h2>
      <div className="mt-5 grid gap-5 sm:grid-cols-3">
        <Field label="Moneda principal" hint="Se usa por defecto en nuevos registros y en el panel.">
          <select className="field-input" value={settings.currency} onChange={(e) => save('currency', e.target.value)}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Tamaño máximo por foto (MB)" hint={`Por defecto ${SETTING_DEFAULTS.maxImageMB} MB.`}>
          <input
            type="number" min={1} max={500} className="field-input" defaultValue={settings.maxImageMB}
            onBlur={(e) => { const n = Math.round(Number(e.target.value)); if (n >= 1 && n <= 500 && n !== settings.maxImageMB) save('maxImageMB', n) }}
          />
        </Field>
        <Field label="Tamaño máximo por modelo 3D (MB)" hint={`Por defecto ${SETTING_DEFAULTS.maxModelMB} MB.`}>
          <input
            type="number" min={1} max={2000} className="field-input" defaultValue={settings.maxModelMB}
            onBlur={(e) => { const n = Math.round(Number(e.target.value)); if (n >= 1 && n <= 2000 && n !== settings.maxModelMB) save('maxModelMB', n) }}
          />
        </Field>
      </div>
      <label className="mt-5 flex items-center gap-2 text-sm text-fg">
        <input type="checkbox" checked={settings.splash !== false} onChange={(e) => save('splash', e.target.checked)} />
        Mostrar la pantalla de presentación al abrir cada sesión
      </label>
    </Panel>
  )
}

function StoragePanel() {
  const [status, setStatus] = useState(null)
  const refresh = () => getStorageStatus().then(setStatus)
  useEffect(() => { refresh() }, [])
  const ratio = status?.quota ? Math.min(1, status.usage / status.quota) : 0
  return (
    <Panel>
      <div className="flex items-center gap-3">
        <HardDrive className="size-5 text-primary" aria-hidden />
        <h2 className="font-display text-2xl">Almacenamiento local</h2>
      </div>
      {status?.usage != null && (
        <div className="mt-5">
          <div className="flex justify-between text-xs text-muted">
            <span>{formatBytes(status.usage)} usados</span>
            <span>{formatBytes(status.quota)} disponibles para este sitio</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fg/5">
            <div className={`h-full rounded-full ${status.low ? 'bg-warn' : 'bg-primary'}`} style={{ width: `${Math.max(1, ratio * 100)}%` }} />
          </div>
          {status.low && <Notice tone="warn" className="mt-4">Queda poco espacio. Exporta una copia de seguridad y elimina archivos que no necesites.</Notice>}
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
        <span className={status?.persisted ? 'text-ok' : 'text-warn'}>
          {status?.persisted ? 'Almacenamiento persistente concedido' : 'Almacenamiento no marcado como persistente'}
        </span>
        {!status?.persisted && (
          <Button size="sm" onClick={async () => { await requestPersistence(); refresh() }}>Solicitar persistencia</Button>
        )}
      </div>
      <Notice className="mt-5" title="Dónde viven tus datos">
        Todo se guarda en IndexedDB, dentro de <strong>este navegador y este perfil</strong>. No hay servidor ni nube.
        Si borras los datos de navegación del sitio, usas otro navegador u otro perfil, o desinstalas el navegador,
        la información no estará disponible. La única forma de conservarla o trasladarla es una <strong>copia de seguridad</strong>.
      </Notice>
    </Panel>
  )
}

function BackupPanel() {
  const toast = useToast()
  const confirm = useConfirm()
  const fileRef = useRef(null)
  const last = useLiveQuery(() => db.meta.get('lastBackup'), [])
  const lastRestore = useLiveQuery(() => db.meta.get('lastRestore'), [])
  const [exporting, setExporting] = useState(null)
  const [pending, setPending] = useState(null) // respaldo leído y validado, a la espera de decisión
  const [reading, setReading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [preBackupDone, setPreBackupDone] = useState(false)

  const doExport = async () => {
    setExporting(0)
    try {
      const { blob, manifest } = await exportBackup(db, { appVersion: pkg.version, onProgress: setExporting })
      saveBlob(blob, backupFileName())
      await markBackupDone(db, manifest, blob.size)
      if (manifest.missingOriginals.length) toast(`Copia creada, pero ${manifest.missingOriginals.length} archivo(s) ya no tenían contenido original.`, 'danger')
      else toast(`Copia creada (${formatBytes(blob.size)}). Guárdala fuera de este equipo.`)
      return true
    } catch (e) {
      toast(`No se pudo crear la copia: ${describeDbError(e)}`, 'danger')
      return false
    } finally {
      setExporting(null)
    }
  }

  const onPick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setReading(true)
    try {
      const parsed = await readBackup(file)
      const room = await hasRoomFor(parsed.totalBytes)
      setPreBackupDone(false)
      setPending({ parsed, fileName: file.name, room })
    } catch (err) {
      toast(err.message, 'danger')
    } finally {
      setReading(false)
    }
  }

  const apply = async (mode) => {
    if (mode === 'replace') {
      const ok = await confirm({
        title: 'Reemplazar todos los datos',
        danger: true,
        confirmLabel: 'Reemplazar',
        message: 'Se sustituirán TODOS los datos actuales de este navegador por el contenido del respaldo. La operación es atómica: si falla, no se cambia nada.',
      })
      if (!ok) return
    }
    setApplying(true)
    try {
      const stats = await applyBackup(db, pending.parsed, { mode })
      const report = await runIntegrityCheck(db)
      setPending(null)
      toast(`Restauración completada: ${stats.added} añadidos, ${stats.updated} actualizados, ${stats.files} archivos.${report.ok ? '' : ' Revisa la integridad.'}`)
    } catch (e) {
      toast(`No se restauró nada: ${describeDbError(e)}`, 'danger')
    } finally {
      setApplying(false)
    }
  }

  const m = pending?.parsed.manifest
  return (
    <Panel>
      <div className="flex items-center gap-3">
        <Download className="size-5 text-primary" aria-hidden />
        <h2 className="font-display text-2xl">Copias de seguridad</h2>
      </div>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        El respaldo es un archivo .zip con todos los registros, fotografías originales, miniaturas, modelos 3D y composiciones.
        Permite trasladar tu información a otro dispositivo.
      </p>
      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="eyebrow">Última copia</dt><dd className="mt-1">{last?.value ? `${formatDateTime(last.value.at)} · ${formatBytes(last.value.size)}` : 'Nunca'}</dd></div>
        <div><dt className="eyebrow">Última restauración</dt><dd className="mt-1">{lastRestore?.value ? `${formatDateTime(lastRestore.value.at)} (${lastRestore.value.mode === 'merge' ? 'combinar' : 'reemplazar'})` : '—'}</dd></div>
      </dl>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="gold" busy={exporting !== null} onClick={doExport}>
          <Download className="size-4" aria-hidden />
          {exporting !== null ? `Exportando ${Math.round(exporting * 100)}%` : 'Exportar todo'}
        </Button>
        <Button busy={reading} onClick={() => fileRef.current?.click()}>
          <Upload className="size-4" aria-hidden /> Importar respaldo
        </Button>
        <input ref={fileRef} type="file" accept=".zip,application/zip" className="hidden" onChange={onPick} />
      </div>

      <Dialog open={!!pending} onClose={() => !applying && setPending(null)} title="Restaurar respaldo" wide
        footer={
          <>
            <Button onClick={() => setPending(null)} disabled={applying}>Cancelar</Button>
            <Button onClick={() => apply('merge')} busy={applying}>Combinar con mis datos</Button>
            <Button variant="danger" onClick={() => apply('replace')} disabled={!preBackupDone || applying}>Reemplazar todo</Button>
          </>
        }
      >
        {m && (
          <div className="space-y-4 text-sm">
            <Notice tone="ok" title="Respaldo válido">
              Archivo <strong>{pending.fileName}</strong> creado el {formatDateTime(Date.parse(m.createdAt))} (app v{m.appVersion}).
              Todas las sumas de verificación coinciden.
            </Notice>
            <ul className="grid grid-cols-2 gap-2 text-muted sm:grid-cols-3">
              <li>Activos: <strong className="text-fg">{pending.parsed.tables.items.length}</strong></li>
              <li>Archivos: <strong className="text-fg">{pending.parsed.tables.media.length}</strong></li>
              <li>Composiciones: <strong className="text-fg">{pending.parsed.tables.compositions.length}</strong></li>
              <li>Fuentes de ingreso: <strong className="text-fg">{pending.parsed.tables.incomeSources.length}</strong></li>
              <li>Ingresos: <strong className="text-fg">{pending.parsed.tables.incomeEntries.length}</strong></li>
              <li>Tamaño: <strong className="text-fg">{formatBytes(pending.parsed.totalBytes)}</strong></li>
            </ul>
            {pending.parsed.warnings.map((w) => <Notice key={w} tone="warn">{w}</Notice>)}
            {pending.room === false && <Notice tone="danger">Puede que no haya espacio suficiente para restaurar este respaldo.</Notice>}
            <p className="text-muted">
              <strong>Combinar</strong> conserva tus datos actuales, añade lo que falta y solo actualiza registros más recientes; no crea duplicados.
            </p>
            <div className="rounded-xl border border-danger/30 p-4">
              <p className="text-muted"><strong>Reemplazar</strong> borra los datos actuales de este navegador. Antes, descarga una copia de lo que tienes ahora:</p>
              <Button size="sm" className="mt-3" busy={exporting !== null} onClick={async () => setPreBackupDone(await doExport())}>
                {preBackupDone ? 'Copia actual descargada ✓' : 'Descargar copia de los datos actuales'}
              </Button>
              <label className="mt-3 flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" checked={preBackupDone} onChange={(e) => setPreBackupDone(e.target.checked)} />
                Ya tengo una copia de mis datos actuales o acepto perderlos.
              </label>
            </div>
          </div>
        )}
      </Dialog>
    </Panel>
  )
}

function IntegrityPanel() {
  const toast = useToast()
  const last = useLiveQuery(() => db.meta.get('lastIntegrityCheck'), [])
  const [report, setReport] = useState(null)
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try { setReport(await runIntegrityCheck(db)) } catch (e) { toast(describeDbError(e), 'danger') } finally { setBusy(false) }
  }
  const repair = async () => {
    setBusy(true)
    try {
      const n = await repairSafeIssues(db, report, { makeThumb: makeThumbnail })
      toast(`${n} incidencia(s) reparadas`)
      setReport(await runIntegrityCheck(db))
    } finally { setBusy(false) }
  }
  const grouped = report ? Object.entries(report.issues.reduce((a, i) => ({ ...a, [i.type]: (a[i.type] || 0) + 1 }), {})) : []
  return (
    <Panel>
      <div className="flex items-center gap-3">
        <ShieldCheck className="size-5 text-primary" aria-hidden />
        <h2 className="font-display text-2xl">Integridad de los datos</h2>
      </div>
      <p className="mt-3 text-sm text-muted">
        Revisa que cada registro tenga sus archivos y referencias. Nunca borra información: solo informa y repara lo que es seguro.
        Última comprobación: {last?.value ? `${formatDateTime(last.value.checkedAt)} · ${last.value.issues} incidencia(s)` : '—'}
      </p>
      <div className="mt-5 flex gap-3">
        <Button onClick={run} busy={busy}>Comprobar ahora</Button>
        {report?.issues.some((i) => ['broken-primary', 'missing-thumb'].includes(i.type)) && (
          <Button variant="gold" onClick={repair} busy={busy}>Reparar lo seguro</Button>
        )}
      </div>
      {report && (
        <div className="mt-5">
          {grouped.length === 0 ? (
            <Notice tone="ok">Sin incidencias. {report.counts.items} activos y {report.counts.media} archivos comprobados.</Notice>
          ) : (
            <ul className="space-y-1 text-sm text-muted">
              {grouped.map(([type, n]) => <li key={type}>{ISSUE_LABELS[type] ?? type}: <strong className="text-fg">{n}</strong></li>)}
            </ul>
          )}
        </div>
      )}
    </Panel>
  )
}

const TABS = [
  { value: 'general', label: 'General', icon: SlidersHorizontal },
  { value: 'apariencia', label: 'Apariencia', icon: Palette },
  { value: 'datos', label: 'Datos y respaldos', icon: Database },
  { value: 'papelera', label: 'Papelera', icon: Trash2 },
]

export default function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'general'
  return (
    <>
      <PageHeader eyebrow="Configuración" title="Configuración">
        Preferencias, apariencia, copias de seguridad, almacenamiento local y papelera.
      </PageHeader>
      <Tabs className="mb-6 w-fit max-w-full" value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} tabs={TABS} />
      <div key={tab} className="animate-page grid gap-6">
        {tab === 'general' && <><PreferencesPanel /><IntegrityPanel /></>}
        {tab === 'apariencia' && (
          <>
            <AppearanceEditor />
            <Panel>
              <p className="eyebrow mb-1">Colección de relojes</p>
              <h2 className="mb-5 font-display text-2xl">Bóveda de relojes</h2>
              <VaultStyleSelector />
            </Panel>
          </>
        )}
        {tab === 'datos' && <><BackupPanel /><StoragePanel /></>}
        {tab === 'papelera' && <TrashPanel />}
      </div>
    </>
  )
}
