import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

const CATEGORIAS = [
  'Uso en aula',
  'Uso administrativo',
  'Pérdida / rotura',
  'Donación',
  'Devolución',
  'Otro',
]

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function StockBar({ consumido, total }) {
  const pct = total > 0 ? Math.min(100, (consumido / total) * 100) : 0
  const color = pct >= 90 ? '#ef4444' : pct >= 60 ? '#f59e0b' : '#10b981'
  return (
    <div style={{ width: '100%', height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.4s ease' }} />
    </div>
  )
}

export default function DepositoInstitucion() {
  const { token } = useAuth()
  const [tab, setTab] = useState('stock')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [institucion, setInstitucion] = useState(null)
  const [items, setItems] = useState([])
  const [historial, setHistorial] = useState([])
  const [historialLoading, setHistorialLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [consumos, setConsumos] = useState({}) // { productoId: { cantidad: '', categoria: '', motivo: '' } }
  const [showForm, setShowForm] = useState(false)

  const loadStock = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/directivo/deposito', { token })
      if (res.ok) {
        const data = await res.json()
        setInstitucion(data.institucion)
        setItems(data.items || [])
        // Inicializar consumos vacíos
        const init = {}
        for (const item of (data.items || [])) {
          init[item.producto_id] = { cantidad: '', categoria: '', motivo: '' }
        }
        setConsumos(init)
      } else {
        const data = await res.json().catch(() => ({}))
        setMsg({ type: 'error', text: data.error || 'Error al cargar el depósito' })
      }
    } catch {
      setMsg({ type: 'error', text: 'Error de conexión' })
    } finally {
      setLoading(false)
    }
  }, [token])

  const loadHistorial = useCallback(async () => {
    setHistorialLoading(true)
    try {
      const res = await apiFetch('/api/directivo/deposito/historial?limit=80', { token })
      if (res.ok) {
        const data = await res.json()
        setHistorial(data.historial || [])
      }
    } catch {
      setHistorial([])
    } finally {
      setHistorialLoading(false)
    }
  }, [token])

  useEffect(() => { loadStock() }, [loadStock])
  useEffect(() => {
    if (tab === 'historial') loadHistorial()
  }, [tab, loadHistorial])

  const handleGuardarConsumo = async () => {
    const itemsPayload = Object.entries(consumos)
      .filter(([, v]) => Number(v.cantidad) > 0)
      .map(([pid, v]) => ({
        id_producto: Number(pid),
        cantidad: Number(v.cantidad),
        categoria: v.categoria || null,
        motivo: v.motivo || null,
      }))

    if (itemsPayload.length === 0) {
      setMsg({ type: 'error', text: 'Ingresá al menos una cantidad para registrar' })
      return
    }

    setSaving(true)
    setMsg(null)
    try {
      const res = await apiFetch('/api/directivo/deposito/consumo', {
        token,
        method: 'POST',
        body: JSON.stringify({ items: itemsPayload }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setMsg({ type: 'success', text: `✓ Consumo registrado para ${data.registrados} producto${data.registrados !== 1 ? 's' : ''}` })
        setShowForm(false)
        await loadStock()
        if (tab === 'historial') await loadHistorial()
      } else {
        setMsg({ type: 'error', text: data.error || 'Error al registrar consumo' })
      }
    } catch {
      setMsg({ type: 'error', text: 'Error de conexión' })
    } finally {
      setSaving(false)
    }
  }

  const totalStock = items.reduce((acc, i) => acc + i.stock_actual, 0)
  const totalRecibido = items.reduce((acc, i) => acc + i.total_recibido, 0)
  const totalConsumido = items.reduce((acc, i) => acc + i.total_consumido, 0)
  const productosConStock = items.filter(i => i.stock_actual > 0).length

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200, gap: 12, color: 'var(--muted)' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      Cargando depósito...
    </div>
  )

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Encabezado */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 800, color: 'var(--dark)' }}>
          🏫 Mi Depósito
        </h2>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
          {institucion?.nombre || 'Tu institución'} — Stock de mercadería recibida y consumos registrados
        </p>
      </div>

      {/* Métricas resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total recibido', value: totalRecibido, color: '#1e3a8a', bg: 'rgba(30,58,138,0.06)' },
          { label: 'Consumido', value: totalConsumido, color: '#d97706', bg: 'rgba(217,119,6,0.06)' },
          { label: 'En stock ahora', value: totalStock, color: '#059669', bg: 'rgba(5,150,105,0.08)', bold: true },
          { label: 'Productos disponibles', value: productosConStock, color: '#7c3aed', bg: 'rgba(124,58,237,0.06)' },
        ].map(m => (
          <div key={m.label} style={{ background: m.bg, border: `1px solid ${m.color}22`, borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{m.label}</div>
              <div style={{ fontSize: m.bold ? '1.6rem' : '1.4rem', fontWeight: 800, color: m.color, lineHeight: 1.1 }}>{m.value}</div>
            </div>
          </div>
        ))}
      </div>

      {msg && (
        <div className={`msg show msg-${msg.type}`} style={{ marginBottom: 16 }}>{msg.text}</div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
        {[
          { key: 'stock', label: '📦 Stock Actual' },
          { key: 'consumo', label: '📝 Registrar Consumo' },
          { key: 'historial', label: '🕐 Historial' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setMsg(null); if (t.key !== 'consumo') setShowForm(false) }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '10px 18px',
              fontWeight: tab === t.key ? 700 : 500,
              color: tab === t.key ? 'var(--primary)' : 'var(--muted)',
              borderBottom: tab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -2, fontSize: '0.9rem', transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB: Stock Actual */}
      {tab === 'stock' && (
        <div>
          {items.length === 0 ? (
            <div className="sv-empty-state">
              <span style={{ fontSize: '2.5rem', marginBottom: 8 }}>📭</span>
              <p>No hay mercadería recibida aún.</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                El stock aparecerá automáticamente cuando confirmes la recepción de mercadería en <strong>Recepción de Mercadería</strong>.
              </p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button className="primary" style={{ width: 'auto', padding: '8px 20px', fontSize: '0.9rem' }} onClick={() => setTab('consumo')}>
                  📝 Registrar Consumo
                </button>
              </div>
              <table>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th>Producto</th>
                    <th style={{ textAlign: 'center', width: 90 }}>Recibido</th>
                    <th style={{ textAlign: 'center', width: 90 }}>Consumido</th>
                    <th style={{ textAlign: 'center', width: 120 }}>En stock</th>
                    <th style={{ width: 180 }}>Uso</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => {
                    const pctConsumido = item.total_recibido > 0 ? Math.round((item.total_consumido / item.total_recibido) * 100) : 0
                    const stockColor = item.stock_actual === 0 ? '#ef4444' : item.stock_actual < item.total_recibido * 0.2 ? '#f59e0b' : '#059669'
                    return (
                      <tr key={item.producto_id}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{item.producto_nombre}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{item.unidad_medida || '-'}</div>
                        </td>
                        <td style={{ textAlign: 'center' }}>{item.total_recibido}</td>
                        <td style={{ textAlign: 'center', color: item.total_consumido > 0 ? '#d97706' : 'var(--muted)' }}>
                          {item.total_consumido}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block', background: item.stock_actual === 0 ? '#fef2f2' : '#f0fdf4',
                            color: stockColor, fontWeight: 800, fontSize: '1.05rem',
                            borderRadius: 8, padding: '4px 14px', minWidth: 50,
                          }}>
                            {item.stock_actual}
                          </span>
                        </td>
                        <td>
                          <div style={{ padding: '2px 0' }}>
                            <StockBar consumido={item.total_consumido} total={item.total_recibido} />
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 3 }}>
                              {pctConsumido}% consumido
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* TAB: Registrar Consumo */}
      {tab === 'consumo' && (
        <div>
          {items.filter(i => i.stock_actual > 0).length === 0 ? (
            <div className="sv-empty-state">
              <span style={{ fontSize: '2.5rem', marginBottom: 8 }}>✅</span>
              <p>No hay stock disponible para registrar consumos.</p>
            </div>
          ) : (
            <>
              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: '0.88rem', color: '#0369a1' }}>
                <strong>ℹ️</strong> Ingresá las cantidades que consumiste de cada producto. El stock se descontará al guardar.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
                {items.filter(i => i.stock_actual > 0).map(item => {
                  const val = consumos[item.producto_id] || { cantidad: '', categoria: '', motivo: '' }
                  const setVal = (field, v) => setConsumos(prev => ({
                    ...prev,
                    [item.producto_id]: { ...(prev[item.producto_id] || {}), [field]: v }
                  }))
                  const cantNum = Number(val.cantidad)
                  const excede = cantNum > item.stock_actual
                  return (
                    <div key={item.producto_id} style={{
                      border: cantNum > 0 ? '2px solid #10b981' : '1px solid var(--border)',
                      borderRadius: 12, padding: '16px 20px',
                      background: cantNum > 0 ? '#f0fdf4' : 'white',
                      transition: 'border-color 0.2s, background 0.2s'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '1rem' }}>{item.producto_nombre}</div>
                          <div style={{ fontSize: '0.83rem', color: 'var(--muted)', marginTop: 2 }}>
                            {item.unidad_medida || '-'} · En stock: <strong style={{ color: '#059669' }}>{item.stock_actual}</strong>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--dark)' }}>Cantidad a consumir:</label>
                          <input
                            type="number"
                            min="0"
                            max={item.stock_actual}
                            value={val.cantidad}
                            onChange={e => setVal('cantidad', e.target.value)}
                            placeholder="0"
                            style={{
                              width: 90, textAlign: 'center', fontWeight: 700, fontSize: '1.1rem',
                              borderColor: excede ? '#ef4444' : cantNum > 0 ? '#10b981' : '',
                            }}
                          />
                        </div>
                      </div>
                      {excede && (
                        <div style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: 6, fontWeight: 600 }}>
                          ⚠ Supera el stock disponible ({item.stock_actual})
                        </div>
                      )}
                      {cantNum > 0 && (
                        <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: 180 }}>
                            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Categoría</label>
                            <select
                              value={val.categoria}
                              onChange={e => setVal('categoria', e.target.value)}
                              style={{ width: '100%' }}
                            >
                              <option value="">— Seleccionar —</option>
                              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <div style={{ flex: 2, minWidth: 220 }}>
                            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Descripción (opcional)</label>
                            <input
                              type="text"
                              value={val.motivo}
                              onChange={e => setVal('motivo', e.target.value)}
                              placeholder="Ej: Distribución a docentes, rotura en aula..."
                              style={{ width: '100%' }}
                              maxLength={200}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Resumen antes de guardar */}
              {Object.values(consumos).some(v => Number(v.cantidad) > 0) && (
                <div style={{ background: '#fff7ed', border: '2px solid #fb923c', borderRadius: 10, padding: '14px 18px', marginBottom: 20 }}>
                  <div style={{ fontWeight: 700, color: '#9a3412', marginBottom: 8 }}>Resumen del consumo a registrar:</div>
                  {Object.entries(consumos)
                    .filter(([, v]) => Number(v.cantidad) > 0)
                    .map(([pid, v]) => {
                      const item = items.find(i => i.producto_id === Number(pid))
                      return (
                        <div key={pid} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #fed7aa', fontSize: '0.88rem' }}>
                          <span><strong>{item?.producto_nombre}</strong> {v.categoria ? `· ${v.categoria}` : ''}</span>
                          <span style={{ fontWeight: 700, color: '#c2410c' }}>{v.cantidad} {item?.unidad_medida}</span>
                        </div>
                      )
                    })}
                </div>
              )}

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  className="primary"
                  onClick={handleGuardarConsumo}
                  disabled={saving || Object.values(consumos).every(v => Number(v.cantidad) <= 0)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {saving ? 'Guardando...' : 'Guardar Consumo'}
                </button>
                <button
                  className="secondary"
                  style={{ width: 'auto', padding: '10px 20px' }}
                  onClick={() => {
                    const reset = {}
                    for (const item of items) reset[item.producto_id] = { cantidad: '', categoria: '', motivo: '' }
                    setConsumos(reset)
                  }}
                >
                  Limpiar
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB: Historial */}
      {tab === 'historial' && (
        <div>
          {historialLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Cargando historial...</div>
          ) : historial.length === 0 ? (
            <div className="sv-empty-state">
              <p>No hay consumos registrados todavía.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th style={{ textAlign: 'center' }}>Cantidad</th>
                  <th>Categoría</th>
                  <th>Descripción</th>
                  <th>Registrado por</th>
                </tr>
              </thead>
              <tbody>
                {historial.map(h => (
                  <tr key={h.id}>
                    <td style={{ fontSize: '0.83rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{formatDate(h.fecha)}</td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{h.producto_nombre}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{h.unidad_medida}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ background: '#fef2f2', color: '#b91c1c', fontWeight: 800, borderRadius: 6, padding: '3px 12px', display: 'inline-block' }}>
                        -{h.cantidad}
                      </span>
                    </td>
                    <td>
                      {h.categoria ? (
                        <span style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '0.8rem', borderRadius: 20, padding: '2px 10px', fontWeight: 600 }}>
                          {h.categoria}
                        </span>
                      ) : <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>—</span>}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--dark)', maxWidth: 200 }}>
                      {h.motivo || <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td style={{ fontSize: '0.83rem', color: 'var(--muted)' }}>{h.usuario}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
