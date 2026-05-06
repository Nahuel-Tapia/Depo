import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'
import PrintButton from './PrintButton'

export default function Proveedores() {
  const { token, hasPermission } = useAuth()
  const [proveedores, setProveedores] = useState([])
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [formOpen, setFormOpen] = useState(false)
  const initialForm = { 
    nombre: '', cuit: '', contacto: '', telefono: '', email: '', categoria: '',
    razon_social: '', direccion: '', rubro: '', email_secundario: '', sitio_web: '', observaciones: ''
  }
  const [form, setForm] = useState(initialForm)
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
      categoria: form.categoria.trim() || null,
      razon_social: form.razon_social.trim() || null,
      direccion: form.direccion.trim() || null,
      rubro: form.rubro.trim() || null,
      email_secundario: form.email_secundario.trim() || null,
      sitio_web: form.sitio_web.trim() || null,
      observaciones: form.observaciones.trim() || null
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

    setForm(initialForm)
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
      razon_social: prov.razon_social || '',
      direccion: prov.direccion || '',
      rubro: prov.rubro || '',
      email_secundario: prov.email_secundario || '',
      sitio_web: prov.sitio_web || '',
      observaciones: prov.observaciones || '',
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
      categoria: editModal.categoria.trim() || null,
      razon_social: editModal.razon_social.trim() || null,
      direccion: editModal.direccion.trim() || null,
      rubro: editModal.rubro.trim() || null,
      email_secundario: editModal.email_secundario.trim() || null,
      sitio_web: editModal.sitio_web.trim() || null,
      observaciones: editModal.observaciones.trim() || null
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
              <th>Empresa / Razón Social</th>
              <th>CUIT</th>
              <th>Contacto Principal</th>
              <th>Email / Web</th>
              <th>Rubro / Categoría</th>
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
                  <td>
                    <strong>{p.nombre}</strong>
                    {p.razon_social && <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{p.razon_social}</div>}
                    {p.direccion && <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>📍 {p.direccion}</div>}
                  </td>
                  <td><code style={{ fontSize: '0.85rem' }}>{p.cuit || '-'}</code></td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.contacto || '-'}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{p.telefono || ''}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.9rem' }}>{p.email || '-'}</div>
                    {p.sitio_web && <div style={{ fontSize: '0.8rem' }}><a href={p.sitio_web.startsWith('http') ? p.sitio_web : `https://${p.sitio_web}`} target="_blank" rel="noreferrer">🌐 Link</a></div>}
                  </td>
                  <td>
                    <div className="badge">{p.rubro || p.categoria || 'Sin rubro'}</div>
                  </td>
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
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => { if (e.target === e.currentTarget) setEditModal(null) }}
        >
          <div style={{ background: 'white', padding: 32, borderRadius: 16, width: 'min(850px, 95%)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>✏️</span> Editar Proveedor
            </h2>
            
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              <section>
                <h4 style={{ borderBottom: '1px solid #eee', paddingBottom: 8, marginBottom: 12 }}>Datos Fiscales</h4>
                <div style={{ marginBottom: 12 }}>
                  <label>Nombre Comercial *</label>
                  <input value={editModal.nombre} onChange={e => setEditModal({ ...editModal, nombre: e.target.value })} style={{ width: '100%' }} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label>Razón Social</label>
                  <input value={editModal.razon_social} onChange={e => setEditModal({ ...editModal, razon_social: e.target.value })} style={{ width: '100%' }} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label>CUIT</label>
                  <input value={editModal.cuit} onChange={e => setEditModal({ ...editModal, cuit: e.target.value })} style={{ width: '100%' }} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label>Dirección</label>
                  <input value={editModal.direccion} onChange={e => setEditModal({ ...editModal, direccion: e.target.value })} style={{ width: '100%' }} />
                </div>
              </section>

              <section>
                <h4 style={{ borderBottom: '1px solid #eee', paddingBottom: 8, marginBottom: 12 }}>Contacto y Web</h4>
                <div style={{ marginBottom: 12 }}>
                  <label>Contacto Responsable</label>
                  <input value={editModal.contacto} onChange={e => setEditModal({ ...editModal, contacto: e.target.value })} style={{ width: '100%' }} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label>Teléfono</label>
                  <input value={editModal.telefono} onChange={e => setEditModal({ ...editModal, telefono: e.target.value })} style={{ width: '100%' }} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label>Email Principal</label>
                  <input value={editModal.email} onChange={e => setEditModal({ ...editModal, email: e.target.value })} style={{ width: '100%' }} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label>Sitio Web</label>
                  <input value={editModal.sitio_web} onChange={e => setEditModal({ ...editModal, sitio_web: e.target.value })} placeholder="https://..." style={{ width: '100%' }} />
                </div>
              </section>

              <section style={{ gridColumn: '1 / -1' }}>
                <h4 style={{ borderBottom: '1px solid #eee', paddingBottom: 8, marginBottom: 12 }}>Categorización y Notas</h4>
                <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label>Rubro / Actividad</label>
                    <input value={editModal.rubro} onChange={e => setEditModal({ ...editModal, rubro: e.target.value })} placeholder="Ej: Papelería" style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label>Categoría Interna</label>
                    <input value={editModal.categoria} onChange={e => setEditModal({ ...editModal, categoria: e.target.value })} style={{ width: '100%' }} />
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <label>Observaciones</label>
                  <textarea 
                    value={editModal.observaciones} 
                    onChange={e => setEditModal({ ...editModal, observaciones: e.target.value })} 
                    style={{ width: '100%', height: 80, padding: 10, borderRadius: 8, border: '1px solid #cbd5e1' }}
                  />
                </div>
              </section>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 32, justifyContent: 'flex-end' }}>
              <button className="secondary" onClick={() => setEditModal(null)}>Cancelar</button>
              <button onClick={handleEditSave} style={{ padding: '10px 24px' }}>Guardar cambios</button>
            </div>
            {editModal.error && <div className="msg show msg-error" style={{ marginTop: 16 }}>{editModal.error}</div>}
          </div>
        </div>
      )}

      {formOpen && canCreate && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setFormOpen(false) }}
        >
          <div style={{ background: 'white', padding: 32, borderRadius: 16, width: 'min(850px, 95%)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: 24 }}>🚀 Nuevo Proveedor</h2>
            <form onSubmit={handleCreate}>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                <section>
                  <h4 style={{ borderBottom: '1px solid #eee', paddingBottom: 8, marginBottom: 12 }}>Identificación</h4>
                  <div style={{ marginBottom: 12 }}>
                    <label>Nombre Comercial *</label>
                    <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Librería Central" required />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label>Razón Social</label>
                    <input type="text" value={form.razon_social} onChange={e => setForm({ ...form, razon_social: e.target.value })} placeholder="Ej: Juan Perez S.R.L." />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label>CUIT</label>
                    <input type="text" value={form.cuit} onChange={e => setForm({ ...form, cuit: e.target.value })} placeholder="30-..." />
                  </div>
                </section>

                <section>
                  <h4 style={{ borderBottom: '1px solid #eee', paddingBottom: 8, marginBottom: 12 }}>Contacto</h4>
                  <div style={{ marginBottom: 12 }}>
                    <label>Email Principal</label>
                    <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="info@..." />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label>Teléfono</label>
                    <input type="text" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label>Dirección</label>
                    <input type="text" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} placeholder="Calle y altura" />
                  </div>
                </section>

                <section style={{ gridColumn: '1 / -1' }}>
                   <h4 style={{ borderBottom: '1px solid #eee', paddingBottom: 8, marginBottom: 12 }}>Información Adicional</h4>
                   <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label>Rubro / Actividad</label>
                      <input type="text" value={form.rubro} onChange={e => setForm({ ...form, rubro: e.target.value })} />
                    </div>
                    <div>
                      <label>Sitio Web</label>
                      <input type="text" value={form.sitio_web} onChange={e => setForm({ ...form, sitio_web: e.target.value })} placeholder="www.empresa.com" />
                    </div>
                   </div>
                   <div style={{ marginTop: 12 }}>
                    <label>Observaciones</label>
                    <textarea value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} style={{ width: '100%', height: 60, padding: 10, borderRadius: 8, border: '1px solid #cbd5e1' }} />
                   </div>
                </section>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 32, justifyContent: 'flex-end' }}>
                <button type="button" className="secondary" onClick={() => setFormOpen(false)}>Cancelar</button>
                <button type="submit" style={{ padding: '10px 24px' }}>Guardar Proveedor</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
