import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'
import DirectorAreaGestion from './DirectorAreaGestion'
import DirectorAreaPedidosAnuales from './DirectorAreaPedidosAnuales'
import DirectorAreaZonas from './DirectorAreaZonas'

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

  useEffect(() => {
    setAsigForm({ supervisor_id: '', institucion_id: '' })
    setInformeForm({ supervisor_id: '', asunto: '', detalle: '', fecha_limite: '' })
    setMsg({ text: '', type: '' })
    setPlanillaObs('')
    setPlanillaDetalle(null)
  }, [activeSection])

  const loadAll = async () => {
    try {
      const [catalogoRes, asigRes, informesRes, solicitudesRes] = await Promise.all([
        apiFetch('/api/director-area/catalogo', { token }),
        apiFetch('/api/director-area/asignaciones', { token }),
        apiFetch('/api/director-area/informes', { token }),
        apiFetch('/api/director-area/solicitudes', { token })
      ])

      if (!catalogoRes.ok || !asigRes.ok || !informesRes.ok) {
        throw new Error('No se pudo cargar la informacion de Direccion de Area')
      }

      const catalogo = await catalogoRes.json()
      const asignacionesData = await asigRes.json()
      const informesData = await informesRes.json()
      const solicitudesData = solicitudesRes.ok ? await solicitudesRes.json() : { solicitudes: [] }

      setSupervisores(catalogo.supervisores || [])
      setEscuelas(catalogo.escuelas || [])
      setNivelEducativo(catalogo.nivel_educativo || '')
      setAsignaciones(asignacionesData.asignaciones || [])
      setInformes(informesData.informes || [])
      setSolicitudes(solicitudesData.solicitudes || [])

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

  // Renderizado principal
  return (
    <>
      {activeSection === 'gestion-escuelas' && (
        <DirectorAreaZonas nivelEducativo={nivelEducativo} />
      )}
      {activeSection === 'pedidos-anuales' && (
        <DirectorAreaPedidosAnuales
          solicitudes={solicitudes}
          planillas={planillas}
          planillaDetalle={planillaDetalle}
          setPlanillaDetalle={setPlanillaDetalle}
          planillaObs={planillaObs}
          setPlanillaObs={setPlanillaObs}
          creandoPlanilla={creandoPlanilla}
          setCreandoPlanilla={setCreandoPlanilla}
          updatingId={updatingId}
          setUpdatingId={setUpdatingId}
          handleEntregarSolicitud={handleEntregarSolicitud}
          handleDecisionSolicitud={handleDecisionSolicitud}
        />
      )}
    </>
  )

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
      const res = await apiFetch(`/api/director-area/solicitudes/${id}/decision`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ decision })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo registrar la decision')

      setSolicitudes((prev) => prev.map((s) => {
        if (s.id !== id) return s
        if (decision === 'aceptar') {
          return { ...s, aprobado_director_area: true }
        }
        return { ...s, aprobado_director_area: false, estado: 'rechazado' }
      }))

      setMsg({
        text: decision === 'aceptar'
          ? `Solicitud #${id} aceptada para pedido anual.`
          : `Solicitud #${id} denegada.`,
        type: 'success'
      })
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
      <h2>Supervisores del Nivel</h2>
      <p style={{ marginTop: 0, color: 'var(--muted)' }}>
        Organiza los supervisores de tu nivel educativo, distribui escuelas y pedi informes de seguimiento.
      </p>

      {activeSection === 'gestion-escuelas' && (
        <DirectorAreaGestion
          nivelEducativo={nivelEducativo}
          supervisores={supervisores}
          escuelas={escuelas}
          asignaciones={asignaciones}
          asigForm={asigForm}
          setAsigForm={setAsigForm}
          handleAsignar={handleAsignar}
          handleEliminarAsignacion={handleEliminarAsignacion}
          msg={msg}
          informes={informes}
          informeForm={informeForm}
          setInformeForm={setInformeForm}
          handleSolicitarInforme={handleSolicitarInforme}
          supervisorMap={supervisorMap}
        />
      )}

      {activeSection === 'gestion-pedidos' && (
        <DirectorAreaPedidosAnuales
          solicitudes={solicitudes}
          updatingId={updatingId}
          handleDecisionSolicitud={handleDecisionSolicitud}
          handleEntregarSolicitud={handleEntregarSolicitud}
          planillas={planillas}
          planillaDetalle={planillaDetalle}
          planillaObs={planillaObs}
          setPlanillaObs={setPlanillaObs}
          creandoPlanilla={creandoPlanilla}
          handleCrearPlanilla={handleCrearPlanilla}
          handleVerDetalle={handleVerDetalle}
          handleEnviarPlanilla={handleEnviarPlanilla}
          handleEliminarPlanilla={handleEliminarPlanilla}
        />
      )}
    </div>
  )
}
