import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

export default function Depositos() {
  const { token, user, hasPermission } = useAuth()
  const [depositos, setDepositos] = useState([])
  const [depositoSeleccionado, setDepositoSeleccionado] = useState(null)
  const [stock, setStock] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [traslados, setTraslados] = useState([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: '' })
  
  // Modales
  const [modalType, setModalType] = useState(null) // 'ingreso', 'egreso', 'traslado'
  const [productos, setProductos] = useState([])
  const [form, setForm] = useState({ id_producto: '', cantidad: '', destino_id: '', motivo: '' })

  const canMove = hasPermission('stock.movement.create') || user?.role === 'admin' || user?.role === 'master'
  const esAdmin = user?.role === 'admin' || user?.role === 'master'
  const depositosMostrar = depositos

  const loadData = useCallback(async () => {
    try {
      const res = await apiFetch('/api/depositos', { token })
      if (res.ok) {
        const data = await res.json()
        setDepositos(data.depositos || [])
        if (data.depositos?.length > 0 && !depositoSeleccionado) {
          setDepositoSeleccionado(data.depositos[0])
        }
      }
      
      const prodRes = await apiFetch('/api/productos', { token })
      if (prodRes.ok) {
        const prodData = await prodRes.json()
        setProductos(prodData.productos || [])
      }
    } catch (err) {
      console.error('Error loading initial data:', err)
    }
  }, [token, depositoSeleccionado])

  const loadStockYMovimientos = useCallback(async () => {
    if (!depositoSeleccionado?.id) return
    setLoading(true)
    try {
      const [stockRes, movRes, trasladosRes] = await Promise.all([
        apiFetch(`/api/depositos/${depositoSeleccionado.id}/stock`, { token }),
        apiFetch(`/api/movimientos?id_deposito=${depositoSeleccionado.id}&limit=10`, { token }),
        apiFetch(`/api/depositos/traslados`, { token })
      ])
      
      if (stockRes.ok) {
        const data = await stockRes.json()
        setStock(data.stock || [])
      }
      
      if (movRes.ok) {
        const data = await movRes.json()
        setMovimientos(data.movimientos || [])
      }

      if (trasladosRes.ok) {
        const data = await trasladosRes.json()
        setTraslados(data.traslados || [])
      }
    } catch (err) {
      console.error('Error loading stock/movimientos:', err)
    }
    setLoading(false)
  }, [token, depositoSeleccionado])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    loadStockYMovimientos()
  }, [loadStockYMovimientos])

  const handleAction = async (e) => {
    e.preventDefault()
    setMsg({ text: '', type: '' })

    if (!form.id_producto || !form.cantidad) {
      setMsg({ text: 'Producto y cantidad requeridos', type: 'error' })
      return
    }

    if (modalType === 'traslado' || modalType === 'egreso') {
      const disp = stock.find(s => s.id === parseInt(form.id_producto))?.cantidad || 0;
      if (disp < parseInt(form.cantidad)) {
        setMsg({ text: `Stock insuficiente en depósito origen. Disponible: ${disp}`, type: 'error' })
        return
      }
    }

    try {
      let endpoint = `/api/depositos/${depositoSeleccionado.id}/${modalType}`
      let body = {
        id_producto: parseInt(form.id_producto),
        cantidad: parseInt(form.cantidad),
        motivo: form.motivo || `${modalType.charAt(0).toUpperCase() + modalType.slice(1)} manual`
      }

      if (modalType === 'traslado') {
        endpoint = '/api/depositos/mover'
        body = {
          ...body,
          origen_id: depositoSeleccionado.id,
          destino_id: parseInt(form.destino_id)
        }
        if (!form.destino_id) {
          setMsg({ text: 'Depósito de destino requerido', type: 'error' })
          return
        }
      }

      const res = await apiFetch(endpoint, {
        token,
        method: 'POST',
        body: JSON.stringify(body)
      })

      if (res.ok) {
        setMsg({ text: 'Operación realizada con éxito', type: 'success' })
        setForm({ id_producto: '', cantidad: '', destino_id: '', motivo: '' })
        setModalType(null)
        loadStockYMovimientos()
      } else {
        const data = await res.json()
        setMsg({ text: data.error || 'Error en la operación', type: 'error' })
      }
    } catch {
      setMsg({ text: 'Error de conexión', type: 'error' })
    }
  }

  const handlePrintTraslados = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=600')
    if (!printWindow) return

    const rowsHTML = traslados.map(t => `
      <tr>
        <td>${t.producto_nombre}</td>
        <td>${t.cantidad}</td>
        <td>${t.origen_nombre}</td>
        <td>${t.destino_nombre}</td>
        <td>${t.motivo}</td>
        <td>${t.usuario_nombre || '-'}</td>
        <td>${new Date(t.created_at).toLocaleDateString()}</td>
      </tr>
    `).join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Historial de Traslados</title>
        <style>
          * { box-sizing: border-box; font-family: Arial, sans-serif; }
          body { margin: 24px; color: #111827; font-size: 13px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #FF8200; padding-bottom: 10px; margin-bottom: 16px; }
          .header-left { display: flex; align-items: center; gap: 12px; }
          .header-left img { height: 40px; width: auto; }
          .header-right { text-align: right; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
          th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; }
          th { background: #f3f4f6; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <img src="/faviconmin.png" alt="Logo San Juan" />
            <div>
              <div style="font-weight: bold; font-size: 1.1rem;">San Juan Gobierno</div>
              <div style="font-size: 0.9rem; color: #666;">Ministerio de Educación</div>
            </div>
          </div>
          <div class="header-right">
            <div style="font-weight: bold; font-size: 1.1rem;">Historial de Traslados</div>
            <div style="font-size: 0.9rem; color: #666;">Entre Depósitos</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Origen</th>
              <th>Destino</th>
              <th>Motivo</th>
              <th>Registrado por</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const handlePrintSingleTraslado = (t) => {
    const printWindow = window.open('', '_blank', 'width=600,height=400')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Comprobante de Traslado</title>
        <style>
          * { box-sizing: border-box; font-family: Arial, sans-serif; }
          body { margin: 24px; color: #111827; font-size: 13px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #FF8200; padding-bottom: 10px; margin-bottom: 16px; }
          .header-left { display: flex; align-items: center; gap: 12px; }
          .header-left img { height: 40px; width: auto; }
          .header-right { text-align: right; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
          th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; }
          th { background: #f3f4f6; width: 150px; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; margin-top: 54px; }
          .signature { border-top: 1px solid #111827; padding-top: 8px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <img src="/faviconmin.png" alt="Logo San Juan" />
            <div>
              <div style="font-weight: bold; font-size: 1.1rem;">San Juan Gobierno</div>
              <div style="font-size: 0.9rem; color: #666;">Ministerio de Educación</div>
            </div>
          </div>
          <div class="header-right">
            <div style="font-weight: bold; font-size: 1.1rem;">Comprobante de Traslado</div>
            <div style="font-size: 0.9rem; color: #666;">Entre Depósitos</div>
          </div>
        </div>

        <table>
          <tr><th>Producto</th><td>${t.producto_nombre}</td></tr>
          <tr><th>Cantidad</th><td>${t.cantidad}</td></tr>
          <tr><th>Origen</th><td>${t.origen_nombre}</td></tr>
          <tr><th>Destino</th><td>${t.destino_nombre}</td></tr>
          <tr><th>Motivo</th><td>${t.motivo}</td></tr>
          <tr><th>Registrado por</th><td>${t.usuario_nombre || '-'}</td></tr>
          <tr><th>Fecha</th><td>${new Date(t.created_at).toLocaleString()}</td></tr>
        </table>

        <div class="signatures">
          <div class="signature">Firma de quien entrega</div>
          <div class="signature">Firma y sello del directivo</div>
        </div>
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const getTipoLabel = (tipo, nombre) => {
    switch (tipo) {
      case 'central': return '📦 Central'
      case 'centro_civico': return '🏛️ Centro Cívico'
      case 'capsula': return '🔐 Cápsula'
      case 'desguace': return '🔧 Desguace (Scrap)'
      default: return nombre || tipo || 'Depósito'
    }
  }

  return (
    <div className="depositos-container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>Gestión de Depósitos</h2>
          <p style={{ color: 'var(--muted)', margin: '4px 0 0 0' }}>Estado del inventario por ubicación</p>
        </div>
      </header>

      {/* Selector de Depósitos con Diseño Premium */}
      <div className="deposito-tabs" style={{ display: 'flex', gap: '12px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '8px' }}>
        {depositosMostrar.map(d => (
          <button
            key={d.id}
            onClick={() => setDepositoSeleccionado(d)}
            style={{
              padding: '12px 20px',
              borderRadius: '12px',
              border: '2px solid',
              borderColor: depositoSeleccionado?.id === d.id ? 'var(--primary)' : 'transparent',
              background: depositoSeleccionado?.id === d.id ? 'var(--primary-light, #eff6ff)' : 'white',
              color: depositoSeleccionado?.id === d.id ? 'var(--primary)' : 'var(--dark)',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {getTipoLabel(d.tipo, d.nombre)}
          </button>
        ))}
      </div>

      {depositoSeleccionado && (
        <div className="grid-depositos" style={{ display: 'grid', gridTemplateColumns: '3fr 1.2fr', gap: '24px' }}>
          
          {/* Panel Principal: Stock */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Inventario Actual</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                {canMove && (depositoSeleccionado.tipo !== 'capsula' || esAdmin) && (
                  <>
                    <button className="primary" onClick={() => { setModalType('ingreso'); setForm({ ...form, id_producto: '', cantidad: '' }) }} style={{ padding: '8px 14px', fontSize: '0.85rem' }}>+ Ingreso</button>
                    <button className="secondary" onClick={() => { setModalType('egreso'); setForm({ ...form, id_producto: '', cantidad: '' }) }} style={{ padding: '8px 14px', fontSize: '0.85rem' }}>- Egreso</button>
                    <button className="secondary" onClick={() => { setModalType('traslado'); setForm({ ...form, id_producto: '', cantidad: '' }) }} style={{ padding: '8px 14px', fontSize: '0.85rem' }}>🔄 Traslado</button>
                  </>
                )}
              </div>
            </div>

            {msg.text && (
              <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`} style={{ marginBottom: '20px' }}>
                {msg.text}
              </div>
            )}

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>Cargando inventario...</div>
            ) : (
              <div className="table-responsive">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f1f5f9', textAlign: 'left' }}>
                      <th style={{ padding: '12px 8px' }}>Producto</th>
                      <th style={{ padding: '12px 8px', textAlign: 'center' }}>Cantidad</th>
                      <th style={{ padding: '12px 8px' }}>Unidad</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right' }}>Alertas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stock.map(s => {
                      const isLow = s.cantidad < 10 && s.cantidad > 0
                      const isZero = s.cantidad === 0
                      return (
                        <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9', opacity: isZero ? 0.6 : 1 }}>
                          <td style={{ padding: '12px 8px', fontWeight: isZero ? 400 : 500 }}>{s.nombre}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                            <span style={{ 
                              background: isZero ? '#f3f4f6' : (isLow ? '#fef2f2' : '#f0fdf4'), 
                              color: isZero ? '#6b7280' : (isLow ? '#b91c1c' : '#166534'),
                              padding: '4px 10px',
                              borderRadius: '20px',
                              fontWeight: 700,
                              fontSize: '0.9rem'
                            }}>
                              {s.cantidad}
                            </span>
                          </td>
                          <td style={{ padding: '12px 8px', color: 'var(--muted)', fontSize: '0.85rem' }}>{s.unidad_medida}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                            {isLow && <span style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 600 }}>⚠️ STOCK BAJO</span>}
                            {isZero && <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>SIN STOCK</span>}
                            {s.requiere_autorizacion && <span style={{ marginLeft: '8px', background: '#fffbeb', color: '#92400e', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>🔒 Cápsula</span>}
                          </td>
                        </tr>
                      )
                    })}
                    {stock.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
                          No se encontraron productos vinculados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Panel Lateral: Información y Actividad */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="card" style={{ padding: '20px', background: 'linear-gradient(to bottom, #ffffff, #f8fafc)' }}>
              <h4 style={{ margin: '0 0 12px 0' }}>Detalles del Nodo</h4>
              <div style={{ fontSize: '0.85rem', lineHeight: '1.6' }}>
                <div style={{ marginBottom: '8px' }}><strong>📍 Ubicación:</strong> {depositoSeleccionado.ubicacion}</div>
                <div style={{ marginBottom: '8px' }}><strong>📝 Descripción:</strong> {depositoSeleccionado.descripcion}</div>
                <div><strong>🏷️ Tipo:</strong> <span style={{ textTransform: 'capitalize' }}>{depositoSeleccionado.tipo ? depositoSeleccionado.tipo.replace('_', ' ') : 'Otro'}</span></div>
              </div>
            </div>

            <div className="card" style={{ padding: '20px' }}>
              <h4 style={{ margin: '0 0 16px 0' }}>Actividad Reciente</h4>
              <div className="activity-list" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {movimientos.map((m, i) => (
                  <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ 
                      width: '8px', height: '8px', borderRadius: '50%', marginTop: '6px',
                      background: m.tipo === 'ingreso' ? '#22c55e' : (m.tipo === 'egreso' ? '#ef4444' : '#f59e0b')
                    }}></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{m.producto_nombre}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                        {m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} de {m.cantidad} unidades
                      </div>
                      {m.proveedor_nombre && (
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                          Proveedor: {m.proveedor_nombre}
                        </div>
                      )}
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>
                        {new Date(m.created_at).toLocaleDateString('es-AR')}
                      </div>
                    </div>
                  </div>
                ))}
                {movimientos.length === 0 && <p style={{ fontSize: '0.8rem', color: 'var(--muted)', textAlign: 'center' }}>Sin actividad reciente</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Historial de Traslados */}
      <div className="card" style={{ padding: '24px', marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0 }}>Historial de Traslados</h3>
          <button type="button" className="secondary" onClick={handlePrintTraslados}>🖨️ Imprimir Historial</button>
        </div>
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f1f5f9', textAlign: 'left' }}>
                <th style={{ padding: '12px 8px' }}>Producto</th>
                <th style={{ padding: '12px 8px' }}>Cantidad</th>
                <th style={{ padding: '12px 8px' }}>Origen</th>
                <th style={{ padding: '12px 8px' }}>Destino</th>
                <th style={{ padding: '12px 8px' }}>Motivo</th>
                <th style={{ padding: '12px 8px' }}>Registrado por</th>
                <th style={{ padding: '12px 8px' }}>Fecha</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {traslados.map(t => (
                <tr key={t.id_movimiento} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 8px' }}>{t.producto_nombre}</td>
                  <td style={{ padding: '12px 8px' }}>{t.cantidad}</td>
                  <td style={{ padding: '12px 8px' }}>{t.origen_nombre}</td>
                  <td style={{ padding: '12px 8px' }}>{t.destino_nombre}</td>
                  <td style={{ padding: '12px 8px' }}>{t.motivo}</td>
                  <td style={{ padding: '12px 8px' }}>{t.usuario_nombre || '-'}</td>
                  <td style={{ padding: '12px 8px' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                    <button type="button" className="secondary" onClick={() => handlePrintSingleTraslado(t)} style={{ padding: '4px 8px', fontSize: '0.8rem' }}>🖨️</button>
                  </td>
                </tr>
              ))}
              {traslados.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)' }}>No hay traslados registrados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Unificado de Movimientos */}
      {modalType && (
        <div className="modal-overlay" onClick={() => setModalType(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{
            background: 'white', padding: '28px', borderRadius: '16px', width: 'min(500px, 95%)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            {form.id_producto && (modalType === 'egreso' || modalType === 'traslado') && (() => {
              const disp = stock.find(s => s.id === parseInt(form.id_producto))?.cantidad || 0;
              if (disp === 0) {
                return <div style={{ marginBottom: '20px', padding: '10px 14px', background: '#fef2f2', color: '#b91c1c', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, border: '1px solid #fecaca' }}>🚫 Sin stock para trasladar o egresar.</div>;
              }
              if (disp < 10) {
                return <div style={{ marginBottom: '20px', padding: '10px 14px', background: '#fffbeb', color: '#92400e', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, border: '1px solid #fde68a' }}>⚠️ Queda poco stock ({disp} unidades).</div>;
              }
              return <div style={{ marginBottom: '20px', padding: '10px 14px', background: '#f0fdf4', color: '#166534', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, border: '1px solid #bbf7d0' }}>✅ Stock disponible: {disp}</div>;
            })()}

            <h3 style={{ marginTop: 0 }}>
              {modalType === 'ingreso' ? '➕ Registrar Ingreso Manual' : (modalType === 'egreso' ? '➖ Registrar Egreso Manual' : '🔄 Traslado entre Depósitos')}
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
              Depósito: <strong>{depositoSeleccionado.nombre}</strong>
            </p>

            {msg.text && (
              <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`} style={{ marginBottom: '20px' }}>
                {msg.text}
              </div>
            )}

            <form onSubmit={handleAction} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Producto</label>
                <select
                  value={form.id_producto}
                  onChange={e => setForm({ ...form, id_producto: e.target.value })}
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                >
                  <option value="">Seleccionar producto</option>
                  {productos.map(p => {
                    const disp = stock.find(s => s.id === p.id)?.cantidad || 0;
                    const stockText = (modalType === 'egreso' || modalType === 'traslado') ? ` - Disp: ${disp}` : '';
                    return (
                      <option key={p.id} value={p.id}>{p.nombre}{p.marca ? ` - ${p.marca}` : ''} ({p.unidad_medida}){stockText}</option>
                    )
                  })}
                </select>
              </div>

              {modalType === 'traslado' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Depósito Destino</label>
                  <select
                    value={form.destino_id}
                    onChange={e => setForm({ ...form, destino_id: e.target.value })}
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                  >
                    <option value="">Seleccionar destino</option>
                    {depositos.filter(d => d.id !== depositoSeleccionado.id).map(d => (
                      <option key={d.id} value={d.id}>{d.nombre}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Cantidad</label>
                <input
                  type="number"
                  min="1"
                  value={form.cantidad}
                  onChange={e => setForm({ ...form, cantidad: e.target.value })}
                  required
                  placeholder="0"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Motivo / Observaciones</label>
                <input
                  type="text"
                  value={form.motivo}
                  onChange={e => setForm({ ...form, motivo: e.target.value })}
                  placeholder="Ej: Ajuste por rotura, vencimiento, etc."
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                />
              </div>

              <div style={{ marginTop: '12px', display: 'flex', gap: '12px' }}>
                <button type="submit" className="primary" style={{ flex: 1 }}>Confirmar Operación</button>
                <button type="button" className="secondary" onClick={() => setModalType(null)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .depositos-container {
          animation: fadeIn 0.3s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .deposito-tabs::-webkit-scrollbar {
          height: 4px;
        }
        .deposito-tabs::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .card {
          background: white;
          border-radius: 16px;
          border: 1px solid #f1f5f9;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }
        tr:hover {
          background-color: #f8fafc;
        }
      `}</style>
    </div>
  )
}
