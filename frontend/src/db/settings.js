import { guardWrite } from './errors.js'

export const SETTING_DEFAULTS = {
  currency: 'USD',
  maxImageMB: 40,
  maxModelMB: 200,
  reduceMotion: 'system', // system | on | off
}

export async function getSettings(db) {
  const rows = await db.settings.toArray()
  const out = { ...SETTING_DEFAULTS }
  for (const r of rows) if (r.key in SETTING_DEFAULTS) out[r.key] = r.value
  return out
}

export async function setSetting(db, key, value) {
  if (!(key in SETTING_DEFAULTS)) throw new Error(`Ajuste desconocido: ${key}`)
  await guardWrite(() => db.settings.put({ key, value }))
}

export async function getMeta(db, key) {
  return (await db.meta.get(key))?.value ?? null
}

export async function setMeta(db, key, value) {
  await guardWrite(() => db.meta.put({ key, value }))
}
