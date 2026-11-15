import { useLiveQuery } from 'dexie-react-hooks'
import { Volume2, VolumeX } from 'lucide-react'
import { db } from '../../db/index.js'
import { getSettings, setSetting } from '../../db/settings.js'
import { describeDbError } from '../../db/errors.js'
import { cx, useToast } from '../../components/ui.jsx'
import { VAULT_INTROS } from '../vault/vaultPrefs.js'

// Preferencias del armario (tabla settings, clave "wardrobe"), separadas de las prendas.
// Por defecto la apertura se ve UNA VEZ POR SESIÓN: al volver a la sección el armario ya está
// abierto y ordenado (se puede repetir con el botón de la escena).
export const WARDROBE_DEFAULTS = { intro: 'session', sound: true }

export function sanitizeWardrobe(v) {
  const src = v && typeof v === 'object' ? v : {}
  return {
    intro: src.intro in VAULT_INTROS ? src.intro : WARDROBE_DEFAULTS.intro,
    sound: typeof src.sound === 'boolean' ? src.sound : WARDROBE_DEFAULTS.sound,
  }
}

export function useWardrobePrefs() {
  const raw = useLiveQuery(async () => (await getSettings(db)).wardrobe, [])
  return { prefs: sanitizeWardrobe(raw), loaded: raw !== undefined }
}

/** Ajustes del armario (Configuración → Apariencia). */
export function WardrobeSettings() {
  const { prefs } = useWardrobePrefs()
  const toast = useToast()
  const save = async (patch) => {
    try { await setSetting(db, 'wardrobe', sanitizeWardrobe({ ...prefs, ...patch })) } catch (e) { toast(describeDbError(e), 'danger') }
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-muted">Animación de apertura del armario</span>
        <select className="field-input" value={prefs.intro} onChange={(e) => save({ intro: e.target.value })}>
          {Object.entries(VAULT_INTROS).map(([id, l]) => <option key={id} value={id}>{l.replace('Relojes', 'Vestimenta')}</option>)}
        </select>
      </label>
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted">Sonido de las puertas</p>
        <button type="button" role="switch" aria-checked={prefs.sound} onClick={() => save({ sound: !prefs.sound })}
          className={cx('inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border text-sm transition-colors', prefs.sound ? 'border-primary/50 text-primary' : 'border-line text-muted')}>
          {prefs.sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />} {prefs.sound ? 'Activado (sutil)' : 'Silenciado'}
        </button>
      </div>
    </div>
  )
}
