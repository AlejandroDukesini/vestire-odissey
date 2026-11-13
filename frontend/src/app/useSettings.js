import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/index.js'
import { getSettings, SETTING_DEFAULTS } from '../db/settings.js'

/** Ajustes reactivos (se actualizan solos al cambiar en IndexedDB). */
export function useSettings() {
  return useLiveQuery(() => getSettings(db), []) ?? SETTING_DEFAULTS
}

export const mb = (n) => Math.max(1, Number(n) || 1) * 1024 * 1024
