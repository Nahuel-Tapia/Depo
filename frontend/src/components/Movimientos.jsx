import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

export default function Movimientos() {
  const { token, hasPermission } = useAuth()
  const [movimientos, setMovimientos] = useState([])
  const [productos, setProductos] = useState([])
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [form, setForm] = useState({ producto_id: '', tipo: '', cantidad: '', motivo: '' })

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

  useEffect(() => {
    loadProductos()
    loadMovimientos()
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setMsg({ text: '', type: '' })

    if (!form.producto_id || !form.tipo || !form.cantidad) {
      setMsg({ text: 'Complete todos los campos obligatorios', type: 'error' })
      return
    }

    const payload = {
      producto_id: parseInt(form.producto_id),
      tipo: form.tipo,
      cantidad: parseInt(form.cantidad),
      motivo: form.motivo.trim() || null
    }

    const res = await apiFetch('/api/movimientos', {
      token,
      method: 'POST',
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setMsg({ text: data.error || 'Error al registrar movimiento', type: 'error' })
      return
    }

    setForm({ producto_id: '', tipo: '', cantidad: '', motivo: '' })
    setMsg({ text: 'Movimiento registrado', type: 'success' })
    loadMovimientos()
    loadProductos()
  }

  return (
    <div>
      <h2>Registro de Movimientos</h2>

      {hasPermission('movimientos.create') && (
        <div style={{ background: '#f9fafb', padding: 24, borderRadius: 8, marginBottom: 32 }}>
          <form onSubmit={handleCreate} className="grid">
            <div>
              <label>Producto</label>
              <select value={form.producto_id} onChange={e => setForm({ ...form, producto_id: e.target.value })} required>
                <option value="">Seleccionar producto...</option>
                {productos.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre} ({p.unidad_medida || 'unidad'})</option>
                ))}
              </select>
            </div>
            <div>
              <label>Tipo de Movimiento</label>
              <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} required>
                <option value="">Seleccionar tipo...</option>
                <option value="ingreso">Ingreso</option>
                <option value="egreso">Egreso</option>
                <option value="ajuste">Ajuste</option>
                <option value="devolucion">Devolución</option>
              </select>
            </div>
            <div>
              <label>Cantidad</label>
              <input type="number" value={form.cantidad} onChange={e => setForm({ ...form, cantidad: e.target.value })} placeholder="0" min="1" required />
            </div>
            <div>
              <label>Motivo</label>
              <input type="text" value={form.motivo} onChange={e => setForm({ ...form, motivo: e.target.value })} placeholder="Ej: Compra, Ajuste inventario" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit">Registrar movimiento</button>
            </div>
          </form>
        </div>
      )}

      {msg.text && (
        <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`}>{msg.text}</div>
      )}

      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Tipo</th>
            <th>Cantidad</th>
            <th>Motivo</th>
            <th>Registrado por</th>
            <th>Fecha</th>
          </tr>
        </thead>
        <tbody>
          {movimientos.map((m, i) => (
            <tr key={m.id || i}>
              <td>{m.producto_nombre || '-'}</td>
              <td><span className={`badge badge-${m.tipo}`}>{m.tipo}</span></td>
              <td>{m.cantidad}</td>
              <td>{m.motivo || '-'}</td>
              <td>{m.usuario_nombre || '-'}</td>
              <td>{new Date(m.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
