import { useState, useMemo } from 'react'
import { apiFetch } from '../api'
import { useAuth } from '../context/AuthContext'

export default function DirectorAreaPedidosAnuales({ solicitudes, isSent }) {
  const [detalle, setDetalle] = useState(null)
  const { token } = useAuth()
  
  const anioActual = new Date().getFullYear()

  // Filtros
  const solicitudesPendientesDirector = solicitudes.filter(
    (s) => (s.tipo || 'anual') === 'anual' && s.estado === 'pendiente_director'
  )
  const solicitudesPendientesSupervisor = solicitudes.filter(
    (s) => (s.tipo || 'anual') === 'anual' && s.estado === 'pendiente'
  )
  const solicitudesAprobadasFinal = solicitudes.filter(
    (s) => (s.tipo || 'anual') === 'anual' && s.estado === 'aprobado'
  )

  const formatItems = (items) => {
    if (!items || items.length === 0) return '-'
    return items.map(i => `${i.producto} (x${i.cantidad})`).join(', ')
  }

  // Definimos las traducciones de estados
  const ESTADO_LABELS = {
    pendiente: 'Falta Supervisor',
    pendiente_director: 'Aprob. Supervisor',
    aprobado: 'Aprobado Final',
    rechazado: 'Rechazado',
    cancelado: 'Cancelado',
    entregado: 'Entregado',
    finalizado: 'Finalizado',
  }

  // Filtros del historial general
  const [filtroEscuela, setFiltroEscuela] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroFecha, setFiltroFecha] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  // Ordenamos las solicitudes de manera descendente por ID para el historial general
  const historial = useMemo(() => {
    let filtrados = [...solicitudes]

    if (filtroEscuela) {
      const q = filtroEscuela.toLowerCase()
      filtrados = filtrados.filter(s => 
        (s.escuela_nombre || s.institucion || '').toLowerCase().includes(q)
      )
    }

    if (filtroTipo) {
      filtrados = filtrados.filter(s => (s.tipo || 'anual') === filtroTipo)
    }

    if (filtroFecha) {
      filtrados = filtrados.filter(s => {
        if (!s.fecha) return false
        const sFechaStr = new Date(s.fecha).toISOString().slice(0, 10)
        return sFechaStr === filtroFecha
      })
    }

    if (filtroEstado) {
      if (filtroEstado === 'aprobado') {
        filtrados = filtrados.filter(s => ['aprobado', 'entregado', 'finalizado'].includes(s.estado))
      } else if (filtroEstado === 'desaprobado') {
        filtrados = filtrados.filter(s => ['rechazado', 'cancelado'].includes(s.estado))
      } else if (filtroEstado === 'pendiente') {
        filtrados = filtrados.filter(s => ['pendiente', 'pendiente_director'].includes(s.estado))
      }
    }

    return filtrados.sort((a, b) => b.id - a.id)
  }, [solicitudes, filtroEscuela, filtroTipo, filtroFecha, filtroEstado])

  const TableHeader = ({ title, icon, color }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, marginTop: 24 }}>
      <span style={{ background: color, color: 'white', padding: '6px', borderRadius: 8, fontSize: '1.1rem', display: 'flex' }}>{icon}</span>
      <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--dark)' }}>{title}</h3>
    </div>
  )

  return (
    <div className="fade-in" style={{ background: '#f9fafb', borderRadius: 20, padding: 32, boxShadow: 'var(--shadow-premium)', border: '1px solid rgba(0,0,0,0.03)' }}>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ color: 'var(--dark)', marginBottom: 8, fontSize: '2rem', fontWeight: 800 }}>Pedidos {anioActual}</h2>
        <p style={{ color: 'var(--muted)', fontSize: '1.1rem' }}>
          Gestión de ciclo lectivo y validación final de kits escolares.
        </p>
      </div>

      <section style={{ marginBottom: 40 }}>
        <TableHeader title="Pendientes de mi aprobación" icon="✍️" color="#3b82f6" />
        <div className="card" style={{ padding: 0, overflow: 'hidden', minHeight: 'auto', border: '1px solid #e2e8f0' }}>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Escuela</th>
                <th>Kit Seleccionado</th>
                <th>Cant. Kits</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {solicitudesPendientesDirector.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>
                    No hay solicitudes pendientes de tu aprobación.
                  </td>
                </tr>
              )}
              {solicitudesPendientesDirector.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 700 }}>#{s.id}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{s.escuela_nombre || s.institucion || '-'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>ID Institución: {s.institucion_id}</div>
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--dark)' }}>{s.producto || '-'}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{s.cantidad || 0}</td>
                  <td>
                    <span className="badge-premium badge-pendiente_director">Aprob. Supervisor</span>
                  </td>
                  <td>
                    <button 
                      className="secondary" 
                      style={{ padding: '6px 16px' }} 
                      onClick={() => setDetalle(s)}
                      disabled={isSent}
                      title={isSent ? "Ya realizaste el envío final a Compras" : ""}
                    >
                      {isSent ? 'Ver' : 'Gestionar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <TableHeader title="En Proceso (Falta Supervisor)" icon="⏳" color="#f59e0b" />
        <div className="card" style={{ padding: 0, overflow: 'hidden', minHeight: 'auto', border: '1px solid #e2e8f0', opacity: 0.85 }}>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Escuela</th>
                <th>Kit Seleccionado</th>
                <th>Cant. Kits</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {solicitudesPendientesSupervisor.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                    No hay solicitudes en proceso.
                  </td>
                </tr>
              )}
              {solicitudesPendientesSupervisor.map((s) => (
                <tr key={s.id}>
                  <td>#{s.id}</td>
                  <td>{s.escuela_nombre || s.institucion || '-'}</td>
                  <td style={{ fontWeight: 600 }}>{s.producto || '-'}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{s.cantidad || 0}</td>
                  <td>
                    <span className="badge-premium badge-pendiente">Esperando Supervisor</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <TableHeader title="Historial General" icon="" color="#64748b" />
        
        {/* Contenedor de filtros */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          marginBottom: '16px'
        }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase' }}>Escuela</label>
            <input
              type="text"
              placeholder="Buscar por escuela..."
              value={filtroEscuela}
              onChange={(e) => setFiltroEscuela(e.target.value)}
              style={{ minHeight: '38px', padding: '8px 12px', fontSize: '0.9rem' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase' }}>Tipo de Pedido</label>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              style={{ minHeight: '38px', padding: '8px 12px', fontSize: '0.9rem' }}
            >
              <option value="">Todos</option>
              <option value="anual">Anual</option>
              <option value="refuerzo">Refuerzo</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase' }}>Fecha de Registro</label>
            <input
              type="date"
              value={filtroFecha}
              onChange={(e) => setFiltroFecha(e.target.value)}
              style={{ minHeight: '38px', padding: '8px 12px', fontSize: '0.9rem' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase' }}>Estado de Aprobación</label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              style={{ minHeight: '38px', padding: '8px 12px', fontSize: '0.9rem' }}
            >
              <option value="">Todos</option>
              <option value="aprobado">Aprobados</option>
              <option value="desaprobado">Rechazados / Cancelados</option>
              <option value="pendiente">Pendientes de Aprobación</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              className="secondary"
              onClick={() => {
                setFiltroEscuela('')
                setFiltroTipo('')
                setFiltroFecha('')
                setFiltroEstado('')
              }}
              style={{ width: '100%', margin: 0, padding: '8px 16px', minHeight: '38px', fontSize: '0.9rem' }}
            >
              Limpiar Filtros
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden', minHeight: 'auto', border: '1px solid #e2e8f0' }}>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Escuela</th>
                <th>Tipo</th>
                <th>Fecha Registro</th>
                <th>Kit Seleccionado</th>
                <th>Cant. Kits</th>
                <th>Supervisor</th>
                <th>Director de Área</th>
                <th>Estado</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {historial.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                    No hay solicitudes registradas en el historial.
                  </td>
                </tr>
              )}
              {historial.map((s) => (
                <tr key={s.id}>
                  <td>#{s.id}</td>
                  <td style={{ fontWeight: 600 }}>{s.escuela_nombre || s.institucion || '-'}</td>
                  <td style={{ textTransform: 'capitalize' }}>{s.tipo || 'anual'}</td>
                  <td>{s.fecha ? new Date(s.fecha).toLocaleDateString() : '-'}</td>
                  <td style={{ fontWeight: 600, color: 'var(--dark)' }}>{s.producto || '-'}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{s.cantidad || 0}</td>
                  <td>{s.supervisor_nombre || '-'}</td>
                  <td>{s.director_nombre || '-'}</td>
                  <td>
                    <span className={`badge-premium badge-${s.estado}`}>
                      {ESTADO_LABELS[s.estado] || s.estado}
                    </span>
                  </td>
                  <td>
                    <div style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.motivo_supervisor || s.notas || ''}>
                      {s.motivo_supervisor || s.notas || '-'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal o Detalle */}
      {detalle && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card fade-in" style={{ width: 'min(600px, 95%)', minHeight: 'auto', padding: 32, borderRadius: 20 }}>
             <h3>Detalle de Solicitud #{detalle.id}</h3>
             <p><strong>Escuela:</strong> {detalle.escuela_nombre || detalle.institucion}</p>
             <p><strong>Kit Solicitado:</strong> {detalle.producto || '-'}</p>
             <p><strong>Cantidad de Kits:</strong> {detalle.cantidad || 0}</p>
             <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
                <button 
                  style={{ flex: 1 }} 
                  onClick={async () => {
                    try {
                      const res = await apiFetch(`/api/pedidos/${detalle.id}/aprobar-director`, {
                        token,
                        method: 'PATCH',
                        body: JSON.stringify({ decision: 'aceptar' })
                      })
                      if (res.ok) {
                        alert('Solicitud aprobada correctamente')
                        window.location.reload()
                      } else {
                        const err = await res.json()
                        alert(err.error || 'Error al aprobar')
                      }
                    } catch (e) {
                      alert('Error de conexión')
                    }
                  }}
                >
                  Aprobar Solicitud
                </button>
                <button className="secondary" onClick={() => setDetalle(null)}>Cerrar</button>
             </div>
          </div>
        </div>
      )}
    </div>
  )
}
