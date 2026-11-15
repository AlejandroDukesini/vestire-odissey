import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Volume2, VolumeX } from 'lucide-react'
import { db } from '../../db/index.js'
import { getSettings, setSetting } from '../../db/settings.js'
import { describeDbError } from '../../db/errors.js'
import { cx, useToast } from '../../components/ui.jsx'
import { VAULT_INTROS, VAULT_SIZES, VAULT_STYLES, sanitizeVault } from './vaultPrefs.js'

/** Preferencias reactivas de la bóveda (IndexedDB → settings.vault). */
export function useVaultPrefs() {
  const raw = useLiveQuery(async () => (await getSettings(db)).vault, [])
  return { prefs: sanitizeVault(raw), loaded: raw !== undefined }
}

export async function saveVaultPrefs(patch, current) {
  await setSetting(db, 'vault', sanitizeVault({ ...current, ...patch }))
}

/** Miniatura del estilo: un frente de caja fuerte dibujado con los colores del estilo. */
function StyleThumb({ id }) {
  return (
    <span className="vault-thumb" data-style={id} aria-hidden>
      <span className="vt-body"><span className="vt-door"><span className="vt-lock" /></span></span>
    </span>
  )
}

/**
 * VaultStyleSelector: estilo de la caja fuerte, tamaño de compartimentos, cuándo reproducir la
 * apertura y sonido. Los cambios se guardan al momento y persisten entre sesiones.
 */
export default function VaultStyleSelector({ compact }) {
  const { prefs } = useVaultPrefs()
  const toast = useToast()
  const save = async (patch) => {
    try { await saveVaultPrefs(patch, prefs) } catch (e) { toast(describeDbError(e), 'danger') }
  }

  return (
    <div className="space-y-6">
      <div role="radiogroup" aria-label="Estilo de la caja fuerte" className={cx('grid gap-3', compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-4')}>
        {Object.entries(VAULT_STYLES).map(([id, s]) => {
          const active = prefs.style === id
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => save({ style: id })}
              className={cx(
                'group relative flex flex-col overflow-hidden rounded-xl border text-left transition-[border-color,transform] duration-300 ease-lux hover:-translate-y-0.5',
                active ? 'border-primary' : 'border-line hover:border-line-strong',
              )}
            >
              <StyleThumb id={id} />
              <span className="block p-3">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-display text-xl text-fg">{s.label}</span>
                  {active && <span className="grid size-5 place-items-center rounded-full bg-primary text-on-primary"><Check className="size-3" /></span>}
                </span>
                <span className="mt-0.5 block text-[11px] uppercase tracking-[0.14em] text-primary/90">{s.tagline}</span>
                <span className="mt-2 block text-xs leading-relaxed text-muted">{s.description}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">Tamaño de los compartimentos</p>
          <div role="radiogroup" aria-label="Tamaño" className="flex rounded-full border border-line bg-fg/[0.02] p-1">
            {Object.entries(VAULT_SIZES).map(([id, s]) => (
              <button key={id} type="button" role="radio" aria-checked={prefs.size === id} title={s.hint} onClick={() => save({ size: id })}
                className={cx('flex-1 rounded-full px-3 py-1.5 text-sm transition-colors', prefs.size === id ? 'bg-primary text-on-primary' : 'text-muted hover:text-fg')}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">Animación de apertura</span>
          <select className="field-input" value={prefs.intro} onChange={(e) => save({ intro: e.target.value })}>
            {Object.entries(VAULT_INTROS).map(([id, l]) => <option key={id} value={id}>{l}</option>)}
          </select>
        </label>
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">Sonido del mecanismo</p>
          <button type="button" role="switch" aria-checked={prefs.sound} onClick={() => save({ sound: !prefs.sound })}
            className={cx('inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border text-sm transition-colors', prefs.sound ? 'border-primary/50 text-primary' : 'border-line text-muted')}>
            {prefs.sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />} {prefs.sound ? 'Activado (sutil)' : 'Silenciado'}
          </button>
        </div>
      </div>
      <p className="text-xs text-muted">Solo cambia la presentación. Los relojes, sus fotografías y sus datos no se modifican.</p>
    </div>
  )
}
