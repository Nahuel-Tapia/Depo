import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'
import PrintButton from './PrintButton'

export default function Proveedores() {
  const { token, hasPermission } = useAuth()
  const [proveedores, setProveedores] = useState([])
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({ nombre: '', cuit: '', contacto: '', telefono: '', email: '', categoria: '' })
  const [editModal, setEditModal] = useState(null)

  const loadProveedores = async () => {
    try {
      const res = await apiFetch('/api/proveedores', { token })
      if (res.ok) {
        const data = await res.json()
        setProveedores(data.proveedores || [])
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    loadProveedores()
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setMsg({ text: '', type: '' })

    const payload = {
      nombre: form.nombre.trim(),
      cuit: form.cuit.trim() || null,
      contacto: form.contacto.trim() || null,
      telefono: form.telefono.trim() || null,
      email: form.email.trim() || null,
      categoria: form.categoria.trim() || null
    }

    const res = await apiFetch('/api/proveedores', {
      token,
      method: 'POST',
      body: JSON.stringify(payload)
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMsg({ text: data.error || 'No se pudo crear el proveedor', type: 'error' })
      return
    }

    setForm({ nombre: '', cuit: '', contacto: '', telefono: '', email: '', categoria: '' })
    setFormOpen(false)
    setMsg({ text: 'Proveedor creado correctamente', type: 'success' })
    loadProveedores()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este proveedor?')) return

    const res = await apiFetch(`/api/proveedores/${id}`, { token, method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMsg({ text: data.error || 'No se pudo eliminar', type: 'error' })
      return
    }
    setMsg({ text: 'Proveedor eliminado', type: 'success' })
    loadProveedores()
  }

  const handleEditOpen = (prov) => {
    setEditModal({
      id: prov.id,
      nombre: prov.nombre,
      cuit: prov.cuit || '',
      contacto: prov.contacto || '',
      telefono: prov.telefono || '',
      email: prov.email || '',
      categoria: prov.categoria || '',
      error: ''
    })
  }

  const handleEditSave = async () => {
    if (!editModal.nombre.trim()) {
      setEditModal({ ...editModal, error: 'El nombre es obligatorio' })
      return
    }

    const payload = {
      nombre: editModal.nombre.trim(),
      cuit: editModal.cuit.trim() || null,
      contacto: editModal.contacto.trim() || null,
      telefono: editModal.telefono.trim() || null,
      email: editModal.email.trim() || null,
      categoria: editModal.categoria.trim() || null
    }

    const res = await apiFetch(`/api/proveedores/${editModal.id}`, {
      token,
      method: 'PATCH',
      body: JSON.stringify(payload)
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setEditModal({ ...editModal, error: data.error || 'No se pudo guardar' })
      return
    }

    setEditModal(null)
    setMsg({ text: 'Proveedor actualizado', type: 'success' })
    loadProveedores()
  }

  const canCreate = hasPermission('proveedores.create')
  const canEdit = hasPermission('proveedores.edit')
  const canDelete = hasPermission('proveedores.delete')

  const printRef = useRef(null)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Proveedores</h2>
        <PrintButton targetRef={printRef} title="Listado de Proveedores" />
      </div>

      {msg.text && (
        <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`} style={{ marginBottom: 16 }}>
          {msg.text}
        </div>
      )}

      {canCreate && (
        <div style={{ marginBottom: 24 }}>
          <button
            type="button"
            style={{ width: 'auto', margin: 0, padding: '10px 18px' }}
            onClick={() => setFormOpen(true)}
          >
            Agregar proveedor
          </button>
        </div>
      )}

      <div ref={printRef} style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Contacto</th>
              <th>Teléfono</th>
              <th>Email</th>
              <th>Categoría</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {proveedores.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>No hay proveedores registrados</td>
              </tr>
            ) : (
              proveedores.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.nombre}</strong><br /><small style={{ color: '#6b7280' }}>{p.cuit || ''}</small></td>
                  <td>{p.contacto || '-'}</td>
                  <td>{p.telefono || '-'}</td>
                  <td>{p.email || '-'}</td>
                  <td>{p.categoria || '-'}</td>
                  <td>
                    <div className="inline-actions">
                      {canEdit && <button onClick={() => handleEditOpen(p)} style={{ padding: '6px 10px' }}>✏️</button>}
                      {canDelete && <button onClick={() => handleDelete(p.id)} style={{ padding: '6px 10px', background: '#ef4444' }}>🗑️</button>}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => { if (e.target === e.currentTarget) setEditModal(null) }}
        >
          <div style={{ background: 'white', padding: 28, borderRadius: 10, minWidth: 380, maxWidth: 520, width: '90%' }}>
            <h3 style={{ marginBottom: 20 }}>Editar proveedor</h3>
            <div className="grid" style={{ gap: 12 }}>
              <div><label>Empresa *</label><input value={editModal.nombre} onChange={e => setEditModal({ ...editModal, nombre: e.target.value })} style={{ width: '100%' }} /></div>
              <div><label>CUIT</label><input value={editModal.cuit} onChange={e => setEditModal({ ...editModal, cuit: e.target.value })} style={{ width: '100%' }} /></div>
              <div><label>Contacto</label><input value={editModal.contacto} onChange={e => setEditModal({ ...editModal, contacto: e.target.value })} style={{ width: '100%' }} /></div>
              <div><label>Teléfono</label><input value={editModal.telefono} onChange={e => setEditModal({ ...editModal, telefono: e.target.value })} style={{ width: '100%' }} /></div>
              <div><label>Email</label><input value={editModal.email} onChange={e => setEditModal({ ...editModal, email: e.target.value })} style={{ width: '100%' }} /></div>
              <div><label>Categoría</label><input value={editModal.categoria} onChange={e => setEditModal({ ...editModal, categoria: e.target.value })} style={{ width: '100%' }} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="secondary" onClick={() => setEditModal(null)}>Cancelar</button>
              <button onClick={handleEditSave}>Guardar cambios</button>
            </div>
            {editModal.error && <div className="msg show msg-error" style={{ marginTop: 10 }}>{editModal.error}</div>}
          </div>
        </div>
      )}

      {formOpen && canCreate && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setFormOpen(false) }}
        >
          <div style={{ background: '#f9fafb', padding: 24, borderRadius: 10, width: 'min(720px, 100%)' }}>
            <h3>Agregar proveedor</h3>
            <form onSubmit={handleCreate} className="grid">
              <div>
                <label>Empresa *</label>
                <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Distribuidora del Norte" required />
              </div>
              <div>
                <label>CUIT</label>
                <input type="text" value={form.cuit} onChange={e => setForm({ ...form, cuit: e.target.value })} placeholder="Ej: 30-12345678-9" />
              </div>
              <div>
                <label>Contacto</label>
                <input type="text" value={form.contacto} onChange={e => setForm({ ...form, contacto: e.target.value })} placeholder="Nombre del contacto" />
              </div>
              <div>
                <label>Teléfono</label>
                <input type="text" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="Ej: 0351-123456" />
              </div>
              <div>
                <label>Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="proveedor@empresa.com" />
              </div>
              <div>
                <label>Categoría</label>
                <input type="text" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} placeholder="Ej: Librería, Informática" />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="secondary" onClick={() => setFormOpen(false)}>Cancelar</button>
                <button type="submit" style={{ width: 'auto', margin: 0, padding: '10px 18px' }}>Guardar proveedor</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
