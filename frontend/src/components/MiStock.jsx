import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

export default function MiStock() {
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [kit, setKit] = useState(null)
  const [items, setItems] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await apiFetch('/api/directivo/mi-stock', { token })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setError(data.error || 'Error cargando Mi stock')
          setItems([])
          setKit(null)
        } else {
          const data = await res.json()
          setKit(data.kit)
          setItems(data.items || [])
        }
      } catch (err) {
        setError('Error de conexión')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [token])

  if (loading) return <div>Cargando Mi stock...</div>
  if (error) return <div className="msg show msg-error">{error}</div>

  if (!kit) return (
    <div>
      <h2>Mi stock</h2>
      <p>No tenés un kit asignado a tu institución.</p>
    </div>
  )

  return (
    <div>
      <h2>Mi stock — {kit.nombre}</h2>
      <p style={{ color: 'var(--muted)' }}>Cantidad alumnos kit: {kit.cantidad_alumnos || '-'}</p>

      <div style={{ marginTop: 18 }}>
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cantidad por kit</th>
              <th>Retirado (anual)</th>
              <th>Refuerzo autorizado</th>
              <th>Restante por retirar</th>
              <th>Total retirado</th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.producto_id}>
                <td style={{ fontWeight: 600 }}>{it.producto_nombre}</td>
                <td>{it.cantidad_por_kit} {it.unidad_medida || ''}</td>
                <td>{it.retirado_anual} {it.unidad_medida || ''}</td>
                <td>{it.pedido_refuerzo} {it.unidad_medida || ''}</td>
                <td>{it.restante} {it.unidad_medida || ''}</td>
                <td>{it.total_retirado} {it.unidad_medida || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
