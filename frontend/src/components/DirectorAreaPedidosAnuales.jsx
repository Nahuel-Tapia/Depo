import React, { useMemo, useState } from 'react'

function formatItems(items = []) {
  if (!items.length) return '-'
  return items.map((item) => `${item.producto} x${item.cantidad}`).join(', ')
}

function totalProductos(items = []) {
  return items.reduce((acc, item) => acc + Number(item.cantidad || 0), 0)
}

export default function DirectorAreaPedidosAnuales({
  solicitudes,
  updatingId,
  handleDecisionSolicitud,
  handleEntregarSolicitud
}) {
  const [detalle, setDetalle] = useState(null)
  const anioActual = new Date().getFullYear()

  // 1. Solicitudes que ya pasaron por el supervisor y esperan al director
  const solicitudesPendientesDirector = solicitudes.filter(
    (s) => (s.tipo || 'anual') === 'anual' && s.estado === 'pendiente_director'
  )

  // 2. Solicitudes que aún están en manos del supervisor (informativo)
  const solicitudesPendientesSupervisor = solicitudes.filter(
    (s) => (s.tipo || 'anual') === 'anual' && s.estado === 'pendiente'
  )

  // 3. Solicitudes ya aprobadas por el director
  const solicitudesAprobadasFinal = solicitudes.filter(
    (s) => (s.tipo || 'anual') === 'anual' && s.estado === 'aprobado' && s.aprobado_director_area === true
  )

  return (
    <div style={{ background: '#f9fafb', borderRadius: 8, padding: 18 }}>
      <h2 style={{ color: '#2a4d8f' }}>Solicitud Anual {anioActual}</h2>
      <p style={{ color: 'var(--muted)', marginBottom: 24 }}>
        Gestiona las aprobaciones finales de las solicitudes anuales de tu nivel educativo.
      </p>

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: 8 }}>Pendientes de mi aprobacion (Aprobadas por Supervisor)</h3>
        <table style={{ width: '100%', background: '#fff', borderCollapse: 'collapse', border: '1px solid #e0e0e0' }}>
          <thead>
            <tr style={{ background: '#f1f5fa' }}>
              <th>ID</th>
              <th>Escuela</th>
              <th>Aprobado por Supervisor</th>
              <th>Fecha Sup.</th>
              <th>Productos</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {solicitudesPendientesDirector.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>
                  No hay solicitudes esperando tu aprobacion final.
                </td>
              </tr>
            )}

            {solicitudesPendientesDirector.map((s) => (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td>{s.escuela_nombre || s.institucion || '-'}</td>
                <td><span style={{ color: '#059669', fontWeight: 'bold' }}>{s.supervisor_nombre || 'Supervisor'}</span></td>
                <td>{s.fecha_aprobacion_supervisor ? new Date(s.fecha_aprobacion_supervisor).toLocaleDateString('es-AR') : '-'}</td>
                <td>{formatItems(s.items)}</td>
                <td>
                  <button onClick={() => handleDecisionSolicitud(s.id, 'aceptar')} disabled={updatingId === s.id} style={{ background: '#059669' }}>
                    Aprobar Final
                  </button>
                  <button
                    onClick={() => handleDecisionSolicitud(s.id, 'rechazar')}
                    disabled={updatingId === s.id}
                    style={{ marginLeft: 8, background: '#dc2626' }}
                  >
                    Rechazar
                  </button>
                  <button className="secondary" onClick={() => setDetalle(s)} style={{ marginLeft: 8 }}>
                    Ver detalle
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: 8 }}>En proceso (Pendiente de Supervisor)</h3>
        <table style={{ width: '100%', background: '#fff', borderCollapse: 'collapse', border: '1px solid #e0e0e0', opacity: 0.8 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th>ID</th>
              <th>Escuela</th>
              <th>Productos</th>
              <th>Estado</th>
              <th>Info</th>
            </tr>
          </thead>
          <tbody>
            {solicitudesPendientesSupervisor.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 12, color: 'var(--muted)' }}>
                  No hay solicitudes pendientes de supervisor.
                </td>
              </tr>
            )}
            {solicitudesPendientesSupervisor.map((s) => (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td>{s.escuela_nombre || s.institucion || '-'}</td>
                <td>{formatItems(s.items)}</td>
                <td><span style={{ color: '#d97706' }}>Esperando Supervisor</span></td>
                <td>
                  <button className="secondary" onClick={() => setDetalle(s)}>Ver</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h3 style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: 8 }}>Historial de Aprobadas por Director</h3>
        <table style={{ width: '100%', background: '#fff', borderCollapse: 'collapse', border: '1px solid #e0e0e0' }}>
          <thead>
            <tr style={{ background: '#f1f5fa' }}>
              <th>ID</th>
              <th>Escuela</th>
              <th>Fecha Aprob. Final</th>
              <th>Productos</th>
              <th>Estado</th>
              <th>Accion</th>
            </tr>
          </thead>
          <tbody>
            {solicitudesAprobadasFinal.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>
                  Aun no has aprobado ninguna solicitud de forma definitiva.
                </td>
              </tr>
            )}

            {solicitudesAprobadasFinal.map((s) => (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td>{s.escuela_nombre || s.institucion || '-'}</td>
                <td>{s.fecha_aprobacion_director ? new Date(s.fecha_aprobacion_director).toLocaleDateString('es-AR') : '-'}</td>
                <td>{formatItems(s.items)}</td>
                <td><span style={{ color: '#059669', fontWeight: 'bold' }}>Aprobada</span></td>
                <td>
                   <div style={{ display: 'flex', gap: 8 }}>
                    <button className="secondary" onClick={() => setDetalle(s)}>Detalle</button>
                    {/* El resumen anual es una pestaña principal, pero podemos poner un link directo si se desea */}
                   </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {detalle && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000 
        }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 8, maxWidth: 600, width: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
            <h4 style={{ marginTop: 0 }}>Detalle del pedido #{detalle.id}</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div><b>Escuela:</b> {detalle.escuela_nombre || detalle.institucion || '-'}</div>
              <div><b>Estado:</b> {detalle.estado}</div>
              <div><b>Supervisor:</b> {detalle.supervisor_nombre || '-'}</div>
              <div><b>Fecha Supervisor:</b> {detalle.fecha_aprobacion_supervisor ? new Date(detalle.fecha_aprobacion_supervisor).toLocaleString() : '-'}</div>
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <b>Observaciones:</b>
              <p style={{ background: '#f3f4f6', padding: 10, borderRadius: 4 }}>{detalle.notas || detalle.observaciones || 'Sin observaciones'}</p>
            </div>

            <div style={{ marginTop: 10 }}><b>Items Solicitados:</b></div>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {(detalle.items || []).map((item, idx) => (
                <li key={`${detalle.id}-item-${idx}`} style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
                  {item.producto} - <b>Cantidad: {item.cantidad}</b>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 24, textAlign: 'right' }}>
              <button className="secondary" onClick={() => setDetalle(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
