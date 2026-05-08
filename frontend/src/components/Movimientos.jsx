import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'
import PrintButton from './PrintButton'
import RetirarPedidoAnual from './RetirarPedidoAnual'

const ESTADOS_PRODUCTO = ['nuevo', 'usado', 'dañado', 'reparado']
const CARGOS = ['director/a', 'vicedirector/a', 'secretario/a', 'rector/a', 'maestro/a a cargo']
const MINISTERIO_LOGO_URL = '/faviconmin.png'

export default function Movimientos() {
  const { token, hasPermission } = useAuth()
  const [movimientos, setMovimientos] = useState([])
  const [productos, setProductos] = useState([])
  const [instituciones, setInstituciones] = useState([])
  const [depositos, setDepositos] = useState([])
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [ingresoModalOpen, setIngresoModalOpen] = useState(false)
  const [egresoModalOpen, setEgresoModalOpen] = useState(false)
  const [retirarPedidoModalOpen, setRetirarPedidoModalOpen] = useState(false)

  // Egreso state
  const [egresoInst, setEgresoInst] = useState('')
  const [egresoCargo, setEgresoCargo] = useState('')
  const [egresoNivel, setEgresoNivel] = useState('')
  const [egresoMotivo, setEgresoMotivo] = useState('')
  const [loteEgreso, setLoteEgreso] = useState([])
  const [egresoItem, setEgresoItem] = useState({ productoNombre: '', cantidad: '', estado: 'nuevo' })

  // Ingreso state
  const [ingresoMotivo, setIngresoMotivo] = useState('')
  const [loteIngreso, setLoteIngreso] = useState([])
  const [ingresoItem, setIngresoItem] = useState({ productoId: '', cantidad: '', estado: 'nuevo' })

  // Depositos
  const [ingresoDeposito, setIngresoDeposito] = useState('')
  const [egresoDeposito, setEgresoDeposito] = useState('')

  const loadProductos = async () => {
    try {
      const res = await apiFetch('/api/productos', { token })
      if (res.ok) {
        const data = await res.json()
        setProductos(data.productos || [])
      }
    } catch { /* ignore */ }
  }

  const loadMovimientos = async () => {
    try {
      const res = await apiFetch('/api/movimientos', { token })
      if (res.ok) {
        const data = await res.json()
        setMovimientos(data.movimientos || [])
      }
    } catch { /* ignore */ }
  }

  const loadInstituciones = async () => {
    try {
      const res = await fetch('/api/instituciones/public/list')
      if (res.ok) {
        const data = await res.json()
        setInstituciones(data.instituciones || [])
      }
    } catch { /* ignore */ }
  }

  const loadDepositos = async () => {
    try {
      const res = await apiFetch('/api/depositos', { token })
      if (res.ok) {
        const data = await res.json()
        setDepositos(data.depositos || [])
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    loadProductos()
    loadMovimientos()
    loadInstituciones()
    loadDepositos()
  }, [])

  useEffect(() => {
    const match = instituciones.find(i => i.nombre.toLowerCase() === egresoInst.trim().toLowerCase())
    setEgresoNivel(match?.nivel_educativo || '')
  }, [egresoInst, instituciones])

  const findProducto = (nombre) =>
    productos.find(p => p.nombre.toLowerCase() === nombre.trim().toLowerCase())

  // Egreso handlers
  const addToEgreso = () => {
    const producto = findProducto(egresoItem.productoNombre)
    if (!producto) return setMsg({ text: 'Seleccione un producto válido', type: 'error' })
    const cantidad = parseInt(egresoItem.cantidad)
    if (!cantidad || cantidad <= 0) return setMsg({ text: 'Ingrese una cantidad válida', type: 'error' })

    setLoteEgreso(prev => [...prev, {
      producto_id: producto.id,
      nombre: producto.nombre,
      cantidad,
      estado: egresoItem.estado
    }])
    setEgresoItem({ productoNombre: '', cantidad: '', estado: 'nuevo' })
    setMsg({ text: '', type: '' })
  }

  const removeFromEgreso = (index) => {
    setLoteEgreso(prev => prev.filter((_, i) => i !== index))
  }

  const handleEgresoSubmit = async (e) => {
    e.preventDefault()
    setMsg({ text: '', type: '' })
    if (loteEgreso.length === 0) { setMsg({ text: 'Agregue al menos un producto al egreso', type: 'error' }); return }

    // Si hay deposito seleccionado, usar la API de depositos
    if (egresoDeposito) {
      const instMatch = instituciones.find(i => i.nombre.toLowerCase() === egresoInst.trim().toLowerCase())
      if (!instMatch || !egresoCargo) {
        setMsg({ text: 'Seleccione institucion y cargo', type: 'error' })
        return
      }
      for (const item of loteEgreso) {
        const res = await apiFetch(`/api/depositos/${egresoDeposito}/egreso`, {
          token,
          method: 'POST',
          body: JSON.stringify({
            id_producto: item.producto_id,
            cantidad: item.cantidad,
            id_institucion: instMatch.id,
            motivo: egresoCargo + ': ' + egresoMotivo.trim()
          })
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setMsg({ text: data.error || 'Error al registrar egreso', type: 'error' })
          return
        }
      }
      setEgresoInst('')
      setEgresoCargo('')
      setEgresoNivel('')
      setEgresoMotivo('')
      setLoteEgreso([])
      setEgresoDeposito('')
      setEgresoModalOpen(false)
      setMsg({ text: 'Egreso registrado correctamente', type: 'success' })
      loadMovimientos()
      loadProductos()
      return
    }

    const instMatch = instituciones.find(i => i.nombre.toLowerCase() === egresoInst.trim().toLowerCase())
    if (!instMatch || !egresoCargo) {
      setMsg({ text: 'Seleccione institucion y cargo', type: 'error' })
      return
    }

    const payload = {
      tipo: 'egreso',
      institucion_id: instMatch.id,
      cargo_retira: egresoCargo,
      motivo: egresoMotivo.trim() || null,
      productos: loteEgreso
    }

    const res = await apiFetch('/api/movimientos/directo', {
      token,
      method: 'POST',
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setMsg({ text: data.error || 'Error al registrar egreso', type: 'error' })
      return
    }

    setEgresoInst('')
    setEgresoCargo('')
    setEgresoNivel('')
    setEgresoMotivo('')
    setLoteEgreso([])
    setEgresoModalOpen(false)
    setMsg({ text: 'Egreso registrado correctamente', type: 'success' })
    loadMovimientos()
    loadProductos()
  }

  // Ingreso handlers
  const addToIngreso = () => {
    const productoId = parseInt(ingresoItem.productoId, 10)
    const producto = productos.find(p => p.id === productoId)
    if (!producto) return setMsg({ text: 'Seleccione un producto válido', type: 'error' })
    const cantidad = parseInt(ingresoItem.cantidad)
    if (!cantidad || cantidad <= 0) return setMsg({ text: 'Ingrese una cantidad válida', type: 'error' })

    setLoteIngreso(prev => [...prev, {
      producto_id: producto.id,
      nombre: producto.nombre,
      cantidad,
      estado: ingresoItem.estado
    }])
    setIngresoItem({ productoId: '', cantidad: '', estado: 'nuevo' })
    setMsg({ text: '', type: '' })
  }

  const removeFromIngreso = (index) => {
    setLoteIngreso(prev => prev.filter((_, i) => i !== index))
  }

  const handleIngresoSubmit = async (e) => {
    e.preventDefault()
    setMsg({ text: '', type: '' })

    if (loteIngreso.length === 0) {
      setMsg({ text: 'Agregue al menos un producto al ingreso', type: 'error' })
      return
    }

    // Si hay depósito seleccionado, usar la API de depósitos
    if (ingresoDeposito) {
      for (const item of loteIngreso) {
        const res = await apiFetch(`/api/depositos/${ingresoDeposito}/ingreso`, {
          token,
          method: 'POST',
          body: JSON.stringify({
            id_producto: item.producto_id,
            cantidad: item.cantidad,
            motivo: ingresoMotivo.trim() || null
          })
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setMsg({ text: data.error || 'Error al registrar ingreso', type: 'error' })
          return
        }
      }
      setIngresoMotivo('')
      setLoteIngreso([])
      setIngresoDeposito('')
      setIngresoModalOpen(false)
      setMsg({ text: 'Ingreso registrado correctamente', type: 'success' })
      loadMovimientos()
      loadProductos()
      return
    }

    // Sino usar la API normal
    const payload = {
      tipo: 'ingreso',
      motivo: ingresoMotivo.trim() || null,
      productos: loteIngreso
    }

    const res = await apiFetch('/api/movimientos/directo', {
      token,
      method: 'POST',
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setMsg({ text: data.error || 'Error al registrar ingreso', type: 'error' })
      return
    }

    setIngresoMotivo('')
    setLoteIngreso([])
    setIngresoModalOpen(false)
    setMsg({ text: 'Ingreso registrado correctamente', type: 'success' })
    loadMovimientos()
    loadProductos()
  }

  const canCreate = hasPermission('movimientos.create')

  const printRef = useRef(null)

  const handlePrintMovimiento = (movimientoOrGroup) => {
    const printWindow = window.open('', '_blank', 'width=700,height=600')
    if (!printWindow) return

    const isGroup = Array.isArray(movimientoOrGroup);
    const movs = isGroup ? movimientoOrGroup : [movimientoOrGroup];
    const primer = movs[0];

    const institucionCargo = primer.institucion_nombre && primer.cargo_retira
      ? `${primer.institucion_nombre} (${primer.cargo_retira})`
      : primer.institucion_nombre || primer.cargo_retira || '-'

    const fecha = primer.created_at
      ? new Date(primer.created_at).toLocaleString('es-AR')
      : '-'

    const rowsHTML = movs.map(m => `<tr><td>${m.producto_nombre || '-'}</td><td>${m.cantidad ?? '-'}</td><td>${m.estado_producto || '-'}</td></tr>`).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Movimiento #${primer.id || ''}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;500;700&display=swap');
          * { box-sizing: border-box; font-family: 'Ubuntu', sans-serif; }
          body { margin: 24px; color: #1D252D; }
          .print-header { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
          .print-header img { height: 36px; width: auto; object-fit: contain; }
          h2 { margin: 0 0 14px; font-size: 20px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; }
          th { background: #f3f4f6; width: 220px; font-size: 12px; text-transform: uppercase; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 700; color: #111827; background: #e5e7eb; }
          .footer { margin-top: 14px; color: #6b7280; font-size: 12px; }
          .product-table th { width: auto; }
        </style>
      </head>
      <body>
        <div class="print-header">
          <img src="${MINISTERIO_LOGO_URL}" alt="Logo Ministerio" />
          <h2>Detalle de Movimiento</h2>
        </div>
        <table>
          <tr><th>Tipo</th><td><span class="badge">${primer.tipo || '-'}</span></td></tr>
          <tr><th>Institucion/Cargo</th><td>${institucionCargo}</td></tr>
          <tr><th>Motivo</th><td>${primer.motivo || '-'}</td></tr>
          <tr><th>Registrado por</th><td>${primer.usuario_nombre || '-'}</td></tr>
          <tr><th>Fecha</th><td>${fecha}</td></tr>
        </table>
        <h4>Productos</h4>
        <table class="product-table">
          <thead>
            <tr><th>Producto</th><th>Cantidad</th><th>Estado</th></tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>
        <div class="footer">Impreso: ${new Date().toLocaleString('es-AR')}</div>
      </body>
      </html>
    `)

    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 300)
  }

  // Traslado entre depositos
  const [transfer, setTransfer] = useState({ productoId: '', origenId: '', destinoId: '', cantidad: '' })

  const handleTransferSubmit = async (e) => {
    e.preventDefault()
    if (!transfer.productoId || !transfer.origenId || !transfer.destinoId || !transfer.cantidad) {
      setMsg({ text: 'Completa todos los campos para trasladar', type: 'error' })
      return
    }
    const payload = {
      id_producto: parseInt(transfer.productoId, 10),
      cantidad: parseInt(transfer.cantidad, 10),
      origen_id: parseInt(transfer.origenId, 10),
      destino_id: parseInt(transfer.destinoId, 10),
      motivo: 'Traslado entre depósitos'
    }
    const res = await apiFetch('/api/depositos/mover', { token, method: 'POST', body: JSON.stringify(payload) })
    if (res.ok) {
      setTransfer({ productoId: '', origenId: '', destinoId: '', cantidad: '' })
      loadMovimientos()
      loadDepositos()
      setMsg({ text: 'Traslado registrado correctamente', type: 'success' })
    } else {
      const data = await res.json().catch(() => ({}))
      setMsg({ text: data.error || 'No se pudo realizar el traslado', type: 'error' })
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>Registro de Movimientos</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {canCreate && (
            <>
              <button
                type="button"
                className="mov-action-btn"
                style={{ width: 'auto', margin: 0, padding: '14px 22px', fontSize: '1rem' }}
                onClick={() => { setEgresoModalOpen(true); setMsg({ text: '', type: '' }) }}
              >
                <span aria-hidden="true" style={{ marginRight: 8, fontSize: '1.2rem' }}>📦⬆️</span>
                Egreso
              </button>
              <button
                type="button"
                className="mov-action-btn"
                style={{ width: 'auto', margin: 0, padding: '14px 22px', fontSize: '1rem' }}
                onClick={() => { setIngresoModalOpen(true); setMsg({ text: '', type: '' }) }}
              >
                <span aria-hidden="true" style={{ marginRight: 8, fontSize: '1.2rem' }}>📦⬇️</span>
                Ingreso
              </button>
              <button
                type="button"
                className="mov-action-btn"
                style={{ width: 'auto', margin: 0, padding: '14px 22px', fontSize: '1rem' }}
                onClick={() => { setRetirarPedidoModalOpen(true); setMsg({ text: '', type: '' }) }}
              >
                <span aria-hidden="true" style={{ marginRight: 8, fontSize: '1.2rem' }}>📋📦</span>
                Retirar Pedido Anual
              </button>
            </>
          )}
          <PrintButton targetRef={printRef} title="Historial de Movimientos" />
        </div>
      </div>

      {canCreate && (
        <>
          {/* EGRESO */}
          {egresoModalOpen && (
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
                if (e.target === e.currentTarget) setEgresoModalOpen(false)
              }}
            >
              <div style={{ background: '#f9fafb', padding: 24, borderRadius: 10, width: 'min(980px, 100%)', maxHeight: '90vh', overflowY: 'auto' }}>
                <h3>➖ Egreso de Productos</h3>
                <div style={{ marginBottom: 16, padding: 12, background: '#fff3e0', borderRadius: 6 }}>
                  <label><strong>Depósito origen:</strong></label>
                  <select value={egresoDeposito} onChange={e => setEgresoDeposito(e.target.value)} style={{ marginLeft: 8 }}>
                    <option value="">-- Depósito del stock --</option>
                    {depositos.map(d => (
                      <option key={d.id} value={d.id}>{d.nombre} ({d.ubicacion})</option>
                    ))}
                  </select>
                </div>
                <form onSubmit={handleEgresoSubmit} className="grid">
                  <div>
                    <label>Institución</label>
                    <input
                      list="egresoInstitucionList"
                      value={egresoInst}
                      onChange={e => setEgresoInst(e.target.value)}
                      placeholder="Escriba para buscar institución..."
                      autoComplete="off"
                      required
                    />
                    <datalist id="egresoInstitucionList">
                      {instituciones.map(i => (
                        <option key={i.id} value={i.nombre} />
                      ))}
                    </datalist>
                  </div>
                  <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label>Cargo de quien retira</label>
                      <select value={egresoCargo} onChange={e => setEgresoCargo(e.target.value)} required>
                        <option value="">Seleccionar cargo...</option>
                        {CARGOS.map(c => (
                          <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label>Nivel Educativo</label>
                      <input
                        type="text"
                        value={egresoNivel}
                        placeholder="Se cargará automáticamente"
                        readOnly
                        disabled
                      />
                    </div>
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <h4>Productos a egresar</h4>
                    <div className="grid" style={{ marginBottom: 16 }}>
                      <div>
                        <label>Producto</label>
                        <input
                          list="egresoProductoList"
                          value={egresoItem.productoNombre}
                          onChange={e => setEgresoItem({ ...egresoItem, productoNombre: e.target.value })}
                          placeholder="Escriba para buscar producto..."
                          autoComplete="off"
                        />
                        <datalist id="egresoProductoList">
                          {productos.map(p => (
                            <option key={p.id} value={p.nombre}>{p.nombre} ({p.unidad_medida || 'unidad'})</option>
                          ))}
                        </datalist>
                      </div>
                      <div>
                        <label>Cantidad</label>
                        <input
                          type="number"
                          value={egresoItem.cantidad}
                          onChange={e => setEgresoItem({ ...egresoItem, cantidad: e.target.value })}
                          placeholder="0"
                          min="1"
                        />
                      </div>
                      <div>
                        <label>Estado del producto</label>
                        <select value={egresoItem.estado} onChange={e => setEgresoItem({ ...egresoItem, estado: e.target.value })}>
                          {ESTADOS_PRODUCTO.map(est => (
                            <option key={est} value={est}>{est.charAt(0).toUpperCase() + est.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ alignSelf: 'end' }}>
                        <button type="button" onClick={addToEgreso}>Agregar al Egreso</button>
                      </div>
                    </div>
                  </div>

                  {loteEgreso.length > 0 && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <h4>Productos en el Egreso:</h4>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#f0f0f0' }}>
                            <th style={{ border: '1px solid #ddd', padding: 8 }}>Producto</th>
                            <th style={{ border: '1px solid #ddd', padding: 8 }}>Cantidad</th>
                            <th style={{ border: '1px solid #ddd', padding: 8 }}>Estado</th>
                            <th style={{ border: '1px solid #ddd', padding: 8 }}>Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loteEgreso.map((item, idx) => (
                            <tr key={idx}>
                              <td style={{ border: '1px solid #ddd', padding: 8 }}>{item.nombre}</td>
                              <td style={{ border: '1px solid #ddd', padding: 8 }}>{item.cantidad}</td>
                              <td style={{ border: '1px solid #ddd', padding: 8 }}>{item.estado}</td>
                              <td style={{ border: '1px solid #ddd', padding: 8 }}>
                                <button type="button" className="secondary" onClick={() => removeFromEgreso(idx)} style={{ margin: 0 }}>Remover</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label>Motivo del egreso</label>
                    <input
                      type="text"
                      value={egresoMotivo}
                      onChange={e => setEgresoMotivo(e.target.value)}
                      placeholder="Motivo del egreso"
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                      <button type="button" className="secondary" onClick={() => setEgresoModalOpen(false)}>Cancelar</button>
                      <button type="submit" style={{ width: 'auto', margin: 0, padding: '10px 18px' }}>Registrar Egreso</button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* INGRESO */}
          {ingresoModalOpen && (
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
                if (e.target === e.currentTarget) setIngresoModalOpen(false)
              }}
            >
              <div style={{ background: '#f9fafb', padding: 24, borderRadius: 10, width: 'min(980px, 100%)', maxHeight: '90vh', overflowY: 'auto' }}>
                <h3>Ingreso de Productos</h3>
                <div style={{ marginBottom: 16, padding: 12, background: '#e8f5e9', borderRadius: 6 }}>
                  <label><strong>Depósito destino:</strong></label>
                  <select value={ingresoDeposito} onChange={e => setIngresoDeposito(e.target.value)} style={{ marginLeft: 8 }}>
                    <option value="">-- Seleccionar depósito --</option>
                    {depositos.map(d => (
                      <option key={d.id} value={d.id}>{d.nombre} ({d.ubicacion})</option>
                    ))}
                  </select>
                  {ingresoDeposito && (
                    <span style={{ marginLeft: 12, fontSize: '0.8rem', color: '#666' }}>
                      {depositos.find(dd => dd.id == ingresoDeposito)?.tipo === 'capsula' ? '⚠️ Requiere autorización' : 'Normal'}
                    </span>
                  )}
                </div>
                <form onSubmit={handleIngresoSubmit} className="grid">
                  <div style={{ gridColumn: '1 / -1' }}>
                    <h4>Productos a ingresar</h4>
                    <div className="grid" style={{ marginBottom: 16 }}>
                      <div>
                        <label>Producto</label>
                        <select
                          value={ingresoItem.productoId}
                          onChange={e => setIngresoItem({ ...ingresoItem, productoId: e.target.value })}
                        >
                          <option value="">Seleccionar producto...</option>
                          {productos.map(p => (
                            <option key={p.id} value={p.id}>{p.nombre} ({p.unidad_medida || 'unidad'})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label>Cantidad</label>
                        <input
                          type="number"
                          value={ingresoItem.cantidad}
                          onChange={e => setIngresoItem({ ...ingresoItem, cantidad: e.target.value })}
                          placeholder="0"
                          min="1"
                        />
                      </div>
                      <div>
                        <label>Estado del producto</label>
                        <select value={ingresoItem.estado} onChange={e => setIngresoItem({ ...ingresoItem, estado: e.target.value })}>
                          {ESTADOS_PRODUCTO.map(est => (
                            <option key={est} value={est}>{est.charAt(0).toUpperCase() + est.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ alignSelf: 'end' }}>
                        <button type="button" onClick={addToIngreso}>Agregar al Ingreso</button>
                      </div>
                    </div>
                  </div>

                  {loteIngreso.length > 0 && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <h4>Productos en el Ingreso:</h4>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#f0f0f0' }}>
                            <th style={{ border: '1px solid #ddd', padding: 8 }}>Producto</th>
                            <th style={{ border: '1px solid #ddd', padding: 8 }}>Cantidad</th>
                            <th style={{ border: '1px solid #ddd', padding: 8 }}>Estado</th>
                            <th style={{ border: '1px solid #ddd', padding: 8 }}>Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loteIngreso.map((item, idx) => (
                            <tr key={idx}>
                              <td style={{ border: '1px solid #ddd', padding: 8 }}>{item.nombre}</td>
                              <td style={{ border: '1px solid #ddd', padding: 8 }}>{item.cantidad}</td>
                              <td style={{ border: '1px solid #ddd', padding: 8 }}>{item.estado}</td>
                              <td style={{ border: '1px solid #ddd', padding: 8 }}>
                                <button type="button" className="secondary" onClick={() => removeFromIngreso(idx)} style={{ margin: 0 }}>Remover</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label>Motivo del ingreso</label>
                    <input
                      type="text"
                      value={ingresoMotivo}
                      onChange={e => setIngresoMotivo(e.target.value)}
                      placeholder="Motivo del ingreso"
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                      <button type="button" className="secondary" onClick={() => setIngresoModalOpen(false)}>Cancelar</button>
                      <button type="submit" style={{ width: 'auto', margin: 0, padding: '10px 18px' }}>Registrar Ingreso</button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* RETIRAR PEDIDO ANUAL */}
          {retirarPedidoModalOpen && (
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
                if (e.target === e.currentTarget) setRetirarPedidoModalOpen(false)
              }}
            >
              <div style={{ background: '#f9fafb', padding: 24, borderRadius: 10, width: 'min(980px, 100%)', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3>Retirar Pedido Anual</h3>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setRetirarPedidoModalOpen(false)}
                    style={{ margin: 0, padding: '6px 12px' }}
                  >
                    ✕ Cerrar
                  </button>
                </div>
                <RetirarPedidoAnual
                  onSuccess={() => {
                    setRetirarPedidoModalOpen(false)
                    loadMovimientos()
                    loadProductos()
                  }}
                  onCancel={() => setRetirarPedidoModalOpen(false)}
                />
              </div>
            </div>
          )}
        </>
      )}

      {msg.text && (
        <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`} style={{ marginBottom: 20 }}>
          {msg.text}
        </div>
      )}

      {/* Traslado entre depósitos */}
      <section className="card" style={{ marginTop: 20 }}>
        <h3>Traslado entre depósitos</h3>
        <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          <select value={transfer.productoId} onChange={e => setTransfer({ ...transfer, productoId: e.target.value })}>
            <option value="">Producto</option>
            {productos.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
          <select value={transfer.origenId} onChange={e => setTransfer({ ...transfer, origenId: e.target.value })}>
            <option value="">Origen</option>
            {depositos.map(d => (
              <option key={d.id} value={d.id}>{d.nombre} ({d.tipo})</option>
            ))}
          </select>
          <select value={transfer.destinoId} onChange={e => setTransfer({ ...transfer, destinoId: e.target.value })}>
            <option value="">Destino</option>
            {depositos.map(d => (
              <option key={d.id} value={d.id}>{d.nombre} ({d.tipo})</option>
            ))}
          </select>
          <input type="number" min="1" placeholder="Cantidad" value={transfer.cantidad} onChange={e => setTransfer({ ...transfer, cantidad: e.target.value })} />
        </div>
        <button type="button" className="primary" onClick={handleTransferSubmit} style={{ marginTop: 8 }}>Trasladar</button>
      </section>

      <div ref={printRef}>
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Tipo</th>
            <th>Cantidad</th>
            <th>Estado</th>
            <th>Institución/Cargo</th>
            <th>Motivo</th>
            <th>Registrado por</th>
            <th>Fecha</th>
            <th style={{ textAlign: 'center' }}>Imprimir</th>
          </tr>
        </thead>
        <tbody>
          {(() => {
            const grouped = [];
            let currentGroup = null;

            // Sort is done by backend (usually DESC). We iterate and group adjacent or identical transaction rows.
            movimientos.forEach((m) => {
              // Create a grouping key based on the transaction metadata
              const timeStr = m.created_at ? new Date(m.created_at).toISOString().slice(0, 16) : '';
              const key = `${m.tipo}|${m.motivo || ''}|${m.institucion_nombre || ''}|${m.cargo_retira || ''}|${m.usuario_nombre || ''}|${timeStr}`;
              
              if (currentGroup && currentGroup.key === key) {
                currentGroup.items.push(m);
              } else {
                currentGroup = { key, items: [m] };
                grouped.push(currentGroup);
              }
            });

            return grouped.map((group, i) => {
              const first = group.items[0];
              const institucionCargo = first.institucion_nombre && first.cargo_retira
                ? `${first.institucion_nombre} (${first.cargo_retira})`
                : first.institucion_nombre || first.cargo_retira || '-';
              
              const isMulti = group.items.length > 1;
              const productSummary = group.items.map(item => `${item.producto_nombre || '-'} (x${item.cantidad})`).join(', ');
              
              const totalCantidad = group.items.reduce((sum, item) => sum + Number(item.cantidad || 0), 0);
              
              return (
                <tr key={first.id || i}>
                  <td style={{ maxWidth: 250 }}>{productSummary}</td>
                  <td><span className={`badge badge-${first.tipo}`}>{first.tipo}</span></td>
                  <td>{isMulti ? totalCantidad : first.cantidad}</td>
                  <td>{isMulti ? 'Varios' : (first.estado_producto || '-')}</td>
                  <td>{institucionCargo}</td>
                  <td>{first.motivo || '-'}</td>
                  <td>{first.usuario_nombre || '-'}</td>
                  <td>{new Date(first.created_at).toLocaleDateString()}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => handlePrintMovimiento(group.items)}
                      title="Imprimir movimiento"
                    aria-label="Imprimir movimiento"
                    style={{ width: 'auto', margin: 0, minWidth: 36, padding: '6px 10px' }}
                  >
                    🖨️
                  </button>
                </td>
              </tr>
            )
          }) // closes map
        })()}
        </tbody>
      </table>
      </div>
    </div>
  )
}