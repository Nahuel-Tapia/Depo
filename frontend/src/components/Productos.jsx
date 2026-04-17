import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'
import PrintButton from './PrintButton'

export default function Productos() {
  const { token, user, hasPermission } = useAuth()
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [formOpen, setFormOpen] = useState(false)
  const [editModal, setEditModal] = useState(null)
  const [deleteModal, setDeleteModal] = useState(null)
  const [form, setForm] = useState({ nombre: '', unidad_medida: 'unidad', stock_actual: 0, stock_minimo: 0, id_categoria: '' })
  const canDeleteProductos = hasPermission('productos.delete') || user?.role === 'admin'

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
      stock_actual: parseInt(form.stock_actual) || 0,
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

    setForm({ nombre: '', unidad_medida: 'unidad', stock_actual: 0, stock_minimo: 0, id_categoria: '' })
    setFormOpen(false)
    setMsg({ text: 'Producto creado', type: 'success' })
    loadProductos()
  }

  const handleEdit = async (id) => {
    const producto = productos.find(p => p.id === id)
    if (!producto) return

    setEditModal({
      id: producto.id,
      nombre: producto.nombre || '',
      unidad_medida: producto.unidad_medida || 'unidad',
      stock_actual: producto.stock_actual ?? 0,
      stock_minimo: producto.stock_minimo ?? 0,
      id_categoria: producto.id_categoria || ''
    })
  }

  const handleEditSave = async (e) => {
    e.preventDefault()
    if (!editModal) return

    const payload = {
      nombre: String(editModal.nombre || '').trim(),
      unidad_medida: String(editModal.unidad_medida || '').trim() || 'unidad',
      stock_actual: parseInt(editModal.stock_actual, 10) || 0,
      stock_minimo: parseInt(editModal.stock_minimo, 10) || 0,
      id_categoria: editModal.id_categoria || null
    }

    if (!payload.nombre) {
      setMsg({ text: 'El nombre es obligatorio', type: 'error' })
      return
    }

    const res = await apiFetch(`/api/productos/${editModal.id}`, {
      token,
      method: 'PATCH',
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setMsg({ text: data.error || 'No se pudo editar el producto', type: 'error' })
      return
    }

    setEditModal(null)
    setMsg({ text: 'Producto actualizado', type: 'success' })
    loadProductos()
  }

  const handleDelete = async (id) => {
    const producto = productos.find(p => p.id === id)
    if (!producto) return
    setDeleteModal({ id, nombre: producto.nombre })
  }

  const confirmDelete = async () => {
    if (!deleteModal) return

    const res = await apiFetch(`/api/productos/${deleteModal.id}`, {
      token,
      method: 'DELETE'
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setMsg({ text: data.error || 'No se pudo eliminar el producto', type: 'error' })
      return
    }

    setDeleteModal(null)
    setMsg({ text: 'Producto eliminado', type: 'success' })
    loadProductos()
  }

  const printRef = useRef(null)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Gestión de Productos</h2>
        <PrintButton targetRef={printRef} title="Inventario de Productos" />
      </div>

      {hasPermission('productos.create') && (
        <div style={{ marginBottom: 24 }}>
          <button
            type="button"
            style={{ width: 'auto', margin: 0, padding: '10px 18px' }}
            onClick={() => setFormOpen(true)}
          >
            Crear producto
          </button>
        </div>
      )}

      {msg.text && (
        <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`}>{msg.text}</div>
      )}

      <div ref={printRef}>
      <h3>Inventario de Productos</h3>
      <table className="productos-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Unidad</th>
            <th>Stock Actual</th>
            <th>Stock Mín.</th>
            <th>Categoría</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {productos.map(p => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{p.nombre}</td>
              <td>{p.unidad_medida || 'unidad'}</td>
              <td>{p.stock_actual ?? 0}</td>
              <td>{p.stock_minimo || 0}</td>
              <td>{p.categoria_nombre || '-'}</td>
              <td>
                {(p.stock_actual ?? 0) <= (p.stock_minimo || 0)
                  ? <span style={{ color: '#ef4444', fontWeight: 600 }}>⚠ Bajo</span>
                  : <span style={{ color: '#10b981' }}>OK</span>
                }
              </td>
              <td>
                <div className="inline-actions">
                  {hasPermission('productos.edit') && (
                    <button onClick={() => handleEdit(p.id)}>Editar</button>
                  )}
                  {canDeleteProductos && (
                    <button onClick={() => handleDelete(p.id)}>Eliminar</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {formOpen && hasPermission('productos.create') && (
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
            if (e.target === e.currentTarget) setFormOpen(false)
          }}
        >
          <div style={{ background: '#f9fafb', padding: 24, borderRadius: 10, width: 'min(720px, 100%)' }}>
            <h3>Crear producto</h3>
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
                <label>Stock actual</label>
                <input type="number" value={form.stock_actual} onChange={e => setForm({ ...form, stock_actual: e.target.value })} placeholder="0" min="0" />
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
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="secondary" onClick={() => setFormOpen(false)}>Cancelar</button>
                <button type="submit" style={{ width: 'auto', margin: 0, padding: '10px 18px' }}>Guardar producto</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editModal && hasPermission('productos.edit') && (
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
            if (e.target === e.currentTarget) setEditModal(null)
          }}
        >
          <div style={{ background: '#f9fafb', padding: 24, borderRadius: 10, width: 'min(720px, 100%)' }}>
            <h3>Editar producto</h3>
            <form onSubmit={handleEditSave} className="grid">
              <div>
                <label>Nombre del producto</label>
                <input type="text" value={editModal.nombre} onChange={e => setEditModal({ ...editModal, nombre: e.target.value })} placeholder="Ej: Resma A4" required />
              </div>
              <div>
                <label>Unidad de medida</label>
                <input type="text" value={editModal.unidad_medida} onChange={e => setEditModal({ ...editModal, unidad_medida: e.target.value })} placeholder="Ej: unidad, kg, litro" />
              </div>
              <div>
                <label>Stock actual</label>
                <input type="number" value={editModal.stock_actual} onChange={e => setEditModal({ ...editModal, stock_actual: e.target.value })} placeholder="0" min="0" />
              </div>
              <div>
                <label>Stock mínimo</label>
                <input type="number" value={editModal.stock_minimo} onChange={e => setEditModal({ ...editModal, stock_minimo: e.target.value })} placeholder="0" min="0" />
              </div>
              <div>
                <label>Categoría</label>
                <select value={editModal.id_categoria} onChange={e => setEditModal({ ...editModal, id_categoria: e.target.value })}>
                  <option value="">-- Sin categoría --</option>
                  {categorias.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="secondary" onClick={() => setEditModal(null)}>Cancelar</button>
                <button type="submit" style={{ width: 'auto', margin: 0, padding: '10px 18px' }}>Guardar cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteModal && canDeleteProductos && (
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
            if (e.target === e.currentTarget) setDeleteModal(null)
          }}
        >
          <div style={{ background: '#f9fafb', padding: 24, borderRadius: 10, width: 'min(520px, 100%)' }}>
            <h3>Confirmar eliminación</h3>
            <p style={{ marginTop: 8, marginBottom: 20 }}>
              ¿Está seguro que quiere eliminar "{deleteModal.nombre}"?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="secondary" onClick={() => setDeleteModal(null)}>No</button>
              <button type="button" onClick={confirmDelete} style={{ width: 'auto', margin: 0, padding: '10px 18px' }}>Sí</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
