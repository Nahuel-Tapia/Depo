import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

const CARGOS = ['director/a', 'vicedirector/a', 'secretario/a', 'rector/a', 'maestro/a a cargo']

export default function RetirarPedidoAnual({ onSuccess, onCancel }) {
  const { token } = useAuth()
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPedido, setSelectedPedido] = useState(null)
  const [itemsSeleccionados, setItemsSeleccionados] = useState([])
  const [cargoRetira, setCargoRetira] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [procesando, setProcesando] = useState(false)

  const loadPedidos = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await apiFetch('/api/entregas/pedidos-disponibles', { token })
      if (res.ok) {
        const data = await res.json()
        const nextPedidos = data.pedidos || []
        setPedidos(prev => JSON.stringify(prev) === JSON.stringify(nextPedidos) ? prev : nextPedidos)
      }
    } catch (err) {
      if (!silent) setMsg({ text: 'Error cargando pedidos disponibles', type: 'error' })
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true
    loadPedidos(false)

    const interval = setInterval(() => {
      if (isMounted && document.visibilityState === 'visible') {
        loadPedidos(true)
      }
    }, 3000)

    const onFocus = () => {
      if (isMounted) loadPedidos(true)
    }
    const onVisibility = () => {
      if (isMounted && document.visibilityState === 'visible') loadPedidos(true)
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      isMounted = false
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [token])

  const handleSeleccionarPedido = (pedido) => {
    setSelectedPedido(pedido)
    setItemsSeleccionados([])
    setMsg({ text: '', type: '' })
  }

  const handleToggleItem = (item) => {
    const existe = itemsSeleccionados.find(i => i.producto_id === item.producto_id)
    
    if (existe) {
      setItemsSeleccionados(itemsSeleccionados.filter(i => i.producto_id !== item.producto_id))
    } else {
      setItemsSeleccionados([
        ...itemsSeleccionados,
        {
          ...item,
          cantidad: Math.min(item.cantidad_pendiente, item.stock_actual)
        }
      ])
    }
  }

  const handleCantidadChange = (productoId, cantidad) => {
    setItemsSeleccionados(itemsSeleccionados.map(item => {
      if (item.producto_id === productoId) {
        const maximo = Math.min(item.cantidad_pendiente, item.stock_actual)
        return {
          ...item,
          cantidad: Math.max(1, Math.min(parseInt(cantidad) || 1, maximo))
        }
      }
      return item
    }))
  }

  const handleRetirar = async (e) => {
    e.preventDefault()
    
    if (!selectedPedido) {
      setMsg({ text: 'Seleccione un pedido', type: 'error' })
      return
    }

    if (itemsSeleccionados.length === 0) {
      setMsg({ text: 'Seleccione al menos un producto para retirar', type: 'error' })
      return
    }

    if (!cargoRetira) {
      setMsg({ text: 'Seleccione el cargo de quien retira', type: 'error' })
      return
    }

    setProcesando(true)
    setMsg({ text: '', type: '' })

    try {
      const payload = {
        id_pedido: selectedPedido.id,
        items: itemsSeleccionados.map(item => ({
          producto_id: item.producto_id,
          cantidad: item.cantidad,
          estado_producto: 'nuevo' // Podría ser un campo seleccionable
        })),
        cargo_retira: cargoRetira,
        observaciones: observaciones.trim() || null
      }

      const res = await apiFetch('/api/entregas/retirar', {
        token,
        method: 'POST',
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al retirar productos')
      }

      setMsg({ 
        text: data.mensaje || 'Entrega registrada correctamente', 
        type: 'success' 
      })

      // Limpiar formulario
      setTimeout(() => {
        if (onSuccess) onSuccess()
      }, 1500)

    } catch (err) {
      setMsg({ text: err.message || 'Error al registrar la entrega', type: 'error' })
    } finally {
      setProcesando(false)
    }
  }

  const totalItemsSeleccionados = itemsSeleccionados.reduce((sum, item) => sum + (item.cantidad || 0), 0)

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>Cargando pedidos disponibles...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 0 }}>
      <h3 style={{ marginTop: 0, color: '#2a4d8f' }}>Retirar Pedido Anual</h3>
      <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: -10 }}>
        Seleccione un pedido anual aprobado para retirar los productos. Puede hacer entregas parciales.
      </p>

      {msg.text && (
        <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`} style={{ marginBottom: 16 }}>
          {msg.text}
        </div>
      )}

      {!selectedPedido ? (
        // Lista de pedidos disponibles
        <div>
          <h4>Pedidos Anuales Aprobados Disponibles</h4>
          {pedidos.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
              <p>No hay pedidos anuales aprobados disponibles para retirar.</p>
              <p style={{ fontSize: '0.85rem' }}>
                Los pedidos deben estar aprobados por el director de área para poder retirarlos.
              </p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f1f5fa' }}>
                  <th style={{ padding: 10, border: '1px solid #e0e0e0', textAlign: 'left' }}>ID</th>
                  <th style={{ padding: 10, border: '1px solid #e0e0e0', textAlign: 'left' }}>Institución</th>
                  <th style={{ padding: 10, border: '1px solid #e0e0e0', textAlign: 'left' }}>Solicitante</th>
                  <th style={{ padding: 10, border: '1px solid #e0e0e0', textAlign: 'left' }}>Fecha</th>
                  <th style={{ padding: 10, border: '1px solid #e0e0e0', textAlign: 'left' }}>Productos</th>
                  <th style={{ padding: 10, border: '1px solid #e0e0e0', textAlign: 'center' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map(pedido => (
                  <tr key={pedido.id} style={{ cursor: 'pointer', ':hover': { background: '#f9f9f9' } }}>
                    <td style={{ padding: 10, border: '1px solid #e0e0e0' }}>#{pedido.id}</td>
                    <td style={{ padding: 10, border: '1px solid #e0e0e0' }}>{pedido.institucion_nombre}</td>
                    <td style={{ padding: 10, border: '1px solid #e0e0e0' }}>{pedido.solicitante_nombre}</td>
                    <td style={{ padding: 10, border: '1px solid #e0e0e0' }}>
                      {new Date(pedido.fecha_creacion).toLocaleDateString('es-AR')}
                    </td>
                    <td style={{ padding: 10, border: '1px solid #e0e0e0' }}>
                      {pedido.items.length} productos
                    </td>
                    <td style={{ padding: 10, border: '1px solid #e0e0e0', textAlign: 'center' }}>
                      <button 
                        onClick={() => handleSeleccionarPedido(pedido)}
                        style={{ margin: 0, padding: '6px 12px' }}
                      >
                        Seleccionar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        // Detalle del pedido seleccionado
        <div>
          <div style={{ background: '#f9fafb', padding: 16, borderRadius: 8, marginBottom: 16, border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
              <div>
                <h4 style={{ margin: '0 0 4px 0' }}>Pedido #{selectedPedido.id}</h4>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
                  <strong>Institución:</strong> {selectedPedido.institucion_nombre} | 
                  <strong> Solicitante:</strong> {selectedPedido.solicitante_nombre} |
                  <strong> Fecha:</strong> {new Date(selectedPedido.fecha_creacion).toLocaleDateString('es-AR')}
                </p>
              </div>
              <button 
                className="secondary" 
                onClick={() => {
                  setSelectedPedido(null)
                  setItemsSeleccionados([])
                }}
                style={{ margin: 0 }}
              >
                ← Volver a la lista
              </button>
            </div>
          </div>

          <form onSubmit={handleRetirar}>
            <h4>Productos Disponibles para Retirar</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
              <thead>
                <tr style={{ background: '#f1f5fa' }}>
                  <th style={{ padding: 10, border: '1px solid #e0e0e0', textAlign: 'left', width: 40 }}>Sel.</th>
                  <th style={{ padding: 10, border: '1px solid #e0e0e0', textAlign: 'left' }}>Producto</th>
                  <th style={{ padding: 10, border: '1px solid #e0e0e0', textAlign: 'center' }}>Solicitado</th>
                  <th style={{ padding: 10, border: '1px solid #e0e0e0', textAlign: 'center' }}>Entregado</th>
                  <th style={{ padding: 10, border: '1px solid #e0e0e0', textAlign: 'center' }}>Pendiente</th>
                  <th style={{ padding: 10, border: '1px solid #e0e0e0', textAlign: 'center' }}>Stock Actual</th>
                  <th style={{ padding: 10, border: '1px solid #e0e0e0', textAlign: 'center', width: 120 }}>A Retirar</th>
                </tr>
              </thead>
              <tbody>
                {selectedPedido.items.map(item => {
                  const seleccionado = itemsSeleccionados.find(i => i.producto_id === item.producto_id)
                  const maximoRetirable = Math.min(item.cantidad_pendiente, item.stock_actual)
                  
                  return (
                    <tr key={item.producto_id} style={{ opacity: item.cantidad_pendiente === 0 ? 0.5 : 1 }}>
                      <td style={{ padding: 10, border: '1px solid #e0e0e0', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={!!seleccionado}
                          onChange={() => handleToggleItem(item)}
                          disabled={item.cantidad_pendiente === 0}
                        />
                      </td>
                      <td style={{ padding: 10, border: '1px solid #e0e0e0' }}>
                        {item.producto_nombre}
                        {item.unidad_medida !== 'unidad' && ` (${item.unidad_medida})`}
                      </td>
                      <td style={{ padding: 10, border: '1px solid #e0e0e0', textAlign: 'center' }}>
                        {item.cantidad_solicitada}
                      </td>
                      <td style={{ padding: 10, border: '1px solid #e0e0e0', textAlign: 'center' }}>
                        {item.cantidad_entregada}
                      </td>
                      <td style={{ padding: 10, border: '1px solid #e0e0e0', textAlign: 'center' }}>
                        <strong>{item.cantidad_pendiente}</strong>
                      </td>
                      <td style={{ padding: 10, border: '1px solid #e0e0e0', textAlign: 'center' }}>
                        <span className={item.stock_actual > 0 ? 'badge' : 'badge badge-error'}>
                          {item.stock_actual}
                        </span>
                      </td>
                      <td style={{ padding: 10, border: '1px solid #e0e0e0', textAlign: 'center' }}>
                        {seleccionado ? (
                          <input
                            type="number"
                            min="1"
                            max={maximoRetirable}
                            value={seleccionado.cantidad}
                            onChange={(e) => handleCantidadChange(item.producto_id, e.target.value)}
                            style={{ width: 80, margin: 0, padding: '4px 8px' }}
                          />
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {itemsSeleccionados.length > 0 && (
              <div style={{ background: '#f0f7ff', padding: 12, borderRadius: 6, marginBottom: 16 }}>
                <p style={{ margin: 0, fontSize: '0.95rem' }}>
                  <strong>Total a retirar:</strong> {totalItemsSeleccionados} producto(s) de {itemsSeleccionados.length} tipo(s)
                </p>
              </div>
            )}

            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label>Cargo de quien retira *</label>
                <select 
                  value={cargoRetira} 
                  onChange={(e) => setCargoRetira(e.target.value)}
                  required
                >
                  <option value="">Seleccionar cargo...</option>
                  {CARGOS.map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Observaciones (opcional)</label>
                <input
                  type="text"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Ej: Retira parcial, observaciones..."
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                className="secondary" 
                onClick={onCancel || (() => setSelectedPedido(null))}
                disabled={procesando}
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                disabled={procesando || itemsSeleccionados.length === 0}
                style={{ width: 'auto', margin: 0, padding: '10px 24px' }}
              >
                {procesando ? 'Procesando...' : 'Confirmar Retiro'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
