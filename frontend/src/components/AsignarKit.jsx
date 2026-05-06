import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'
import PrintButton from './PrintButton'

export default function AsignarKit() {
  const { token, user } = useAuth()
  const printRef = useRef(null)

  const [instituciones, setInstituciones] = useState([])
  const [supervisorMeta, setSupervisorMeta] = useState({
    zona_label: '',
    zona_count: 0,
    nivel_educativo: user?.nivel_educativo || ''
  })
  const [kits, setKits] = useState([])
  const [kitByInstitucion, setKitByInstitucion] = useState({})
  const [savingTipoId, setSavingTipoId] = useState(null)
  const [msg, setMsg] = useState({ text: '', type: '' })

  useEffect(() => {
    const loadInstitucionesYKits = async () => {
      try {
        const [institucionesRes, kitsRes] = await Promise.all([
          apiFetch('/api/supervisor/instituciones', { token }),
          apiFetch('/api/pedidos/kits', { token })
        ])

        if (institucionesRes.ok) {
          const data = await institucionesRes.json()
          const rows = data.instituciones || []
          const meta = data.meta || {}
          setInstituciones(rows)
          setSupervisorMeta({
            zona_label: meta.zona_label || '',
            zona_count: Number(meta.zona_count) || 0,
            nivel_educativo: meta.nivel_educativo || user?.nivel_educativo || ''
          })
          setKitByInstitucion(
            Object.fromEntries(rows.map((inst) => [String(inst.id), inst.kit_id ? String(inst.kit_id) : '']))
          )
        }

        if (kitsRes.ok) {
          const data = await kitsRes.json()
          setKits(data.kits || [])
        }
      } catch (err) {
        console.error('Error cargando escuelas del supervisor:', err)
      }
    }
    loadInstitucionesYKits()
  }, [token, user?.nivel_educativo])

  const zonaLabel = supervisorMeta.zona_label || 'Sin zona asignada'
  const nivelLabel = supervisorMeta.nivel_educativo || '-'
  const zonaTitle = supervisorMeta.zona_count > 1 ? 'Zonas' : 'Zona'

  const handleGuardarTipoKit = async (institucionId) => {
    const kit_id = Number(kitByInstitucion[String(institucionId)] || 0)
    setSavingTipoId(institucionId)
    try {
      const res = await apiFetch(`/api/supervisor/instituciones/${institucionId}/tipo-kit`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ kit_id })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo asignar el kit.')
      }

      setInstituciones((prev) => prev.map((inst) => (
        Number(inst.id) === Number(institucionId)
          ? { ...inst, kit_id, kit_nombre: data.kit_nombre || '' }
          : inst
      )))
      setMsg({ text: 'Kit actualizado correctamente.', type: 'success' })
      setTimeout(() => setMsg({ text: '', type: '' }), 3000)
    } catch (err) {
      setMsg({ text: err.message || 'No se pudo asignar el kit.', type: 'error' })
      setTimeout(() => setMsg({ text: '', type: '' }), 3000)
    } finally {
      setSavingTipoId(null)
    }
  }

  return (
    <div className="supervisor-dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h2>Asignar Kit</h2>
        <PrintButton targetRef={printRef} title="Reporte Asignar Kit" />
      </div>

      <div className="sv-jurisdiction-banner">
        <span className="sv-jurisdiction-dot"></span>
        <span>{zonaTitle}: <strong>{zonaLabel}</strong></span>
        <span>Nivel: <strong>{nivelLabel}</strong></span>
        <span className="sv-jurisdiction-count">
          {instituciones.length} escuelas asignadas
        </span>
      </div>

      {msg.text && <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`}>{msg.text}</div>}

      <section ref={printRef}>
        <h3>Asignar kit</h3>
        <p style={{ marginTop: 0, color: 'var(--muted)' }}>
          Aca podes asignar a cada escuela uno de los kits que ya fueron creados.
        </p>

        {instituciones.length === 0 ? (
          <div className="sv-empty-state">Este supervisor no tiene escuelas asignadas.</div>
        ) : kits.length === 0 ? (
          <div className="sv-empty-state">No hay kits creados para asignar todavia.</div>
        ) : (
          <div className="sv-kit-grid">
            {instituciones.map((inst) => (
              <article key={inst.id} className="sv-kit-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div>
                    <div className="sv-inst-nombre">{inst.nombre}</div>
                    <div className="sv-inst-cue">CUE: {inst.cue || '-'}</div>
                  </div>
                  {inst.kit_nombre && <span className="badge sv-badge-tipo-escuela">{inst.kit_nombre}</span>}
                </div>

                <div className="sv-kit-meta">
                  <span>Nivel: <strong>{inst.nivel || '-'}</strong></span>
                  <span>Departamento: <strong>{inst.departamento || '-'}</strong></span>
                </div>

                <label>Kit asignado</label>
                <select
                  value={kitByInstitucion[String(inst.id)] || ''}
                  onChange={(e) => setKitByInstitucion((prev) => ({
                    ...prev,
                    [String(inst.id)]: e.target.value
                  }))}
                >
                  <option value="">Seleccionar kit...</option>
                  {kits.map((kit) => (
                    <option key={kit.id} value={kit.id}>{kit.nombre}</option>
                  ))}
                </select>

                <button
                  type="button"
                  className="sv-btn-historial"
                  onClick={() => handleGuardarTipoKit(inst.id)}
                  disabled={savingTipoId === inst.id}
                >
                  {savingTipoId === inst.id ? 'Guardando...' : 'Asignar kit'}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
