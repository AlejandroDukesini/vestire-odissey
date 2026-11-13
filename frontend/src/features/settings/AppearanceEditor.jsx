import { useEffect, useMemo, useState } from 'react'
import { Check, Eye, RotateCcw, Save, Sparkles, Square, X } from 'lucide-react'
import { useTheme } from '../../theme/ThemeProvider.jsx'
import { MOTION, PALETTES, THEMES, TOKENS, legibilityIssues, normalizeHex, onColor, sanitizeAppearance } from '../../theme/palettes.js'
import { describeDbError } from '../../db/errors.js'
import { Badge, Button, Field, Notice, Panel, cx, useToast } from '../../components/ui.jsx'

/** Variables CSS para la vista previa local (solo afecta a la caja de previsualización). */
function previewVars(a) {
  const vars = { '--c-on-primary': onColor(a.colors.primary), '--c-on-accent': onColor(a.colors.accent) }
  for (const t of TOKENS) vars[t.css] = a.colors[t.key]
  return vars
}

function ColorRow({ token, value, onChange }) {
  const [text, setText] = useState(value)
  const [error, setError] = useState(false)
  useEffect(() => { setText(value); setError(false) }, [value])
  const commit = (v) => {
    const hex = normalizeHex(v)
    if (!hex) { setError(true); return }
    setError(false)
    onChange(hex)
  }
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={value.toLowerCase()}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        aria-label={`${token.label}: selector de color`}
        className="size-9 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <label className="block text-xs text-muted" htmlFor={`hex-${token.key}`}>{token.label}</label>
        <input
          id={`hex-${token.key}`}
          value={text}
          onChange={(e) => { setText(e.target.value); if (normalizeHex(e.target.value)) commit(e.target.value) }}
          onBlur={(e) => commit(e.target.value)}
          aria-invalid={error}
          spellCheck={false}
          className="field-input mt-1 py-1.5 font-mono text-xs uppercase"
        />
        {error && <span className="text-[11px] text-danger">Código HEX no válido (#RRGGBB)</span>}
      </div>
    </div>
  )
}

function ThemePreview({ draft }) {
  return (
    <div data-theme={draft.theme} style={previewVars(draft)} className="relative overflow-hidden rounded-2xl border border-line p-5" aria-label="Vista previa del tema">
      <div className="absolute inset-0" style={{ background: 'var(--c-bg)' }} />
      {draft.theme === 'glass' && (
        <div className="absolute inset-0" style={{ background: 'radial-gradient(260px 200px at 85% 10%, color-mix(in oklab, var(--c-primary) 40%, transparent), transparent 70%), radial-gradient(240px 220px at 10% 90%, color-mix(in oklab, var(--c-accent) 30%, transparent), transparent 70%)' }} />
      )}
      <div className="relative space-y-3 text-fg">
        <div className="panel p-4">
          <p className="eyebrow">Panel</p>
          <h4 className="mt-1 font-display text-2xl">Colección privada</h4>
          <p className="text-xs text-muted">Texto secundario de ejemplo para comprobar la legibilidad.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="gold" size="sm">Primario</Button>
            <Button size="sm">Secundario</Button>
            <span className="inline-flex h-8 items-center rounded-full px-3 text-xs font-medium" style={{ background: 'var(--c-accent)', color: 'var(--c-on-accent)' }}>Acento</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-3">
            <p className="text-xs text-muted">Tarjeta</p>
            <p className="font-display text-xl text-primary">$ 12.500</p>
          </div>
          <div className="card p-3">
            <label className="text-xs text-muted">Formulario<input className="field-input mt-1 py-1 text-xs" defaultValue="Texto" /></label>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="ok">Éxito</Badge><Badge tone="warn">Advertencia</Badge><Badge tone="danger">Error</Badge>
          <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ background: 'var(--c-secondary)', color: onColor(draft.colors.secondary) }}>Secundario</span>
        </div>
      </div>
    </div>
  )
}

