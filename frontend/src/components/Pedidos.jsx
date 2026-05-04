import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'
import PrintButton from './PrintButton'
import SupervisorSolicitudes from './supervisor/SupervisorSolicitudes'

function normalizeLabelText(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function formatUnidad(unidad) {
  const value = String(unidad || '').trim().toLowerCase()
  if (!value || value === 'unidad') return 'Unidades'
  if (value === 'kg') return 'Kilogramos'
  if (value === 'l' || value === 'lt' || value === 'litro') return 'Litros'
  return normalizeLabelText(unidad)
}

function formatProductoOptionLabel(producto) {
  const nombre = normalizeLabelText(producto?.nombre) || 'Producto sin nombre'
  const unidad = formatUnidad(producto?.unidad_medida)
  return `${nombre} (${unidad})`
}



// ============================================================
// Vista Supervisor: Bandeja de aprobación de pedidos
// ============================================================
function SupervisorPedidos() {
  const { token, user } = useAuth()
  const printRef = useRef(null)

  const [instituciones, setInstituciones] = useState([])
  const [pedidosPendientes, setPedidosPendientes] = useState([])
  const [procesados, setProcesados] = useState([])
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [rechazandoId, setRechazandoId] = useState(null)
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [historialVisible, setHistorialVisible] = useState(null)
  const [historialData, setHistorialData] = useState([])
  const [busqueda, setBusqueda] = useState('')

  const loadData = async () => {
    try {
      const jurisdiccion = user?.jurisdiccion || ''
      const [instRes, pedRes] = await Promise.all([
        apiFetch(`/api/supervisor/instituciones?jurisdiccion=${encodeURIComponent(jurisdiccion)}`, { token }),
        apiFetch(`/api/supervisor/pedidos-pendientes?jurisdiccion=${encodeURIComponent(jurisdiccion)}`, { token }),
      ])
      if (instRes.ok) {
        const instData = await instRes.json()
        setInstituciones(instData.instituciones || [])
      }
      if (pedRes.ok) {
        const pedData = await pedRes.json()
        setPedidosPendientes(pedData.pedidos || [])
      }
    } catch (err) {
      console.error('Error cargando datos del supervisor:', err)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleAprobar = async (pedidoId) => {
    try {
      const res = await apiFetch(`/api/pedidos/${pedidoId}/estado`, { token, method: 'PATCH', body: JSON.stringify({ estado: 'aprobado' }) })
      if (!res.ok) {
        const err = await res.json()
        setMsg({ text: err.error || 'Error al aprobar pedido', type: 'error' })
        setTimeout(() => setMsg({ text: '', type: '' }), 3000)
        return
      }
      const pedido = pedidosPendientes.find(p => p.id === pedidoId)
      setPedidosPendientes(prev => prev.filter(p => p.id !== pedidoId))
      setProcesados(prev => [...prev, { ...pedido, estado: 'aprobado', fechaProcesado: new Date().toISOString() }])
      setMsg({ text: `Pedido #${pedidoId} aprobado correctamente`, type: 'success' })
    } catch (err) {
      setMsg({ text: 'Error de conexión al aprobar pedido', type: 'error' })
    }
    setTimeout(() => setMsg({ text: '', type: '' }), 3000)
  }

  const iniciarRechazo = (id) => { setRechazandoId(id); setMotivoRechazo('') }
  const cancelarRechazo = () => { setRechazandoId(null); setMotivoRechazo('') }

  const confirmarRechazo = async (pedidoId) => {
    if (!motivoRechazo.trim()) {
      setMsg({ text: 'Debe ingresar un motivo de rechazo', type: 'error' })
      setTimeout(() => setMsg({ text: '', type: '' }), 3000)
      return
    }
    try {
      const res = await apiFetch(`/api/pedidos/${pedidoId}/estado`, { token, method: 'PATCH', body: JSON.stringify({ estado: 'rechazado', motivo: motivoRechazo.trim() }) })
      if (!res.ok) {
        const err = await res.json()
        setMsg({ text: err.error || 'Error al rechazar pedido', type: 'error' })
        setTimeout(() => setMsg({ text: '', type: '' }), 3000)
        return
      }
      const pedido = pedidosPendientes.find(p => p.id === pedidoId)
      setPedidosPendientes(prev => prev.filter(p => p.id !== pedidoId))
      setProcesados(prev => [...prev, { ...pedido, estado: 'rechazado', motivo: motivoRechazo.trim(), fechaProcesado: new Date().toISOString() }])
      setMsg({ text: `Pedido #${pedidoId} rechazado`, type: 'success' })
    } catch (err) {
      setMsg({ text: 'Error de conexión al rechazar pedido', type: 'error' })
    }
    setRechazandoId(null); setMotivoRechazo('')
    setTimeout(() => setMsg({ text: '', type: '' }), 3000)
  }

  const verHistorial = async (institucionId) => {
    if (historialVisible === institucionId) { setHistorialVisible(null); setHistorialData([]); return }
    try {
      const res = await apiFetch(`/api/supervisor/instituciones/${institucionId}/historial`, { token })
      if (res.ok) {
        const data = await res.json()
        setHistorialData(data.eventos || [])
      } else {
        setHistorialData([])
      }
    } catch {
      setHistorialData([])
    }
    setHistorialVisible(institucionId)
  }

  const pedidosFiltrados = busqueda.trim()
    ? pedidosPendientes.filter(p => p.institucion.toLowerCase().includes(busqueda.toLowerCase()) || p.producto.toLowerCase().includes(busqueda.toLowerCase()))
    : pedidosPendientes

  return (
    <div className="supervisor-dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h2>Pedidos — Supervisor</h2>
        <PrintButton targetRef={printRef} title="Reporte Pedidos Supervisor" />
      </div>

      <div className="sv-jurisdiction-banner">
        <span className="sv-jurisdiction-dot"></span>
        <span>Jurisdicción: <strong>{user?.jurisdiccion || '-'}</strong></span>
        <span className="sv-jurisdiction-count">{instituciones.length} escuelas</span>
      </div>

      {msg.text && <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`}>{msg.text}</div>}

      <div ref={printRef}>
        <h3>Pedidos Pendientes de Aprobación</h3>

        <div style={{ marginBottom: 16, maxWidth: 400 }}>
          <input type="text" placeholder="Buscar por institución o producto..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ marginBottom: 0 }} />
        </div>

        {pedidosFiltrados.length === 0 ? (
          <div className="sv-empty-state">No hay pedidos pendientes en tu jurisdicción</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Institución</th>
                <th>Fecha</th>
                <th>Pedido</th>
                <th>Cantidad</th>
                <th>Solicitante</th>
                <th>Notas</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pedidosFiltrados.map(pedido => (
                <tr key={pedido.id}>
                  <td><strong>{pedido.institucion}</strong></td>
                  <td>{new Date(pedido.fecha).toLocaleDateString('es-AR')}</td>
                  <td>{pedido.producto}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{pedido.cantidad}</td>
                  <td>{pedido.solicitante}</td>
                  <td>{pedido.notas || '-'}</td>
                  <td>
                    {rechazandoId === pedido.id ? (
                      <div className="sv-rechazo-box">
                        <textarea className="sv-rechazo-input" placeholder="Motivo del rechazo..." value={motivoRechazo} onChange={e => setMotivoRechazo(e.target.value)} rows={2} />
                        <div className="inline-actions" style={{ marginTop: 6 }}>
                          <button onClick={() => confirmarRechazo(pedido.id)} className="sv-btn-confirmar-rechazo">Confirmar</button>
                          <button onClick={cancelarRechazo} className="secondary" style={{ margin: 0, minHeight: 'auto', padding: '6px 12px', fontSize: '0.75rem' }}>Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="inline-actions">
                        <button onClick={() => handleAprobar(pedido.id)}>Aprobar</button>
                        <button onClick={() => iniciarRechazo(pedido.id)} className="sv-btn-rechazar">Rechazar</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {procesados.length > 0 && (
          <>
            <h3>Procesados en esta sesión</h3>
            <table>
              <thead><tr><th>Institución</th><th>Producto</th><th>Cantidad</th><th>Estado</th><th>Motivo</th></tr></thead>
              <tbody>
                {procesados.map(p => (
                  <tr key={p.id}>
                    <td>{p.institucion}</td>
                    <td>{p.producto}</td>
                    <td style={{ textAlign: 'center' }}>{p.cantidad}</td>
                    <td><span className={`badge badge-estado-${p.estado}`}>{p.estado}</span></td>
                    <td>{p.motivo || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <h3>Escuelas de la Jurisdicción</h3>
        <div className="sv-instituciones-grid">
          {instituciones.map(inst => (
            <div key={inst.id} className="sv-inst-card">
              <div className="sv-inst-header">
                <span className="badge sv-badge-tipo-escuela">Escuela</span>
                <span className="sv-inst-cue">CUE: {inst.cue}</span>
              </div>
              <div className="sv-inst-nombre">{inst.nombre}</div>
              <button className="secondary sv-btn-historial" onClick={() => verHistorial(inst.id)}>
                {historialVisible === inst.id ? 'Ocultar historial' : 'Ver historial de retiros'}
              </button>
              {historialVisible === inst.id && (
                <div className="sv-historial-panel">
                  {historialData.length === 0 ? (
                    <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: '8px 0' }}>Sin registros</p>
                  ) : (
                    <table className="sv-historial-table">
                      <thead><tr><th>Fecha</th><th>Producto</th><th>Cantidad</th><th>Tipo</th></tr></thead>
                      <tbody>
                        {historialData.map((h, idx) => (
                          <tr key={idx}>
                            <td>{new Date(h.fecha).toLocaleDateString('es-AR')}</td>
                            <td>{h.producto}</td>
                            <td style={{ textAlign: 'center' }}>{h.cantidad}</td>
                            <td><span className={`badge badge-${h.tipo.toLowerCase()}`}>{h.tipo}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Vista Depósito: Gestión de pedidos (admin, operador, directivo)
// ============================================================
function DepositoPedidos() {
  const { token, user, hasPermission } = useAuth()
  const [pedidos, setPedidos] = useState([])
  const [productos, setProductos] = useState([])
  const [kits, setKits] = useState([])
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [form, setForm] = useState({ producto_id: '', cantidad: '', notas: '' })
  const [createModalOpen, setCreateModalOpen] = useState(false)

  const loadProductos = async () => {
    try {
      const res = await apiFetch('/api/productos', { token })
      if (res.ok) {
        const data = await res.json()
        setProductos(data.productos || [])
      }
    } catch { /* ignore */ }
  }

  const loadPedidos = async () => {
    try {
      const res = await apiFetch('/api/pedidos', { token })
      if (res.ok) {
        const data = await res.json()
        setPedidos(data.pedidos || [])
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    loadProductos()
    loadPedidos()
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setMsg({ text: '', type: '' })

    const payload = {
      producto_id: parseInt(form.producto_id, 10),
      cantidad: parseInt(form.cantidad, 10),
      notas: form.notas.trim() || null
    }

    const res = await apiFetch('/api/pedidos', {
      token,
      method: 'POST',
      body: JSON.stringify(payload)
    })

    const data = await res.json().catch(() => ({ }))
    if (!res.ok) {
      setMsg({ text: data.error || 'No se pudo crear el pedido', type: 'error' })
      return
    }

    setForm({ producto_id: '', cantidad: '', notas: '' })
    setCreateModalOpen(false)
    setMsg({ text: 'Pedido creado correctamente', type: 'success' })
    loadPedidos()
  }

  const handleAction = async (id, action) => {
    setMsg({ text: '', type: '' })

    let url = null
    let options = null

    if (action === 'cancelar') {
      url = `/api/pedidos/${id}/cancelar`
      options = { token, method: 'PATCH' }
    }
    if (action === 'aprobar') {
      url = `/api/pedidos/${id}/estado`
      options = { token, method: 'PATCH', body: JSON.stringify({ estado: 'aprobado' }) }
    }
    if (action === 'rechazar') {
      url = `/api/pedidos/${id}/estado`
      options = { token, method: 'PATCH', body: JSON.stringify({ estado: 'rechazado' }) }
    }
    if (action === 'entregar') {
      url = `/api/pedidos/${id}/estado`
      options = { token, method: 'PATCH', body: JSON.stringify({ estado: 'entregado' }) }
    }

    if (!url || !options) return

    const res = await apiFetch(url, options)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMsg({ text: data.error || 'No se pudo actualizar el pedido', type: 'error' })
      return
    }

    loadPedidos()
    loadProductos()
  }

  const canCreatePedido = hasPermission('pedidos.create') && user?.role === 'directivo'
  const canManage = hasPermission('pedidos.manage')
  const canSupervisorDecision = canManage && user?.role === 'supervisor'
  const canEntregar = canManage && user?.role !== 'supervisor'
  const productosOrdenados = [...productos].sort((a, b) =>
    String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es', { sensitivity: 'base' })
  )

  const printRef = useRef(null)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Gestión de Pedidos</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {canCreatePedido && (
            <button
              type="button"
              className="mov-action-btn"
              style={{ width: 'auto', margin: 0, padding: '14px 22px', fontSize: '1rem' }}
              onClick={() => {
                setCreateModalOpen(true)
                setMsg({ text: '', type: '' })
              }}
            >
              <span aria-hidden="true" style={{ marginRight: 8, fontSize: '1.2rem' }}>📝</span>
              Crear pedido
            </button>
          )}
          <PrintButton targetRef={printRef} title="Reporte de Pedidos" />
        </div>
      </div>

      {canCreatePedido && createModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16
          }}
          onClick={e => {
            if (e.target === e.currentTarget) {
              setCreateModalOpen(false)
            }
          }}
        >
          <div style={{ background: '#f9fafb', padding: 24, borderRadius: 10, width: 'min(760px, 100%)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0 }}>Nuevo pedido</h3>
            <form onSubmit={handleCreate} className="grid">
              <div>
                <label>Kit</label>
                <select value={form.kit_id} onChange={e => setForm({ ...form, kit_id: e.target.value, producto_id: e.target.value })} required>
                  <option value="">Seleccionar kit...</option>
                  {productosOrdenados.map(p => (
                    <option key={p.id} value={p.id}>{formatProductoOptionLabel(p)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Cantidad de kits</label>
                <input type="number" value={form.cantidad} onChange={e => setForm({ ...form, cantidad: e.target.value })} placeholder="0" min="1" required />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label>Notas</label>
                <input type="text" value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} placeholder="Observaciones del pedido" />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setCreateModalOpen(false)
                    setForm({ producto_id: '', cantidad: '', notas: '' })
                  }}
                >
                  Cancelar
                </button>
                <button type="submit">Crear pedido</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {msg.text && (
        <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`}>{msg.text}</div>
      )}

      <div ref={printRef}>

      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Cantidad</th>
            {canManage && <th>Stock Actual</th>}
            <th>Institución</th>
            <th>Estado</th>
            <th>Solicitado por</th>
            <th>Notas</th>
            <th>Fecha</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {pedidos.map(pedido => {
            const stockActual = Number(pedido.stock_actual || 0)
            const stockSuficiente = stockActual >= Number(pedido.cantidad || 0)
            const canCancel = hasPermission('pedidos.create') && pedido.estado === 'pendiente' && !canManage

            return (
              <tr key={pedido.id}>
                <td>{pedido.producto_nombre || '-'}</td>
                <td>{pedido.cantidad}</td>
                {canManage && <td>{stockActual}</td>}
                <td>{pedido.institucion || '-'}</td>
                <td><span className={`badge badge-estado-${pedido.estado}`}>{pedido.estado}</span></td>
                <td>{pedido.usuario_nombre || '-'}</td>
                <td>{pedido.notas || '-'}</td>
                <td>{new Date(pedido.created_at).toLocaleDateString()}</td>
                <td>
                  <div className="inline-actions">
                    {canSupervisorDecision && pedido.estado === 'pendiente' && (
                      <>
                        <button onClick={() => handleAction(pedido.id, 'aprobar')} disabled={!stockSuficiente} title={!stockSuficiente ? 'Stock insuficiente para aprobar' : ''}>Aprobar</button>
                        <button onClick={() => handleAction(pedido.id, 'rechazar')}>Rechazar</button>
                      </>
                    )}
                    {canEntregar && pedido.estado !== 'entregado' && pedido.estado !== 'rechazado' && pedido.estado !== 'cancelado' && (
                      <button onClick={() => handleAction(pedido.id, 'entregar')}>Entregar</button>
                    )}
                    {canCancel && (
                      <button onClick={() => handleAction(pedido.id, 'cancelar')}>Cancelar</button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
    </div>
  )
}

// ============================================================
// Vista Directivo: Solicitud Anual y Solicitud de Refuerzos
// ============================================================
function DirectivoPedidos() {
  const { token } = useAuth()
  const [tab, setTab] = useState('anual')
  const [pedidos, setPedidos] = useState([])
  const [kits, setKits] = useState([])
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [form, setForm] = useState({ kit_id: '', cantidad: '1', notas: '', items: {} })
  const [modalOpen, setModalOpen] = useState(false)
  const printRef = useRef(null)

  const loadKits = async () => {
    try {
      const res = await apiFetch('/api/pedidos/kits', { token })
      if (res.ok) {
        const data = await res.json()
        setKits(data.kits || [])
      }
    } catch { /* ignore */ }
  }

  const loadPedidos = async () => {
    try {
      const res = await apiFetch('/api/pedidos', { token })
      if (res.ok) {
        const data = await res.json()
        setPedidos(data.pedidos || [])
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    loadKits()
    loadPedidos()
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setMsg({ text: '', type: '' })

    let payload = {
      notas: form.notas.trim() || null,
      tipo: tab,
    }

    if (tab === 'refuerzo') {
      const items = Object.entries(form.items || {})
        .map(([productoId, cantidad]) => ({
          producto_id: parseInt(productoId, 10),
          cantidad: Number(cantidad)
        }))
        .filter((item) => Number.isInteger(item.producto_id) && item.producto_id > 0 && item.cantidad > 0)

      if (items.length === 0) {
        setMsg({ text: 'Debés indicar cantidad para al menos un producto', type: 'error' })
        return
      }

      payload = {
        ...payload,
        items
      }
    } else {
      payload = {
        ...payload,
        kit_id: parseInt(form.kit_id, 10),
        cantidad: parseInt(form.cantidad, 10),
      }
    }

    const res = await apiFetch('/api/pedidos', { token, method: 'POST', body: JSON.stringify(payload) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMsg({ text: data.error || 'No se pudo crear el pedido', type: 'error' })
      return
    }
    setForm({ kit_id: '', cantidad: '1', notas: '', items: {} })
    setModalOpen(false)
    setMsg({ text: 'Pedido creado correctamente', type: 'success' })
    loadPedidos()
  }

  const handleCancelar = async (id) => {
    setMsg({ text: '', type: '' })
    const res = await apiFetch(`/api/pedidos/${id}/cancelar`, { token, method: 'PATCH' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMsg({ text: data.error || 'No se pudo cancelar el pedido', type: 'error' })
      return
    }
    loadPedidos()
  }

  const getEstadoVisiblePedido = (pedido) => {
    if (pedido.estado === 'pendiente' && pedido.respuesta_supervisor_tipo === 'aclaracion') {
      return 'aclaracion'
    }
    return pedido.estado
  }

  const ApprovalStepper = ({ pedido }) => {
    const { estado, logistica } = pedido
    
    let steps = [
      { id: 'pendiente', label: 'Supervisor' },
      { id: 'pendiente_director', label: 'Director Área' },
      { id: 'aprobado', label: 'Autorizado' }
    ]

    if (pedido.tipo === 'anual' && logistica) {
      steps = [
        ...steps,
        { id: 'licitacion', label: 'Licitación' },
        { id: 'en_deposito', label: 'En Depósito' },
        { id: 'entregado', label: 'Entregado' }
      ]
    }

    const getStepStatus = (stepId, currentEstado, log) => {
      const order = ['pendiente', 'pendiente_director', 'aprobado', 'licitacion', 'en_deposito', 'entregado']
      let logicalEstado = currentEstado

      if (pedido.tipo === 'anual' && log && currentEstado === 'aprobado') {
        if (log.porcentaje_entrega >= 100) logicalEstado = 'entregado'
        else if (log.total_entregada > 0) logicalEstado = 'en_deposito' // Simplificación: si ya entregamos algo, es que ya pasó por depósito
        else if (log.estado_licitacion === 'en_deposito') logicalEstado = 'en_deposito'
        else if (log.estado_licitacion === 'adjudicada') logicalEstado = 'licitacion'
      }

      const currentIndex = order.indexOf(logicalEstado)
      const stepIndex = order.indexOf(stepId)

      if (currentEstado === 'rechazado' || currentEstado === 'cancelado') return 'error'
      if (stepIndex < currentIndex || logicalEstado === 'entregado') return 'completed'
      if (stepIndex === currentIndex) return 'active'
      return 'pending'
    }

    return (
      <div className="approval-stepper">
        {steps.map((step, idx) => {
          const status = getStepStatus(step.id, estado, logistica)
          return (
            <div key={step.id} className={`step ${status}`}>
              <div className="step-circle">
                {status === 'completed' ? '✓' : idx + 1}
              </div>
              <div className="step-label">{step.label}</div>
            </div>
          )
        })}
      </div>
    )
  }

  const formatEstadoPedido = (pedido) => {
    const { estado, logistica } = pedido
    if (estado === 'aclaracion') return 'Aclaración solicitada'
    if (estado === 'pendiente_director') return 'Aprobado por Supervisor'
    
    if (estado === 'aprobado' && logistica) {
      if (logistica.porcentaje_entrega >= 100) return 'Entregado (100%)'
      if (logistica.total_entregada > 0) return `Entrega Parcial (${logistica.porcentaje_entrega}%)`
      if (logistica.estado_licitacion === 'en_deposito') return 'En Depósito Central'
      if (logistica.estado_licitacion === 'adjudicada') return 'Licitación Adjudicada'
      return 'En Proceso de Licitación'
    }

    if (estado === 'aprobado') return 'Aprobado - Listo'
    if (estado === 'rechazado') return 'Rechazado'
    if (estado === 'cancelado') return 'Cancelado'
    if (estado === 'entregado') return 'Entregado'
    return 'Pendiente de Supervisor'
  }

  const pedidosFiltrados = pedidos.filter(p => (p.tipo || 'anual') === tab)
  const tieneKits = kits.length > 0
  const kitSeleccionado = kits.find((kit) => Number(kit.id) === Number(form.kit_id))
  const cantidadKits = Math.max(1, parseInt(form.cantidad, 10) || 1)
  const cargandoCupos = false
  const tieneProductosKit = tieneKits
  const anioActual = new Date().getFullYear()
  const pedidosAnualesDelAnio = pedidos.filter((pedido) => {
    if ((pedido.tipo || 'anual') !== 'anual' || !pedido.created_at) return false
    return new Date(pedido.created_at).getFullYear() === anioActual
  })
  const pedidoAnualBloqueante = pedidosAnualesDelAnio.find((pedido) => {
    const estadoVisible = getEstadoVisiblePedido(pedido)
    return estadoVisible === 'pendiente' || estadoVisible === 'aprobado' || estadoVisible === 'entregado'
  }) || null
  const pedidoAnualConAclaracion = pedidosAnualesDelAnio.find(
    pedido => getEstadoVisiblePedido(pedido) === 'aclaracion'
  ) || null
  const puedeCrearAnual = tieneKits && !pedidoAnualBloqueante
  const puedeCrearRefuerzo = tieneKits
  const kitAsignado = kits.length === 1 ? kits[0] : kitSeleccionado
  const productosKitOrdenados = kits.map((kit) => ({
    id: kit.id,
    nombre: kit.nombre,
    unidad_medida: kit.tipo_escuela_label
  }))
  const textoBloqueoAnual = pedidoAnualBloqueante
    ? getEstadoVisiblePedido(pedidoAnualBloqueante) === 'pendiente'
      ? `Ya enviaste la solicitud anual #${pedidoAnualBloqueante.id}. Vas a poder generar otra si el supervisor la rechaza o te pide una aclaracion.`
      : `Tu escuela ya tiene una solicitud anual registrada este ano (#${pedidoAnualBloqueante.id}).`
    : ''

  const badgeTab = (tipo) => {
    const count = pedidos.filter(p => (p.tipo || 'anual') === tipo && getEstadoVisiblePedido(p) === 'pendiente').length
    return count > 0 ? <span style={{ marginLeft: 6, background: '#ef4444', color: '#fff', borderRadius: 99, fontSize: '0.7rem', padding: '1px 7px' }}>{count}</span> : null
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Mis Pedidos</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {((tab === 'refuerzo' && puedeCrearRefuerzo) || (tab === 'anual' && tieneKits)) && (
            <button
              type="button"
              className="mov-action-btn"
              disabled={tab === 'anual' && !puedeCrearAnual}
              title={tab === 'anual' && !puedeCrearAnual ? textoBloqueoAnual : undefined}
              style={{
                width: 'auto',
                margin: 0,
                padding: '14px 22px',
                fontSize: '1rem',
                opacity: tab === 'anual' && !puedeCrearAnual ? 0.6 : 1,
                cursor: tab === 'anual' && !puedeCrearAnual ? 'not-allowed' : 'pointer'
              }}
              onClick={() => {
                if (tab === 'anual' && !puedeCrearAnual) return
                setModalOpen(true)
                setMsg({ text: '', type: '' })
              }}
            >
              <span aria-hidden="true" style={{ marginRight: 8, fontSize: '1.2rem' }}>📝</span>
              Nueva solicitud
            </button>
          )}
          <PrintButton targetRef={printRef} title="Reporte de Pedidos" />
        </div>
      </div>

      {/* Pestañas */}
      <div style={{ display: 'flex', gap: 4, marginTop: 20, borderBottom: '2px solid var(--border)' }}>
        {[
          { key: 'anual', label: 'Solicitud Anual' },
          { key: 'refuerzo', label: 'Solicitud de Refuerzos' }
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            style={{
              background: tab === key ? 'var(--primary, #2563eb)' : 'transparent',
              color: tab === key ? '#fff' : 'var(--muted)',
              border: 'none',
              borderRadius: '6px 6px 0 0',
              padding: '10px 22px',
              fontWeight: tab === key ? 700 : 400,
              cursor: 'pointer',
              fontSize: '0.97rem',
              transition: 'background 0.15s'
            }}
          >
            {label}{badgeTab(key)}
          </button>
        ))}
      </div>

      {/* Descripción contextual */}
      <p style={{ marginTop: 12, marginBottom: 4, color: 'var(--muted)', fontSize: '0.9rem' }}>
        {tab === 'anual'
          ? 'Pedido anual planificado según el kit asignado a la escuela.'
          : 'Pedidos extraordinarios para reforzar el stock cuando el pedido anual no fue suficiente.'}
      </p>

      {tab === 'anual' && (
        <div className="msg show" style={{ background: '#ecfeff', color: '#155e75', border: '1px solid #67e8f9', marginTop: 8 }}>
          Pedido anual por kit: al seleccionar un kit se enviará el conjunto completo de productos configurados.
        </div>
      )}

      {tab === 'anual' && pedidoAnualBloqueante && (
        <div className="msg show msg-error">
          {textoBloqueoAnual}
        </div>
      )}

      {tab === 'anual' && !pedidoAnualBloqueante && pedidoAnualConAclaracion && (
        <div className="msg show" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', marginTop: 8 }}>
          El supervisor respondio la solicitud anual #{pedidoAnualConAclaracion.id}. Podes enviar una nueva solicitud anual.
          {pedidoAnualConAclaracion.motivo_supervisor && (
            <div style={{ marginTop: 6 }}>
              <strong>Observacion:</strong> {pedidoAnualConAclaracion.motivo_supervisor}
            </div>
          )}
        </div>
      )}

      {!cargandoCupos && !tieneProductosKit && (
        <div className="msg show msg-error">
          Tu escuela no tiene kits asignados. Contactá al director de área o al administrador para configurarlos.
        </div>
      )}

      {msg.text && (
        <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`}>{msg.text}</div>
      )}

      {/* Sección de Pedidos Listos para Retirar */}
      {tab === 'anual' && pedidos.some(p => p.estado === 'aprobado' && (p.tipo || 'anual') === 'anual') && (
        <div className="fade-in" style={{ marginTop: 24, padding: '24px 30px', background: 'var(--surface-gradient)', border: '1px solid #dcfce7', borderRadius: 16, boxShadow: 'var(--shadow-premium)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h3 style={{ marginTop: 0, color: '#166534', display: 'flex', alignItems: 'center', gap: 10, fontSize: '1.4rem' }}>
                <span style={{ fontSize: '1.8rem' }}>🎉</span> ¡Solicitud Anual Aprobada!
              </h3>
              <p style={{ color: '#166534', fontWeight: 500, margin: 0, opacity: 0.8 }}>
                Tu pedido ha pasado todas las etapas de validación. Ya podés retirar tus insumos.
              </p>
            </div>
            <div style={{ background: '#dcfce7', padding: '12px 20px', borderRadius: 12, textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>Estado Final</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#166534' }}>LISTO PARA RETIRO</div>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginTop: 20 }}>
            {pedidos
              .filter(p => p.estado === 'aprobado' && (p.tipo || 'anual') === 'anual')
              .flatMap(p => p.items || [])
              .map((item, idx) => (
                <div key={idx} style={{ background: '#fff', padding: '16px 20px', borderRadius: 12, border: '1px solid #f0fdf4', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'transform 0.2s' }} className="stat-card-clickable">
                  <div>
                    <div style={{ fontWeight: 700, color: '#111827', fontSize: '1rem' }}>{item.producto_nombre}</div>
                    <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{item.unidad_medida || 'unidades'}</div>
                  </div>
                  <div style={{ background: '#f0fdf4', color: '#166534', fontSize: '1.4rem', fontWeight: 800, padding: '4px 12px', borderRadius: 8 }}>
                    {item.cantidad}
                  </div>
                </div>
              ))}
          </div>
          <div style={{ marginTop: 24, textAlign: 'right' }}>
            <button className="secondary" style={{ borderRadius: 8 }} onClick={() => window.print()}>
              🖨️ Descargar Comprobante de Retiro
            </button>
          </div>
        </div>
      )}

      {/* Modal nuevo pedido */}
      {modalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}
        >
          <div style={{ background: '#f9fafb', padding: 24, borderRadius: 10, width: 'min(760px, 100%)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0 }}>
              Nueva {tab === 'anual' ? 'Solicitud Anual' : 'Solicitud de Refuerzos'}
            </h3>
            <form onSubmit={handleCreate} className="grid">
              {tab === 'anual' ? (
                <>
                  <div>
                    <label>Kit</label>
                    <select value={form.kit_id} onChange={e => setForm({ ...form, kit_id: e.target.value })} required>
                      <option value="">Seleccionar kit...</option>
                      {kits.map(k => (
                        <option key={k.id} value={k.id}>{k.nombre}</option>
                      ))}
                    </select>
                  </div>
                  {kitSeleccionado && (
                    <div className="msg show" style={{ gridColumn: '1 / -1', marginBottom: 0, background: '#eff6ff', color: '#1e3a8a', border: '1px solid #93c5fd' }}>
                      <strong>{kitSeleccionado.nombre}</strong>
                      <div style={{ marginTop: 8 }}>
                        <b>Detalle de productos del kit:</b>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {(kitSeleccionado.items || []).map((item) => (
                            <li key={`${kitSeleccionado.id}-${item.producto_id}`}>
                              {item.producto_nombre}: {Number(item.cantidad) * cantidadKits} {item.unidad_medida || 'unidad'}
                            </li>
                          ))}
                        </ul>
                        {kitSeleccionado.cantidad_alumnos && (
                          <div style={{ marginTop: 6 }}>
                            <b>Cantidad de alumnos para este kit:</b> {kitSeleccionado.cantidad_alumnos}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div>
                    <label>Cantidad de kits</label>
                    <input type="number" value={form.cantidad} onChange={e => setForm({ ...form, cantidad: e.target.value })} placeholder="0" min="1" required />
                  </div>
                </>
              ) : (
                <>
                  <div className="msg show" style={{ gridColumn: '1 / -1', marginBottom: 0, background: '#ecfeff', color: '#155e75', border: '1px solid #67e8f9' }}>
                    Vas a solicitar <b>productos individuales</b> del kit asignado a tu escuela.
                  </div>

                  {!kitAsignado ? (
                    <div className="msg show msg-error" style={{ gridColumn: '1 / -1' }}>
                      Tu escuela no tiene kit asignado. Contactá al director de área.
                    </div>
                  ) : (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>{kitAsignado.nombre}</div>
                      {(kitAsignado.items || []).length === 0 ? (
                        <div className="msg show msg-error">
                          El kit asignado no tiene productos configurados.
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10 }}>
                          {(kitAsignado.items || []).map((item) => (
                            <div key={`${kitAsignado.id}-${item.producto_id}`} style={{ display: 'contents' }}>
                              <div style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, background: '#fff' }}>
                                <div style={{ fontWeight: 600 }}>{item.producto_nombre}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                                  Unidad: {item.unidad_medida || 'unidad'}
                                </div>
                              </div>
                              <div>
                                <label style={{ display: 'block' }}>Cantidad</label>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={form.items?.[String(item.producto_id)] ?? ''}
                                  onChange={(e) => {
                                    const value = e.target.value
                                    setForm((prev) => ({
                                      ...prev,
                                      items: {
                                        ...(prev.items || {}),
                                        [String(item.producto_id)]: value
                                      }
                                    }))
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
              <div style={{ gridColumn: '1 / -1' }}>
                <label>Notas</label>
                <input type="text" value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} placeholder="Observaciones del pedido" />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="secondary" onClick={() => { setModalOpen(false); setForm({ kit_id: '', cantidad: '1', notas: '', items: {} }) }}>
                  Cancelar
                </button>
                <button type="submit">Crear solicitud</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div ref={printRef} style={{ marginTop: 16 }}>
        {pedidosFiltrados.length === 0 ? (
          <div className="sv-empty-state">
            No hay {tab === 'anual' ? 'solicitudes anuales' : 'solicitudes de refuerzos'} registradas.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Estado</th>
                <th>Notas</th>
                <th>Fecha</th>
                <th>Progreso</th>
                <th>Detalle</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pedidosFiltrados.map(pedido => {
                const estadoVisible = getEstadoVisiblePedido(pedido)
                return (
                  <tr key={pedido.id}>
                    <td>#{pedido.id}</td>
                    <td>{pedido.producto_nombre || '-'}</td>
                    <td>{pedido.cantidad}</td>
                    <td>
                      <span className={`badge-premium badge-${estadoVisible}`}>
                        {formatEstadoPedido(pedido)}
                      </span>
                    </td>
                    <td>
                      {pedido.notas || '-'}
                      {pedido.motivo_supervisor && (
                        <div style={{ marginTop: 6, fontSize: '0.85rem', color: estadoVisible === 'aclaracion' ? '#1d4ed8' : '#991b1b' }}>
                          <strong>{estadoVisible === 'aclaracion' ? 'Replica del supervisor:' : 'Respuesta del supervisor:'}</strong> {pedido.motivo_supervisor}
                        </div>
                      )}
                    </td>
                    <td>{new Date(pedido.created_at).toLocaleDateString('es-AR')}</td>
                    <td style={{ minWidth: 200 }}><ApprovalStepper pedido={pedido} /></td>
                    <td>{pedido.resumen_items || '-'}</td>
                    <td>
                      {pedido.estado === 'pendiente' && (
                        <button className="sv-btn-rechazar" style={{ margin: 0 }} onClick={() => handleCancelar(pedido.id)}>
                          Cancelar
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Export: muestra la vista correcta según el rol
// ============================================================
export default function Pedidos() {
  const { user } = useAuth()

  if (user?.role === 'supervisor') {
    return <SupervisorSolicitudes />
  }

  if (user?.role === 'directivo') {
    return <DirectivoPedidos />
  }

  return <DepositoPedidos />
}
