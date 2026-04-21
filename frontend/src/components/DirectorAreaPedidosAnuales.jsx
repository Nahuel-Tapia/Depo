import React, { useState } from 'react'
import ProductKitsManager from './ProductKitsManager'

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
  const [tab, setTab] = useState('gestion')
  const anioActual = new Date().getFullYear()
  const solicitudesAnualesPorDecidir = solicitudes.filter(
    s => (s.tipo || 'anual') === 'anual' && s.estado === 'aprobado' && s.aprobado_director_area == null
  )
  const solicitudesAnualesAceptadas = solicitudes.filter(
    s => (s.tipo || 'anual') === 'anual' && s.estado === 'aprobado' && s.aprobado_director_area === true
  )
  const solicitudesGestion = solicitudes.filter(s => (s.tipo || 'anual') !== 'anual' || s.estado !== 'aprobado')
  const [detalle, setDetalle] = useState(null)

  return (
    <div style={{ background: '#f9fafb', borderRadius: 8, padding: 18 }}>
      <h2 style={{ color: '#2a4d8f' }}>Gestion de Pedidos</h2>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <button className={tab === 'gestion' ? 'tab-btn active' : 'tab-btn'} onClick={() => setTab('gestion')}>Gestion de Pedidos</button>
        <button className={tab === 'resumen' ? 'tab-btn active' : 'tab-btn'} onClick={() => setTab('resumen')}>Resumen Pedido Anual</button>
      </div>

      {tab === 'gestion' && (
        <section>
          <h3>Solicitudes registradas</h3>
          <table style={{ width: '100%', background: '#fff', borderCollapse: 'collapse', border: '1px solid #e0e0e0' }}>
            <thead>
              <tr style={{ background: '#f1f5fa' }}>
                <th>ID</th>
                <th>Escuela</th>
                <th>Supervisor</th>
                <th>Pedido</th>
                <th>Cantidad</th>
                <th>Estado</th>
                <th>Accion</th>
              </tr>
            </thead>
            <tbody>
              {solicitudesGestion.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.escuela_nombre || s.institucion || '-'}</td>
                  <td>{s.supervisor_nombre || '-'}</td>
                  <td>{s.producto || '-'}</td>
                  <td>{s.cantidad || '-'}</td>
                  <td>{s.estado}</td>
                  <td>
                    <button onClick={() => setDetalle(s)}>Ver detalle</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {detalle && (
            <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, marginTop: 18, padding: 18 }}>
              <h4>Detalle del pedido #{detalle.id}</h4>
              <div><b>Escuela:</b> {detalle.escuela_nombre || detalle.institucion || '-'}</div>
              <div><b>Supervisor:</b> {detalle.supervisor_nombre || '-'}</div>
              <div><b>Estado:</b> {detalle.estado}</div>
              <div><b>Fecha:</b> {detalle.fecha ? new Date(detalle.fecha).toLocaleDateString('es-AR') : '-'}</div>
              <div><b>Pedido:</b> {detalle.producto || '-'}</div>
              <div><b>Cantidad:</b> {detalle.cantidad || '-'}</div>
              <div><b>Observaciones:</b> {detalle.notas || detalle.observaciones || '-'}</div>
              <div style={{ marginTop: 10 }}><b>Items:</b></div>
              <ul>
                {(detalle.items || []).map((item, idx) => (
                  <li key={`${detalle.id}-item-${idx}`}>{item.producto} - Cantidad: {item.cantidad}</li>
                ))}
              </ul>
              <button className="secondary" onClick={() => setDetalle(null)} style={{ marginTop: 10 }}>Cerrar</button>
            </div>
          )}
        </section>
      )}

      {tab === 'resumen' && (
        <>
          <section style={{ marginBottom: 24 }}>
            <h3>Planilla de Pedido Anual {anioActual}</h3>
            <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
              Consolida solicitudes anuales aceptadas por Direccion de Area en una planilla y enviala al Area de Compras.
            </p>
            <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: '0.85rem' }}>
              Pendientes de decision: <strong>{solicitudesAnualesPorDecidir.length}</strong> · Aceptadas para planilla: <strong>{solicitudesAnualesAceptadas.length}</strong>
            </p>
          </section>

          <section style={{ marginBottom: 24 }}>
            <h3>Acciones rapidas</h3>
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
                  <th>Pedido</th>
                  <th>Cantidad</th>
                  <th>Estado</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {solicitudesAnualesPorDecidir.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{s.escuela_nombre || s.institucion || '-'}</td>
                    <td>{s.producto || '-'}</td>
                    <td>{s.cantidad || '-'}</td>
                    <td>Pendiente decision</td>
                    <td>
                      <button onClick={() => handleDecisionSolicitud(s.id, 'aceptar')} disabled={updatingId === s.id}>Aceptar</button>
                      <button onClick={() => handleDecisionSolicitud(s.id, 'denegar')} disabled={updatingId === s.id} style={{ marginLeft: 8 }}>Rechazar</button>
                    </td>
                  </tr>
                ))}
                {solicitudesAnualesAceptadas.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{s.escuela_nombre || s.institucion || '-'}</td>
                    <td>{s.producto || '-'}</td>
                    <td>{s.cantidad || '-'}</td>
                    <td>Aceptada</td>
                    <td>
                      <button onClick={() => handleEntregarSolicitud(s.id)} disabled={updatingId === s.id}>Marcar como entregada</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  )
}
