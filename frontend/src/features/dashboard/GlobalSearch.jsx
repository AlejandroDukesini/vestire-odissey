import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { ScanEye, Wallet } from 'lucide-react'
import { db } from '../../db/index.js'
import { KINDS, itemSubtitle } from '../../domain/kinds.js'
import { itemPath } from '../../app/nav.js'
import MediaImage from '../../components/MediaImage.jsx'
import { SearchInput, cx } from '../../components/ui.jsx'

const norm = (s) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** Búsqueda global sobre activos, fuentes de ingreso y composiciones (excluye la papelera). */
export default function GlobalSearch() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const navigate = useNavigate()
  const box = useRef(null)
  const input = useRef(null)

  const data = useLiveQuery(async () => {
    if (q.trim().length < 2) return null
    const [items, sources, comps] = await Promise.all([db.items.toArray(), db.incomeSources.toArray(), db.compositions.toArray()])
    return { items: items.filter((i) => !i.deletedAt), sources: sources.filter((s) => !s.deletedAt), comps: comps.filter((c) => !c.deletedAt) }
  }, [q.trim().length >= 2])

  const results = useMemo(() => {
    const nq = norm(q.trim())
    if (!data || nq.length < 2) return []
    const out = []
    for (const i of data.items) {
      if (norm([i.title, itemSubtitle(i), ...Object.values(i.fields).flat()].join(' ')).includes(nq)) {
        out.push({ key: i.id, title: i.title, sub: `${KINDS[i.kind].label}${itemSubtitle(i) ? ` · ${itemSubtitle(i)}` : ''}`, to: itemPath(i), media: i.primaryMediaId })
      }
    }
    for (const s of data.sources) if (norm(`${s.name} ${s.category} ${s.description}`).includes(nq)) out.push({ key: s.id, title: s.name, sub: `Fuente de ingreso · ${s.category}`, to: `/ingresos/${s.id}`, icon: Wallet })
    for (const c of data.comps) if (norm(c.name).includes(nq)) out.push({ key: c.id, title: c.name, sub: 'Previsualización', to: `/previsualizaciones/${c.id}`, media: c.photoMediaId, icon: ScanEye })
    return out.slice(0, 8)
  }, [data, q])

  useEffect(() => { setActive(0) }, [q])
  useEffect(() => {
    const onDoc = (e) => !box.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.current?.focus() } }
    document.addEventListener('pointerdown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [])

  const go = (r) => { setOpen(false); setQ(''); navigate(r.to) }
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    if (e.key === 'Enter' && results[active]) go(results[active])
    if (e.key === 'Escape') setOpen(false)
  }

  const show = open && q.trim().length >= 2
  return (
    <div ref={box} className="relative w-full sm:w-80">
      <SearchInput
        inputRef={input}
        value={q}
        onChange={(v) => { setQ(v); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Buscar en todo el patrimonio…  (Ctrl+K)"
        aria-label="Búsqueda global"
        role="combobox"
        aria-expanded={show}
        aria-controls="global-search-results"
      />
      {show && (
        <ul id="global-search-results" role="listbox" className="overlay animate-rise absolute right-0 z-40 mt-2 max-h-[60dvh] w-full overflow-y-auto rounded-xl p-1 shadow-2xl sm:w-[26rem]">
          {results.length === 0 && <li className="px-3 py-4 text-sm text-muted">Sin resultados para «{q}».</li>}
          {results.map((r, i) => (
            <li key={r.key} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r)}
                className={cx('flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left', i === active && 'bg-fg/[0.06]')}
              >
                {r.media ? <MediaImage mediaId={r.media} className="size-10 shrink-0 rounded-md" alt="" /> : <span className="grid size-10 shrink-0 place-items-center rounded-md bg-fg/5">{r.icon && <r.icon className="size-4 text-muted" />}</span>}
                <span className="min-w-0">
                  <span className="block truncate text-sm text-fg">{r.title}</span>
                  <span className="block truncate text-xs text-muted">{r.sub}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
