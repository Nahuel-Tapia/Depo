import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

function itemKey(loteId, productoId) {
  return `${loteId}:${productoId}`
}

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

function filesToBase64(files = []) {
  return Promise.all(
    Array.from(files).map((file) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const raw = String(reader.result || '')
          const base64 = raw.includes(',') ? raw.split(',')[1] : raw
          resolve({
            nombre: file.name,
            mime_type: file.type || 'image/jpeg',
            datos: base64,
          })
        }
        reader.onerror = () => reject(new Error('No se pudo leer archivo'))
        reader.readAsDataURL(file)
      })
    )
  )
}

export default function MiStock() {
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [kit, setKit] = useState(null)
  const [items, setItems] = useState([])
  const [historial, setHistorial] = useState([])
  const [historialMsg, setHistorialMsg] = useState('')
  const [error, setError] = useState(null)

  const [distLoading, setDistLoading] = useState(true)
  const [lotesPendientes, setLotesPendientes] = useState([])
  const [recepcionForm, setRecepcionForm] = useState({})
  const [distMsg, setDistMsg] = useState({ text: '', type: '' })

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
              cantidad_danada: String(item.cantidad_danada || 0),
              detalle_danio: item.detalle_danio || '',
              coincide_esperado: item.coincide_esperado !== false,
              observaciones_directivo: item.observaciones_directivo || '',
              reclamo_directivo: item.reclamo_directivo || '',
              imagenes: item.imagenes || [],
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
        cantidad_danada: Number(formRow.cantidad_danada || 0),
        detalle_danio: formRow.detalle_danio || '',
        coincide_esperado: formRow.coincide_esperado !== false,
        observaciones_directivo: formRow.observaciones_directivo || '',
        reclamo_directivo: formRow.reclamo_directivo || '',
        imagenes: Array.isArray(formRow.imagenes) ? formRow.imagenes : [],
      }
    })

    const invalidItem = payloadItems.find((it, idx) => {
      const planificada = Number(lote.items[idx]?.cantidad_planificada || 0)
      return Number(it.cantidad_recibida) + Number(it.cantidad_danada || 0) > planificada
    })
    if (invalidItem) {
      setDistMsg({ text: 'Hay ítems donde recibido + dañado supera la cantidad planificada', type: 'error' })
      return
    }

    // Validar obligatoriedad de observaciones y fotos para cada producto que se está recibiendo
    const missingFieldsItem = payloadItems.find((it) => {
      const isReceiving = it.cantidad_recibida > 0 || it.cantidad_danada > 0
      return isReceiving && (!it.observaciones_directivo.trim() || it.imagenes.length === 0)
    })
    if (missingFieldsItem) {
      const prodName = lote.items.find(x => Number(x.id_producto) === Number(missingFieldsItem.id_producto))?.producto_nombre || 'producto'
      setDistMsg({
        text: `Es obligatorio ingresar Observaciones y adjuntar al menos una foto (Evidencia) para el producto: "${prodName}".`,
        type: 'error'
      })
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

  const handleImageChange = async (loteId, productoId, fileList) => {
    const files = Array.from(fileList || [])
    if (files.length === 0) return

    try {
      const converted = await filesToBase64(files)
      handleFormChange(loteId, productoId, 'imagenes', converted)
    } catch {
      setDistMsg({ text: 'No se pudieron procesar las imágenes de daño', type: 'error' })
    }
  }

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

      <div style={{ marginTop: 28 }}>
        <h3 style={{ marginBottom: 6 }}>Recepción de Envío</h3>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>
          Confirmá recepción total o parcial, informá productos dañados y adjuntá evidencia.
          <br />
          <strong style={{ color: '#dc2626', fontSize: '0.85rem' }}>
            * Al recibir mercadería (recibido o dañado > 0), es obligatorio ingresar Observaciones y adjuntar al menos una foto (Evidencia).
          </strong>
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
                    <th style={{ textAlign: 'center' }}>Dañado</th>
                    <th style={{ textAlign: 'center' }}>Coincide</th>
                    <th>Detalle daño</th>
                    <th>Observaciones <span style={{ color: '#dc2626' }}>*</span></th>
                    <th>Reclamo</th>
                    <th>Evidencia (Fotos) <span style={{ color: '#dc2626' }}>*</span></th>
                  </tr>
                </thead>
                <tbody>
                  {(lote.items || []).map((item) => {
                    const key = itemKey(lote.lote_id, item.id_producto)
                    const row = recepcionForm[key] || {}
                    const imagenes = Array.isArray(row.imagenes) ? row.imagenes : []
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
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="number"
                            min="0"
                            max={item.cantidad_planificada}
                            value={row.cantidad_danada || ''}
                            onChange={(e) => handleFormChange(lote.lote_id, item.id_producto, 'cantidad_danada', e.target.value)}
                            style={{ width: 90, textAlign: 'center' }}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={row.coincide_esperado !== false}
                            onChange={(e) => handleFormChange(lote.lote_id, item.id_producto, 'coincide_esperado', e.target.checked)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={row.detalle_danio || ''}
                            onChange={(e) => handleFormChange(lote.lote_id, item.id_producto, 'detalle_danio', e.target.value)}
                            placeholder="Detalle de daño"
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
                        <td>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) => handleImageChange(lote.lote_id, item.id_producto, e.target.files)}
                          />
                          {imagenes.length > 0 && (
                            <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {imagenes.slice(0, 3).map((img, idx) => (
                                <img
                                  key={`${key}-img-${idx}`}
                                  alt={img.nombre || `img-${idx}`}
                                  src={`data:${img.mime_type || 'image/jpeg'};base64,${img.datos}`}
                                  style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4, border: '1px solid #e2e8f0' }}
                                />
                              ))}
                              {imagenes.length > 3 && <span style={{ fontSize: '0.75rem', color: '#64748b' }}>+{imagenes.length - 3}</span>}
                            </div>
                          )}
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
