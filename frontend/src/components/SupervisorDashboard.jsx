import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'
import PrintButton from './PrintButton'

const CATEGORIAS_PATRIMONIO = [
  'Bancos', 'Sillas', 'Escritorios', 'Pizarrones', 'Estantes',
  'Mesas', 'Armarios', 'Equipamiento informatico', 'Otro'
]

const PRIORIDAD_STYLE = {
  alta: { bg: '#fef2f2', color: '#b91c1c', label: 'Alta' },
  media: { bg: '#fffbeb', color: '#92400e', label: 'Media' },
  baja: { bg: '#f0fdf4', color: '#065f46', label: 'Baja' }
}

export default function SupervisorDashboard() {
  const { token, user } = useAuth()
  const printRef = useRef(null)

  const [activeSection, setActiveSection] = useState('patrimonio')
  const [tickets, setTickets] = useState([])
  const [procesados, setProcesados] = useState([])
  const [instituciones, setInstituciones] = useState([])
  const [kits, setKits] = useState([])
  const [kitByInstitucion, setKitByInstitucion] = useState({})
  const [savingTipoId, setSavingTipoId] = useState(null)
  const [msg, setMsg] = useState({ text: '', type: '' })

  const [accionandoId, setAccionandoId] = useState(null)
  const [accionTipo, setAccionTipo] = useState('')
  const [motivoAccion, setMotivoAccion] = useState('')

  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroPrioridad, setFiltroPrioridad] = useState('')

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
    const loadInstitucionesYKits = async () => {
      try {
        const [institucionesRes, kitsRes] = await Promise.all([
          apiFetch('/api/supervisor/instituciones', { token }),
          apiFetch('/api/pedidos/kits', { token })
        ])

        if (institucionesRes.ok) {
          const data = await institucionesRes.json()
          const rows = data.instituciones || []
          setInstituciones(rows)
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
  }, [token])

  const handleAprobar = async (ticketId) => {
    try {
      const res = await apiFetch(`/api/patrimonio/tickets/${ticketId}/estado`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ estado: 'aprobado' })
      })
      if (!res.ok) {
        const err = await res.json()
        setMsg({ text: err.error || 'Error al aprobar ticket', type: 'error' })
        setTimeout(() => setMsg({ text: '', type: '' }), 3000)
        return
      }
    } catch (err) {
      setMsg({ text: 'Error de conexion', type: 'error' })
      setTimeout(() => setMsg({ text: '', type: '' }), 3000)
      return
    }

    const ticket = tickets.find((t) => t.id === ticketId)
    setTickets((prev) => prev.filter((t) => t.id !== ticketId))
    setProcesados((prev) => [
      ...prev,
      { ...ticket, estado: 'aprobado', resolucion: 'Reemplazo aprobado', fechaProcesado: new Date().toISOString() }
    ])
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
      setMsg({ text: `Debe ingresar una observacion para ${accionTipo === 'rechazar' ? 'el rechazo' : 'la reparacion'}`, type: 'error' })
      setTimeout(() => setMsg({ text: '', type: '' }), 3000)
      return
    }

    const nuevoEstado = accionTipo === 'rechazar' ? 'rechazado' : 'en_reparacion'
    try {
      const res = await apiFetch(`/api/patrimonio/tickets/${ticketId}/estado`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ estado: nuevoEstado, observacion: motivoAccion.trim() })
      })
      if (!res.ok) {
        const err = await res.json()
        setMsg({ text: err.error || 'Error al procesar ticket', type: 'error' })
        setTimeout(() => setMsg({ text: '', type: '' }), 3000)
        return
      }
    } catch (err) {
      setMsg({ text: 'Error de conexion', type: 'error' })
      setTimeout(() => setMsg({ text: '', type: '' }), 3000)
      return
    }

    const ticket = tickets.find((t) => t.id === ticketId)
    const labelEstado = accionTipo === 'rechazar' ? 'Rechazado' : 'Enviado a reparacion'
    setTickets((prev) => prev.filter((t) => t.id !== ticketId))
    setProcesados((prev) => [
      ...prev,
      {
        ...ticket,
        estado: nuevoEstado,
        resolucion: labelEstado,
        observacion: motivoAccion.trim(),
        fechaProcesado: new Date().toISOString()
      }
    ])
    setMsg({ text: `Ticket #${ticketId} - ${labelEstado}`, type: 'success' })
    cancelarAccion()
    setTimeout(() => setMsg({ text: '', type: '' }), 3000)
  }

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

  const ticketsFiltrados = tickets.filter((t) => {
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      if (!t.institucion.toLowerCase().includes(q) && !t.descripcion.toLowerCase().includes(q) && !t.categoria.toLowerCase().includes(q)) {
        return false
      }
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
        <span>Jurisdiccion: <strong>{user?.jurisdiccion || '-'}</strong></span>
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
            <input type="text" placeholder="Buscar institucion, categoria o descripcion..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={{ flex: '1 1 250px', marginBottom: 0 }} />
            <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} style={{ flex: '0 1 180px' }}>
              <option value="">Todas las categorias</option>
              {CATEGORIAS_PATRIMONIO.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filtroPrioridad} onChange={(e) => setFiltroPrioridad(e.target.value)} style={{ flex: '0 1 140px' }}>
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
                    <th>Institucion</th>
                    <th>Fecha</th>
                    <th>Categoria</th>
                    <th>Descripcion</th>
                    <th>Cant.</th>
                    <th>Prioridad</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ticketsFiltrados.map((ticket) => {
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
                                {accionTipo === 'rechazar' ? 'Motivo del rechazo:' : 'Detalle de reparacion:'}
                              </p>
                              <textarea className="sv-rechazo-input" placeholder={accionTipo === 'rechazar' ? 'Motivo del rechazo...' : 'Indicar taller, plazo estimado...'} value={motivoAccion} onChange={(e) => setMotivoAccion(e.target.value)} rows={2} style={accionTipo === 'reparar' ? { borderColor: '#3b82f6' } : {}} />
                              <div className="inline-actions" style={{ marginTop: 6 }}>
                                <button onClick={() => confirmarAccion(ticket.id)} className={accionTipo === 'rechazar' ? 'sv-btn-confirmar-rechazo' : 'sv-btn-confirmar-reparar'}>Confirmar</button>
                                <button onClick={cancelarAccion} className="secondary" style={{ margin: 0, minHeight: 'auto', padding: '6px 12px', fontSize: '0.75rem' }}>Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <div className="inline-actions">
                              <button onClick={() => handleAprobar(ticket.id)} title="Aprobar reemplazo completo">Aprobar</button>
                              <button onClick={() => iniciarAccion(ticket.id, 'reparar')} className="sv-btn-reparar" title="Enviar a reparacion">Reparar</button>
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
                      <th>Institucion</th>
                      <th>Categoria</th>
                      <th>Cant.</th>
                      <th>Resolucion</th>
                      <th>Observacion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {procesados.map((t) => (
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
      )}
    </div>
  )
}
