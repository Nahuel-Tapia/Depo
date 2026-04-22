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
  handleEntregarSolicitud,
  planillaObs,
  setPlanillaObs,
  creandoPlanilla,
  handleCrearPlanilla
}) {
  const [tab, setTab] = useState('gestion')
  const [detalle, setDetalle] = useState(null)
  const anioActual = new Date().getFullYear()

  const solicitudesPendientes = solicitudes.filter(
    (s) => (s.tipo || 'anual') === 'anual' && s.estado === 'aprobado' && s.aprobado_director_area == null
  )

  const solicitudesAceptadas = solicitudes.filter(
    (s) => (s.tipo || 'anual') === 'anual' && s.estado === 'aprobado' && s.aprobado_director_area === true
  )

  const productosAceptados = useMemo(() => {
    const productosMap = new Map()

    solicitudesAceptadas.forEach((solicitud) => {
      ;(solicitud.items || []).forEach((item) => {
        const nombre = String(item.producto || '').trim() || 'Producto sin nombre'
        const cantidad = Number(item.cantidad || 0)
        const acumulado = productosMap.get(nombre) || { producto: nombre, cantidad: 0, pedidos: 0 }

        acumulado.cantidad += cantidad
        acumulado.pedidos += 1
        productosMap.set(nombre, acumulado)
      })
    })

    return Array.from(productosMap.values()).sort((a, b) =>
      a.producto.localeCompare(b.producto, 'es', { sensitivity: 'base' })
    )
  }, [solicitudesAceptadas])

  return (
    <div style={{ background: '#f9fafb', borderRadius: 8, padding: 18 }}>
      <h2 style={{ color: '#2a4d8f' }}>Gestion de Pedidos</h2>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <button className={tab === 'gestion' ? 'tab-btn active' : 'tab-btn'} onClick={() => setTab('gestion')}>
          Gestion de Pedidos
        </button>
        <button className={tab === 'resumen' ? 'tab-btn active' : 'tab-btn'} onClick={() => setTab('resumen')}>
          Solicitud Anual
        </button>
      </div>

      {tab === 'gestion' && (
        <section>
          <h3>Solicitudes pendientes de aceptar</h3>
          <table style={{ width: '100%', background: '#fff', borderCollapse: 'collapse', border: '1px solid #e0e0e0' }}>
            <thead>
              <tr style={{ background: '#f1f5fa' }}>
                <th>ID</th>
                <th>Escuela</th>
                <th>Supervisor</th>
                <th>Productos</th>
                <th>Total productos</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {solicitudesPendientes.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                    No hay solicitudes pendientes de decision.
                  </td>
                </tr>
              )}

              {solicitudesPendientes.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.escuela_nombre || s.institucion || '-'}</td>
                  <td>{s.supervisor_nombre || '-'}</td>
                  <td>{formatItems(s.items)}</td>
                  <td>{totalProductos(s.items)}</td>
                  <td>Pendiente decision</td>
                  <td>
                    <button onClick={() => handleDecisionSolicitud(s.id, 'aceptar')} disabled={updatingId === s.id}>Aceptar</button>
                    <button
                      onClick={() => handleDecisionSolicitud(s.id, 'denegar')}
                      disabled={updatingId === s.id}
                      style={{ marginLeft: 8 }}
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
      )}

      {tab === 'resumen' && (
        <>
          <section style={{ marginBottom: 24 }}>
            <h3>Solicitud Anual {anioActual}</h3>
            <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
              Aca aparecen los pedidos anuales ya aceptados y el acumulado por producto para la planilla.
            </p>
            <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: '0.85rem' }}>
              Pendientes de decision: <strong>{solicitudesPendientes.length}</strong> · Pedidos aceptados: <strong>{solicitudesAceptadas.length}</strong>
            </p>
          </section>

          <section style={{ marginBottom: 24 }}>
            <h3>Productos aceptados acumulados</h3>
            <table style={{ width: '100%', background: '#fff', borderCollapse: 'collapse', border: '1px solid #e0e0e0' }}>
              <thead>
                <tr style={{ background: '#f1f5fa' }}>
                  <th>Producto</th>
                  <th>Cantidad total</th>
                  <th>Pedidos aceptados</th>
                </tr>
              </thead>
              <tbody>
                {productosAceptados.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                      Todavia no hay productos aceptados.
                    </td>
                  </tr>
                )}

                {productosAceptados.map((producto) => (
                  <tr key={producto.producto}>
                    <td>{producto.producto}</td>
                    <td>{producto.cantidad}</td>
                    <td>{producto.pedidos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section style={{ marginBottom: 24 }}>
            <h3>Acciones rapidas</h3>
            <button onClick={handleCrearPlanilla} disabled={creandoPlanilla || solicitudesAceptadas.length === 0}>
              {creandoPlanilla ? 'Creando planilla...' : 'Crear nueva planilla anual'}
            </button>
            <div style={{ marginTop: 12 }}>
              <label>Observaciones para la planilla:</label>
              <input
                type="text"
                value={planillaObs}
                onChange={(e) => setPlanillaObs(e.target.value)}
                placeholder="Observaciones opcionales"
                style={{ width: '100%', maxWidth: 400 }}
              />
            </div>
          </section>

          <section>
            <h3>Pedidos ya aceptados</h3>
            <table style={{ width: '100%', background: '#fff', borderCollapse: 'collapse', border: '1px solid #e0e0e0' }}>
              <thead>
                <tr style={{ background: '#f1f5fa' }}>
                  <th>ID</th>
                  <th>Escuela</th>
                  <th>Productos</th>
                  <th>Total productos</th>
                  <th>Estado</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {solicitudesAceptadas.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                      No hay pedidos aceptados todavia.
                    </td>
                  </tr>
                )}

                {solicitudesAceptadas.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{s.escuela_nombre || s.institucion || '-'}</td>
                    <td>{formatItems(s.items)}</td>
                    <td>{totalProductos(s.items)}</td>
                    <td>Aceptada</td>
                    <td>
                      <button onClick={() => handleEntregarSolicitud(s.id)} disabled={updatingId === s.id}>Marcar como entregada</button>
                      <button className="secondary" onClick={() => setDetalle(s)} style={{ marginLeft: 8 }}>Ver detalle</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {detalle && (
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, marginTop: 18, padding: 18 }}>
          <h4>Detalle del pedido #{detalle.id}</h4>
          <div><b>Escuela:</b> {detalle.escuela_nombre || detalle.institucion || '-'}</div>
          <div><b>Supervisor:</b> {detalle.supervisor_nombre || '-'}</div>
          <div><b>Estado:</b> {detalle.estado}</div>
          <div><b>Fecha:</b> {detalle.fecha ? new Date(detalle.fecha).toLocaleDateString('es-AR') : '-'}</div>
          <div><b>Total de productos:</b> {totalProductos(detalle.items)}</div>
          <div><b>Observaciones:</b> {detalle.notas || detalle.observaciones || '-'}</div>
          <div style={{ marginTop: 10 }}><b>Items:</b></div>
          <ul>
            {(detalle.items || []).map((item, idx) => (
              <li key={`${detalle.id}-item-${idx}`}>{item.producto} - Cantidad: {item.cantidad}</li>
            ))}
          </ul>
          <button className="secondary" onClick={() => setDetalle(null)} style={{ marginTop: 10 }}>
            Cerrar
          </button>
        </div>
      )}
    </div>
  )
}
