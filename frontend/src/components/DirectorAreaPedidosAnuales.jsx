import React from 'react'

export default function DirectorAreaPedidosAnuales({
  solicitudes,
  updatingId,
  handleDecisionSolicitud,
  handleEntregarSolicitud,
  planillas,
  planillaDetalle,
  planillaObs,
  setPlanillaObs,
  creandoPlanilla,
  handleCrearPlanilla,
  handleVerDetalle,
  handleEnviarPlanilla,
  handleEliminarPlanilla
}) {
  const anioActual = new Date().getFullYear()
  const planillaActivaAnio = planillas.find(p => p.anio === anioActual && p.estado !== 'procesada')
  const solicitudesAnualesPorDecidir = solicitudes.filter(
    s => (s.tipo || 'anual') === 'anual' && s.estado === 'aprobado' && s.aprobado_director_area == null
  )
  const solicitudesAnualesAceptadas = solicitudes.filter(
    s => (s.tipo || 'anual') === 'anual' && s.estado === 'aprobado' && s.aprobado_director_area === true
  )

  return (
    <div style={{ background: '#f9fafb', borderRadius: 8, padding: 18 }}>
      <h2 style={{ color: '#2a4d8f' }}>Gestión de Pedidos Anuales</h2>
      <section style={{ marginBottom: 24 }}>
        <h3>Planilla de Pedido Anual {anioActual}</h3>
        <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
          Consolidá solicitudes anuales aceptadas por Dirección de Área en una planilla y envíala al Área de Compras.
        </p>
        <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: '0.85rem' }}>
          Pendientes de decisión: <strong>{solicitudesAnualesPorDecidir.length}</strong> · Aceptadas para planilla: <strong>{solicitudesAnualesAceptadas.length}</strong>
        </p>
      </section>
      <section style={{ marginBottom: 24 }}>
        <h3>Acciones rápidas</h3>
        <button onClick={handleCrearPlanilla} disabled={creandoPlanilla}>
          {creandoPlanilla ? 'Creando planilla...' : 'Crear nueva planilla anual'}
        </button>
        <div style={{ marginTop: 12 }}>
          <label>Observaciones para la planilla:</label>
          <input
            type="text"
            value={planillaObs}
            onChange={e => setPlanillaObs(e.target.value)}
            placeholder="Observaciones opcionales"
            style={{ width: '100%', maxWidth: 400 }}
          />
        </div>
      </section>
      <section>
        <h3>Solicitudes anuales</h3>
        <table style={{ width: '100%', background: '#fff', borderCollapse: 'collapse', border: '1px solid #e0e0e0' }}>
          <thead>
            <tr style={{ background: '#f1f5fa' }}>
              <th>ID</th>
              <th>Escuela</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {solicitudesAnualesPorDecidir.map(s => (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td>{s.escuela_nombre || '-'}</td>
                <td>Pendiente decisión</td>
                <td>
                  <button onClick={() => handleDecisionSolicitud(s.id, 'aceptar')} disabled={updatingId === s.id}>Aceptar</button>
                  <button onClick={() => handleDecisionSolicitud(s.id, 'rechazar')} disabled={updatingId === s.id} style={{ marginLeft: 8 }}>Rechazar</button>
                </td>
              </tr>
            ))}
            {solicitudesAnualesAceptadas.map(s => (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td>{s.escuela_nombre || '-'}</td>
                <td>Aceptada</td>
                <td>
                  <button onClick={() => handleEntregarSolicitud(s.id)} disabled={updatingId === s.id}>Marcar como entregada</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
