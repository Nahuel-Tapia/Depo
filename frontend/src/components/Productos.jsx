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
  const [form, setForm] = useState({
    codigo_sku: '',
    nombre: '',
    marca: '',
    unidad_medida: 'unidad',
    ubicacion_estante: '',
    stock_minimo: 0,
    id_categoria: '',
    descripcion: '',
    es_perecedero: false
  })
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
        setDetailModal({ ...data, producto: prod })
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

  // Scanner state
  const barcodeBuffer = useRef('')
  const lastKeyTime = useRef(0)

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignorar si el foco está en un input, textarea o select (el usuario está escribiendo normalmente)
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        return
      }
      
      const currentTime = new Date().getTime()
      
      // Si pasó mucho tiempo desde la última tecla (>50ms suele ser manual), reiniciamos el buffer
      if (currentTime - lastKeyTime.current > 50) {
        barcodeBuffer.current = ''
      }
      lastKeyTime.current = currentTime
      
      if (e.key === 'Enter') {
        if (barcodeBuffer.current.length > 0) {
          const scannedCode = barcodeBuffer.current
          barcodeBuffer.current = '' // reset
          
          // Buscar el producto con el código escaneado
          const producto = productos.find(p => String(p.codigo_sku) === String(scannedCode))
          if (producto) {
            loadDetail(producto.id)
            setMsg({ text: `Producto escaneado: ${producto.nombre}`, type: 'success' })
          } else {
            setMsg({ text: `Producto no encontrado (Código: ${scannedCode})`, type: 'error' })
          }
        }
      } else if (e.key.length === 1) {
        barcodeBuffer.current += e.key
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [productos])

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
      codigo_sku: form.codigo_sku.trim() || '',
      nombre: form.nombre.trim(),
      marca: form.marca.trim() || '',
      unidad_medida: form.unidad_medida.trim() || 'unidad',
      ubicacion_estante: form.ubicacion_estante.trim() || '',
      stock_minimo: parseInt(form.stock_minimo) || 0,
      id_categoria: form.id_categoria || null,
      descripcion: form.descripcion.trim() || '',
      es_perecedero: Boolean(form.es_perecedero)
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

    setForm({
      codigo_sku: '',
      nombre: '',
      marca: '',
      unidad_medida: 'unidad',
      ubicacion_estante: '',
      stock_minimo: 0,
      id_categoria: '',
      descripcion: '',
      es_perecedero: false
    })
    setFormOpen(false)
    setMsg({ text: 'Producto creado exitosamente', type: 'success' })
    loadProductos()
  }

  const handleEdit = async (id) => {
    const producto = productos.find(p => p.id === id)
    if (!producto) return

    setEditModal({
      id: producto.id,
      codigo_sku: producto.codigo_sku || '',
      nombre: producto.nombre || '',
      marca: producto.marca || '',
      unidad_medida: producto.unidad_medida || 'unidad',
      ubicacion_estante: producto.ubicacion_estante || '',
      stock_minimo: producto.stock_minimo ?? 0,
      id_categoria: producto.id_categoria || '',
      descripcion: producto.descripcion || '',
      es_perecedero: Boolean(producto.es_perecedero)
    })
  }

  const handleEditSave = async (e) => {
    e.preventDefault()
    if (!editModal) return

    const payload = {
      codigo_sku: String(editModal.codigo_sku || '').trim() || '',
      nombre: String(editModal.nombre || '').trim(),
      marca: String(editModal.marca || '').trim() || '',
      unidad_medida: String(editModal.unidad_medida || '').trim() || 'unidad',
      ubicacion_estante: String(editModal.ubicacion_estante || '').trim() || '',
      stock_minimo: parseInt(editModal.stock_minimo, 10) || 0,
      id_categoria: editModal.id_categoria || null,
      descripcion: String(editModal.descripcion || '').trim() || '',
      es_perecedero: Boolean(editModal.es_perecedero)
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
          producto.codigo_sku,
          producto.marca,
          producto.unidad_medida,
          producto.ubicacion_estante,
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
            searchPlaceholder="Buscar por nombre, SKU, marca, deposito o categoria..."
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
              <th>SKU / ID</th>
              <th>Nombre</th>
              <th>Marca</th>
              <th>Categoría</th>
              <th>Ubicación</th>
              <th>Stock Total</th>
              <th>Estado</th>
              <th style={{ background: '#f8fafc', width: '130px' }}>Acciones</th>
            </tr>
          </thead>
        <tbody>
          {productosVista.map(p => (
            <tr key={p.id}>
              <td>
                <span style={{ fontWeight: 600, color: 'var(--dark)' }}>{p.codigo_sku || `#${p.id}`}</span>
              </td>
              <td>{p.nombre}</td>
              <td>{p.marca || '-'}</td>
              <td>{p.categoria_nombre || '-'}</td>
              <td>{p.ubicacion_estante || '-'}</td>
              <td><strong>{p.stock_total ?? 0}</strong> <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{p.unidad_medida || 'un'}</span></td>
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
                        borderRadius: 4, padding: '2px 8px', fontWeight: 600, fontSize: 11
                      }}>
                        Stock bajo
                      </span>
                    )
                  }
                  if (venceProximo) {
                    return (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        background: '#fffbeb', color: '#92400e', border: '1px solid #fcd34d',
                        borderRadius: 4, padding: '2px 8px', fontWeight: 600, fontSize: 11
                      }}>
                        Próximo a vencer
                      </span>
                    )
                  }
                  return (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      background: '#ecfdf5', color: '#065f46', border: '1px solid #6ee7b7',
                      borderRadius: 4, padding: '2px 8px', fontWeight: 600, fontSize: 11
                    }}>
                      OK
                    </span>
                  )
                })()}
              </td>
              
              <td>
                <div className="inline-actions">
                  <button onClick={() => loadDetail(p.id)} className="secondary" style={{ padding: '4px 8px', fontSize: '0.78rem' }}>Detalle</button>
                  {hasPermission('productos.edit') && (
                    <button onClick={() => handleEdit(p.id)} style={{ padding: '4px 8px', fontSize: '0.78rem' }}>Editar</button>
                  )}
                  {canDeleteProductos && (
                    <button onClick={() => handleDelete(p.id)} className="secondary" style={{ padding: '4px 8px', fontSize: '0.78rem', color: '#dc2626', borderColor: '#fca5a5' }}>Eliminar</button>
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
            background: 'rgba(0, 0, 0, 0.4)',
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
          <div style={{ background: '#ffffff', padding: 28, borderRadius: 8, width: 'min(760px, 100%)', border: '1px solid var(--border)', maxHeight: '92vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0, marginBottom: 18 }}>Crear nuevo producto</h3>
            <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              <div>
                <label>Código / SKU</label>
                <input type="text" value={form.codigo_sku} onChange={e => setForm({ ...form, codigo_sku: e.target.value })} placeholder="Ej: ART-001" />
              </div>
              <div>
                <label>Nombre del producto *</label>
                <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Resma A4 75g" required />
              </div>
              <div>
                <label>Marca / Fabricante</label>
                <input type="text" value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value })} placeholder="Ej: Ledesma" />
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
              <div>
                <label>Unidad de medida</label>
                <input type="text" value={form.unidad_medida} onChange={e => setForm({ ...form, unidad_medida: e.target.value })} placeholder="Ej: unidad, litro, kg, pack" />
              </div>
              <div>
                <label>Stock mínimo (alerta)</label>
                <input type="number" value={form.stock_minimo} onChange={e => setForm({ ...form, stock_minimo: e.target.value })} placeholder="0" min="0" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label>Ubicación en Depósito</label>
                <input type="text" value={form.ubicacion_estante} onChange={e => setForm({ ...form, ubicacion_estante: e.target.value })} placeholder="Ej: Pasillo 2 - Estante B" />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <input
                  type="checkbox"
                  id="create-es-perecedero"
                  checked={form.es_perecedero}
                  onChange={e => setForm({ ...form, es_perecedero: e.target.checked })}
                  style={{ width: 'auto', minHeight: 'auto', cursor: 'pointer' }}
                />
                <label htmlFor="create-es-perecedero" style={{ margin: 0, textTransform: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>
                  Es producto perecedero (requiere control de fecha de vencimiento)
                </label>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label>Descripción / Observaciones</label>
                <textarea
                  value={form.descripcion}
                  onChange={e => setForm({ ...form, descripcion: e.target.value })}
                  placeholder="Detalles adicionales, contenido o especificaciones técnicas..."
                  rows={3}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontFamily: 'Ubuntu, sans-serif', fontSize: '0.9rem' }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="button" className="secondary" onClick={() => setFormOpen(false)}>Cancelar</button>
                <button type="submit" style={{ width: 'auto', margin: 0, padding: '8px 18px' }}>Guardar producto</button>
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
            background: 'rgba(0, 0, 0, 0.4)',
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
          <div style={{ background: '#ffffff', padding: 28, borderRadius: 8, width: 'min(760px, 100%)', border: '1px solid var(--border)', maxHeight: '92vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0, marginBottom: 18 }}>Editar producto</h3>
            <form onSubmit={handleEditSave} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              <div>
                <label>Código / SKU</label>
                <input type="text" value={editModal.codigo_sku} onChange={e => setEditModal({ ...editModal, codigo_sku: e.target.value })} placeholder="Ej: ART-001" />
              </div>
              <div>
                <label>Nombre del producto *</label>
                <input type="text" value={editModal.nombre} onChange={e => setEditModal({ ...editModal, nombre: e.target.value })} placeholder="Ej: Resma A4 75g" required />
              </div>
              <div>
                <label>Marca / Fabricante</label>
                <input type="text" value={editModal.marca} onChange={e => setEditModal({ ...editModal, marca: e.target.value })} placeholder="Ej: Ledesma" />
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
              <div>
                <label>Unidad de medida</label>
                <input type="text" value={editModal.unidad_medida} onChange={e => setEditModal({ ...editModal, unidad_medida: e.target.value })} placeholder="Ej: unidad, litro, kg, pack" />
              </div>
              <div>
                <label>Stock mínimo (alerta)</label>
                <input type="number" value={editModal.stock_minimo} onChange={e => setEditModal({ ...editModal, stock_minimo: e.target.value })} placeholder="0" min="0" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label>Ubicación en Depósito</label>
                <input type="text" value={editModal.ubicacion_estante} onChange={e => setEditModal({ ...editModal, ubicacion_estante: e.target.value })} placeholder="Ej: Pasillo 2 - Estante B" />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <input
                  type="checkbox"
                  id="edit-es-perecedero"
                  checked={editModal.es_perecedero}
                  onChange={e => setEditModal({ ...editModal, es_perecedero: e.target.checked })}
                  style={{ width: 'auto', minHeight: 'auto', cursor: 'pointer' }}
                />
                <label htmlFor="edit-es-perecedero" style={{ margin: 0, textTransform: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>
                  Es producto perecedero (requiere control de fecha de vencimiento)
                </label>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label>Descripción / Observaciones</label>
                <textarea
                  value={editModal.descripcion}
                  onChange={e => setEditModal({ ...editModal, descripcion: e.target.value })}
                  placeholder="Detalles adicionales, contenido o especificaciones técnicas..."
                  rows={3}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontFamily: 'Ubuntu, sans-serif', fontSize: '0.9rem' }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="button" className="secondary" onClick={() => setEditModal(null)}>Cancelar</button>
                <button type="submit" style={{ width: 'auto', margin: 0, padding: '8px 18px' }}>Guardar cambios</button>
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
              <h3 style={{ margin: 0 }}>
                {detailModal.producto?.nombre} 
                <span style={{ fontSize: '1.1rem', color: 'var(--muted)', marginLeft: 8 }}>
                  ({detailModal.producto?.codigo_sku || `#${detailModal.producto?.id}`})
                </span>
              </h3>
              <button className="secondary" onClick={() => setDetailModal(null)} style={{ margin: 0, padding: '6px 12px' }}>✕</button>
            </div>
            
            <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 20 }}>
              <p style={{ margin: '0 0 8px 0' }}><strong>Marca:</strong> {detailModal.producto?.marca || '-'}</p>
              <p style={{ margin: '0 0 8px 0' }}><strong>Categoría:</strong> {detailModal.producto?.categoria_nombre || '-'}</p>
              <p style={{ margin: 0 }}><strong>Descripción:</strong> {detailModal.producto?.descripcion || '-'}</p>
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
