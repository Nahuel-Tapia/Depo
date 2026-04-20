
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'
import DirectorAreaGestion from './DirectorAreaGestion'
import DirectorAreaPedidosAnuales from './DirectorAreaPedidosAnuales'

export default function DirectorAreaPanel({ initialSection }) {
  const { token } = useAuth()
  const [activeSection, setActiveSection] = useState(initialSection || 'gestion-escuelas')

  const [supervisores, setSupervisores] = useState([])
  const [escuelas, setEscuelas] = useState([])
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

  const loadAll = async () => {
    try {
      const [catalogoRes, asigRes, informesRes, solicitudesRes] = await Promise.all([
        apiFetch('/api/director-area/catalogo', { token }),
        apiFetch('/api/director-area/asignaciones', { token }),
        apiFetch('/api/director-area/informes', { token }),
        apiFetch('/api/director-area/solicitudes', { token })
      ])

      if (!catalogoRes.ok || !asigRes.ok || !informesRes.ok) {
        throw new Error('No se pudo cargar la información de Dirección de Área')
      }

      const catalogo = await catalogoRes.json()
      const asignacionesData = await asigRes.json()
      const informesData = await informesRes.json()
      const solicitudesData = solicitudesRes.ok ? await solicitudesRes.json() : { solicitudes: [] }

      setSupervisores(catalogo.supervisores || [])
      setEscuelas(catalogo.escuelas || [])
      setAsignaciones(asignacionesData.asignaciones || [])
      setInformes(informesData.informes || [])
      setSolicitudes(solicitudesData.solicitudes || [])

      // Cargar planillas
      const planillasRes = await apiFetch('/api/compras/planillas', { token })
      if (planillasRes.ok) {
        const planillasData = await planillasRes.json()
        setPlanillas(planillasData.planillas || [])
      }
    } catch (err) {
      setMsg({ text: err.message || 'Error cargando datos', type: 'error' })
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line
  }, [token])

  const supervisorMap = useMemo(() => {
    return Object.fromEntries(supervisores.map(s => [String(s.id), `${s.nombre || ''} ${s.apellido || ''}`.trim()]))
  }, [supervisores])

  // Handlers mínimos para props (puedes expandir según lógica anterior)
  const handleAsignar = async (e) => {
    e.preventDefault()
    setMsg({ text: '', type: '' })
    if (!asigForm.supervisor_id || !asigForm.institucion_id) {
      setMsg({ text: 'Debes seleccionar supervisor y escuela', type: 'error' })
      return
    }
    const res = await apiFetch('/api/director-area/asignaciones', {
      token,
      method: 'POST',
      body: JSON.stringify({
        supervisor_id: Number(asigForm.supervisor_id),
        institucion_id: Number(asigForm.institucion_id)
      })
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setMsg({ text: data.error || 'No se pudo crear la asignación', type: 'error' })
      return
    }
    setAsigForm({ supervisor_id: '', institucion_id: '' })
    setMsg({ text: 'Escuela asignada correctamente', type: 'success' })
    loadAll()
  }

  const handleEliminarAsignacion = async (id) => {
    const res = await apiFetch(`/api/director-area/asignaciones/${id}`, { token, method: 'DELETE' })
    if (!res.ok) {
      setMsg({ text: 'No se pudo eliminar asignación', type: 'error' })
      return
    }
    setMsg({ text: 'Asignación eliminada', type: 'success' })
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

  // Handlers para pedidos anuales (puedes expandir según lógica anterior)
  const handleDecisionSolicitud = () => {}
  const handleEntregarSolicitud = () => {}
  const handleCrearPlanilla = () => {}
  const handleVerDetalle = () => {}
  const handleEnviarPlanilla = () => {}
  const handleEliminarPlanilla = () => {}

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {[
          { key: 'gestion-escuelas', label: 'Gestión de Escuelas' },
          { key: 'gestion-pedidos', label: 'Gestión de Pedidos' }
        ].map(section => (
          <button
            key={section.key}
            type="button"
            className={activeSection === section.key ? '' : 'secondary'}
            style={{ margin: 0 }}
            onClick={() => setActiveSection(section.key)}
          >
            {section.label}
          </button>
        ))}
      </div>
      {msg.text && (
        <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`}>{msg.text}</div>
      )}
      {activeSection === 'gestion-escuelas' && (
        <>
          <h2 style={{marginTop:0}}>Gestión de Escuelas</h2>
          <DirectorAreaGestion
            supervisores={supervisores}
            escuelas={escuelas}
            asignaciones={asignaciones}
            informes={informes}
            asigForm={asigForm}
            setAsigForm={setAsigForm}
            handleAsignar={handleAsignar}
            handleEliminarAsignacion={handleEliminarAsignacion}
            informeForm={informeForm}
            setInformeForm={setInformeForm}
            handleSolicitarInforme={handleSolicitarInforme}
            msg={msg}
            supervisorMap={supervisorMap}
          />
        </>
      )}
      {activeSection === 'gestion-pedidos' && (
        <>
          <h2 style={{marginTop:0}}>Gestión de Pedidos</h2>
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
        </>
      )}
    </div>
  )
}
