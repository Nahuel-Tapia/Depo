import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'
import DirectorAreaGestion from './DirectorAreaGestion'
import DirectorAreaPedidosAnuales from './DirectorAreaPedidosAnuales'
import DirectorAreaZonas from './DirectorAreaZonas'
import DirectorAreaResumenAnual from './DirectorAreaResumenAnual'

export default function DirectorAreaPanel({ initialSection }) {
  const { token } = useAuth()
  const [activeSection, setActiveSection] = useState(initialSection || 'gestion-escuelas')
  const [supervisores, setSupervisores] = useState([])
  const [escuelas, setEscuelas] = useState([])
  const [nivelEducativo, setNivelEducativo] = useState('')
  const [asignaciones, setAsignaciones] = useState([])
  const [informes, setInformes] = useState([])
  const [solicitudes, setSolicitudes] = useState([])
  const [planillas, setPlanillas] = useState([])
  const [planillaDetalle, setPlanillaDetalle] = useState(null)
  const [planillaObs, setPlanillaObs] = useState('')
  const [creandoPlanilla, setCreandoPlanilla] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [asigForm, setAsigForm] = useState({ supervisor_id: '', institucion_id: '' })
  const [informeForm, setInformeForm] = useState({ supervisor_id: '', asunto: '', detalle: '', fecha_limite: '' })

  useEffect(() => {
    if (initialSection && initialSection !== activeSection) {
      setActiveSection(initialSection)
    }
  }, [initialSection, activeSection])

  const loadSolicitudes = async () => {
    try {
      const res = await apiFetch('/api/supervisor/solicitudes', { token })
      if (res.ok) {
        const data = await res.json()
        setSolicitudes(data.solicitudes || [])
      }
    } catch (err) {}
  }

  useEffect(() => {
    setAsigForm({ supervisor_id: '', institucion_id: '' })
    setInformeForm({ supervisor_id: '', asunto: '', detalle: '', fecha_limite: '' })
    setMsg({ text: '', type: '' })
    setPlanillaObs('')
    setPlanillaDetalle(null)
  }, [activeSection])

  const loadAll = async () => {
    try {
      const [catalogoRes, asigRes] = await Promise.all([
        apiFetch('/api/director-area/catalogo', { token }),
        apiFetch('/api/director-area/asignaciones', { token })
      ])

      if (!catalogoRes.ok) {
        throw new Error('No se pudo cargar el catalogo')
      }

      const catalogo = await catalogoRes.json()
      const asignacionesData = await asigRes.json()

      setSupervisores(catalogo.supervisores || [])
      setEscuelas(catalogo.escuelas || [])
      setNivelEducativo(catalogo.nivel_educativo || '')
      setAsignaciones(asignacionesData.asignaciones || [])
      
      await loadSolicitudes()

      const planillasRes = await apiFetch('/api/compras/planillas', { token })
      if (planillasRes.ok) {
        const planillasData = await planillasRes.json()
        setPlanillas(planillasData.planillas || [])
      }
    } catch (err) {}
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line
  }, [token, activeSection])

  const supervisorMap = useMemo(() => {
    const map = {}
    supervisores.forEach((s) => {
      map[String(s.id)] = `${s.nombre || ''} ${s.apellido || ''}`.trim()
    })
    return map
  }, [supervisores])

  // Renderizado principal
  // El componente continuará hacia abajo para el return principal


  const handleEliminarAsignacion = async (id) => {
    const res = await apiFetch(`/api/director-area/asignaciones/${id}`, { token, method: 'DELETE' })
    if (!res.ok) {
      setMsg({ text: 'No se pudo eliminar asignacion', type: 'error' })
      return
    }
    setMsg({ text: 'Asignacion eliminada', type: 'success' })
    loadAll()
  }

  const handleSolicitarInforme = async (e) => {
    e.preventDefault()
    setMsg({ text: '', type: '' })
    if (!informeForm.supervisor_id || !informeForm.asunto.trim()) {
      setMsg({ text: 'Supervisor y asunto son obligatorios', type: 'error' })
      return
    }

    const res = await apiFetch('/api/director-area/informes', {
      token,
      method: 'POST',
      body: JSON.stringify({
        supervisor_id: Number(informeForm.supervisor_id),
        asunto: informeForm.asunto.trim(),
        detalle: informeForm.detalle.trim() || null,
        fecha_limite: informeForm.fecha_limite || null
      })
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setMsg({ text: data.error || 'No se pudo solicitar informe', type: 'error' })
      return
    }

    setInformeForm({ supervisor_id: '', asunto: '', detalle: '', fecha_limite: '' })
    setMsg({ text: 'Solicitud de informe registrada', type: 'success' })
    loadAll()
  }

  const handleEntregarSolicitud = async (id) => {
    setUpdatingId(id)
    try {
      const res = await apiFetch(`/api/pedidos/${id}/estado`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ estado: 'entregado' })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'No se pudo actualizar')
      }
      setSolicitudes((prev) => prev.map((s) => (s.id === id ? { ...s, estado: 'entregado' } : s)))
      setMsg({ text: `Solicitud #${id} marcada como entregada.`, type: 'success' })
    } catch (err) {
      setMsg({ text: err.message || 'Error al marcar entregada', type: 'error' })
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDecisionSolicitud = async (id, decision) => {
    setUpdatingId(id)
    try {
      const res = await apiFetch(`/api/pedidos/${id}/aprobar-director`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ decision })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo registrar la decision')

      setSolicitudes((prev) => prev.map((s) => {
        if (s.id !== id) return s
        if (decision === 'aceptar') {
          return { ...s, aprobado_director_area: true, estado: 'aprobado' }
        }
        return { ...s, aprobado_director_area: false, estado: 'rechazado' }
      }))

      setMsg({
        text: decision === 'aceptar'
          ? `Solicitud #${id} aprobada definitivamente.`
          : `Solicitud #${id} rechazada.`,
        type: 'success'
      })
      await loadSolicitudes()
    } catch (err) {
      setMsg({ text: err.message || 'Error al decidir solicitud', type: 'error' })
    } finally {
      setUpdatingId(null)
    }
  }

  const handleCrearPlanilla = async () => {
    setCreandoPlanilla(true)
    try {
      const res = await apiFetch('/api/compras/planillas', {
        token,
        method: 'POST',
        body: JSON.stringify({ observaciones: planillaObs.trim() || null })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo crear la planilla')
      setPlanillaObs('')
      setMsg({ text: `Planilla creada con ${data.items} solicitudes. Revisa la planilla antes de enviarla.`, type: 'success' })
      loadAll()
    } catch (err) {
      setMsg({ text: err.message, type: 'error' })
    } finally {
      setCreandoPlanilla(false)
    }
  }

  const handleVerDetalle = async (id) => {
    if (planillaDetalle?.planilla?.id === id) {
      setPlanillaDetalle(null)
      return
    }
    try {
      const res = await apiFetch(`/api/compras/planillas/${id}`, { token })
      if (!res.ok) throw new Error('No se pudo cargar el detalle')
      const data = await res.json()
      setPlanillaDetalle(data)
    } catch (err) {
      setMsg({ text: err.message, type: 'error' })
    }
  }

  const handleEnviarPlanilla = async (id) => {
    try {
      const res = await apiFetch(`/api/compras/planillas/${id}/enviar`, { token, method: 'PATCH' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar')
      setMsg({ text: 'Planilla enviada a Area de Compras.', type: 'success' })
      if (planillaDetalle?.planilla?.id === id) setPlanillaDetalle(null)
      loadAll()
    } catch (err) {
      setMsg({ text: err.message, type: 'error' })
    }
  }

  const handleEliminarPlanilla = async (id) => {
    try {
      const res = await apiFetch(`/api/compras/planillas/${id}`, { token, method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo eliminar')
      setMsg({ text: 'Planilla eliminada.', type: 'success' })
      if (planillaDetalle?.planilla?.id === id) setPlanillaDetalle(null)
      loadAll()
    } catch (err) {
      setMsg({ text: err.message, type: 'error' })
    }
  }

  return (
    <div>
      {activeSection === 'gestion-escuelas' && (
        <>
          <h2>Supervisores del Nivel</h2>
          <p style={{ marginTop: 0, color: 'var(--muted)' }}>
            Organiza los supervisores de tu nivel educativo, distribui escuelas y pedi informes de seguimiento.
          </p>
          <DirectorAreaZonas nivelEducativo={nivelEducativo} />
          
          <div style={{ marginTop: 40 }}>
            <DirectorAreaGestion
              nivelEducativo={nivelEducativo}
              supervisores={supervisores}
              informes={informes}
              informeForm={informeForm}
              setInformeForm={setInformeForm}
              handleSolicitarInforme={handleSolicitarInforme}
              msg={msg}
              supervisorMap={supervisorMap}
            />
          </div>
        </>
      )}
      {activeSection === 'solicitud-anual' && (
        <DirectorAreaPedidosAnuales
          solicitudes={solicitudes}
          updatingId={updatingId}
          handleDecisionSolicitud={handleDecisionSolicitud}
          handleEntregarSolicitud={handleEntregarSolicitud}
        />
      )}

      {activeSection === 'resumen-anual' && (
        <DirectorAreaResumenAnual solicitudes={solicitudes} />
      )}
    </div>
  )
}
