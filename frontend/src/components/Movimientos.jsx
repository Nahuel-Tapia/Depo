import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'
import PrintButton from './PrintButton'

const ESTADOS_PRODUCTO = ['nuevo', 'usado', 'dañado', 'reparado']
const CARGOS = ['director/a', 'vicedirector/a', 'secretario/a', 'rector/a', 'maestro/a a cargo']

export default function Movimientos() {
  const { token, hasPermission } = useAuth()
  const [movimientos, setMovimientos] = useState([])
  const [productos, setProductos] = useState([])
  const [instituciones, setInstituciones] = useState([])
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [subTab, setSubTab] = useState('egreso')

  // Egreso state
  const [egresoInst, setEgresoInst] = useState('')
  const [egresoCargo, setEgresoCargo] = useState('')
  const [egresoMotivo, setEgresoMotivo] = useState('')
  const [loteEgreso, setLoteEgreso] = useState([])
  const [egresoItem, setEgresoItem] = useState({ productoNombre: '', cantidad: '', estado: 'nuevo' })

  // Ingreso state
  const [ingresoMotivo, setIngresoMotivo] = useState('')
  const [loteIngreso, setLoteIngreso] = useState([])
  const [ingresoItem, setIngresoItem] = useState({ productoNombre: '', cantidad: '', estado: 'nuevo' })

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

  useEffect(() => {
    loadProductos()
    loadMovimientos()
    loadInstituciones()
  }, [])

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

    const instMatch = instituciones.find(i => i.nombre.toLowerCase() === egresoInst.trim().toLowerCase())
    if (!instMatch || !egresoCargo) {
      setMsg({ text: 'Seleccione institución válida y cargo', type: 'error' })
      return
    }
    if (loteEgreso.length === 0) {
      setMsg({ text: 'Agregue al menos un producto al egreso', type: 'error' })
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
    setEgresoMotivo('')
    setLoteEgreso([])
    setMsg({ text: 'Egreso registrado correctamente', type: 'success' })
    loadMovimientos()
    loadProductos()
  }

  // Ingreso handlers
  const addToIngreso = () => {
    const producto = findProducto(ingresoItem.productoNombre)
    if (!producto) return setMsg({ text: 'Seleccione un producto válido', type: 'error' })
    const cantidad = parseInt(ingresoItem.cantidad)
    if (!cantidad || cantidad <= 0) return setMsg({ text: 'Ingrese una cantidad válida', type: 'error' })

    setLoteIngreso(prev => [...prev, {
      producto_id: producto.id,
      nombre: producto.nombre,
      cantidad,
      estado: ingresoItem.estado
    }])
    setIngresoItem({ productoNombre: '', cantidad: '', estado: 'nuevo' })
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
    setMsg({ text: 'Ingreso registrado correctamente', type: 'success' })
    loadMovimientos()
    loadProductos()
  }

  const canCreate = hasPermission('movimientos.create')

  const printRef = useRef(null)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Registro de Movimientos</h2>
        <PrintButton targetRef={printRef} title="Historial de Movimientos" />
      </div>

      {canCreate && (
        <>
          <div className="sub-tabs">
            <button
              type="button"
              className={`sub-tab-btn${subTab === 'egreso' ? ' active' : ''}`}
              onClick={() => { setSubTab('egreso'); setMsg({ text: '', type: '' }) }}
            >EGRESO</button>
            <button
              type="button"
              className={`sub-tab-btn${subTab === 'ingreso' ? ' active' : ''}`}
              onClick={() => { setSubTab('ingreso'); setMsg({ text: '', type: '' }) }}
            >INGRESO</button>
          </div>

          {/* EGRESO */}
          {subTab === 'egreso' && (
            <div>
              <h3>Egreso de Productos</h3>
              <div style={{ background: '#f9fafb', padding: 24, borderRadius: 8, marginBottom: 32 }}>
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
                  <div>
                    <label>Cargo de quien retira</label>
                    <select value={egresoCargo} onChange={e => setEgresoCargo(e.target.value)} required>
                      <option value="">Seleccionar cargo...</option>
                      {CARGOS.map(c => (
                        <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                      ))}
                    </select>
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
                    <button type="submit">Registrar Egreso</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* INGRESO */}
          {subTab === 'ingreso' && (
            <div>
              <h3>Ingreso de Productos</h3>
              <div style={{ background: '#f9fafb', padding: 24, borderRadius: 8, marginBottom: 32 }}>
                <form onSubmit={handleIngresoSubmit} className="grid">
                  <div style={{ gridColumn: '1 / -1' }}>
                    <h4>Productos a ingresar</h4>
                    <div className="grid" style={{ marginBottom: 16 }}>
                      <div>
                        <label>Producto</label>
                        <input
                          list="ingresoProductoList"
                          value={ingresoItem.productoNombre}
                          onChange={e => setIngresoItem({ ...ingresoItem, productoNombre: e.target.value })}
                          placeholder="Escriba para buscar producto..."
                          autoComplete="off"
                        />
                        <datalist id="ingresoProductoList">
                          {productos.map(p => (
                            <option key={p.id} value={p.nombre}>{p.nombre} ({p.unidad_medida || 'unidad'})</option>
                          ))}
                        </datalist>
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
                    <button type="submit">Registrar Ingreso</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {msg.text && (
        <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`}>{msg.text}</div>
      )}

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
          </tr>
        </thead>
        <tbody>
          {movimientos.map((m, i) => {
            const institucionCargo = m.institucion_nombre && m.cargo_retira
              ? `${m.institucion_nombre} (${m.cargo_retira})`
              : m.institucion_nombre || m.cargo_retira || '-'
            return (
              <tr key={m.id || i}>
                <td>{m.producto_nombre || '-'}</td>
                <td><span className={`badge badge-${m.tipo}`}>{m.tipo}</span></td>
                <td>{m.cantidad}</td>
                <td>{m.estado_producto || '-'}</td>
                <td>{institucionCargo}</td>
                <td>{m.motivo || '-'}</td>
                <td>{m.usuario_nombre || '-'}</td>
                <td>{new Date(m.created_at).toLocaleDateString()}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
    </div>
  )
}
