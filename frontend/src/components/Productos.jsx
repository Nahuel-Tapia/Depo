import { useState, useEffect, useMemo, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'
import PrintButton from './PrintButton'
import FilterSortButton from './FilterSortButton'

export default function Productos() {
  const { token, user, hasPermission } = useAuth()
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [formOpen, setFormOpen] = useState(false)
  const [editModal, setEditModal] = useState(null)
  const [deleteModal, setDeleteModal] = useState(null)
  const [detailModal, setDetailModal] = useState(null)
  const [searchText, setSearchText] = useState('')
  const [filterCategoria, setFilterCategoria] = useState('')
  const [filterEstado, setFilterEstado] = useState('')
  const [sortBy, setSortBy] = useState('nombre_asc')
  const [form, setForm] = useState({ nombre: '', marca: '', unidad_medida: 'unidad', stock_minimo: 0, id_categoria: '' })
  const [vencimientosProximos, setVencimientosProximos] = useState(new Set())
  const canDeleteProductos = hasPermission('productos.delete') || user?.role === 'admin' || user?.role === 'master'

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
        // Nuevamente, esperamos que data.productos incluya deposito en cada item
        setProductos(data.productos || [])
      }
    } catch { /* ignore */ }
  }

  const [stockPorDeposito, setStockPorDeposito] = useState([])

  const loadStockPorDeposito = async () => {
    try {
      const res = await apiFetch('/api/depositos/stock-por-producto', { token })
      if (res.ok) {
        const data = await res.json()
        setStockPorDeposito(data.productos || [])
      }
    } catch { /* ignore */ }
  }

  const loadDetail = async (id) => {
    try {
      const res = await apiFetch(`/api/productos/${id}/stock-detalle`, { token })
      if (res.ok) {
        const data = await res.json()
        const prod = productos.find(p => p.id === id)
        setDetailModal({ ...data, producto_nombre: prod?.nombre || 'Producto' })
      }
    } catch { /* ignore */ }
  }

  const loadVencimientos = async () => {
    try {
      const res = await apiFetch('/api/depositos/vencimientos-proximos?dias=60', { token })
      if (res.ok) {
        const data = await res.json()
        const ids = new Set((data.alertas || []).map(a => Number(a.id_producto)))
        setVencimientosProximos(ids)
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    loadCategorias()
    loadProductos()
    loadStockPorDeposito()
    loadVencimientos()
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setMsg({ text: '', type: '' })

    const payload = {
      nombre: form.nombre.trim(),
      marca: form.marca.trim() || '',
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

    setForm({ nombre: '', marca: '', unidad_medida: 'unidad', stock_minimo: 0, id_categoria: '' })
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
      marca: producto.marca || '',
      unidad_medida: producto.unidad_medida || 'unidad',
      stock_minimo: producto.stock_minimo ?? 0,
      id_categoria: producto.id_categoria || ''
    })
  }

  const handleEditSave = async (e) => {
    e.preventDefault()
    if (!editModal) return

    const payload = {
      nombre: String(editModal.nombre || '').trim(),
      marca: String(editModal.marca || '').trim() || '',
      unidad_medida: String(editModal.unidad_medida || '').trim() || 'unidad',
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

  const getProductoEstado = (producto) => {
    const stock = producto.stock_total ?? producto.stock_actual ?? 0
    const minimo = producto.stock_minimo ?? 0
    if (stock <= 0 || (minimo > 0 && stock <= minimo)) return 'stock_bajo'
    if (vencimientosProximos.has(Number(producto.id))) return 'vence_proximo'
    return 'ok'
  }

  const productosVista = useMemo(() => {
    const search = searchText.trim().toLowerCase()

    return [...productos]
      .filter((producto) => {
        const matchesSearch = !search || [
          producto.nombre,
          producto.marca,
          producto.unidad_medida,
          producto.deposito,
          producto.categoria_nombre,
        ].some((value) => String(value || '').toLowerCase().includes(search))

        return matchesSearch &&
          (!filterCategoria || String(producto.categoria_nombre || '') === filterCategoria) &&
          (!filterEstado || getProductoEstado(producto) === filterEstado)
      })
      .sort((a, b) => {
        if (sortBy === 'stock_desc') return Number(b.stock_total ?? b.stock_actual ?? 0) - Number(a.stock_total ?? a.stock_actual ?? 0)
        if (sortBy === 'stock_asc') return Number(a.stock_total ?? a.stock_actual ?? 0) - Number(b.stock_total ?? b.stock_actual ?? 0)
        if (sortBy === 'categoria_asc') return String(a.categoria_nombre || '').localeCompare(String(b.categoria_nombre || ''), 'es', { sensitivity: 'base' })
        if (sortBy === 'deposito_asc') return String(a.deposito || '').localeCompare(String(b.deposito || ''), 'es', { sensitivity: 'base' })
        return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { sensitivity: 'base' })
      })
  }, [productos, searchText, filterCategoria, filterEstado, sortBy, vencimientosProximos])

  const productoFilterCount = [searchText.trim(), filterCategoria, filterEstado].filter(Boolean).length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2>Gestión de Productos</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <FilterSortButton
            searchValue={searchText}
            searchPlaceholder="Buscar producto, deposito o categoria..."
            onSearchChange={setSearchText}
            filters={[
              {
                key: 'categoria',
                label: 'Categoria',
                value: filterCategoria,
                onChange: setFilterCategoria,
                emptyLabel: 'Todas',
                options: categorias.map((cat) => ({ value: String(cat.nombre), label: cat.nombre })),
              },
              {
                key: 'estado',
                label: 'Estado',
                value: filterEstado,
                onChange: setFilterEstado,
                emptyLabel: 'Todos',
                options: [
                  { value: 'ok', label: 'OK' },
                  { value: 'stock_bajo', label: 'Stock bajo' },
                  { value: 'vence_proximo', label: 'Proximo a vencer' },
                ],
              },
            ]}
            sortValue={sortBy}
            sortOptions={[
              { value: 'nombre_asc', label: 'Nombre (A-Z)' },
              { value: 'categoria_asc', label: 'Categoria' },
              { value: 'deposito_asc', label: 'Deposito' },
              { value: 'stock_desc', label: 'Stock mayor' },
              { value: 'stock_asc', label: 'Stock menor' },
            ]}
            onSortChange={setSortBy}
            onClear={() => {
              setSearchText('')
              setFilterCategoria('')
              setFilterEstado('')
              setSortBy('nombre_asc')
            }}
            activeCount={productoFilterCount}
          />
          <PrintButton targetRef={printRef} title="Inventario de Productos" />
        </div>
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
              <th>Marca</th>
              <th>Unidad</th>
        <th>Stock Total</th>
        <th>Depósito</th>
              <th>Categoría</th>
              <th>Estado</th>
              <th style={{ background: '#f0f9ff', width: '120px' }}>Acciones</th>
            </tr>
          </thead>
        <tbody>
          {productosVista.map(p => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{p.nombre}</td>
              <td>{p.marca || '-'}</td>
              <td>{p.unidad_medida || 'unidad'}</td>
              <td>{p.stock_total ?? 0}</td>
              <td>{p.deposito || '-'}</td>
              <td>{p.categoria_nombre || '-'}</td>
              <td>
                {(() => {
                  const stock = p.stock_total ?? p.stock_actual ?? 0
                  const minimo = p.stock_minimo ?? 0
                  const stockBajo = stock <= 0 || (minimo > 0 && stock <= minimo)
                  const venceProximo = vencimientosProximos.has(Number(p.id))
                  if (stockBajo) {
                    return (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        background: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5',
                        borderRadius: 6, padding: '3px 9px', fontWeight: 600, fontSize: 12
                      }}>
                        <span style={{ fontSize: 10 }}>●</span> Stock bajo
                      </span>
                    )
                  }
                  if (venceProximo) {
                    return (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        background: '#fffbeb', color: '#92400e', border: '1px solid #fcd34d',
                        borderRadius: 6, padding: '3px 9px', fontWeight: 600, fontSize: 12
                      }}>
                        <span style={{ fontSize: 10 }}>●</span> Próximo a vencer
                      </span>
                    )
                  }
                  return (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      background: '#ecfdf5', color: '#065f46', border: '1px solid #6ee7b7',
                      borderRadius: 6, padding: '3px 9px', fontWeight: 600, fontSize: 12
                    }}>
                      <span style={{ fontSize: 10 }}>●</span> OK
                    </span>
                  )
                })()}
              </td>
              
              <td>
                <div className="inline-actions">
                  <button onClick={() => loadDetail(p.id)} style={{ background: '#e0f2fe', color: '#0369a1' }}>Detalle</button>
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
                <label>Marca</label>
                <input type="text" value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value })} placeholder="Ej: Autor" />
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
                <label>Marca</label>
                <input type="text" value={editModal.marca} onChange={e => setEditModal({ ...editModal, marca: e.target.value })} placeholder="Ej: Autor" />
              </div>
              <div>
                <label>Unidad de medida</label>
                <input type="text" value={editModal.unidad_medida} onChange={e => setEditModal({ ...editModal, unidad_medida: e.target.value })} placeholder="Ej: unidad, kg, litro" />
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

      {detailModal && (
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
            if (e.target === e.currentTarget) setDetailModal(null)
          }}
        >
          <div style={{ background: '#f9fafb', padding: 24, borderRadius: 10, width: 'min(720px, 100%)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Ubicación y Vencimientos — {detailModal.producto_nombre}</h3>
              <button className="secondary" onClick={() => setDetailModal(null)} style={{ margin: 0, padding: '6px 12px' }}>✕</button>
            </div>

            <h4>📦 Distribución por Depósito</h4>
            {detailModal.depositos?.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>No hay stock registrado en ningún depósito.</p>
            ) : (
              <table style={{ marginBottom: 20 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th>Depósito</th>
                    <th style={{ textAlign: 'right' }}>Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {detailModal.depositos.map((d, idx) => (
                    <tr key={idx}>
                      <td>{d.deposito}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{d.cantidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <h4>📅 Fechas de Vencimiento</h4>
            {detailModal.vencimientos?.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>No hay fechas de vencimiento registradas.</p>
            ) : (
              <table>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th>Depósito</th>
                    <th>Fecha Vencimiento</th>
                    <th style={{ textAlign: 'right' }}>Cantidad Ingresada</th>
                  </tr>
                </thead>
                <tbody>
                  {detailModal.vencimientos.map((v, idx) => (
                    <tr key={idx}>
                      <td>{v.deposito}</td>
                      <td>{new Date(v.fecha_vencimiento).toLocaleDateString()}</td>
                      <td style={{ textAlign: 'right' }}>{v.cantidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
