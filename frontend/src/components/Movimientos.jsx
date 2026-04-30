import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

export default function Movimientos() {
  const { token } = useAuth()
  const [movimientos, setMovimientos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch('/api/movimientos', { token })
        if (res.ok) {
          const data = await res.json()
          setMovimientos(data.movimientos || [])
        } else {
          setError('Error al cargar movimientos')
        }
      } catch (e) {
        setError('Error de red')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  if (loading) return <div>Cargando movimientos...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div>
      <h2>Movimientos</h2>
      <table className="movimientos-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Producto</th>
            <th>Tipo</th>
            <th>Cantidad</th>
            <th>Estado</th>
            <th>Cargo</th>
            <th>Institución</th>
            <th>Proveedor</th>
            <th>Motivo</th>
            <th>Usuario</th>
            <th>Fecha</th>
          </tr>
        </thead>
        <tbody>
          {movimientos.map((m) => (
            <tr key={m.id}>
              <td>{m.id}</td>
              <td>{m.producto_nombre || m.nombre || m.producto || '-'}</td>
              <td>{m.tipo}</td>
              <td>{m.cantidad}</td>
              <td>{m.estado_producto || '-'}</td>
              <td>{m.cargo_retira || '-'}</td>
              <td>{m.institucion_nombre || '-'}</td>
              <td>{m.proveedor_nombre || '-'}</td>
              <td>{m.motivo || '-'}</td>
              <td>{m.usuario_nombre || ''}{m.usuario_email ? ` (${m.usuario_email})` : ''}</td>
              <td>{m.created_at ? new Date(m.created_at).toLocaleString() : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
