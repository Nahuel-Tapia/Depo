import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('es-AR')
}

function buildRetiraLabel(solicitud) {
  if (solicitud?.retira_tipo === 'otro') {
    return `${solicitud.retira_nombre || '-'} - DNI ${solicitud.retira_dni || '-'}`
  }
  return solicitud?.solicitante_nombre || 'Directivo'
}

export default function MiStock() {
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [kit, setKit] = useState(null)
  const [items, setItems] = useState([])
  const [historial, setHistorial] = useState([])
  const [historialMsg, setHistorialMsg] = useState('')
  const [error, setError] = useState(null)

  const loadStock = async () => {
    setLoading(true)
    try {
      const [stockRes, historialRes] = await Promise.all([
        apiFetch('/api/directivo/mi-stock', { token }),
        apiFetch('/api/directivo/historial-retiros', { token })
      ])
      if (!stockRes.ok) {
        const data = await stockRes.json().catch(() => ({}))
        setError(data.error || 'Error cargando Mi stock')
        setItems([])
        setKit(null)
      } else {
        const data = await stockRes.json()
        setKit(data.kit)
        setItems(data.items || [])
        setError(null)
      }
      if (historialRes.ok) {
        const data = await historialRes.json()
        setHistorial(data.historial || [])
        setHistorialMsg('')
      } else {
        const data = await historialRes.json().catch(() => ({}))
        setHistorial([])
        setHistorialMsg(data.error || 'No se pudo cargar el historial. Reinicia el backend si esta pantalla acaba de actualizarse.')
      }
    } catch {
      setError('Error de conexión')
      setHistorial([])
      setHistorialMsg('No se pudo cargar el historial de retiros.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStock()
  }, [token])

  if (loading) return <div>Cargando Mi stock...</div>
  if (error) return <div className="msg show msg-error">{error}</div>

  const anualItems = items.map((it) => ({
    ...it,
    pendiente_anual: Math.max(0, Number(it.cantidad_por_kit || 0) - Number(it.retirado_anual || 0)),
  }))
  const refuerzoItems = items.filter((it) => Number(it.pedido_refuerzo || 0) > 0 || Number(it.retirado_refuerzo || 0) > 0)
  const totalPendienteAnual = anualItems.reduce((sum, it) => sum + Number(it.pendiente_anual || 0), 0)
  const totalPendienteRefuerzo = refuerzoItems.reduce(
    (sum, it) => sum + Math.max(0, Number(it.pedido_refuerzo || 0) - Number(it.retirado_refuerzo || 0)),
    0
  )

  return (
    <div>
      {!kit ? (
        <>
          <h2>Mi stock</h2>
          <p>No tenés un kit asignado a tu institución.</p>
        </>
      ) : (
        <>
          <h2>Mi stock — {kit.nombre}</h2>
          <p style={{ color: 'var(--muted)' }}>Cantidad alumnos kit: {kit.cantidad_alumnos || '-'}</p>

          <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
            <section style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0 }}>Pedido anual</h3>
                  <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '0.88rem' }}>Kit base asignado a la escuela.</p>
                </div>
                <span className={`badge badge-estado-${totalPendienteAnual > 0 ? 'pendiente' : 'aprobado'}`}>
                  {totalPendienteAnual > 0 ? 'Pendiente' : 'Completo'}
                </span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Asignado</th>
                    <th>Retirado</th>
                    <th>Pendiente</th>
                  </tr>
                </thead>
                <tbody>
                  {anualItems.map((it) => (
                    <tr key={`anual-${it.producto_id}`}>
                      <td style={{ fontWeight: 700 }}>{it.producto_nombre}</td>
                      <td>{it.cantidad_por_kit} {it.unidad_medida || ''}</td>
                      <td>{it.retirado_anual} {it.unidad_medida || ''}</td>
                      <td style={{ fontWeight: 800, color: it.pendiente_anual > 0 ? '#b91c1c' : '#065f46' }}>
                        {it.pendiente_anual} {it.unidad_medida || ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0 }}>Refuerzos</h3>
                  <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '0.88rem' }}>Pedidos extraordinarios aprobados.</p>
                </div>
                <span className={`badge badge-estado-${totalPendienteRefuerzo > 0 ? 'pendiente' : 'aprobado'}`}>
                  {totalPendienteRefuerzo > 0 ? 'Pendiente' : 'Completo'}
                </span>
              </div>
              {refuerzoItems.length === 0 ? (
                <div className="sv-empty-state" style={{ border: 0, borderRadius: 0 }}>No hay refuerzos registrados.</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Autorizado</th>
                      <th>Retirado</th>
                      <th>Pendiente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {refuerzoItems.map((it) => {
                      const pendiente = Math.max(0, Number(it.pedido_refuerzo || 0) - Number(it.retirado_refuerzo || 0))
                      return (
                        <tr key={`refuerzo-${it.producto_id}`}>
                          <td style={{ fontWeight: 700 }}>{it.producto_nombre}</td>
                          <td>{it.pedido_refuerzo} {it.unidad_medida || ''}</td>
                          <td>{it.retirado_refuerzo} {it.unidad_medida || ''}</td>
                          <td style={{ fontWeight: 800, color: pendiente > 0 ? '#b91c1c' : '#065f46' }}>
                            {pendiente} {it.unidad_medida || ''}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </section>
          </div>

          <div style={{ marginTop: 28 }}>
            <h3 style={{ marginBottom: 12 }}>Historial de retiros entregados</h3>
            {historial.length === 0 ? (
              <div className="sv-empty-state">{historialMsg || 'Todavia no hay retiros entregados.'}</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Fecha entrega</th>
                    <th>Productos</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((solicitud) => (
                    <tr key={solicitud.id}>
                      <td>
                        #{solicitud.id_pedido || '-'}
                        <span className={`badge badge-estado-${solicitud.tipo_pedido === 'refuerzo' ? 'pendiente' : 'aprobado'}`} style={{ marginLeft: 8 }}>
                          {solicitud.tipo_pedido === 'refuerzo' ? 'Refuerzo' : 'Anual'}
                        </span>
                      </td>
                      <td>{formatDate(solicitud.fecha_entrega)}</td>
                      <td>
                        {(solicitud.items || []).map((item) => (
                          <div key={item.producto_id}>
                            {item.producto_nombre}: {item.cantidad_entregada || item.cantidad_solicitada} {item.unidad_medida || 'unidad'}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}


    </div>
  )
}
