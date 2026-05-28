import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch, API_URL } from '../api'

export default function Bajas() {
  const { token, hasPermission } = useAuth()
  const [bajas, setBajas] = useState([])
  const [productos, setProductos] = useState([])
  const [depositos, setDepositos] = useState([])
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [loading, setLoading] = useState(false)

  // Filtros
  const [filterDeposito, setFilterDeposito] = useState('')
  const [filterProducto, setFilterProducto] = useState('')
  const [filterDesde, setFilterDesde] = useState('')
  const [filterHasta, setFilterHasta] = useState('')

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    depositoId: '',
    productoId: '',
    totalInspeccionado: '',
    unidadesDanadas: '',
    motivo: '',
    fotoFile: null,
  })
  const [stockDisponible, setStockDisponible] = useState(null)
  const [loadingStock, setLoadingStock] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Preview de foto
  const [fotoModalOpen, setFotoModalOpen] = useState(false)
  const [fotoModalSrc, setFotoModalSrc] = useState('')
  const [fotoModalError, setFotoModalError] = useState('')

  // Historial
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [historialBaja, setHistorialBaja] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const canCreate = hasPermission('movimientos.create')
  const canAuthorize = hasPermission('bajas.authorize')

  // ─── Loaders ───
  const loadBajas = useCallback(async (opts = {}) => {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      const dep = opts.id_deposito ?? filterDeposito
      const prod = opts.producto_id ?? filterProducto
      const desde = opts.desde ?? filterDesde
      const hasta = opts.hasta ?? filterHasta

      if (dep) q.append('id_deposito', dep)
      if (prod) q.append('producto_id', prod)
      if (desde) q.append('desde', desde)
      if (hasta) q.append('hasta', hasta)

      const qs = q.toString() ? `?${q.toString()}` : ''
      const res = await apiFetch(`/api/movimientos/bajas${qs}`, { token })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setBajas([])
        setMsg({ text: data.error || 'No se pudo cargar el historial de bajas', type: 'error' })
        return
      }
      const data = await res.json()
      setBajas(data.bajas || [])
      setMsg(prev => prev.type === 'error' ? { text: '', type: '' } : prev)
    } catch {
      setBajas([])
      setMsg({ text: 'Error de red al cargar el historial de bajas', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [token, filterDeposito, filterProducto, filterDesde, filterHasta])

  const loadProductos = useCallback(async () => {
    try {
      const res = await apiFetch('/api/productos', { token })
      if (res.ok) {
        const data = await res.json()
        setProductos(data.productos || [])
      }
    } catch { /* ignore */ }
  }, [token])

  const loadDepositos = useCallback(async () => {
    try {
      const res = await apiFetch('/api/depositos', { token })
      if (res.ok) {
        const data = await res.json()
        setDepositos(data.depositos || data || [])
      }
    } catch { /* ignore */ }
  }, [token])

  useEffect(() => {
    loadBajas()
    loadProductos()
    loadDepositos()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Cargar stock del depósito cuando cambian depósito o producto
  useEffect(() => {
    if (!form.depositoId || !form.productoId) {
      setStockDisponible(null)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoadingStock(true)
      try {
        const res = await apiFetch(`/api/depositos/${form.depositoId}/stock`, { token })
        if (res.ok && !cancelled) {
          const data = await res.json()
          const items = data.stock || []
          const found = items.find(i => String(i.id) === String(form.productoId))
          setStockDisponible(found ? Number(found.cantidad) : 0)
        }
      } catch { if (!cancelled) setStockDisponible(null) }
      if (!cancelled) setLoadingStock(false)
    })()
    return () => { cancelled = true }
  }, [form.depositoId, form.productoId, token])

  // ─── Handlers ───
  const handleFilterApply = () => loadBajas()
  const handleFilterClear = () => {
    setFilterDeposito('')
    setFilterProducto('')
    setFilterDesde('')
    setFilterHasta('')
    loadBajas({ id_deposito: '', producto_id: '', desde: '', hasta: '' })
  }

  const openModal = () => {
    setForm({ depositoId: '', productoId: '', totalInspeccionado: '', unidadesDanadas: '', motivo: '', fotoFile: null })
    setStockDisponible(null)
    setMsg({ text: '', type: '' })
    setModalOpen(true)
  }

  const unidadesBuenas = () => {
    const total = parseInt(form.totalInspeccionado, 10) || 0
    const danadas = parseInt(form.unidadesDanadas, 10) || 0
    return Math.max(0, total - danadas)
  }

  const validarFormulario = () => {
    if (!form.depositoId) return 'Seleccioná un depósito'
    if (!form.productoId) return 'Seleccioná un producto'
    const total = parseInt(form.totalInspeccionado, 10)
    const danadas = parseInt(form.unidadesDanadas, 10)
    if (!total || total <= 0) return 'El total inspeccionado debe ser mayor a 0'
    if (!danadas || danadas <= 0) return 'Las unidades dañadas deben ser mayor a 0'
    if (danadas > total) return 'Las unidades dañadas no pueden superar el total inspeccionado'
    if (stockDisponible !== null && danadas > stockDisponible) {
      return `Stock insuficiente en el depósito. Disponible: ${stockDisponible}`
    }
    if (!form.motivo.trim()) return 'Indicá el motivo de la baja'
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const error = validarFormulario()
    if (error) { setMsg({ text: error, type: 'error' }); return }

    if (!form.fotoFile) {
      setMsg({ text: 'La fotografía de evidencia es obligatoria', type: 'error' }); 
      return;
    }

    setSubmitting(true)
    setMsg({ text: '', type: '' })

    const fd = new FormData()
    fd.append('producto_id', form.productoId)
    fd.append('cantidad', parseInt(form.unidadesDanadas, 10))
    fd.append('id_deposito', form.depositoId)
    fd.append('motivo', form.motivo)
    if (form.fotoFile) fd.append('foto', form.fotoFile)

    try {
      const res = await apiFetch('/api/movimientos/baja', {
        method: 'POST',
        token,
        body: fd
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setMsg({ text: data.error || 'Error al registrar la baja', type: 'error' })
        setSubmitting(false)
        return
      }

      setModalOpen(false)
      setMsg({ text: '✅ Baja registrada correctamente', type: 'success' })
      loadBajas()
      loadProductos()
    } catch {
      setMsg({ text: 'Error de red al registrar la baja', type: 'error' })
    }
    setSubmitting(false)
  }

  const handleFotoChange = (e) => {
    setForm(prev => ({ ...prev, fotoFile: e.target.files?.[0] || null }))
  }

  const openFotoModal = (fotoPath) => {
    setFotoModalError('')
    setFotoModalSrc(`${API_URL}${fotoPath}`)
    setFotoModalOpen(true)
  }

  const handleAuthorize = async (id, accion) => {
    if (!window.confirm(`¿Estás seguro de ${accion} esta solicitud de baja?`)) return
    
    setLoading(true)
    try {
      const res = await apiFetch(`/api/movimientos/bajas/${id}/autorizar`, {
        method: 'POST',
        token,
        body: JSON.stringify({ accion }),
        headers: { 'Content-Type': 'application/json' }
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setMsg({ text: data.error || `Error al ${accion} la baja`, type: 'error' })
      } else {
        setMsg({ text: `Baja ${accion === 'aprobar' ? 'aprobada' : 'rechazada'} correctamente`, type: 'success' })
        loadBajas()
      }
    } catch {
      setMsg({ text: 'Error de red al autorizar la baja', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const loadHistorial = async (bajaId) => {
    setLoadingHistory(true)
    setHistoryModalOpen(true)
    try {
      const res = await apiFetch(`/api/movimientos/bajas/${bajaId}/historial`, { token })
      if (res.ok) {
        const data = await res.json()
        setHistorialBaja(data.historial || [])
      } else {
        setHistorialBaja([])
      }
    } catch {
      setHistorialBaja([])
    } finally {
      setLoadingHistory(false)
    }
  }

  const fmtDate = (d) => d ? new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'

  // ─── Render ───
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0 }}>Bajas y Material Dañado</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>
            Registro de mercadería dañada, descartada o dada de baja del stock
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="mov-action-btn"
            style={{ width: 'auto', margin: 0, padding: '14px 22px', fontSize: '1rem' }}
            onClick={openModal}
          >
            <span aria-hidden="true" style={{ marginRight: 8, fontSize: '1.2rem' }}>🚫📦</span>
            Registrar Baja
          </button>
        )}
      </div>

      {/* Mensaje */}
      {msg.text && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 16,
          background: msg.type === 'error' ? '#fef2f2' : '#ecfdf5',
          color: msg.type === 'error' ? '#b91c1c' : '#065f46',
          fontWeight: 500,
          fontSize: '0.92rem',
          border: `1px solid ${msg.type === 'error' ? '#fecaca' : '#bbf7d0'}`
        }}>
          {msg.text}
        </div>
      )}

      {/* Filtros */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 12,
        padding: 16,
        background: '#f8fafc',
        borderRadius: 10,
        marginBottom: 20,
        border: '1px solid var(--border)'
      }}>
        <div>
          <label style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600, letterSpacing: 0.3 }}>Depósito</label>
          <select value={filterDeposito} onChange={e => setFilterDeposito(e.target.value)} style={{ margin: 0 }}>
            <option value="">Todos</option>
            {depositos.map(d => (
              <option key={d.id} value={d.id}>{d.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600, letterSpacing: 0.3 }}>Producto</label>
          <select value={filterProducto} onChange={e => setFilterProducto(e.target.value)} style={{ margin: 0 }}>
            <option value="">Todos</option>
            {productos.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600, letterSpacing: 0.3 }}>Desde</label>
          <input type="date" value={filterDesde} onChange={e => setFilterDesde(e.target.value)} style={{ margin: 0 }} />
        </div>
        <div>
          <label style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600, letterSpacing: 0.3 }}>Hasta</label>
          <input type="date" value={filterHasta} onChange={e => setFilterHasta(e.target.value)} style={{ margin: 0 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <button type="button" onClick={handleFilterApply} style={{ margin: 0, padding: '10px 16px', width: 'auto' }}>Filtrar</button>
          <button type="button" className="secondary" onClick={handleFilterClear} style={{ margin: 0, padding: '10px 16px', width: 'auto' }}>Limpiar</button>
        </div>
      </div>

      {/* Tabla de historial */}
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Depósito</th>
              <th>Motivo</th>
              <th>Operador</th>
              <th>Foto</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={canAuthorize ? "9" : "8"} style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>Cargando...</td></tr>
            ) : bajas.length === 0 ? (
              <tr><td colSpan={canAuthorize ? "9" : "8"} style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>No hay bajas registradas</td></tr>
            ) : (
              bajas.map(b => (
                <tr key={b.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(b.created_at)}</td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{b.producto_nombre || '-'}</span>
                    {b.unidad_medida && <span style={{ color: 'var(--muted)', fontSize: '0.85rem', marginLeft: 4 }}>({b.unidad_medida})</span>}
                  </td>
                  <td>
                    <span className="badge" style={{ background: '#fef2f2', color: '#b91c1c', fontWeight: 700 }}>
                      −{b.cantidad}
                    </span>
                  </td>
                  <td>{b.deposito_nombre || '-'}</td>
                  <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.motivo || '-'}</td>
                  <td>{b.usuario_nombre || '-'}</td>
                  <td>
                    {b.foto_path ? (
                      <button
                        type="button"
                        onClick={() => openFotoModal(b.foto_path)}
                        style={{
                          background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                          padding: '4px 10px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--orange)',
                          fontWeight: 600, margin: 0, width: 'auto', minHeight: 0
                        }}
                      >
                        📷 Ver
                      </button>
                    ) : (
                      <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>—</span>
                    )}
                  </td>
                  <td>
                    <span className="badge" style={{
                      background: b.estado === 'pendiente' ? '#fffbeb' : b.estado === 'aprobada' ? '#ecfdf5' : '#fef2f2',
                      color: b.estado === 'pendiente' ? '#b45309' : b.estado === 'aprobada' ? '#065f46' : '#b91c1c',
                      fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem'
                    }}>
                      {b.estado || 'aprobada'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => loadHistorial(b.id)}
                        title="Ver Historial"
                        style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, width: 'auto', margin: 0, minHeight: 0 }}
                      >
                        🕒
                      </button>
                      {canAuthorize && b.estado === 'pendiente' && (
                        <>
                          <button
                            type="button"
                            title="Aprobar"
                            onClick={() => handleAuthorize(b.id, 'aprobar')}
                            style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, width: 'auto', margin: 0, minHeight: 0 }}
                          >
                            ✅
                          </button>
                          <button
                            type="button"
                            title="Rechazar"
                            onClick={() => handleAuthorize(b.id, 'rechazar')}
                            style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, width: 'auto', margin: 0, minHeight: 0 }}
                          >
                            ❌
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Modal de registro ─── */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 16
          }}
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}
        >
          <div style={{
            background: '#fff', padding: 0, borderRadius: 14, width: 'min(660px, 100%)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            {/* Header */}
            <div style={{
              padding: '18px 24px', borderBottom: '1px solid var(--border)',
              background: '#fef2f2', borderRadius: '14px 14px 0 0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>🚫 Registrar Baja de Mercadería</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{
                  background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer',
                  color: 'var(--muted)', padding: 4, width: 36, height: 36,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 6, margin: 0, minHeight: 0
                }}
              >×</button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} style={{ padding: 24 }}>
              <div className="grid" style={{ gap: 16 }}>
                {/* Depósito */}
                <div>
                  <label>Depósito de origen</label>
                  <select
                    value={form.depositoId}
                    onChange={e => setForm(prev => ({ ...prev, depositoId: e.target.value }))}
                    required
                  >
                    <option value="">Seleccionar depósito...</option>
                    {depositos.map(d => (
                      <option key={d.id} value={d.id}>{d.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Producto */}
                <div>
                  <label>Producto</label>
                  <select
                    value={form.productoId}
                    onChange={e => setForm(prev => ({ ...prev, productoId: e.target.value }))}
                    required
                  >
                    <option value="">Seleccionar producto...</option>
                    {productos.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}{p.marca ? ` - ${p.marca}` : ''} ({p.unidad_medida || 'unidad'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Stock info */}
                {form.depositoId && form.productoId && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', borderRadius: 8,
                      background: stockDisponible === 0 ? '#fef2f2' : '#f0fdf4',
                      border: `1px solid ${stockDisponible === 0 ? '#fecaca' : '#bbf7d0'}`
                    }}>
                      <span style={{ fontSize: '1.2rem' }}>{loadingStock ? '⏳' : stockDisponible === 0 ? '⚠️' : '📦'}</span>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: stockDisponible === 0 ? '#b91c1c' : '#065f46' }}>
                        {loadingStock ? 'Consultando stock...' : `Stock disponible en depósito: ${stockDisponible ?? '—'} unidades`}
                      </span>
                    </div>
                  </div>
                )}

                {/* Total inspeccionado */}
                <div>
                  <label>Total inspeccionado</label>
                  <input
                    type="number"
                    min="1"
                    max={stockDisponible ?? undefined}
                    placeholder="Cantidad total analizada"
                    value={form.totalInspeccionado}
                    onChange={e => setForm(prev => ({ ...prev, totalInspeccionado: e.target.value }))}
                    required
                  />
                </div>

                {/* Unidades dañadas */}
                <div>
                  <label>Unidades dañadas (a dar de baja)</label>
                  <input
                    type="number"
                    min="1"
                    max={form.totalInspeccionado || undefined}
                    placeholder="Unidades en mal estado"
                    value={form.unidadesDanadas}
                    onChange={e => setForm(prev => ({ ...prev, unidadesDanadas: e.target.value }))}
                    required
                  />
                </div>

                {/* Resumen inspección */}
                {(parseInt(form.totalInspeccionado, 10) > 0 || parseInt(form.unidadesDanadas, 10) > 0) && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10,
                      padding: 14, borderRadius: 8, background: '#f8fafc',
                      border: '1px solid var(--border)'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600, letterSpacing: 0.4, marginBottom: 4 }}>
                          Inspeccionadas
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--dark)' }}>
                          {parseInt(form.totalInspeccionado, 10) || 0}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600, letterSpacing: 0.4, marginBottom: 4 }}>
                          Buen estado
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#065f46' }}>
                          {unidadesBuenas()}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600, letterSpacing: 0.4, marginBottom: 4 }}>
                          Dañadas (baja)
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#b91c1c' }}>
                          {parseInt(form.unidadesDanadas, 10) || 0}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Motivo */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label>Detalle / Motivo del daño</label>
                  <textarea
                    value={form.motivo}
                    onChange={e => setForm(prev => ({ ...prev, motivo: e.target.value }))}
                    rows={3}
                    placeholder="Describa el motivo de la baja: tipo de daño, circunstancia, etc."
                    required
                    style={{ resize: 'vertical', minHeight: 72 }}
                  />
                </div>

                {/* Foto */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label>Foto de evidencia (obligatoria)</label>
                  <input type="file" accept="image/*" onChange={handleFotoChange} required />
                  {form.fotoFile && (
                    <div style={{ marginTop: 8 }}>
                      <img
                        src={URL.createObjectURL(form.fotoFile)}
                        alt="Preview"
                        style={{ maxWidth: 200, maxHeight: 140, borderRadius: 8, border: '1px solid var(--border)', objectFit: 'cover' }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Mensaje en modal */}
              {msg.text && msg.type === 'error' && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8, marginTop: 16,
                  background: '#fef2f2', color: '#b91c1c', fontWeight: 500, fontSize: '0.9rem',
                  border: '1px solid #fecaca'
                }}>
                  {msg.text}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" className="secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    width: 'auto', margin: 0, padding: '12px 24px',
                    background: '#b91c1c', opacity: submitting ? 0.6 : 1
                  }}
                >
                  {submitting ? 'Enviando...' : '🚫 Solicitar Baja'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal de foto ─── */}
      {fotoModalOpen && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1100, padding: 16, cursor: 'pointer'
          }}
          onClick={() => { setFotoModalOpen(false); setFotoModalError('') }}
        >
          <div style={{
            position: 'relative', maxWidth: '90vw', maxHeight: '85vh',
            background: '#fff', borderRadius: 12, padding: 8,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)'
          }} onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => { setFotoModalOpen(false); setFotoModalError('') }}
              style={{
                position: 'absolute', top: -10, right: -10,
                background: '#1d252d', color: '#fff', border: 'none',
                borderRadius: '50%', width: 32, height: 32, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.1rem', fontWeight: 700, margin: 0, padding: 0, minHeight: 0
              }}
            >×</button>
            {fotoModalError && (
              <div style={{
                minWidth: 320,
                maxWidth: 480,
                padding: '28px 24px',
                textAlign: 'center',
                color: '#b91c1c'
              }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>No se pudo cargar la foto</div>
                <div style={{ fontSize: '0.92rem', color: 'var(--muted)' }}>
                  El registro existe, pero el archivo de imagen no est&aacute; disponible en el servidor.
                </div>
              </div>
            )}
            <img
              src={fotoModalSrc}
              onError={() => setFotoModalError('missing')}
              alt="Foto de evidencia de daño"
              style={{ maxWidth: '85vw', maxHeight: '80vh', borderRadius: 8, objectFit: 'contain', display: fotoModalError ? 'none' : 'block' }}
            />
          </div>
        </div>
      )}

      {/* ─── Modal de Historial ─── */}
      {historyModalOpen && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 16
          }}
          onClick={e => { if (e.target === e.currentTarget) setHistoryModalOpen(false) }}
        >
          <div style={{
            background: '#fff', padding: 0, borderRadius: 14, width: 'min(500px, 100%)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            <div style={{
              padding: '18px 24px', borderBottom: '1px solid var(--border)',
              background: '#f8fafc', borderRadius: '14px 14px 0 0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>🕒 Historial de la Solicitud</h3>
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                style={{
                  background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer',
                  color: 'var(--muted)', padding: 4, width: 36, height: 36,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 6, margin: 0, minHeight: 0
                }}
              >×</button>
            </div>
            <div style={{ padding: 24 }}>
              {loadingHistory ? (
                <p style={{ textAlign: 'center', color: 'var(--muted)' }}>Cargando historial...</p>
              ) : historialBaja.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--muted)' }}>No hay historial registrado para esta baja.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {historialBaja.map((h, i) => (
                    <div key={h.id} style={{ display: 'flex', gap: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginTop: 4 }}></div>
                        {i < historialBaja.length - 1 && <div style={{ width: 2, flexGrow: 1, background: 'var(--border)', margin: '4px 0' }}></div>}
                      </div>
                      <div style={{ paddingBottom: 16 }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 4 }}>
                          {fmtDate(h.created_at)}
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 4 }}>
                          {h.estado_nuevo.toUpperCase()}
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--dark)' }}>
                          {h.comentarios}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 4 }}>
                          👤 {h.usuario_nombre || 'Sistema'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