export default function AppearanceEditor() {
  const theme = useTheme()
  const toast = useToast()
  const [draft, setDraft] = useState(theme.saved)
  const [saving, setSaving] = useState(false)

  // Al salir sin guardar se descarta la vista previa aplicada a la aplicación.
  useEffect(() => () => theme.cancelPreview(), []) // eslint-disable-line react-hooks/exhaustive-deps

  const issues = useMemo(() => legibilityIssues(draft.colors), [draft.colors])
  const differsFromSaved = JSON.stringify(sanitizeAppearance(draft)) !== JSON.stringify(theme.saved)
  const previewActive = !!theme.preview

  const setColor = (key, hex) => setDraft((d) => ({ ...d, palette: 'custom', colors: { ...d.colors, [key]: hex } }))
  const choosePalette = (key) => setDraft((d) => ({ ...d, palette: key, colors: { ...PALETTES[key].colors } }))

  const save = async () => {
    setSaving(true)
    try { await theme.save(draft); toast('Apariencia guardada') } catch (e) { toast(describeDbError(e), 'danger') } finally { setSaving(false) }
  }
  const cancel = () => { theme.cancelPreview(); setDraft(theme.saved); toast('Cambios descartados') }
  const restoreDefaults = () => { setDraft(structuredClone(theme.defaults)); toast('Valores predeterminados cargados. Guarda para conservarlos.') }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-6">
        <Panel>
          <h2 className="font-display text-2xl">Tema</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Tema">
            {Object.entries(THEMES).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={draft.theme === key}
                onClick={() => setDraft((d) => ({ ...d, theme: key }))}
                className={cx('card interactive flex items-start gap-3 p-4 text-left', draft.theme === key && 'border-primary shadow-[0_0_0_1px_var(--c-primary)]')}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-fg/5">
                  {key === 'glass' ? <Sparkles className="size-5 text-primary" /> : <Square className="size-5 text-primary" />}
                </span>
                <span>
                  <span className="block font-medium text-fg">{label}</span>
                  <span className="block text-xs text-muted">{key === 'glass' ? 'Paneles translúcidos con desenfoque, bordes semitransparentes y profundidad.' : 'Superficies sólidas, bordes discretos y máxima legibilidad.'}</span>
                </span>
                {draft.theme === key && <Check className="ml-auto size-4 text-primary" />}
              </button>
            ))}
          </div>
        </Panel>

        <Panel>
          <h2 className="font-display text-2xl">Paletas predefinidas</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.entries(PALETTES).map(([key, p]) => (
              <button
                key={key}
                type="button"
                onClick={() => choosePalette(key)}
                aria-pressed={draft.palette === key}
                className={cx('card interactive overflow-hidden p-0 text-left', draft.palette === key && 'border-primary shadow-[0_0_0_1px_var(--c-primary)]')}
              >
                <span className="flex h-12">
                  {['background', 'surface', 'primary', 'accent', 'text'].map((k) => <span key={k} className="flex-1" style={{ background: p.colors[k] }} />)}
                </span>
                <span className="flex items-center justify-between px-3 py-2 text-xs text-fg">{p.name}{draft.palette === key && <Check className="size-3.5 text-primary" />}</span>
              </button>
            ))}
          </div>
          {draft.palette === 'custom' && <p className="mt-3 text-xs text-muted">Paleta personalizada.</p>}
        </Panel>

        <Panel>
          <h2 className="font-display text-2xl">Colores personalizados</h2>
          <p className="mt-1 text-sm text-muted">Usa el selector o escribe un código HEX (#RRGGBB).</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOKENS.map((t) => <ColorRow key={t.key} token={t} value={draft.colors[t.key]} onChange={(hex) => setColor(t.key, hex)} />)}
          </div>
          {issues.length > 0 && (
            <Notice tone="warn" title="Posibles problemas de legibilidad" className="mt-5">
              <ul className="list-disc pl-4">{issues.map((i) => <li key={i.label}>{i.label}: contraste {i.ratio.toFixed(1)}:1 (mínimo recomendado {i.min}:1)</li>)}</ul>
            </Notice>
          )}
        </Panel>

        <Panel>
          <h2 className="font-display text-2xl">Animaciones</h2>
          <Field label="Nivel de movimiento" className="mt-4 max-w-sm" hint="«Según el sistema» respeta la preferencia de movimiento reducido del sistema operativo.">
            <select className="field-input" value={draft.motion} onChange={(e) => setDraft((d) => ({ ...d, motion: e.target.value }))}>
              {Object.entries(MOTION).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
        </Panel>
      </div>

      <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Vista previa en tiempo real</p>
          {previewActive && <Badge tone="warn">Aplicado sin guardar</Badge>}
        </div>
        <ThemePreview draft={sanitizeAppearance(draft)} />
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => theme.applyPreview(draft)} disabled={!differsFromSaved && !previewActive}><Eye className="size-4" /> Aplicar cambios</Button>
          <Button variant="gold" onClick={save} busy={saving} disabled={!differsFromSaved}><Save className="size-4" /> Guardar configuración</Button>
          <Button onClick={cancel} disabled={!differsFromSaved && !previewActive}><X className="size-4" /> Cancelar</Button>
          <Button variant="quiet" className="col-span-2" onClick={restoreDefaults}><RotateCcw className="size-4" /> Restaurar valores predeterminados</Button>
        </div>
        <p className="text-xs text-muted">«Aplicar cambios» muestra la apariencia en toda la aplicación sin guardarla. Se guarda en este dispositivo (IndexedDB) al pulsar «Guardar configuración» y se conserva entre sesiones y actualizaciones.</p>
      </div>
    </div>
  )
}
