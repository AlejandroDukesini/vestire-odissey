import { PageHeader, Panel } from '../../components/ui.jsx'

/** Página honesta para módulos aún no implementados: no simula funcionalidad. */
export default function Pending({ title, phase }) {
  return (
    <>
      <PageHeader eyebrow={`Fase ${phase}`} title={title} />
      <Panel>
        <p className="text-sm text-muted">
          Este módulo todavía no está implementado y se entregará en la Fase {phase}. Por ahora no guarda ni muestra datos.
        </p>
      </Panel>
    </>
  )
}
