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

  // Detalle modal
  const [detalleModalOpen, setDetalleModalOpen] = useState(false)
  const [detalleData, setDetalleData] = useState(null)

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
  const [ingresoItem, setIngresoItem] = useState({ productoId: '', cantidad: '', estado: 'nuevo', fechaVencimiento: '', proveedorId: '' })
  const [proveedores, setProveedores] = useState([])
  // Filtros para la lista de movimientos
  const [filterDesde, setFilterDesde] = useState('')
  const [filterHasta, setFilterHasta] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [filterUsuario, setFilterUsuario] = useState('')
  const [filterProveedor, setFilterProveedor] = useState('')

  // Historial tab
  const [historialTab, setHistorialTab] = useState('movimientos') // 'movimientos' | 'bajas'
  const [bajas, setBajas] = useState([])
  const [filterBajaDesde, setFilterBajaDesde] = useState('')
  const [filterBajaHasta, setFilterBajaHasta] = useState('')
  const [filterBajaDeposito, setFilterBajaDeposito] = useState('')
  const [fotoModalUrl, setFotoModalUrl] = useState(null)

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

  const loadMovimientos = async (opts = {}) => {
    try {
      const q = new URLSearchParams()
      const tipoVal = opts.tipo ?? filterTipo
      const desdeVal = opts.desde ?? filterDesde
      const hastaVal = opts.hasta ?? filterHasta
      const usuarioVal = opts.usuario ?? filterUsuario
      const proveedorVal = opts.proveedor ?? filterProveedor

      if (tipoVal) q.append('tipo', tipoVal)
      if (desdeVal) q.append('desde', desdeVal)
      if (hastaVal) q.append('hasta', hastaVal)
      if (usuarioVal) q.append('usuario', usuarioVal)
      if (proveedorVal) q.append('proveedor', proveedorVal)

      const qs = q.toString() ? `?${q.toString()}` : ''
      const res = await apiFetch(`/api/movimientos${qs}`, { token })
      if (res.ok) {
        const data = await res.json()
        setMovimientos(data.movimientos || [])
      }
    } catch (err) { /* ignore */ }
  }

  const loadInstituciones = async () => {
    try {
      const res = await apiFetch('/api/instituciones/public/list')
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

  const loadProveedores = async () => {
    try {
      const res = await apiFetch('/api/proveedores', { token })
      if (res.ok) {
        const data = await res.json()
        setProveedores(data.proveedores || [])
      }
    } catch { /* ignore */ }
  }

  const loadBajas = async (opts = {}) => {
    try {
      const q = new URLSearchParams()
      const desdeVal = opts.desde ?? filterBajaDesde
      const hastaVal = opts.hasta ?? filterBajaHasta
      const depVal = opts.id_deposito ?? filterBajaDeposito

      if (desdeVal) q.append('desde', desdeVal)
      if (hastaVal) q.append('hasta', hastaVal)
      if (depVal) q.append('id_deposito', depVal)

      const qs = q.toString() ? `?${q.toString()}` : ''
      const res = await apiFetch(`/api/movimientos/bajas${qs}`, { token })
      if (res.ok) {
        const data = await res.json()
        setBajas(data.bajas || [])
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    loadProductos()
    loadMovimientos()
    loadInstituciones()
    loadDepositos()
    loadProveedores()
    loadBajas()
  }, [])

  useEffect(() => {
    const match = instituciones.find(i => i.nombre.toLowerCase() === egresoInst.trim().toLowerCase())
    setEgresoNivel(match?.nivel_educativo || '')
  }, [egresoInst, instituciones])

  useEffect(() => {
    if (egresoModalOpen && !egresoDeposito && depositos.length > 0) {
      const central = depositos.find(d => (d.tipo || d.tipo_deposito) === 'central' || d.nombre?.toLowerCase().includes('central') || d.id == 1)
      if (central) setEgresoDeposito(String(central.id))
    }
  }, [egresoModalOpen, depositos, egresoDeposito])

  const findProducto = (nombre) =>
    productos.find(p => p.nombre.toLowerCase().trim() === (nombre || '').toLowerCase().trim())

  // Egreso handlers
  const addToEgreso = () => {
    const producto = findProducto(egresoItem.productoNombre)
    if (!producto) return setMsg({ text: 'Seleccione un producto válido de la lista', type: 'error' })
    
    const stockDisp = Number(producto.stock_central ?? producto.stock_actual ?? 0)
    if (stockDisp <= 0) {
      return setMsg({ text: `🚨 ATENCIÓN: No hay stock disponible de "${producto.nombre}" en Depósito Central (Stock: 0)`, type: 'error' })
    }

    const cantidad = parseInt(egresoItem.cantidad, 10)
    if (!cantidad || cantidad <= 0) return setMsg({ text: 'Ingrese una cantidad válida mayor a 0', type: 'error' })

    if (cantidad > stockDisp) {
      return setMsg({ text: `⚠️ La cantidad a egresar (${cantidad}) supera el stock disponible en Depósito Central (${stockDisp} ${producto.unidad_medida || 'unidades'})`, type: 'error' })
    }

    setLoteEgreso(prev => [...prev, {
      producto_id: producto.id,
      nombre: producto.nombre,
      cantidad,
      estado: egresoItem.estado,
      stock_disponible: stockDisp,
      unidad_medida: producto.unidad_medida || 'unidad'
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

    // Si hay deposito seleccionado y NO es un traslado (es para institución), usar la API de depositos
    const destDeposito = depositos.find(d => d.nombre.toLowerCase() === egresoInst.trim().toLowerCase())

    if (egresoDeposito && !destDeposito) {
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

    // Detectar si el destino es un depósito (Traslado)
    if (destDeposito) {
      if (!egresoDeposito || destDeposito.id == egresoDeposito) {
        setMsg({ text: 'Seleccione un depósito de origen válido y distinto al destino', type: 'error' })
        return
      }
      for (const item of loteEgreso) {
        const payload = {
          id_producto: item.producto_id,
          cantidad: item.cantidad,
          origen_id: parseInt(egresoDeposito, 10),
          destino_id: destDeposito.id,
          motivo: egresoMotivo.trim() || 'Traslado entre depósitos'
        }
        const res = await apiFetch('/api/depositos/mover', { token, method: 'POST', body: JSON.stringify(payload) })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setMsg({ text: data.error || 'Error en traslado', type: 'error' })
          return
        }
      }
      setEgresoInst('')
      setEgresoMotivo('')
      setLoteEgreso([])
      setEgresoDeposito('')
      setEgresoModalOpen(false)
      setMsg({ text: 'Traslado registrado correctamente', type: 'success' })
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
      estado: ingresoItem.estado,
      fecha_vencimiento: ingresoItem.fechaVencimiento || null,
      proveedor_id: ingresoItem.proveedorId || null
    }])
    setIngresoItem({ productoId: '', cantidad: '', estado: 'nuevo', fechaVencimiento: '', proveedorId: '' })
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

    for (const item of loteIngreso) {
      const isTransfer = String(item.proveedor_id).startsWith('dep-')
      const targetId = String(item.proveedor_id).split('-')[1]

      if (isTransfer) {
        // Es un traslado entre depósitos
        const res = await apiFetch('/api/depositos/mover', {
          token,
          method: 'POST',
          body: JSON.stringify({
            id_producto: item.producto_id,
            cantidad: item.cantidad,
            origen_id: targetId,
            destino_id: ingresoDeposito,
            motivo: ingresoMotivo.trim() || 'Traslado entre depósitos'
          })
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setMsg({ text: data.details || data.error || 'No se pudo registrar traslado', type: 'error' })
          return
        }
      } else {
        // Es un ingreso desde proveedor
        const provId = targetId || null
        const res = await apiFetch(`/api/depositos/${ingresoDeposito}/ingreso`, {
          token,
          method: 'POST',
          body: JSON.stringify({
            id_producto: item.producto_id,
            cantidad: item.cantidad,
            motivo: ingresoMotivo.trim() || null,
            fecha_vencimiento: item.fecha_vencimiento,
            id_proveedor: provId
          })
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setMsg({ text: data.details || data.error || 'No se pudo registrar ingreso', type: 'error' })
          return
        }
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


// Baja handlers


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

  const rowsHTML = movs.map(m => `<tr><td>${m.producto_nombre || '-'}</td><td>${m.cantidad ?? '-'}</td><td>${m.estado_producto || '-'}</td><td>${m.proveedor_nombre || '-'}</td></tr>`).join('');

  printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Movimiento #${primer.id || ''}</title>
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
            <div style="font-weight: bold; font-size: 1.1rem;">Comprobante de Movimiento</div>
            <div style="font-size: 0.9rem; color: #666;">Tipo: ${primer.tipo || '-'}</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px;">
          <div><strong>Institución/Cargo:</strong> ${institucionCargo}</div>
          <div><strong>Motivo:</strong> ${primer.motivo || '-'}</div>
          <div><strong>Registrado por:</strong> ${primer.usuario_nombre || '-'}</div>
          <div><strong>Fecha:</strong> ${fecha}</div>
        </div>

        <h4>Productos</h4>
        <table>
          <thead>
            <tr><th>Producto</th><th>Cantidad</th><th>Estado</th><th>Proveedor</th></tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>

        <div class="signatures">
          <div class="signature">Firma de quien entrega</div>
          <div class="signature">Firma y sello del directivo</div>
        </div>
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
              style={{ width: 'auto', margin: 0, padding: '10px 18px', fontSize: '0.95rem' }}
              onClick={() => { setEgresoModalOpen(true); setMsg({ text: '', type: '' }) }}
            >
              Egreso
            </button>
            <button
              type="button"
              className="mov-action-btn"
              style={{ width: 'auto', margin: 0, padding: '10px 18px', fontSize: '0.95rem' }}
              onClick={() => { setIngresoModalOpen(true); setMsg({ text: '', type: '' }) }}
            >
              Ingreso
            </button>
            <button
              type="button"
              className="mov-action-btn"
              style={{ width: 'auto', margin: 0, padding: '10px 18px', fontSize: '0.95rem' }}
              onClick={() => { setRetirarPedidoModalOpen(true); setMsg({ text: '', type: '' }) }}
            >
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
                  <label>Institución o Depósito Destino</label>
                  <input
                    list="egresoInstitucionList"
                    value={egresoInst}
                    onChange={e => setEgresoInst(e.target.value)}
                    placeholder="Busque escuela o depósito (ej: Centro Cívico)..."
                    autoComplete="off"
                    required
                  />
                  <datalist id="egresoInstitucionList">
                    {instituciones.map(i => (
                      <option key={i.id} value={i.nombre} />
                    ))}
                    {depositos.filter(d => d.id != egresoDeposito).map(d => (
                      <option key={`dep-${d.id}`} value={d.nombre}>{d.nombre} (Depósito)</option>
                    ))}
                  </datalist>
                </div>
                <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label>Cargo de quien retira</label>
                    <select value={egresoCargo} onChange={e => {
                      setEgresoCargo(e.target.value);
                      // Si es un deposito, no forzar cargo pero dejarlo opcional
                    }} required={!depositos.some(d => d.nombre.toLowerCase() === egresoInst.trim().toLowerCase())}>
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
                        {productos.map(p => {
                          const stockDisp = Number(p.stock_central ?? p.stock_actual ?? 0)
                          const stockLabel = stockDisp > 0 ? `(Stock Central: ${stockDisp} ${p.unidad_medida || 'unidades'})` : '(⚠️ SIN STOCK Central)'
                          return (
                            <option key={p.id} value={p.nombre}>{p.nombre}{p.marca ? ` - ${p.marca}` : ''} {stockLabel}</option>
                          )
                        })}
                      </datalist>

                      {(() => {
                        const inputVal = egresoItem.productoNombre.trim()
                        if (!inputVal) {
                          return (
                            <div style={{ marginTop: 6, fontSize: '0.8rem', color: '#6b7280' }}>
                              ℹ️ Busque un producto para verificar su stock en Depósito Central.
                            </div>
                          )
                        }
                        const selectedProd = findProducto(inputVal)
                        if (!selectedProd) {
                          return (
                            <div style={{ marginTop: 6, fontSize: '0.8rem', color: '#dc2626' }}>
                              ⚠️ Producto no encontrado en el catálogo.
                            </div>
                          )
                        }
                        const stockDisp = Number(selectedProd.stock_central ?? selectedProd.stock_actual ?? 0)
                        if (stockDisp > 0) {
                          return (
                            <div style={{ marginTop: 6, padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: '1.1rem' }}>📦</span>
                              <span style={{ fontSize: '0.85rem', color: '#166534', fontWeight: 600 }}>
                                Stock disponible (Depósito Central): <strong>{stockDisp}</strong> {selectedProd.unidad_medida || 'unidades'}
                              </span>
                            </div>
                          )
                        }
                        return (
                          <div style={{ marginTop: 6, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '1.1rem' }}>🚨</span>
                            <span style={{ fontSize: '0.85rem', color: '#991b1b', fontWeight: 700 }}>
                              ⚠️ ADVERTENCIA: No hay stock disponible en Depósito Central (0 {selectedProd.unidad_medida || 'unidades'})
                            </span>
                          </div>
                        )
                      })()}
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
                          <th style={{ border: '1px solid #ddd', padding: 8 }}>Stock Central</th>
                          <th style={{ border: '1px solid #ddd', padding: 8 }}>Cantidad A Egresar</th>
                          <th style={{ border: '1px solid #ddd', padding: 8 }}>Estado</th>
                          <th style={{ border: '1px solid #ddd', padding: 8 }}>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loteEgreso.map((item, idx) => (
                          <tr key={idx}>
                            <td style={{ border: '1px solid #ddd', padding: 8 }}>{item.nombre}</td>
                            <td style={{ border: '1px solid #ddd', padding: 8, color: '#15803d', fontWeight: 600 }}>{item.stock_disponible} {item.unidad_medida}</td>
                            <td style={{ border: '1px solid #ddd', padding: 8, fontWeight: 700 }}>{item.cantidad}</td>
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
                        {productos.map(p => {
                          const stockDisp = Number(p.stock_central ?? p.stock_actual ?? 0)
                          const stockText = stockDisp > 0 ? `(Stock Central: ${stockDisp} ${p.unidad_medida || 'unidades'})` : '(⚠️ SIN STOCK Central)'
                          return (
                            <option key={p.id} value={p.id}>{p.nombre}{p.marca ? ` - ${p.marca}` : ''} {stockText}</option>
                          )
                        })}
                      </select>
                      {(() => {
                        const selectedProd = productos.find(p => String(p.id) === String(ingresoItem.productoId))
                        if (!selectedProd) return null
                        const stockDisp = Number(selectedProd.stock_central ?? selectedProd.stock_actual ?? 0)
                        return (
                          <div style={{ marginTop: 6, padding: '6px 10px', background: stockDisp === 0 ? '#fffbe6' : '#f0fdf4', border: `1px solid ${stockDisp === 0 ? '#ffe58f' : '#bbf7d0'}`, borderRadius: 6, fontSize: '0.82rem', color: stockDisp === 0 ? '#d48806' : '#166534', fontWeight: 600 }}>
                            📦 Stock actual en Depósito Central: <strong>{stockDisp}</strong> {selectedProd.unidad_medida || 'unidades'} {stockDisp === 0 ? '⚠️ (Actualmente sin stock)' : ''}
                          </div>
                        )
                      })()}
                    </div>
                    <div>
                      <label>Origen (Proveedor o Depósito)</label>
                      <select
                        value={ingresoItem.proveedorId}
                        onChange={e => setIngresoItem({ ...ingresoItem, proveedorId: e.target.value })}
                      >
                        <option value="">Seleccionar origen...</option>
                        <optgroup label="Proveedores">
                          {proveedores.length === 0 && <option disabled>No hay proveedores registrados</option>}
                          {proveedores.map(prov => (
                            <option key={`prov-${prov.id}`} value={`prov-${prov.id}`}>{prov.nombre}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Depósitos (Traslado)">
                          {depositos.filter(d => String(d.id) !== String(ingresoDeposito)).map(d => (
                            <option key={`dep-${d.id}`} value={`dep-${d.id}`}>{d.nombre}</option>
                          ))}
                        </optgroup>
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
                    <div>
                      <label>Fecha de Vencimiento</label>
                      <input
                        type="date"
                        value={ingresoItem.fechaVencimiento || ''}
                        onChange={e => setIngresoItem({ ...ingresoItem, fechaVencimiento: e.target.value })}
                      />
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

    <div ref={printRef} style={{ marginTop: 20, overflowX: 'auto' }}>
      <h3>Historial de Movimientos</h3>

      {/* ===== TABS ===== */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '2px solid #e5e7eb' }}>
        <button
          type="button"
          onClick={() => { setHistorialTab('movimientos'); loadMovimientos() }}
          style={{
            padding: '10px 20px',
            border: 'none',
            borderBottom: historialTab === 'movimientos' ? '3px solid #2563eb' : '3px solid transparent',
            background: historialTab === 'movimientos' ? '#eff6ff' : 'transparent',
            color: historialTab === 'movimientos' ? '#1d4ed8' : '#6b7280',
            fontWeight: historialTab === 'movimientos' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.95rem',
            transition: 'all 0.2s',
            borderRadius: '8px 8px 0 0',
          }}
        >
          Ingresos / Egresos
        </button>
        <button
          type="button"
          onClick={() => { setHistorialTab('bajas'); loadBajas() }}
          style={{
            padding: '10px 20px',
            border: 'none',
            borderBottom: historialTab === 'bajas' ? '3px solid #dc2626' : '3px solid transparent',
            background: historialTab === 'bajas' ? '#fef2f2' : 'transparent',
            color: historialTab === 'bajas' ? '#dc2626' : '#6b7280',
            fontWeight: historialTab === 'bajas' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.95rem',
            transition: 'all 0.2s',
            borderRadius: '8px 8px 0 0',
          }}
        >
          Bajas
        </button>
      </div>

      {/* ===== TAB: MOVIMIENTOS ===== */}
      {historialTab === 'movimientos' && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem' }}>Desde</label>
              <input type="date" value={filterDesde} onChange={e => setFilterDesde(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem' }}>Hasta</label>
              <input type="date" value={filterHasta} onChange={e => setFilterHasta(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem' }}>Tipo</label>
              <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
                <option value="">Todos</option>
                <option value="ingreso">Ingreso</option>
                <option value="egreso">Egreso</option>
                <option value="ajuste">Ajuste</option>
                <option value="devolucion">Devolución</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem' }}>Usuario</label>
              <input placeholder="Nombre o id" value={filterUsuario} onChange={e => setFilterUsuario(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem' }}>Proveedor</label>
              <input placeholder="Nombre o id" value={filterProveedor} onChange={e => setFilterProveedor(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <button type="button" onClick={() => loadMovimientos()}>Buscar</button>
              <button type="button" onClick={() => { setFilterDesde(''); setFilterHasta(''); setFilterTipo(''); setFilterUsuario(''); setFilterProveedor(''); loadMovimientos({}) }} className="secondary">Limpiar</button>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Nº Movimiento</th>
                <th>Tipo</th>
                <th>Producto(s)</th>
                <th>Cantidad</th>
                <th>Motivo</th>
                <th>Proveedor / Institución</th>
                <th>Registrado por</th>
                <th>Fecha</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const grouped = [];
                let currentGroup = null;

                movimientos.forEach((m) => {
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
                  const proveedoresResumen = [...new Set(group.items.map(item => item.proveedor_nombre).filter(Boolean))];

                  const uniqueEstados = [...new Set(group.items.map(item => item.estado_producto).filter(Boolean))];
                  const estadoDisplay = uniqueEstados.length === 1 ? uniqueEstados[0] : (uniqueEstados.length > 1 ? 'Varios' : '-');

                  const totalCantidad = group.items.reduce((sum, item) => sum + Number(item.cantidad || 0), 0);

                  let proveedorDisplay = '-';
                  if (first.tipo === 'egreso') {
                    proveedorDisplay = first.institucion_nombre || '-';
                  } else if (first.tipo === 'ingreso') {
                    proveedorDisplay = proveedoresResumen.length > 0 ? proveedoresResumen.join(', ') : 'Sin proveedor';
                  } else {
                    proveedorDisplay = proveedoresResumen.length > 0 ? proveedoresResumen.join(', ') : '-';
                  }

                  const productosDisplay = isMulti
                    ? [...new Set(group.items.map(item => item.producto_nombre).filter(Boolean))].join(', ')
                    : (first.producto_nombre || '-');

                  return (
                    <tr key={first.id || i}>
                      <td>{`#${first.id}`}</td>
                      <td><span className={`badge badge-${first.tipo}`}>{first.tipo}</span></td>
                      <td style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={productosDisplay}>{productosDisplay}</td>
                      <td>{isMulti ? totalCantidad : first.cantidad}</td>
                      <td>{first.motivo || '-'}</td>
                      <td>{proveedorDisplay}</td>
                      <td>{first.usuario_nombre || '-'}</td>
                      <td>{first.created_at ? new Date(first.created_at).toLocaleDateString() : '-'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => handlePrintMovimiento(group.items)}
                            title="Imprimir movimiento"
                            aria-label="Imprimir movimiento"
                            style={{ width: 'auto', margin: 0, minWidth: 36, padding: '6px 10px' }}
                          >
                            Imprimir
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => { setDetalleData({ proveedor: proveedoresResumen.length > 0 ? proveedoresResumen.join(', ') : (first.tipo === 'egreso' ? first.institucion_nombre : null), deposito: first.deposito_nombre, institucion: institucionCargo, productos: group.items }); setDetalleModalOpen(true) }}
                            title="Ver detalle"
                            aria-label="Ver detalle"
                            style={{ width: 'auto', margin: 0, minWidth: 36, padding: '6px 10px' }}
                          >
                            Detalle
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              })()}
            </tbody>
          </table>
        </>
      )}

      {/* ===== TAB: BAJAS ===== */}
      {historialTab === 'bajas' && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem' }}>Desde</label>
              <input type="date" value={filterBajaDesde} onChange={e => setFilterBajaDesde(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem' }}>Hasta</label>
              <input type="date" value={filterBajaHasta} onChange={e => setFilterBajaHasta(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem' }}>Depósito</label>
              <select value={filterBajaDeposito} onChange={e => setFilterBajaDeposito(e.target.value)}>
                <option value="">Todos</option>
                {depositos.map(d => (
                  <option key={d.id} value={d.id}>{d.nombre}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <button type="button" onClick={() => loadBajas()}>Buscar</button>
              <button type="button" onClick={() => { setFilterBajaDesde(''); setFilterBajaHasta(''); setFilterBajaDeposito(''); loadBajas({}) }} className="secondary">Limpiar</button>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Nº Baja</th>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Motivo</th>
                <th>Estado</th>
                <th>Depósito</th>
                <th>Foto</th>
                <th>Registrado por</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {bajas.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 20, color: '#9ca3af' }}>No se encontraron bajas</td></tr>
              ) : bajas.map((b, i) => {
                const estadoColors = {
                  pendiente: { bg: '#fef9c3', color: '#92400e', border: '#fde68a' },
                  aprobada: { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' },
                  rechazada: { bg: '#fee2e2', color: '#991b1b', border: '#fecaca' },
                }
                const ec = estadoColors[b.estado] || { bg: '#f3f4f6', color: '#374151', border: '#e5e7eb' }
                return (
                  <tr key={b.id || i}>
                    <td>{`#${b.id}`}</td>
                    <td>{b.producto_nombre || '-'}</td>
                    <td>{b.cantidad}</td>
                    <td style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={b.motivo || ''}>{b.motivo || '-'}</td>
                    <td>
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: 12,
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        background: ec.bg,
                        color: ec.color,
                        border: `1px solid ${ec.border}`,
                      }}>
                        {b.estado ? b.estado.charAt(0).toUpperCase() + b.estado.slice(1) : '-'}
                      </span>
                    </td>
                    <td>{b.deposito_nombre || '-'}</td>
                    <td style={{ textAlign: 'center' }}>
                      {b.foto_path ? (
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => setFotoModalUrl(`${window.location.origin.replace(':5173', ':3000')}${b.foto_path}`)}
                          style={{ width: 'auto', margin: 0, padding: '4px 10px', fontSize: '0.8rem' }}
                        >
                          📷 Ver
                        </button>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>—</span>
                      )}
                    </td>
                    <td>{b.usuario_nombre || '-'}</td>
                    <td>{b.created_at ? new Date(b.created_at).toLocaleDateString() : '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}
    </div>

    {/* Modal foto baja */}
    {fotoModalUrl && (
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}
        onClick={() => setFotoModalUrl(null)}
      >
        <div style={{ background: '#fff', padding: 16, borderRadius: 10, maxWidth: '90vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <strong>Foto de la Baja</strong>
            <button type="button" className="secondary" onClick={() => setFotoModalUrl(null)} style={{ margin: 0, padding: '4px 10px' }}>✕</button>
          </div>
          <img src={fotoModalUrl} alt="Foto de baja" style={{ maxWidth: '80vw', maxHeight: '70vh', objectFit: 'contain', borderRadius: 6 }} />
        </div>
      </div>
    )}
    {/* Detalle modal */}
    {detalleModalOpen && detalleData && (
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}
        onClick={e => { if (e.target === e.currentTarget) setDetalleModalOpen(false) }}
      >
        <div style={{ background: '#fff', padding: 20, borderRadius: 8, width: 'min(720px, 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Detalle del Movimiento</h3>
            <button type="button" className="secondary" onClick={() => setDetalleModalOpen(false)}>✕ Cerrar</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div><strong>Proveedor:</strong><div>{detalleData.proveedor || '-'}</div></div>
            <div><strong>Depósito:</strong><div>{detalleData.deposito || '-'}</div></div>
            <div style={{ gridColumn: '1 / -1' }}><strong>Institución / Cargo:</strong><div>{detalleData.institucion || '-'}</div></div>
          </div>
          <div>
            <h4 style={{ marginTop: 0 }}>Productos</h4>
            <ul>
              {detalleData.productos.map((p, idx) => (
                <li key={idx}>{p.producto_nombre || '-'} — Cantidad: {p.cantidad}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    )}
  </div>
)
}