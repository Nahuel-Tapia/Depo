import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

export default function HistorialConsumoPanel({ institucionId, institucionNombre, onClose }) {
  const { token } = useAuth()
  const [historial, setHistorial] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (institucionId) {
      loadHistorial()
    }
  }, [institucionId])

  const loadHistorial = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/supervisor/instituciones/${institucionId}/historial-consumo`, { token })
      if (res.ok) {
        const data = await res.json()
        setHistorial(data)
      } else {
        const err = await res.json()
        setError(err.error || 'Error al cargar historial')
      }
    } catch (err) {
      console.error('Error cargando historial de consumo:', err)
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const formatFecha = (fecha) => {
    if (!fecha) return '-'
    const d = new Date(fecha)
    return d.toLocaleDateString('es-AR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const estadoBadge = (estado) => {
    const styles = {
      aprobado: { bg: '#d1fae5', color: '#065f46' },
      entregado: { bg: '#d1fae5', color: '#065f46' },
      finalizado: { bg: '#d1fae5', color: '#065f46' },
      pendiente_director: { bg: '#dbeafe', color: '#1d4ed8' }
    }
    const style = styles[estado] || { bg: '#f3f4f6', color: '#374151' }
    const label = estado === 'pendiente_director' ? 'Pendiente Director' : 
                  estado === 'entregado' || estado === 'finalizado' ? 'Entregado' : 
                  'Aprobado'
    return (
      <span style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 12,
        fontSize: '0.75rem',
        fontWeight: 600,
        background: style.bg,
        color: style.color
      }}>
        {label}
      </span>
    )
  }

  const tipoBadge = (tipo) => {
    const isRefuerzo = tipo === 'refuerzo'
    return (
      <span style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 12,
        fontSize: '0.75rem',
        fontWeight: 600,
        background: isRefuerzo ? '#ede9fe' : '#dbeafe',
        color: isRefuerzo ? '#6d28d9' : '#1d4ed8'
      }}>
        {isRefuerzo ? 'Refuerzo' : 'Anual'}
      </span>
    )
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: '1.1rem', color: '#6b7280' }}>Cargando historial...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: '1.1rem', color: '#dc2626', marginBottom: 16 }}>{error}</div>
        <button onClick={loadHistorial} className="primary">Reintentar</button>
      </div>
    )
  }

  if (!historial) return null

  const { pedidos, movimientos, consumo_por_producto, resumen } = historial

  return (
    <div style={{ padding: '20px 0' }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#1e293b' }}>Historial de Consumo</h2>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.95rem' }}>
            {institucionNombre || 'Institución'}
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} className="secondary" style={{ padding: '8px 16px' }}>
            Cerrar
          </button>
        )}
      </div>

      {/* Resumen */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
        gap: 16, 
        marginBottom: 32 
      }}>
        <div style={{ 
          background: '#f8fafc', 
          border: '1px solid #e2e8f0', 
          borderRadius: 12, 
          padding: 16,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e293b' }}>
            {resumen.pedidos_anuales?.total || 0}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Pedidos Anuales</div>
        </div>
        <div style={{ 
          background: '#f0f9ff', 
          border: '1px solid #bae6fd', 
          borderRadius: 12, 
          padding: 16,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0369a1' }}>
            {resumen.pedidos_refuerzo?.total || 0}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#0369a1' }}>Pedidos Refuerzo</div>
        </div>
        <div style={{ 
          background: '#f0fdf4', 
          border: '1px solid #86efac', 
          borderRadius: 12, 
          padding: 16,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#166534' }}>
            {(resumen.pedidos_anuales?.entregados || 0) + (resumen.pedidos_refuerzo?.entregados || 0)}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#166534' }}>Entregados</div>
        </div>
        <div style={{ 
          background: '#fff7ed', 
          border: '1px solid #fed7aa', 
          borderRadius: 12, 
          padding: 16,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#9a3412' }}>
            {(resumen.pedidos_anuales?.pendientes || 0) + (resumen.pedidos_refuerzo?.pendientes || 0)}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#9a3412' }}>Pendientes</div>
        </div>
      </div>

      {/* Consumo por producto */}
      {consumo_por_producto && consumo_por_producto.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: '1.1rem', color: '#1e293b', marginBottom: 16 }}>
            Consumo Histórico por Producto
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Producto</th>
                  <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #e2e8f0', fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Total Consumido</th>
                  <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #e2e8f0', fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Entregas</th>
                  <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #e2e8f0', fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Última Entrega</th>
                </tr>
              </thead>
              <tbody>
                {consumo_por_producto.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: 12, fontSize: '0.9rem' }}>{item.producto}</td>
                    <td style={{ padding: 12, textAlign: 'center', fontWeight: 600, color: '#1e293b' }}>
                      {item.total_consumido} {item.unidad_medida}
                    </td>
                    <td style={{ padding: 12, textAlign: 'center', color: '#64748b' }}>{item.cantidad_movimientos}</td>
                    <td style={{ padding: 12, textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                      {formatFecha(item.ultima_entrega)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pedidos anteriores */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: '1.1rem', color: '#1e293b', marginBottom: 16 }}>
          Pedidos Anteriores
        </h3>
        {pedidos.length === 0 ? (
          <p style={{ color: '#64748b', fontStyle: 'italic' }}>No hay pedidos anteriores registrados.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Fecha</th>
                  <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Tipo</th>
                  <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Estado</th>
                  <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Detalle</th>
                  <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Solicitante</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((pedido) => (
                  <tr key={pedido.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: 12, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{formatFecha(pedido.fecha)}</td>
                    <td style={{ padding: 12 }}>{tipoBadge(pedido.tipo)}</td>
                    <td style={{ padding: 12 }}>{estadoBadge(pedido.estado)}</td>
                    <td style={{ padding: 12, fontSize: '0.85rem', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {pedido.detalle}
                    </td>
                    <td style={{ padding: 12, fontSize: '0.85rem', color: '#64748b' }}>{pedido.solicitante || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Movimientos recientes */}
      <div>
        <h3 style={{ fontSize: '1.1rem', color: '#1e293b', marginBottom: 16 }}>
          Últimas Entregas (Egresos)
        </h3>
        {movimientos.length === 0 ? (
          <p style={{ color: '#64748b', fontStyle: 'italic' }}>No hay movimientos de entrega registrados.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Fecha</th>
                  <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Producto</th>
                  <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #e2e8f0', fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Cantidad</th>
                  <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((mov) => (
                  <tr key={mov.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: 12, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{formatFecha(mov.fecha)}</td>
                    <td style={{ padding: 12, fontSize: '0.9rem' }}>{mov.producto}</td>
                    <td style={{ padding: 12, textAlign: 'center', fontWeight: 600, color: '#1e293b' }}>
                      {mov.cantidad}
                    </td>
                    <td style={{ padding: 12, fontSize: '0.85rem', color: '#64748b' }}>{mov.usuario || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}