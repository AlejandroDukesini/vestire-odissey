import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { db } from '../db/index.js'
import { setSetting } from '../db/settings.js'
import { logActivity } from '../db/activity.js'
import { guardWrite } from '../db/errors.js'
import { applyAppearance, mirrorAppearance } from './apply.js'
import { DEFAULT_APPEARANCE, sanitizeAppearance } from './palettes.js'

const Ctx = createContext(null)

/**
 * saved   configuración persistida en IndexedDB
 * preview configuración aplicada temporalmente a toda la app (sin guardar), o null
 */
export function ThemeProvider({ initial, children }) {
  const [saved, setSaved] = useState(() => sanitizeAppearance(initial))
  const [preview, setPreview] = useState(null)
  const active = preview ?? saved

  useEffect(() => { applyAppearance(active) }, [active])

  const save = useCallback(async (next) => {
    const clean = sanitizeAppearance(next)
    await guardWrite(() =>
      db.transaction('rw', db.settings, db.activity, async () => {
        await setSetting(db, 'appearance', clean)
        await logActivity(db, { type: 'settings.appearance', title: clean.theme === 'glass' ? 'Glassmorphism' : 'Normal' })
      }),
    )
    mirrorAppearance(clean)
    setSaved(clean)
    setPreview(null)
  }, [])

  const value = useMemo(
    () => ({
      saved, preview, active,
      applyPreview: (a) => setPreview(sanitizeAppearance(a)),
      cancelPreview: () => setPreview(null),
      save,
      defaults: DEFAULT_APPEARANCE,
    }),
    [saved, preview, active, save],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useTheme = () => useContext(Ctx)
