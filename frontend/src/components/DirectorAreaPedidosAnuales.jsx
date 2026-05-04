import { useState, useMemo } from 'react'

export default function DirectorAreaPedidosAnuales({ solicitudes, isSent }) {
  const [detalle, setDetalle] = useState(null)
  
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

  const TableHeader = ({ title, icon, color }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, marginTop: 24 }}>
      <span style={{ background: color, color: 'white', padding: '6px', borderRadius: 8, fontSize: '1.1rem', display: 'flex' }}>{icon}</span>
      <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--dark)' }}>{title}</h3>
    </div>
  )

  return (
    <div className="fade-in" style={{ background: '#f9fafb', borderRadius: 20, padding: 32, boxShadow: 'var(--shadow-premium)', border: '1px solid rgba(0,0,0,0.03)' }}>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ color: 'var(--dark)', marginBottom: 8, fontSize: '2rem', fontWeight: 800 }}>Solicitudes Anuales {anioActual}</h2>
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
                <th>Kit / Productos</th>
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
                  <td style={{ maxWidth: 300 }}>{formatItems(s.items)}</td>
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
                <th>Productos</th>
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
                  <td style={{ fontSize: '0.85rem' }}>{formatItems(s.items)}</td>
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
        <TableHeader title="Historial de Aprobadas" icon="✅" color="#10b981" />
        <div className="card" style={{ padding: 0, overflow: 'hidden', minHeight: 'auto', border: '1px solid #e2e8f0' }}>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Escuela</th>
                <th>Fecha</th>
                <th>Productos</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {solicitudesAprobadasFinal.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                    Aún no has aprobado ninguna solicitud.
                  </td>
                </tr>
              )}
              {solicitudesAprobadasFinal.map((s) => (
                <tr key={s.id}>
                  <td>#{s.id}</td>
                  <td style={{ fontWeight: 600 }}>{s.escuela_nombre || s.institucion || '-'}</td>
                  <td>{s.fecha_aprobacion_director ? new Date(s.fecha_aprobacion_director).toLocaleDateString() : '-'}</td>
                  <td style={{ fontSize: '0.85rem' }}>{formatItems(s.items)}</td>
                  <td>
                    <span className="badge-premium badge-aprobado">Aprobado Final</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal o Detalle (Placeholder por ahora) */}
      {detalle && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card fade-in" style={{ width: 'min(600px, 95%)', minHeight: 'auto', padding: 32, borderRadius: 20 }}>
             <h3>Detalle de Solicitud #{detalle.id}</h3>
             <p><strong>Escuela:</strong> {detalle.escuela_nombre || detalle.institucion}</p>
             <p><strong>Productos:</strong> {formatItems(detalle.items)}</p>
             <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
                <button style={{ flex: 1 }}>Aprobar Solicitud</button>
                <button className="secondary" onClick={() => setDetalle(null)}>Cerrar</button>
             </div>
          </div>
        </div>
      )}
    </div>
  )
}
