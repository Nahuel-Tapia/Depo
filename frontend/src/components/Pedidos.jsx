import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'
import PrintButton from './PrintButton'
import SupervisorSolicitudes from './supervisor/SupervisorSolicitudes'



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
                <th>Producto</th>
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
                <label>Producto</label>
                <select value={form.producto_id} onChange={e => setForm({ ...form, producto_id: e.target.value })} required>
                  <option value="">Seleccionar producto...</option>
                  {productos.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre} ({p.unidad_medida || 'unidad'})</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Cantidad</label>
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
                    {canManage && pedido.estado === 'pendiente' && (
                      <>
                        <button onClick={() => handleAction(pedido.id, 'aprobar')} disabled={!stockSuficiente} title={!stockSuficiente ? 'Stock insuficiente para aprobar' : ''}>Aprobar</button>
                        <button onClick={() => handleAction(pedido.id, 'rechazar')}>Rechazar</button>
                      </>
                    )}
                    {canManage && pedido.estado !== 'entregado' && pedido.estado !== 'rechazado' && (
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
  const [productos, setProductos] = useState([])
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [form, setForm] = useState({ producto_id: '', cantidad: '', notas: '' })
  const [modalOpen, setModalOpen] = useState(false)
  const printRef = useRef(null)

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
      notas: form.notas.trim() || null,
      tipo: tab
    }
    const res = await apiFetch('/api/pedidos', { token, method: 'POST', body: JSON.stringify(payload) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMsg({ text: data.error || 'No se pudo crear el pedido', type: 'error' })
      return
    }
    setForm({ producto_id: '', cantidad: '', notas: '' })
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

  const pedidosFiltrados = pedidos.filter(p => (p.tipo || 'anual') === tab)

  const anioActual = new Date().getFullYear()
  // Solicitud anual activa = existe una del año en curso que no fue rechazada
  const tieneAnualActiva = pedidos.some(
    p => (p.tipo || 'anual') === 'anual' &&
         p.estado !== 'rechazado' &&
         new Date(p.created_at).getFullYear() === anioActual
  )
  const puedeCrearAnual = !tieneAnualActiva

  const badgeTab = (tipo) => {
    const count = pedidos.filter(p => (p.tipo || 'anual') === tipo && p.estado === 'pendiente').length
    return count > 0 ? <span style={{ marginLeft: 6, background: '#ef4444', color: '#fff', borderRadius: 99, fontSize: '0.7rem', padding: '1px 7px' }}>{count}</span> : null
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Mis Pedidos</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {(tab === 'refuerzo' || puedeCrearAnual) && (
            <button
              type="button"
              className="mov-action-btn"
              style={{ width: 'auto', margin: 0, padding: '14px 22px', fontSize: '1rem' }}
              onClick={() => { setModalOpen(true); setMsg({ text: '', type: '' }) }}
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
          ? 'Pedido anual planificado para cubrir las necesidades regulares de la institución. Solo se puede realizar uno por año.'
          : 'Pedidos extraordinarios para reforzar el stock cuando el pedido anual no fue suficiente.'}
      </p>

      {/* Aviso si ya existe solicitud anual */}
      {tab === 'anual' && tieneAnualActiva && (
        <div className="msg show" style={{ background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047', marginTop: 8 }}>
          Ya realizaste tu solicitud anual para {anioActual}. Podés hacer solicitudes de refuerzos si el stock no alcanza.
        </div>
      )}

      {msg.text && (
        <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`}>{msg.text}</div>
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
              <div>
                <label>Producto</label>
                <select value={form.producto_id} onChange={e => setForm({ ...form, producto_id: e.target.value })} required>
                  <option value="">Seleccionar producto...</option>
                  {productos.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre} ({p.unidad_medida || 'unidad'})</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Cantidad</label>
                <input type="number" value={form.cantidad} onChange={e => setForm({ ...form, cantidad: e.target.value })} placeholder="0" min="1" required />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label>Notas</label>
                <input type="text" value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} placeholder="Observaciones del pedido" />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="secondary" onClick={() => { setModalOpen(false); setForm({ producto_id: '', cantidad: '', notas: '' }) }}>
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
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pedidosFiltrados.map(pedido => (
                <tr key={pedido.id}>
                  <td>#{pedido.id}</td>
                  <td>{pedido.producto_nombre || '-'}</td>
                  <td>{pedido.cantidad}</td>
                  <td><span className={`badge badge-estado-${pedido.estado}`}>{pedido.estado}</span></td>
                  <td>{pedido.notas || '-'}</td>
                  <td>{new Date(pedido.created_at).toLocaleDateString('es-AR')}</td>
                  <td>
                    {pedido.estado === 'pendiente' && (
                      <button className="sv-btn-rechazar" style={{ margin: 0 }} onClick={() => handleCancelar(pedido.id)}>
                        Cancelar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
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
