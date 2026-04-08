import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

export default function Productos() {
  const { token, hasPermission } = useAuth()
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [form, setForm] = useState({ nombre: '', unidad_medida: 'unidad', stock_minimo: 0, id_categoria: '' })

  const loadCategorias = async () => {
    try {
      const res = await apiFetch('/api/productos/categorias', { token })
      if (res.ok) {
        const data = await res.json()
        setCategorias(data.categorias || [])
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

  useEffect(() => {
    loadCategorias()
    loadProductos()
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setMsg({ text: '', type: '' })

    const payload = {
      nombre: form.nombre.trim(),
      unidad_medida: form.unidad_medida.trim() || 'unidad',
      stock_minimo: parseInt(form.stock_minimo) || 0,
      id_categoria: form.id_categoria || null
    }

    const res = await apiFetch('/api/productos', {
      token,
      method: 'POST',
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setMsg({ text: data.error || 'Error al crear producto', type: 'error' })
      return
    }

    setForm({ nombre: '', unidad_medida: 'unidad', stock_minimo: 0, id_categoria: '' })
    setMsg({ text: 'Producto creado', type: 'success' })
    loadProductos()
  }

  const handleEdit = async (id) => {
    const producto = productos.find(p => p.id === id)
    if (!producto) return

    const nuevoNombre = window.prompt('Nuevo nombre:', producto.nombre)
    if (nuevoNombre === null) return

    const res = await apiFetch(`/api/productos/${id}`, {
      token,
      method: 'PATCH',
      body: JSON.stringify({ nombre: nuevoNombre })
    })

    if (!res.ok) {
      alert('No se pudo editar el producto')
      return
    }

    loadProductos()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro?')) return

    const res = await apiFetch(`/api/productos/${id}`, {
      token,
      method: 'DELETE'
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'No se pudo eliminar el producto')
      return
    }

    loadProductos()
  }

  return (
    <div>
      <h2>Gestión de Productos</h2>

      {hasPermission('productos.create') && (
        <div style={{ background: '#f9fafb', padding: 24, borderRadius: 8, marginBottom: 32 }}>
          <form onSubmit={handleCreate} className="grid">
            <div>
              <label>Nombre del producto</label>
              <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Resma A4" required />
            </div>
            <div>
              <label>Unidad de medida</label>
              <input type="text" value={form.unidad_medida} onChange={e => setForm({ ...form, unidad_medida: e.target.value })} placeholder="Ej: unidad, kg, litro" />
            </div>
            <div>
              <label>Stock mínimo</label>
              <input type="number" value={form.stock_minimo} onChange={e => setForm({ ...form, stock_minimo: e.target.value })} placeholder="0" min="0" />
            </div>
            <div>
              <label>Categoría</label>
              <select value={form.id_categoria} onChange={e => setForm({ ...form, id_categoria: e.target.value })}>
                <option value="">-- Sin categoría --</option>
                {categorias.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit">Crear producto</button>
            </div>
          </form>
        </div>
      )}

      {msg.text && (
        <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`}>{msg.text}</div>
      )}

      <h3>Inventario de Productos</h3>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Unidad</th>
            <th>Stock Mín.</th>
            <th>Categoría</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {productos.map(p => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{p.nombre}</td>
              <td>{p.unidad_medida || 'unidad'}</td>
              <td>{p.stock_minimo || 0}</td>
              <td>{p.categoria_nombre || '-'}</td>
              <td>
                <div className="inline-actions">
                  {hasPermission('productos.edit') && (
                    <button onClick={() => handleEdit(p.id)}>Editar</button>
                  )}
                  {hasPermission('productos.delete') && (
                    <button onClick={() => handleDelete(p.id)}>Eliminar</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
