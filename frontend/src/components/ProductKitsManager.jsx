import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

const SCHOOL_TYPES = [
  { value: 'normal', label: 'Jornada Normal' },
  { value: 'jornada_extendida', label: 'Jornada Completa' },
  { value: 'albergue', label: 'Escuela Albergue' }
]

function emptyForm() {
  return {
    id: null,
    nombre: '',
    tipo_escuela: 'normal',
    descripcion: '',
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
      tipo_escuela: kit.tipo_escuela || 'normal',
      descripcion: kit.descripcion || '',
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
      tipo_escuela: form.tipo_escuela,
      descripcion: form.descripcion.trim(),
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ marginBottom: 6 }}>Kits de productos</h3>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.92rem' }}>
            Configurá kits por tipo de escuela para que luego los directivos pidan por kit y no por producto individual.
          </p>
        </div>
        <button type="button" onClick={openCreate}>Crear kit</button>
      </div>

      {msg.text && (
        <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`}>{msg.text}</div>
      )}

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Cargando kits...</p>
      ) : kits.length === 0 ? (
        <div className="sv-empty-state" style={{ marginTop: 18 }}>
          No hay kits configurados todavía.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14, marginTop: 18 }}>
          {kits.map((kit) => (
            <article key={kit.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ margin: 0 }}>{kit.nombre}</h4>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    <span className="badge">{kit.tipo_escuela_label}</span>
                    {!kit.activo && <span className="badge" style={{ background: '#fee2e2', color: '#991b1b' }}>Inactivo</span>}
                  </div>
                  {kit.descripcion && (
                    <p style={{ marginBottom: 0, color: 'var(--muted)' }}>{kit.descripcion}</p>
                  )}
                </div>
                <div className="inline-actions">
                  <button type="button" onClick={() => openEdit(kit)}>Editar</button>
                  {kit.activo && (
                    <button type="button" className="sv-btn-rechazar" onClick={() => handleDelete(kit)}>
                      Eliminar
                    </button>
                  )}
                </div>
              </div>

              <table style={{ width: '100%', marginTop: 16 }}>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Unidad</th>
                  </tr>
                </thead>
                <tbody>
                  {(kit.items || []).map((item) => (
                    <tr key={`${kit.id}-${item.producto_id}`}>
                      <td>{item.producto_nombre}</td>
                      <td>{item.cantidad}</td>
                      <td>{item.unidad_medida || 'unidad'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          ))}
        </div>
      )}

      {modalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div style={{ background: '#f9fafb', padding: 24, borderRadius: 10, width: 'min(920px, 100%)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0 }}>{form.id ? 'Editar kit' : 'Nuevo kit'}</h3>
            <form onSubmit={handleSubmit} className="grid">
              <div>
                <label>Nombre del kit</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej: Kit Jornada Normal (100 alumnos / mes)"
                  required
                />
              </div>
              <div>
                <label>Tipo de escuela</label>
                <select
                  value={form.tipo_escuela}
                  onChange={(e) => setForm({ ...form, tipo_escuela: e.target.value })}
                  required
                >
                  {SCHOOL_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label>Descripción</label>
                <input
                  type="text"
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  placeholder="Enfoque del kit o nota interna"
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label>Productos del kit</label>
                <div style={{ display: 'grid', gap: 10 }}>
                  {form.items.map((item, index) => (
                    <div key={`kit-item-${index}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(140px, 180px) auto', gap: 10, alignItems: 'end' }}>
                      <div>
                        <select
                          value={item.producto_id}
                          onChange={(e) => updateItem(index, 'producto_id', e.target.value)}
                          required
                        >
                          <option value="">Seleccionar producto...</option>
                          {productosOrdenados.map((producto) => (
                            <option key={producto.id} value={producto.id}>
                              {producto.nombre} ({producto.unidad_medida || 'unidad'})
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
                        />
                      </div>
                      <button type="button" className="secondary" onClick={() => removeItem(index)} disabled={form.items.length === 1}>
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="secondary" style={{ marginTop: 12 }} onClick={addItem}>
                  Agregar producto
                </button>
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="secondary" onClick={closeModal}>Cancelar</button>
                <button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar kit'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
