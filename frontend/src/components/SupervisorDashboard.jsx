import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'
import PrintButton from './PrintButton'
import { SCHOOL_TYPE_OPTIONS, getSchoolTypeLabel } from '../constants/schoolTypes'

const CATEGORIAS_PATRIMONIO = [
  'Bancos', 'Sillas', 'Escritorios', 'Pizarrones', 'Estantes',
  'Mesas', 'Armarios', 'Equipamiento informático', 'Otro'
]

const PRIORIDAD_STYLE = {
  alta: { bg: '#fef2f2', color: '#b91c1c', label: 'Alta' },
  media: { bg: '#fffbeb', color: '#92400e', label: 'Media' },
  baja: { bg: '#f0fdf4', color: '#065f46', label: 'Baja' },
}

export default function SupervisorDashboard() {
  const { token, user } = useAuth()
  const printRef = useRef(null)

  const [activeSection, setActiveSection] = useState('patrimonio')
  const [tickets, setTickets] = useState([])
  const [procesados, setProcesados] = useState([])
  const [instituciones, setInstituciones] = useState([])
  const [tipoKitByInstitucion, setTipoKitByInstitucion] = useState({})
  const [savingTipoId, setSavingTipoId] = useState(null)
  const [msg, setMsg] = useState({ text: '', type: '' })

  const [accionandoId, setAccionandoId] = useState(null)
  const [accionTipo, setAccionTipo] = useState('')
  const [motivoAccion, setMotivoAccion] = useState('')

  useEffect(() => {
    const loadTickets = async () => {
      try {
        const res = await apiFetch('/api/patrimonio/tickets', { token })
        if (res.ok) {
          const data = await res.json()
          setTickets(data.tickets || [])
        }
      } catch (err) {
        console.error('Error cargando tickets de patrimonio:', err)
      }
    }
    loadTickets()
  }, [token])

  useEffect(() => {
    const loadInstituciones = async () => {
      try {
        const res = await apiFetch('/api/supervisor/instituciones', { token })
        if (!res.ok) return
        const data = await res.json()
        const rows = data.instituciones || []
        setInstituciones(rows)
        setTipoKitByInstitucion(
          Object.fromEntries(rows.map((inst) => [String(inst.id), inst.tipo_escuela || 'normal']))
        )
      } catch (err) {
        console.error('Error cargando escuelas del supervisor:', err)
      }
    }
    loadInstituciones()
  }, [token])

  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroPrioridad, setFiltroPrioridad] = useState('')

  const handleAprobar = async (ticketId) => {
    try {
      const res = await apiFetch(`/api/patrimonio/tickets/${ticketId}/estado`, { token, method: 'PATCH', body: JSON.stringify({ estado: 'aprobado' }) })
      if (!res.ok) {
        const err = await res.json()
        setMsg({ text: err.error || 'Error al aprobar ticket', type: 'error' })
        setTimeout(() => setMsg({ text: '', type: '' }), 3000)
        return
      }
    } catch (err) {
      setMsg({ text: 'Error de conexión', type: 'error' })
      setTimeout(() => setMsg({ text: '', type: '' }), 3000)
      return
    }
    const ticket = tickets.find(t => t.id === ticketId)
    setTickets(prev => prev.filter(t => t.id !== ticketId))
    setProcesados(prev => [...prev, { ...ticket, estado: 'aprobado', resolucion: 'Reemplazo aprobado', fechaProcesado: new Date().toISOString() }])
    setMsg({ text: `Ticket #${ticketId} - Reemplazo aprobado`, type: 'success' })
    setTimeout(() => setMsg({ text: '', type: '' }), 3000)
  }

  const iniciarAccion = (ticketId, tipo) => {
    setAccionandoId(ticketId)
    setAccionTipo(tipo)
    setMotivoAccion('')
  }

  const cancelarAccion = () => {
    setAccionandoId(null)
    setAccionTipo('')
    setMotivoAccion('')
  }

  const confirmarAccion = async (ticketId) => {
    if (!motivoAccion.trim()) {
      setMsg({ text: `Debe ingresar una observación para ${accionTipo === 'rechazar' ? 'el rechazo' : 'la reparación'}`, type: 'error' })
      setTimeout(() => setMsg({ text: '', type: '' }), 3000)
      return
    }

    const nuevoEstado = accionTipo === 'rechazar' ? 'rechazado' : 'en_reparacion'
    try {
      const res = await apiFetch(`/api/patrimonio/tickets/${ticketId}/estado`, { token, method: 'PATCH', body: JSON.stringify({ estado: nuevoEstado, observacion: motivoAccion.trim() }) })
      if (!res.ok) {
        const err = await res.json()
        setMsg({ text: err.error || 'Error al procesar ticket', type: 'error' })
        setTimeout(() => setMsg({ text: '', type: '' }), 3000)
        return
      }
    } catch (err) {
      setMsg({ text: 'Error de conexión', type: 'error' })
      setTimeout(() => setMsg({ text: '', type: '' }), 3000)
      return
    }
    const ticket = tickets.find(t => t.id === ticketId)
    const labelEstado = accionTipo === 'rechazar' ? 'Rechazado' : 'Enviado a reparación'

    setTickets(prev => prev.filter(t => t.id !== ticketId))
    setProcesados(prev => [...prev, {
      ...ticket,
      estado: nuevoEstado,
      resolucion: labelEstado,
      observacion: motivoAccion.trim(),
      fechaProcesado: new Date().toISOString()
    }])
    setMsg({ text: `Ticket #${ticketId} - ${labelEstado}`, type: 'success' })
    cancelarAccion()
    setTimeout(() => setMsg({ text: '', type: '' }), 3000)
  }

  const handleGuardarTipoKit = async (institucionId) => {
    const tipo_escuela = tipoKitByInstitucion[String(institucionId)] || 'normal'
    setSavingTipoId(institucionId)
    try {
      const res = await apiFetch(`/api/supervisor/instituciones/${institucionId}/tipo-kit`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ tipo_escuela })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo asignar el tipo de kit.')
      }
      setInstituciones(prev => prev.map((inst) => Number(inst.id) === Number(institucionId) ? { ...inst, tipo_escuela } : inst))
      setMsg({ text: 'Tipo de kit actualizado correctamente.', type: 'success' })
      setTimeout(() => setMsg({ text: '', type: '' }), 3000)
    } catch (err) {
      setMsg({ text: err.message || 'No se pudo asignar el tipo de kit.', type: 'error' })
      setTimeout(() => setMsg({ text: '', type: '' }), 3000)
    } finally {
      setSavingTipoId(null)
    }
  }

  const ticketsFiltrados = tickets.filter(t => {
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      if (!t.institucion.toLowerCase().includes(q) && !t.descripcion.toLowerCase().includes(q) && !t.categoria.toLowerCase().includes(q)) return false
    }
    if (filtroCategoria && t.categoria !== filtroCategoria) return false
    if (filtroPrioridad && t.prioridad !== filtroPrioridad) return false
    return true
  })

  return (
    <div className="supervisor-dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h2>{activeSection === 'asignar-kit' ? 'Asignar kit' : 'Patrimonio Escolar'}</h2>
        <PrintButton targetRef={printRef} title={activeSection === 'asignar-kit' ? 'Reporte Asignar Kit' : 'Reporte Patrimonio Escolar'} />
      </div>

      <div className="sv-jurisdiction-banner">
        <span className="sv-jurisdiction-dot"></span>
        <span>Jurisdicción: <strong>{user?.jurisdiccion || '-'}</strong></span>
        <span className="sv-jurisdiction-count">
          {activeSection === 'asignar-kit' ? `${instituciones.length} escuelas asignadas` : `${tickets.length} tickets pendientes`}
        </span>
      </div>

      {msg.text && <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`}>{msg.text}</div>}

      <div className="sub-tabs">
        <button type="button" className={`sub-tab-btn ${activeSection === 'patrimonio' ? 'active' : ''}`} onClick={() => setActiveSection('patrimonio')}>
          Patrimonio
        </button>
        <button type="button" className={`sub-tab-btn ${activeSection === 'asignar-kit' ? 'active' : ''}`} onClick={() => setActiveSection('asignar-kit')}>
          Asignar kit
        </button>
      </div>

      {activeSection === 'patrimonio' && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <input type="text" placeholder="Buscar institución, categoría o descripción..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ flex: '1 1 250px', marginBottom: 0 }} />
            <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} style={{ flex: '0 1 180px' }}>
              <option value="">Todas las categorías</option>
              {CATEGORIAS_PATRIMONIO.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filtroPrioridad} onChange={e => setFiltroPrioridad(e.target.value)} style={{ flex: '0 1 140px' }}>
              <option value="">Toda prioridad</option>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </div>

          <div ref={printRef}>
            <h3>Tickets Pendientes</h3>

            {ticketsFiltrados.length === 0 ? (
              <div className="sv-empty-state">No hay tickets pendientes de patrimonio</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>N°</th>
                    <th>Institución</th>
                    <th>Fecha</th>
                    <th>Categoría</th>
                    <th>Descripción</th>
                    <th>Cant.</th>
                    <th>Prioridad</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ticketsFiltrados.map(ticket => {
                    const pStyle = PRIORIDAD_STYLE[ticket.prioridad] || {}
                    return (
                      <tr key={ticket.id}>
                        <td style={{ fontWeight: 600, color: 'var(--muted)' }}>#{ticket.id}</td>
                        <td><strong>{ticket.institucion}</strong><br /><span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>CUE: {ticket.cue}</span></td>
                        <td>{new Date(ticket.fecha).toLocaleDateString('es-AR')}</td>
                        <td><span className="badge" style={{ background: '#f3f4f6' }}>{ticket.categoria}</span></td>
                        <td style={{ fontSize: '0.88rem', maxWidth: 260 }}>{ticket.descripcion}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{ticket.cantidad}</td>
                        <td><span className="badge" style={{ background: pStyle.bg, color: pStyle.color }}>{pStyle.label}</span></td>
                        <td>
                          {accionandoId === ticket.id ? (
                            <div className="sv-rechazo-box">
                              <p style={{ margin: '0 0 4px', fontSize: '0.78rem', fontWeight: 600, color: accionTipo === 'rechazar' ? '#b91c1c' : '#1e40af' }}>
                                {accionTipo === 'rechazar' ? 'Motivo del rechazo:' : 'Detalle de reparación:'}
                              </p>
                              <textarea className="sv-rechazo-input" placeholder={accionTipo === 'rechazar' ? 'Motivo del rechazo...' : 'Indicar taller, plazo estimado...'} value={motivoAccion} onChange={e => setMotivoAccion(e.target.value)} rows={2} style={accionTipo === 'reparar' ? { borderColor: '#3b82f6' } : {}} />
                              <div className="inline-actions" style={{ marginTop: 6 }}>
                                <button onClick={() => confirmarAccion(ticket.id)} className={accionTipo === 'rechazar' ? 'sv-btn-confirmar-rechazo' : 'sv-btn-confirmar-reparar'}>Confirmar</button>
                                <button onClick={cancelarAccion} className="secondary" style={{ margin: 0, minHeight: 'auto', padding: '6px 12px', fontSize: '0.75rem' }}>Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <div className="inline-actions">
                              <button onClick={() => handleAprobar(ticket.id)} title="Aprobar reemplazo completo">Aprobar</button>
                              <button onClick={() => iniciarAccion(ticket.id, 'reparar')} className="sv-btn-reparar" title="Enviar a reparación">Reparar</button>
                              <button onClick={() => iniciarAccion(ticket.id, 'rechazar')} className="sv-btn-rechazar" title="Rechazar solicitud">Rechazar</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

            {procesados.length > 0 && (
              <>
                <h3>Tickets Procesados</h3>
                <table>
                  <thead>
                    <tr>
                      <th>N°</th>
                      <th>Institución</th>
                      <th>Categoría</th>
                      <th>Cant.</th>
                      <th>Resolución</th>
                      <th>Observación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {procesados.map(t => (
                      <tr key={t.id}>
                        <td>#{t.id}</td>
                        <td>{t.institucion}</td>
                        <td>{t.categoria}</td>
                        <td style={{ textAlign: 'center' }}>{t.cantidad}</td>
                        <td>
                          <span className={`badge badge-estado-${t.estado === 'en_reparacion' ? 'reparacion' : t.estado}`}>
                            {t.resolucion}
                          </span>
                        </td>
                        <td>{t.observacion || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </>
      )}

      {activeSection === 'asignar-kit' && (
        <section ref={printRef}>
          <h3>Asignar kit</h3>
          <p style={{ marginTop: 0, color: 'var(--muted)' }}>
            Acá podés definir qué tipo de kit usa cada escuela asignada a este supervisor.
          </p>

          {instituciones.length === 0 ? (
            <div className="sv-empty-state">Este supervisor no tiene escuelas asignadas.</div>
          ) : (
            <div className="sv-kit-grid">
              {instituciones.map((inst) => (
                <article key={inst.id} className="sv-kit-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                    <div>
                      <div className="sv-inst-nombre">{inst.nombre}</div>
                      <div className="sv-inst-cue">CUE: {inst.cue || '-'}</div>
                    </div>
                    <span className="badge sv-badge-tipo-escuela">{getSchoolTypeLabel(inst.tipo_escuela || 'normal')}</span>
                  </div>

                  <div className="sv-kit-meta">
                    <span>Nivel: <strong>{inst.nivel || '-'}</strong></span>
                    <span>Departamento: <strong>{inst.departamento || '-'}</strong></span>
                  </div>

                  <label>Tipo de kit</label>
                  <select
                    value={tipoKitByInstitucion[String(inst.id)] || 'normal'}
                    onChange={(e) => setTipoKitByInstitucion((prev) => ({
                      ...prev,
                      [String(inst.id)]: e.target.value
                    }))}
                  >
                    {SCHOOL_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
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
      )}
    </div>
  )
}
