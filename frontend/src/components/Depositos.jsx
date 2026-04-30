import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

export default function Depositos() {
  const { token, user, hasPermission } = useAuth()
  const [depositos, setDepositos] = useState([])
  const [depositoSeleccionado, setDepositoSeleccionado] = useState(null)
  const [stock, setStock] = useState([])
  const [perDeposit, setPerDeposit] = useState({})
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [loading, setLoading] = useState(false)
  
  // Formularios
  const [modalMovimiento, setModalMovimiento] = useState(null)
  const [formMov, setFormMov] = useState({ id_producto: '', cantidad: '', motivo: '' })
  const [productos, setProductos] = useState([])

  const canMove = hasPermission('stock.movement.create') || user?.role === 'admin'
  const esAdmin = user?.role === 'admin'
  const esOperador = user?.role === 'operador'

  // Operador solo ve Central
  const depositosMostrar = esOperador 
    ? depositos.filter(d => d.tipo === 'central')
    : depositos

  const loadDepositos = async () => {
    try {
      const res = await apiFetch('/api/depositos', { token })
      if (res.ok) {
        const data = await res.json()
        setDepositos(data.depositos || [])
        if (data.depositos?.length > 0 && !depositoSeleccionado) {
          setDepositoSeleccionado(data.depositos[0])
        }
      }
    } catch { /* ignore */ }
  }

  const loadProductos = async () => {
    try {
      const res = await apiFetch('/api/productos', { token })
      if (res.ok) {
        const data = await res.json()
        setProductos(data.productos || [])
      }
    } catch { /* ignore */ }
  }

  const loadStock = async (depositoId) => {
    if (!depositoId) return
    setLoading(true)
    try {
      const res = await apiFetch(`/api/depositos/${depositoId}/stock`, { token })
      if (res.ok) {
        const data = await res.json()
        setStock(data.stock || [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  const loadDepositosProductos = async (depositoId) => {
    try {
      const res = await apiFetch(`/api/depositos/${depositoId}/productos`, { token })
      if (res.ok) {
        const data = await res.json()
        setPerDeposit(prev => ({ ...prev, [depositoId]: data.productos || [] }))
      }
    } catch {}
  }

  useEffect(() => {
    loadDepositos()
    loadProductos()
  }, [])

  useEffect(() => {
    if (depositoSeleccionado?.id) {
      loadStock(depositoSeleccionado.id)
      loadDepositosProductos(depositoSeleccionado.id)
    }
  }, [depositoSeleccionado])

  const handleMovimiento = async (tipo) => {
    setMsg({ text: '', type: '' })
    if (!formMov.id_producto || !formMov.cantidad) {
      setMsg({ text: 'Producto y cantidad requeridos', type: 'error' })
      return
    }

    try {
      const endpoint = `/api/depositos/${depositoSeleccionado.id}/${tipo}`
      const res = await apiFetch(endpoint, {
        token,
        method: 'POST',
        body: JSON.stringify({
          id_producto: parseInt(formMov.id_producto),
          cantidad: parseInt(formMov.cantidad),
          motivo: formMov.motivo || `${tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} a depósito`
        })
      })

      if (res.ok) {
        setMsg({ text: `${tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} registrado`, type: 'success' })
        setFormMov({ id_producto: '', cantidad: '', motivo: '' })
        setModalMovimiento(null)
        loadStock(depositoSeleccionado.id)
      } else {
        const data = await res.json()
        setMsg({ text: data.error || 'Error', type: 'error' })
      }
    } catch {
      setMsg({ text: 'Error de conexión', type: 'error' })
    }
  }

  const getTipoLabel = (tipo) => {
    switch (tipo) {
      case 'central': return '🗃️ Central'
      case 'centro_civico': return '🏛️ Centro Cívico'
      case 'capsula': return '🔐 Cápsula'
      default: return tipo
    }
  }

  return (
    <div>
      <h2>📦 Gestión de Depósitos</h2>
      
      {/* Selector de depósito */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {depositos.map(d => (
          <button
            key={d.id}
            className={`tab-btn ${depositoSeleccionado?.id === d.id ? 'active' : ''}`}
            onClick={() => setDepositoSeleccionado(d)}
          >
            {getTipoLabel(d.tipo)}
          </button>
        ))}
      </div>

      {depositoSeleccionado && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ margin: 0 }}>
                {depositoSeleccionado.nombre}
              </h3>
              <p style={{ margin: '0.25rem 0', color: 'var(--muted)', fontSize: '0.85rem' }}>
                {depositoSeleccionado.descripcion} — {depositoSeleccionado.ubicacion}
              </p>
            </div>
            {depositoSeleccionado.tipo === 'capsula' && !esAdmin && (
              <span style={{ background: 'var(--warning-bg)', color: 'var(--warning-color)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                🔒 Solo admin puede mover
              </span>
            )}
          </div>

          {/* Botones de movimiento */}
          {canMove && depositoSeleccionado.tipo !== 'capsula' && !esOperador && (
            <div style={{ marginBottom: '1rem' }}>
              <button className="primary" onClick={() => setModalMovimiento('ingreso')}>+ Ingreso</button>
              <button className="secondary" style={{ marginLeft: '0.5rem' }} onClick={() => setModalMovimiento('egreso')}>- Egreso</button>
            </div>
          )}
          {canMove && depositoSeleccionado.tipo === 'capsula' && esAdmin && (
            <div style={{ marginBottom: '1rem' }}>
              <button className="primary" onClick={() => setModalMovimiento('ingreso')}>+ Ingreso</button>
              <button className="secondary" style={{ marginLeft: '0.5rem' }} onClick={() => setModalMovimiento('egreso')}>- Egreso</button>
            </div>
          )}

          {/* Mensaje */}
          {msg.text && (
            <div className={msg.type === 'error' ? 'error' : 'success'} style={{ marginBottom: '1rem' }}>
              {msg.text}
            </div>
          )}

          {/* Stock */}
          <h4 style={{ marginTop: '1rem' }}>Stock actual</h4>
          {loading ? (
            <p>Cargando...</p>
          ) : (
            <table style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Producto</th>
                  <th style={{ textAlign: 'right' }}>Cantidad</th>
                  <th style={{ textAlign: 'center' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {stock.filter(s => s.cantidad > 0).map(s => (
                  <tr key={s.id}>
                    <td>{s.nombre}</td>
                    <td style={{ textAlign: 'right' }}>{s.cantidad} {s.unidad_medida}</td>
                    <td style={{ textAlign: 'center' }}>
                      {s.requiere_autorizacion ? (
                        <span style={{ background: 'var(--warning-bg)', color: 'var(--warning-color)', padding: '0.1rem 0.3rem', borderRadius: '3px', fontSize: '0.7rem' }}>
                          🔐 Auth
                        </span>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
          {stock.filter(s => s.cantidad > 0).length === 0 && (
            <tr>
              <td colSpan={3} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                Sin stock
              </td>
            </tr>
          )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Productos por depósito (ver desde Depositos) */}
      {depositoSeleccionado && (
        <div className="card" style={{ marginTop: 20 }}>
          <h4>Productos en {depositoSeleccionado.nombre}</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Unidad</th>
              </tr>
            </thead>
            <tbody>
              {(perDeposit[depositoSeleccionado.id] || []).map((p) => (
                <tr key={p.id}>
                  <td>{p.nombre}</td>
                  <td>{p.cantidad}</td>
                  <td>{p.unidad_medida}</td>
                </tr>
              ))}
              {(perDeposit[depositoSeleccionado.id] || []).length === 0 && (
                <tr><td colSpan={3} style={{ textAlign:'center' }}>Sin productos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de movimiento */}
      {modalMovimiento && (
        <div className="modal-overlay" onClick={() => setModalMovimiento(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{modalMovimiento === 'ingreso' ? '➕ Ingreso' : '➖ Egreso'}</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
              {depositoSeleccionado.nombre}
            </p>

            <form onSubmit={e => { e.preventDefault(); handleMovimiento(modalMovimiento) }}>
              <label>Producto</label>
              <select
                value={formMov.id_producto}
                onChange={e => setFormMov({ ...formMov, id_producto: e.target.value })}
                required
              >
                <option value="">Seleccionar producto</option>
                {productos.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} ({p.unidad_medida})
                  </option>
                ))}
              </select>

              <label>Cantidad</label>
              <input
                type="number"
                min="1"
                value={formMov.cantidad}
                onChange={e => setFormMov({ ...formMov, cantidad: e.target.value })}
                required
              />

              <label>Motivo (opcional)</label>
              <input
                type="text"
                value={formMov.motivo}
                onChange={e => setFormMov({ ...formMov, motivo: e.target.value })}
                placeholder={modalMovimiento === 'ingreso' ? 'Compra, donated, etc.' : 'Entrega a institución'}
              />

              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="primary">
                  Confirmar {modalMovimiento === 'ingreso' ? 'Ingreso' : 'Egreso'}
                </button>
                <button type="button" className="secondary" onClick={() => setModalMovimiento(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
