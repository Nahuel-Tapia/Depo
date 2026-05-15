import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('es-AR')
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function buildRetiraLabel(solicitud) {
  if (solicitud?.retira_tipo === 'otro') {
    return `${solicitud.retira_nombre || '-'} - DNI ${solicitud.retira_dni || '-'}`
  }
  return solicitud?.solicitante_nombre || 'Directivo'
}

function Comprobante({ solicitud }, ref) {
  if (!solicitud) return null

  return (
    <div ref={ref} style={{ background: '#fff', color: '#111827', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #FF8200', paddingBottom: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/faviconmin.png" alt="Logo San Juan" style={{ height: 40, width: 'auto' }} />
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>San Juan Gobierno</div>
            <div style={{ fontSize: '0.9rem', color: '#666' }}>Ministerio de Educación</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Comprobante de entrega</div>
          <div style={{ fontSize: '0.9rem', color: '#666' }}>Solicitud #{solicitud.id}</div>
        </div>
      </div>
      <div style={{ paddingBottom: 10, marginBottom: 14 }}>
        <strong>Pedido anual #{solicitud.id_pedido}</strong>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div><strong>Institucion:</strong> {solicitud.institucion_nombre}</div>
        <div><strong>CUE:</strong> {solicitud.cue || '-'}</div>
        <div><strong>Fecha solicitada de retiro:</strong> {formatDate(solicitud.fecha_retiro)}</div>
        <div><strong>Fecha de entrega:</strong> {formatDate(solicitud.fecha_entrega) || '-'}</div>
        <div style={{ gridColumn: '1 / -1' }}><strong>Retira:</strong> {buildRetiraLabel(solicitud)}</div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 28 }}>
        <thead>
          <tr>
            <th style={thStyle}>Producto</th>
            <th style={thStyle}>Cantidad</th>
            <th style={thStyle}>Unidad</th>
          </tr>
        </thead>
        <tbody>
          {(solicitud.items || []).map((item) => (
            <tr key={item.producto_id}>
              <td style={tdStyle}>{item.producto_nombre}</td>
              <td style={tdStyle}>{item.cantidad_entregada || item.cantidad_solicitada}</td>
              <td style={tdStyle}>{item.unidad_medida || 'unidad'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 36, marginTop: 54 }}>
        <div style={signatureStyle}>Firma de quien entrega</div>
        <div style={signatureStyle}>Firma y sello del directivo</div>
      </div>
    </div>
  )
}

const thStyle = {
  border: '1px solid #d1d5db',
  background: '#f3f4f6',
  padding: '8px 10px',
  textAlign: 'left'
}

const tdStyle = {
  border: '1px solid #d1d5db',
  padding: '8px 10px'
}

const signatureStyle = {
  borderTop: '1px solid #111827',
  paddingTop: 8,
  textAlign: 'center',
  minHeight: 46
}

const ForwardComprobante = Object.assign(
  (props) => Comprobante(props, props.forwardedRef),
  { displayName: 'Comprobante' }
)

export default function SolicitudesRetiro({ embedded = false }) {
  const { token, user } = useAuth()
  const [pedidos, setPedidos] = useState([])
  const [solicitudes, setSolicitudes] = useState([])
  const [selectedPedidoId, setSelectedPedidoId] = useState('')
  const [cantidades, setCantidades] = useState({})
  const [fechaRetiro, setFechaRetiro] = useState(todayInputValue())
  const [retiraTipo, setRetiraTipo] = useState('directivo')
  const [retiraNombre, setRetiraNombre] = useState('')
  const [retiraDni, setRetiraDni] = useState('')
  const [solicitarEnvio, setSolicitarEnvio] = useState(false)
  const [observaciones, setObservaciones] = useState('')
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState(null)
  const [comprobante, setComprobante] = useState(null)
  const [historialEntregadas, setHistorialEntregadas] = useState([])
  const printRef = useRef(null)
  const [operatorPedidos, setOperatorPedidos] = useState([])
  const [operatorPedidosLoading, setOperatorPedidosLoading] = useState(false)

  const isDirectivo = user?.role === 'directivo'
  const isOperador = user?.role === 'operador' || user?.role === 'admin' || user?.role === 'master'

  const selectedPedido = useMemo(
    () => pedidos.find((pedido) => Number(pedido.id) === Number(selectedPedidoId)) || null,
    [pedidos, selectedPedidoId]
  )

  const loadData = async () => {
    setLoading(true)
    try {
      if (isDirectivo) {
        const [dispRes, misRes] = await Promise.all([
          apiFetch('/api/entregas/solicitudes/productos-disponibles', { token }),
          apiFetch('/api/entregas/solicitudes/mis', { token })
        ])
        if (dispRes.ok) {
          const data = await dispRes.json()
          setPedidos(data.pedidos || [])
        }
        if (misRes.ok) {
          const data = await misRes.json()
          setSolicitudes(data.solicitudes || [])
        }
      } else if (isOperador) {
        const [pendRes, entRes] = await Promise.all([
          apiFetch('/api/entregas/solicitudes/pendientes', { token }),
          apiFetch('/api/entregas/solicitudes/entregadas', { token })
        ])
        if (pendRes.ok) {
          const data = await pendRes.json()
          setSolicitudes(data.solicitudes || [])
        }
        if (entRes.ok) {
          const data = await entRes.json()
          setHistorialEntregadas(data.solicitudes || [])
        }
      }
    } catch {
      setMsg({ text: 'No se pudieron cargar las solicitudes de retiro', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [token, user?.role])

  const handleCantidadChange = (productoId, value) => {
    setCantidades((prev) => ({
      ...prev,
      [productoId]: value
    }))
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    setMsg({ text: '', type: '' })

    const items = Object.entries(cantidades)
      .map(([productoId, cantidad]) => ({
        producto_id: Number(productoId),
        cantidad: Number(cantidad)
      }))
      .filter((item) => item.producto_id > 0 && item.cantidad > 0)

    if (!selectedPedidoId || items.length === 0) {
      setMsg({ text: 'Selecciona un pedido y al menos un producto con cantidad.', type: 'error' })
      return
    }

    const res = await apiFetch('/api/entregas/solicitudes', {
      token,
      method: 'POST',
      body: JSON.stringify({
        id_pedido: Number(selectedPedidoId),
        fecha_retiro: fechaRetiro,
        retira_tipo: retiraTipo,
        retira_nombre: retiraTipo === 'otro' ? retiraNombre.trim() : null,
        retira_dni: retiraTipo === 'otro' ? retiraDni.trim() : null,
        solicitar_envio: solicitarEnvio,
        observaciones: observaciones.trim() || null,
        items
      })
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMsg({ text: data.error || 'No se pudo crear la solicitud de retiro', type: 'error' })
      return
    }

    setSelectedPedidoId('')
    setCantidades({})
    setFechaRetiro(todayInputValue())
    setRetiraTipo('directivo')
    setRetiraNombre('')
    setRetiraDni('')
    setSolicitarEnvio(false)
    setObservaciones('')
    setMsg({ text: 'Solicitud de retiro creada correctamente.', type: 'success' })
    loadData()
  }

  const handleEntregar = async (solicitudId) => {
    setProcessingId(solicitudId)
    setMsg({ text: '', type: '' })
    try {
      const res = await apiFetch(`/api/entregas/solicitudes/${solicitudId}/entregar`, {
        token,
        method: 'POST'
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg({ text: data.error || 'No se pudo confirmar la entrega', type: 'error' })
        return
      }
      setComprobante(data.solicitud)
      setMsg({ text: 'Entrega confirmada. Ya podes imprimir el comprobante.', type: 'success' })
      loadData()
    } finally {
      setProcessingId(null)
    }
  }

  const handleAccept = async (solicitudId) => {
    setProcessingId(solicitudId)
    setMsg({ text: '', type: '' })
    try {
      const res = await apiFetch(`/api/entregas/solicitudes/${solicitudId}/aceptar`, {
        token,
        method: 'PATCH'
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg({ text: data.error || 'No se pudo aceptar la solicitud', type: 'error' })
        return
      }
      // actualizar estado localmente
      setSolicitudes(prev => prev.map(s => s.id === solicitudId ? { ...s, estado: 'aceptada', id_usuario_acepta: data.solicitud?.id_usuario_acepta || null } : s))
      setMsg({ text: `Solicitud #${solicitudId} aceptada.`, type: 'success' })
    } catch (err) {
      setMsg({ text: 'Error de conexión al aceptar solicitud', type: 'error' })
    } finally {
      setTimeout(() => setMsg({ text: '', type: '' }), 3000)
      setProcessingId(null)
    }
  }

  const printSolicitud = (solicitud) => {
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) return
    const retiraLabel = solicitud.retira_tipo === 'otro'
      ? `${solicitud.retira_nombre || '-'} - DNI ${solicitud.retira_dni || '-'}`
      : (solicitud.solicitante_nombre || 'Directivo')
    const fmtDate = v => v ? new Date(v).toLocaleDateString('es-AR') : '-'
    const itemsHtml = (solicitud.items || []).map(item =>
      `<tr>
        <td style="border:1px solid #d1d5db;padding:8px 10px">${item.producto_nombre}</td>
        <td style="border:1px solid #d1d5db;padding:8px 10px">${item.cantidad_entregada || item.cantidad_solicitada}</td>
        <td style="border:1px solid #d1d5db;padding:8px 10px">${item.unidad_medida || 'unidad'}</td>
      </tr>`
    ).join('')
    printWindow.document.write(`<!DOCTYPE html><html>
      <head><title>Comprobante #${solicitud.id}</title>
      <style>* { box-sizing: border-box; font-family: Arial, sans-serif; } body { margin: 24px; color: #111827; font-size: 13px; }</style>
      </head><body>
        <div style="display:flex;justify-content:space-between;border-bottom:2px solid #FF8200;padding-bottom:10px;margin-bottom:16px">
          <div><strong style="font-size:1.1rem">San Juan Gobierno</strong><br><span style="color:#666">Ministerio de Educaci\u00f3n</span></div>
          <div style="text-align:right"><strong style="font-size:1.1rem">Comprobante de entrega</strong><br><span style="color:#666">Solicitud #${solicitud.id}</span></div>
        </div>
        <p><strong>Pedido anual #${solicitud.id_pedido}</strong></p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
          <div><strong>Institución:</strong> ${solicitud.institucion_nombre}</div>
          <div><strong>CUE:</strong> ${solicitud.cue || '-'}</div>
          <div><strong>Fecha solicitada de retiro:</strong> ${fmtDate(solicitud.fecha_retiro)}</div>
          <div><strong>Fecha de entrega:</strong> ${fmtDate(solicitud.fecha_entrega)}</div>
          <div style="grid-column:1/-1"><strong>Retira:</strong> ${retiraLabel}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
          <thead><tr>
            <th style="border:1px solid #d1d5db;background:#f3f4f6;padding:8px 10px;text-align:left">Producto</th>
            <th style="border:1px solid #d1d5db;background:#f3f4f6;padding:8px 10px;text-align:left">Cantidad</th>
            <th style="border:1px solid #d1d5db;background:#f3f4f6;padding:8px 10px;text-align:left">Unidad</th>
          </tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-top:54px">
          <div style="border-top:1px solid #111827;padding-top:8px;text-align:center">Firma de quien entrega</div>
          <div style="border-top:1px solid #111827;padding-top:8px;text-align:center">Firma y sello del directivo</div>
        </div>
      </body></html>`)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => { printWindow.print(); printWindow.close() }, 250)
  }

  const printComprobante = () => {
    if (!printRef.current) return
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Comprobante de entrega</title>
          <style>
            * { box-sizing: border-box; font-family: Arial, sans-serif; }
            body { margin: 24px; color: #111827; font-size: 13px; }
            h2 { font-size: 18px; }
            table { page-break-inside: avoid; }
          </style>
        </head>
        <body>${printRef.current.innerHTML}</body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 250)
  }

  if (loading) {
    return <div className="sv-empty-state">Cargando solicitudes de retiro...</div>
  }

  return (
    <div style={{ marginTop: embedded ? 0 : 8 }}>
      {!embedded && <h2>Solicitudes de retiro</h2>}

      {msg.text && (
        <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`}>
          {msg.text}
        </div>
      )}

      {isDirectivo && (
        <>
          <form onSubmit={handleCreate} className="grid" style={{ marginTop: 16 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label>Pedido anual aprobado</label>
              <select
                value={selectedPedidoId}
                onChange={(event) => {
                  setSelectedPedidoId(event.target.value)
                  setCantidades({})
                }}
                required
              >
                <option value="">Seleccionar pedido...</option>
                {pedidos.map((pedido) => (
                  <option key={pedido.id} value={pedido.id}>
                    Pedido #{pedido.id} - {formatDate(pedido.fecha_creacion)}
                  </option>
                ))}
              </select>
            </div>

            {selectedPedido && (
              <div style={{ gridColumn: '1 / -1' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Saldo kit</th>
                      {!isDirectivo && <th>Stock</th>}
                      <th>Cantidad a retirar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPedido.items.map((item) => (
                      <tr key={item.producto_id}>
                        <td>{item.producto_nombre}</td>
                        <td>{item.cantidad_disponible_kit}</td>
                        {!isDirectivo && <td>{item.stock_actual}</td>}
                        <td>
                          <input
                            type="number"
                            min="0"
                            max={isDirectivo ? item.cantidad_disponible_kit : (item.cantidad_disponible_kit != null ? Math.min(item.cantidad_disponible_kit, item.stock_actual ?? Infinity) : (item.stock_actual ?? Infinity))}
                            value={cantidades[item.producto_id] || ''}
                            onChange={(event) => handleCantidadChange(item.producto_id, event.target.value)}
                            placeholder="0"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Historial moved to its own section below */}
              </div>
            )}

            <div>
              <label>Fecha de retiro</label>
              <input
                type="date"
                value={fechaRetiro}
                onChange={(event) => setFechaRetiro(event.target.value)}
                required
              />
            </div>
            <div>
              <label>Quien retira</label>
              <select value={retiraTipo} onChange={(event) => setRetiraTipo(event.target.value)}>
                <option value="directivo">Directivo</option>
                <option value="otro">Otro</option>
              </select>
            </div>

            {retiraTipo === 'otro' && (
              <>
                <div>
                  <label>DNI</label>
                  <input value={retiraDni} onChange={(event) => setRetiraDni(event.target.value)} required />
                </div>
                <div>
                  <label>Nombre y apellido</label>
                  <input value={retiraNombre} onChange={(event) => setRetiraNombre(event.target.value)} required />
                </div>
              </>
            )}

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={solicitarEnvio}
                  onChange={(event) => setSolicitarEnvio(event.target.checked)}
                />
                Solicitar envío
              </label>
              <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                Esta opción está disponible para escuelas de zona alejada.
              </div>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label>Observaciones</label>
              <input value={observaciones} onChange={(event) => setObservaciones(event.target.value)} />
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" style={{ width: 'auto', margin: 0 }}>Crear solicitud de retiro</button>
            </div>
          </form>

          <h3>Mis solicitudes pendientes</h3>
          <SolicitudesTable solicitudes={solicitudes.filter(s => s.estado !== 'entregado')} onSelectComprobante={setComprobante} />
        </>
      )}

      {isOperador && (
        <>
          {solicitudes.length === 0 ? (
            <div>
              <div className="sv-empty-state">No hay solicitudes de retiro pendientes.</div>
              <div style={{ marginTop: 12 }}>
                <button type="button" onClick={async () => {
                  setOperatorPedidosLoading(true)
                  try {
                    const res = await apiFetch('/api/entregas/pedidos-disponibles', { token })
                    if (res.ok) {
                      const data = await res.json()
                      setOperatorPedidos(data.pedidos || [])
                    } else {
                      setOperatorPedidos([])
                    }
                  } catch (_) {
                    setOperatorPedidos([])
                  } finally {
                    setOperatorPedidosLoading(false)
                  }
                }}>Ver pedidos con pendientes</button>
              </div>
              {operatorPedidosLoading ? (
                <p style={{ color: 'var(--muted)', marginTop: 12 }}>Cargando pedidos...</p>
              ) : operatorPedidos.length > 0 ? (
                <table style={{ marginTop: 12 }}>
                  <thead><tr><th>Pedido</th><th>Institución</th><th>Fecha</th><th>Items pendientes</th></tr></thead>
                  <tbody>
                    {operatorPedidos.map(p => (
                      <tr key={p.id}>
                        <td>#{p.id}</td>
                        <td>{p.institucion_nombre}</td>
                        <td>{formatDate(p.fecha_creacion)}</td>
                        <td>{p.items.filter(i => i.cantidad_pendiente > 0).length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </div>
          ) : (
            <SolicitudesTable
              solicitudes={solicitudes}
              onEntregar={handleEntregar}
              onAccept={handleAccept}
              processingId={processingId}
              onSelectComprobante={setComprobante}
            />
          )}
        </>
      )}

      {/* Historial de solicitudes entregadas */}
      {(() => {
        const historial = isDirectivo
          ? solicitudes.filter(s => s.estado === 'entregado')
          : historialEntregadas
        if (!historial.length) return null
        return (
          <div style={{ marginTop: 28 }}>
            <h3 style={{ marginBottom: 12 }}>Historial de solicitudes entregadas</h3>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Institución</th>
                  <th>Modalidad</th>
                  <th>Fecha retiro</th>
                  <th>Fecha entrega</th>
                  <th>Retira</th>
                  <th>Productos</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {historial.map(sol => (
                  <tr key={sol.id}>
                    <td>#{sol.id}</td>
                    <td>{sol.institucion_nombre}</td>
                    <td>{sol.solicitar_envio ? 'Envío' : 'Retiro'}</td>
                    <td>{formatDate(sol.fecha_retiro)}</td>
                    <td>{formatDate(sol.fecha_entrega)}</td>
                    <td>{buildRetiraLabel(sol)}</td>
                    <td>
                      {(sol.items || []).map(item => (
                        <div key={item.producto_id}>{item.producto_nombre}: {item.cantidad_entregada || item.cantidad_solicitada} {item.unidad_medida || 'unidad'}</div>
                      ))}
                    </td>
                    <td>
                      <button type="button" className="secondary" onClick={() => setComprobante(sol)} style={{ width: 'auto', margin: 0 }}>
                        Imprimir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })()}

      {comprobante && (
        <div style={{ marginTop: 18, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: '#f9fafb' }}>
            <strong>Comprobante solicitud #{comprobante.id}</strong>
            <button type="button" className="secondary" onClick={printComprobante} style={{ width: 'auto', margin: 0 }}>
              Imprimir comprobante
            </button>
          </div>
          <ForwardComprobante solicitud={comprobante} forwardedRef={printRef} />
        </div>
      )}
    </div>
  )
}

function SolicitudesTable({ solicitudes, onEntregar, onAccept, onViewHistory, processingId, onSelectComprobante }) {
  if (!solicitudes.length) {
    return <div className="sv-empty-state">No hay solicitudes registradas.</div>
  }

  return (
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Institucion</th>
          <th>Modalidad</th>
          <th>Fecha retiro</th>
          <th>Retira</th>
          <th>Productos</th>
          <th>Estado</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        {solicitudes.map((solicitud) => (
          <tr key={solicitud.id}>
            <td>#{solicitud.id}</td>
            <td>{solicitud.institucion_nombre}</td>
            <td>{solicitud.solicitar_envio ? 'Envío' : 'Retiro'}</td>
            <td>{formatDate(solicitud.fecha_retiro)}</td>
            <td>{buildRetiraLabel(solicitud)}</td>
            <td>
              {(solicitud.items || []).map((item) => (
                <div key={item.producto_id}>
                  {item.producto_nombre}: {item.cantidad_solicitada} {item.unidad_medida || 'unidad'}
                </div>
              ))}
            </td>
            <td><span className={`badge badge-estado-${solicitud.estado}`}>{solicitud.estado}</span></td>
            <td>
              <div className="inline-actions">
                {onAccept && solicitud.estado === 'pendiente' && (
                  <button
                    type="button"
                    onClick={() => onAccept(solicitud.id)}
                    disabled={processingId === solicitud.id}
                  >
                    {processingId === solicitud.id ? 'Aceptando...' : 'Aceptar solicitud'}
                  </button>
                )}
                {onEntregar && solicitud.estado === 'aceptada' && (
                  <button
                    type="button"
                    onClick={() => onEntregar(solicitud.id)}
                    disabled={processingId === solicitud.id}
                  >
                    {processingId === solicitud.id ? 'Confirmando...' : 'Marcar entrega'}
                  </button>
                )}
                {solicitud.estado === 'entregado' && (
                  <button type="button" className="secondary" onClick={() => onSelectComprobante?.(solicitud)}>
                    Comprobante
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
