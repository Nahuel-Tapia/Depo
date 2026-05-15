import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

function itemKey(loteId, productoId) {
  return `${loteId}:${productoId}`
}

export default function MiStock() {
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [kit, setKit] = useState(null)
  const [items, setItems] = useState([])
  const [error, setError] = useState(null)

  const [distLoading, setDistLoading] = useState(true)
  const [lotesPendientes, setLotesPendientes] = useState([])
  const [recepcionForm, setRecepcionForm] = useState({})
  const [distMsg, setDistMsg] = useState({ text: '', type: '' })

  const loadStock = async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/directivo/mi-stock', { token })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Error cargando Mi stock')
        setItems([])
        setKit(null)
      } else {
        const data = await res.json()
        setKit(data.kit)
        setItems(data.items || [])
        setError(null)
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const loadDistribuciones = async () => {
    setDistLoading(true)
    try {
      const res = await apiFetch('/api/directivo/distribuciones/pendientes', { token })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setDistMsg({ text: data.error || 'No se pudieron cargar distribuciones pendientes', type: 'error' })
        setLotesPendientes([])
      } else {
        const data = await res.json()
        const lotes = data.lotes || []
        setLotesPendientes(lotes)

        const nextForm = {}
        for (const lote of lotes) {
          for (const item of lote.items || []) {
            const key = itemKey(lote.lote_id, item.id_producto)
            nextForm[key] = {
              cantidad_recibida: String(item.cantidad_planificada || 0),
              observaciones_directivo: item.observaciones_directivo || '',
              reclamo_directivo: item.reclamo_directivo || '',
            }
          }
        }
        setRecepcionForm(nextForm)
      }
    } catch {
      setDistMsg({ text: 'Error de conexión al cargar distribuciones', type: 'error' })
      setLotesPendientes([])
    } finally {
      setDistLoading(false)
    }
  }

  useEffect(() => {
    loadStock()
    loadDistribuciones()
  }, [token])

  const handleFormChange = (loteId, productoId, field, value) => {
    const key = itemKey(loteId, productoId)
    setRecepcionForm((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [field]: value,
      },
    }))
  }

  const handleConfirmarRecepcionLote = async (lote) => {
    const payloadItems = (lote.items || []).map((item) => {
      const key = itemKey(lote.lote_id, item.id_producto)
      const formRow = recepcionForm[key] || {}
      return {
        id_producto: Number(item.id_producto),
        cantidad_recibida: Number(formRow.cantidad_recibida || 0),
        observaciones_directivo: formRow.observaciones_directivo || '',
        reclamo_directivo: formRow.reclamo_directivo || '',
      }
    })

    const invalidItem = payloadItems.find((it, idx) => Number(it.cantidad_recibida) > Number(lote.items[idx]?.cantidad_planificada || 0))
    if (invalidItem) {
      setDistMsg({ text: 'Hay cantidades recibidas mayores a la planificada', type: 'error' })
      return
    }

    try {
      const res = await apiFetch(`/api/directivo/distribuciones/${lote.lote_id}/confirmar-recepcion`, {
        token,
        method: 'POST',
        body: JSON.stringify({ items: payloadItems }),
      })

      if (res.ok) {
        const data = await res.json()
        setDistMsg({ text: `Recepción actualizada para lote #${lote.lote_id}. Estado: ${data.estado}`, type: 'success' })
        loadDistribuciones()
      } else {
        const data = await res.json().catch(() => ({}))
        setDistMsg({ text: data.error || 'No se pudo confirmar recepción', type: 'error' })
      }
    } catch {
      setDistMsg({ text: 'Error de conexión al confirmar recepción', type: 'error' })
    }
  }

  if (loading) return <div>Cargando Mi stock...</div>
  if (error) return <div className="msg show msg-error">{error}</div>

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

          <div style={{ marginTop: 18 }}>
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad por kit</th>
                  <th>Retirado (anual)</th>
                  <th>Refuerzo autorizado</th>
                  <th>Restante por retirar</th>
                  <th>Total retirado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.producto_id}>
                    <td style={{ fontWeight: 600 }}>{it.producto_nombre}</td>
                    <td>{it.cantidad_por_kit} {it.unidad_medida || ''}</td>
                    <td>{it.retirado_anual} {it.unidad_medida || ''}</td>
                    <td>{it.pedido_refuerzo} {it.unidad_medida || ''}</td>
                    <td>{it.restante} {it.unidad_medida || ''}</td>
                    <td>{it.total_retirado} {it.unidad_medida || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div style={{ marginTop: 28 }}>
        <h3 style={{ marginBottom: 6 }}>Validación de Distribuciones Recibidas</h3>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>
          Confirmá recepción completa, parcial o cargá reclamo por diferencias detectadas.
        </p>

        {distMsg.text && (
          <div className={`msg show ${distMsg.type === 'success' ? 'msg-success' : 'msg-error'}`} style={{ marginBottom: 14 }}>
            {distMsg.text}
          </div>
        )}

        {distLoading ? (
          <div className="sv-empty-state">Buscando distribuciones pendientes...</div>
        ) : lotesPendientes.length === 0 ? (
          <div className="sv-empty-state">No hay distribuciones pendientes para validar.</div>
        ) : (
          lotesPendientes.map((lote) => (
            <div key={lote.lote_id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>Lote #{lote.lote_id} — {lote.zona_nombre}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                    Depósito: {lote.deposito_nombre} | Año: {lote.anio} | Fecha: {new Date(lote.created_at).toLocaleString('es-AR')}
                  </div>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Estado actual: {lote.lote_estado}</div>
              </div>

              <table>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th>Producto</th>
                    <th style={{ textAlign: 'center' }}>Planificado</th>
                    <th style={{ textAlign: 'center' }}>Recibido Ahora</th>
                    <th>Observaciones</th>
                    <th>Reclamo</th>
                  </tr>
                </thead>
                <tbody>
                  {(lote.items || []).map((item) => {
                    const key = itemKey(lote.lote_id, item.id_producto)
                    const row = recepcionForm[key] || {}
                    return (
                      <tr key={`${lote.lote_id}-${item.id_producto}`}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.producto_nombre}</div>
                          <div style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{item.unidad_medida || '-'}</div>
                        </td>
                        <td style={{ textAlign: 'center' }}>{item.cantidad_planificada}</td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="number"
                            min="0"
                            max={item.cantidad_planificada}
                            value={row.cantidad_recibida || ''}
                            onChange={(e) => handleFormChange(lote.lote_id, item.id_producto, 'cantidad_recibida', e.target.value)}
                            style={{ width: 120, textAlign: 'center' }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={row.observaciones_directivo || ''}
                            onChange={(e) => handleFormChange(lote.lote_id, item.id_producto, 'observaciones_directivo', e.target.value)}
                            placeholder="Observación"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={row.reclamo_directivo || ''}
                            onChange={(e) => handleFormChange(lote.lote_id, item.id_producto, 'reclamo_directivo', e.target.value)}
                            placeholder="Detalle de reclamo"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button className="primary" onClick={() => handleConfirmarRecepcionLote(lote)}>
                  Confirmar Recepción del Lote
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
