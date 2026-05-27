import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

function emptyForm() {
  return {
    id: null,
    nombre: '',
    descripcion: '',
    cantidad_alumnos: '',
    items: [{ producto_id: '', cantidad: '' }]
  }
}

export default function ProductKitsManager() {
  const { token } = useAuth()
  const [kits, setKits] = useState([])
  const [productos, setProductos] = useState([])
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [expandedKits, setExpandedKits] = useState({})

  const toggleKit = (id) => {
    setExpandedKits(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const productosOrdenados = useMemo(() => (
    [...productos].sort((a, b) =>
      String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es', { sensitivity: 'base' })
    )
  ), [productos])

  const loadData = async () => {
    setLoading(true)
    try {
      const [kitsRes, productosRes] = await Promise.all([
        apiFetch('/api/pedidos/kits?include_inactive=1', { token }),
        apiFetch('/api/productos', { token })
      ])

      const kitsData = kitsRes.ok ? await kitsRes.json() : { kits: [] }
      const productosData = await productosRes.json().catch(() => ({}))

      if (!kitsRes.ok) {
        const kitsError = await kitsRes.json().catch(() => ({}))
        throw new Error(kitsError.error || 'No se pudieron cargar los kits.')
      }

      if (!productosRes.ok) {
        throw new Error(productosData.error || 'No se pudieron cargar los productos para armar el kit.')
      }

      setKits(kitsData.kits || [])
      setProductos(productosData.productos || [])
    } catch (err) {
      setProductos([])
      setMsg({ text: err.message || 'No se pudieron cargar los datos del kit.', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [token])

  const openCreate = () => {
    setForm(emptyForm())
    setMsg({ text: '', type: '' })
    setModalOpen(true)
  }

  const openEdit = (kit) => {
    setForm({
      id: kit.id,
      nombre: kit.nombre || '',
      descripcion: kit.descripcion || '',
      cantidad_alumnos: kit.cantidad_alumnos || '',
      items: (kit.items || []).length
        ? kit.items.map((item) => ({
            producto_id: String(item.producto_id),
            cantidad: String(item.cantidad)
          }))
        : [{ producto_id: '', cantidad: '' }]
    })
    setMsg({ text: '', type: '' })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setForm(emptyForm())
  }

  const updateItem = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, idx) => idx === index ? { ...item, [field]: value } : item)
    }))
  }

  const addItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { producto_id: '', cantidad: '' }]
    }))
  }

  const removeItem = (index) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index)
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMsg({ text: '', type: '' })

    const payload = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim(),
      cantidad_alumnos: form.cantidad_alumnos ? Number(form.cantidad_alumnos) : null,
      items: form.items
        .filter((item) => item.producto_id && item.cantidad)
        .map((item) => ({
          producto_id: Number(item.producto_id),
          cantidad: Number(item.cantidad)
        }))
    }

    const endpoint = form.id ? `/api/pedidos/kits/${form.id}` : '/api/pedidos/kits'
    const method = form.id ? 'PUT' : 'POST'

    try {
      const res = await apiFetch(endpoint, {
        token,
        method,
        body: JSON.stringify(payload)
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo guardar el kit.')
      }

      setMsg({ text: form.id ? 'Kit actualizado correctamente.' : 'Kit creado correctamente.', type: 'success' })
      closeModal()
      loadData()
    } catch (err) {
      setMsg({ text: err.message || 'No se pudo guardar el kit.', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (kit) => {
    if (!window.confirm(`¿Eliminar el kit "${kit.nombre}"?`)) return

    try {
      const res = await apiFetch(`/api/pedidos/kits/${kit.id}`, {
        token,
        method: 'DELETE'
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo eliminar el kit.')
      }
      setMsg({ text: 'Kit desactivado correctamente.', type: 'success' })
      loadData()
    } catch (err) {
      setMsg({ text: err.message || 'No se pudo eliminar el kit.', type: 'error' })
    }
  }

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid #e2e8f0', paddingBottom: 16 }}>
        <div>
          <h3 style={{ marginBottom: 6, fontSize: '1.4rem', color: '#1e3a8a', fontWeight: 800 }}>Kits de productos</h3>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.92rem' }}>
            Creá kits por nombre y después asignalos directamente a cada escuela.
          </p>
        </div>
        <button 
          type="button" 
          onClick={openCreate}
          style={{ 
            width: 'auto', 
            margin: 0, 
            padding: '10px 20px', 
            borderRadius: 8, 
            fontSize: '0.95rem', 
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          ➕ Crear kit
        </button>
      </div>

      {msg.text && (
        <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`} style={{ marginTop: 16 }}>{msg.text}</div>
      )}

      {loading ? (
        <p style={{ color: 'var(--muted)', marginTop: 18 }}>Cargando kits...</p>
      ) : kits.length === 0 ? (
        <div className="sv-empty-state" style={{ marginTop: 18 }}>
          No hay kits configurados todavía.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>
          {kits.map((kit) => (
            <article 
              key={kit.id} 
              style={{ 
                background: '#fff', 
                border: '1px solid #e2e8f0', 
                borderRadius: 12, 
                padding: '20px 24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                transition: 'box-shadow 0.2s ease',
                position: 'relative'
              }}
            >
              <div 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  gap: 12, 
                  flexWrap: 'wrap', 
                  alignItems: 'center',
                  cursor: 'pointer'
                }}
                onClick={() => toggleKit(kit.id)}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <h4 style={{ margin: 0, fontSize: '1.15rem', color: '#1e3a8a', fontWeight: 700 }}>{kit.nombre}</h4>
                    {!kit.activo && (
                      <span className="badge" style={{ background: '#fee2e2', color: '#991b1b', fontSize: '0.75rem', padding: '2px 8px', borderRadius: 4 }}>
                        Inactivo
                      </span>
                    )}
                    <span style={{ 
                      background: '#f1f5f9', 
                      color: '#475569', 
                      fontSize: '0.8rem', 
                      padding: '3px 10px', 
                      borderRadius: 20, 
                      fontWeight: 600 
                    }}>
                      📦 {(kit.items || []).length} productos
                    </span>
                    {kit.cantidad_alumnos && (
                      <span style={{ 
                        background: '#eff6ff', 
                        color: '#1d4ed8', 
                        fontSize: '0.8rem', 
                        padding: '3px 10px', 
                        borderRadius: 20, 
                        fontWeight: 600 
                      }}>
                        👥 Ref: {kit.cantidad_alumnos} alumnos
                      </span>
                    )}
                  </div>
                  {kit.descripcion && (
                    <p style={{ margin: '6px 0 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>{kit.descripcion}</p>
                  )}
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }} onClick={(e) => e.stopPropagation()}>
                  <div className="inline-actions" style={{ display: 'flex', gap: 8 }}>
                    <button 
                      type="button" 
                      onClick={() => openEdit(kit)}
                      style={{ 
                        width: 'auto', 
                        margin: 0, 
                        padding: '6px 14px', 
                        fontSize: '0.85rem', 
                        borderRadius: 6, 
                        fontWeight: 600,
                        cursor: 'pointer' 
                      }}
                    >
                      ✏️ Editar
                    </button>
                    {kit.activo && (
                      <button 
                        type="button" 
                        className="sv-btn-rechazar" 
                        onClick={() => handleDelete(kit)}
                        style={{ 
                          width: 'auto', 
                          margin: 0, 
                          padding: '6px 14px', 
                          fontSize: '0.85rem', 
                          borderRadius: 6, 
                          fontWeight: 600,
                          cursor: 'pointer' 
                        }}
                      >
                        🗑️ Eliminar
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleKit(kit.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      margin: 0,
                      padding: 4,
                      width: 'auto',
                      minHeight: 'auto',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transform: expandedKits[kit.id] ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                    }}
                  >
                    <span style={{ fontSize: '0.95rem', color: '#64748b' }}>▼</span>
                  </button>
                </div>
              </div>

              {expandedKits[kit.id] && (
                <div style={{ 
                  marginTop: 20, 
                  borderTop: '1px solid #f1f5f9', 
                  paddingTop: 16,
                  animation: 'fadeIn 0.2s ease-out'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ textAlign: 'left', padding: '10px 12px', color: '#475569', fontWeight: 600, fontSize: '0.85rem' }}>Producto</th>
                        <th style={{ textAlign: 'center', padding: '10px 12px', color: '#475569', fontWeight: 600, fontSize: '0.85rem' }}>Cantidad</th>
                        <th style={{ textAlign: 'left', padding: '10px 12px', color: '#475569', fontWeight: 600, fontSize: '0.85rem' }}>Unidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(kit.items || []).map((item) => (
                        <tr key={`${kit.id}-${item.producto_id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 12px', color: '#334155' }}>{item.producto_nombre}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#1e3a8a' }}>{item.cantidad}</td>
                          <td style={{ padding: '10px 12px', color: '#64748b' }}>{item.unidad_medida || 'unidad'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {modalOpen && (
        <div
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(15, 23, 42, 0.6)', 
            backdropFilter: 'blur(8px)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 1000, 
            padding: 16 
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div style={{ 
            background: '#ffffff', 
            padding: 32, 
            borderRadius: 16, 
            width: '100%',
            maxWidth: '850px', 
            maxHeight: '90vh', 
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <h3 style={{ marginTop: 0, color: '#1e3a8a', fontSize: '1.4rem', fontWeight: 800 }}>{form.id ? 'Editar kit' : 'Nuevo kit'}</h3>
            <form onSubmit={handleSubmit} className="grid">
              <div>
                <label>Nombre del kit</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej: Kit Primaria Turno Manana"
                  required
                />
              </div>
              <div>
                <label>Cantidad de alumnos (referencia)</label>
                <input
                  type="number"
                  min="1"
                  value={form.cantidad_alumnos}
                  onChange={(e) => setForm({ ...form, cantidad_alumnos: e.target.value })}
                  placeholder="Ej: 100"
                  required
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label>Descripcion</label>
                <input
                  type="text"
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  placeholder="Enfoque del kit o nota interna"
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontWeight: 600, color: '#334155', marginBottom: 10, display: 'block' }}>Productos del kit</label>
                <div style={{ display: 'grid', gap: 12 }}>
                  {form.items.map((item, index) => (
                    <div key={`kit-item-${index}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(120px, 150px) auto', gap: 10, alignItems: 'end' }}>
                      <div>
                        <select
                          value={item.producto_id}
                          onChange={(e) => updateItem(index, 'producto_id', e.target.value)}
                          required
                        >
                          <option value="">Seleccionar producto...</option>
                          {productosOrdenados.map((producto) => (
                            <option key={producto.id} value={producto.id}>
                              {producto.nombre}{producto.marca ? ` - ${producto.marca}` : ''} ({producto.unidad_medida || 'unidad'})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={item.cantidad}
                          onChange={(e) => updateItem(index, 'cantidad', e.target.value)}
                          placeholder="Cantidad"
                          required
                          style={{ margin: 0 }}
                        />
                      </div>
                      <button 
                        type="button" 
                        onClick={() => removeItem(index)} 
                        disabled={form.items.length === 1}
                        style={{ 
                          width: 'auto', 
                          margin: 0, 
                          padding: '10px 14px', 
                          borderRadius: 8, 
                          background: '#fee2e2', 
                          color: '#991b1b', 
                          fontSize: '0.95rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: '44px'
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
                <button 
                  type="button" 
                  className="secondary" 
                  onClick={addItem}
                  style={{ 
                    width: 'auto', 
                    marginTop: 14, 
                    marginBottom: 0, 
                    padding: '8px 16px', 
                    borderRadius: 8, 
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer'
                  }}
                >
                  ➕ Agregar producto
                </button>
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24, borderTop: '1px solid #e2e8f0', paddingTop: 20 }}>
                <button 
                  type="button" 
                  className="secondary" 
                  onClick={closeModal}
                  style={{ width: 'auto', margin: 0, padding: '10px 20px', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  style={{ width: 'auto', margin: 0, padding: '10px 20px', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
                >
                  {saving ? 'Guardando...' : 'Guardar kit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
