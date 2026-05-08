import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'
import PrintButton from './PrintButton'

const ESTADO_BADGE = {
  enviada: 'pendiente',
  aceptada: 'aprobado',
  adjudicada: 'entregado',
  cerrada: 'entregado',
  borrador: 'pendiente'
}

const NIVELES = ['Inicial', 'Primaria', 'Secundaria', 'Especial', 'Superior', 'Adultos']

function formatCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2
  }).format(Number(value))
}

function buildQuery(filters) {
  const params = new URLSearchParams()
  if (filters.director_area_id) params.set('director_area_id', filters.director_area_id)
  if (filters.nivel) params.set('nivel', filters.nivel)
  if (filters.estado) params.set('estado', filters.estado)
  return params.toString() ? `?${params.toString()}` : ''
}

function Filters({ filters, setFilters, directores, compact = false }) {
  const wrapperStyle = compact
    ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }
    : { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 14 }

  return (
    <div style={wrapperStyle}>
      <div>
        <label>Director de Area</label>
        <select value={filters.director_area_id} onChange={(e) => setFilters((prev) => ({ ...prev, director_area_id: e.target.value }))}>
          <option value="">Todos</option>
          {directores.map((director) => (
            <option key={director.id} value={director.id}>{director.nombre}</option>
          ))}
        </select>
      </div>
      <div>
        <label>Nivel educativo</label>
        <select value={filters.nivel} onChange={(e) => setFilters((prev) => ({ ...prev, nivel: e.target.value }))}>
          <option value="">Todos</option>
          {NIVELES.map((nivel) => (
            <option key={nivel} value={nivel}>{nivel}</option>
          ))}
        </select>
      </div>
      <div>
        <label>Estado</label>
        <select value={filters.estado} onChange={(e) => setFilters((prev) => ({ ...prev, estado: e.target.value }))}>
          <option value="">Todos</option>
          <option value="enviada">Enviada</option>
          <option value="aceptada">Aceptada</option>
          <option value="adjudicada">Adjudicada</option>
          <option value="cerrada">Cerrada</option>
        </select>
      </div>
    </div>
  )
}

export default function ComprasPanel({ section = 'pedidos' }) {
  const { token } = useAuth()
  const printRef = useRef(null)

  const [filters, setFilters] = useState({ director_area_id: '', nivel: '', estado: '' })
  const [catalogPlanillas, setCatalogPlanillas] = useState([])
  const [planillas, setPlanillas] = useState([])
  const [detalle, setDetalle] = useState(null)
  const [consolidado, setConsolidado] = useState([])
  const [estadoDirectores, setEstadoDirectores] = useState([])
  const [adjudicacion, setAdjudicacion] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [formByProduct, setFormByProduct] = useState({})
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)
  const [itemsFinales, setItemsFinales] = useState([])
  const [publicacionStatus, setPublicacionStatus] = useState({ publicada: false, data: null })
  const [editQty, setEditQty] = useState({})
  const [showConfirmPublicar, setShowConfirmPublicar] = useState(false)

  const loadCatalogData = async () => {
    const proveedoresRes = await apiFetch('/api/proveedores', { token })
    const proveedoresData = proveedoresRes.ok ? await proveedoresRes.json() : { proveedores: [] }
    setProveedores(proveedoresData.proveedores || [])
  }

  const loadWorkflowData = async (activeFilters = filters) => {
    setLoading(true)
    try {
      const anio = new Date().getFullYear()

      const [consolidadoRes, statusRes, finalRes, pubRes, adjudicacionRes, planillasRes] = await Promise.all([
        apiFetch(`/api/compras/licitacion/anual/consolidado?anio=${anio}`, { token }),
        apiFetch(`/api/compras/licitacion/anual/estado-directores?anio=${anio}`, { token }),
        apiFetch(`/api/compras/licitacion/anual/final-items?anio=${anio}`, { token }),
        apiFetch(`/api/compras/licitacion/anual/publicada-status?anio=${anio}`, { token }),
        apiFetch(`/api/compras/adjudicacion?anio=${anio}`, { token }),
        apiFetch(`/api/compras/planillas?anio=${anio}`, { token })
      ])

      const consolidadoData = consolidadoRes.ok ? await consolidadoRes.json() : { items: [] }
      const statusData = statusRes.ok ? await statusRes.json() : { directores: [] }
      const finalData = finalRes.ok ? await finalRes.json() : { items: [] }
      const pubData = pubRes.ok ? await pubRes.json() : { publicada: false }
      const adjudicacionData = adjudicacionRes.ok ? await adjudicacionRes.json() : { items: [] }
      const planillasData = planillasRes.ok ? await planillasRes.json() : { planillas: [] }

      setConsolidado(consolidadoData.items || [])
      setEstadoDirectores(statusData.directores || [])
      setItemsFinales(finalData.items || [])
      setPublicacionStatus(pubData)
      setAdjudicacion(adjudicacionData.items || [])
      setPlanillas(planillasData.planillas || [])
      
      setFormByProduct((prev) => {
        const next = { ...prev }
        for (const item of adjudicacionData.items || []) {
          const key = String(item.producto_id)
          next[key] = {
            proveedor_id: next[key]?.proveedor_id || String(item.proveedor_actual_id || ''),
            precio_compra_real: next[key]?.precio_compra_real || (item.precio_actual ? String(item.precio_actual) : '')
          }
        }
        return next
      })
      
      // Inicializar cantidades editables con las originales (sin descontar stock automáticamente)
      if (!pubData.publicada) {
        const initialEdit = {}
        const itemsToUse = consolidadoData.items || []
        itemsToUse.forEach(item => {
          initialEdit[item.producto_id] = item.cantidad_total
        })
        setEditQty(initialEdit)
      } else {
        // Si ya está publicada, las cantidades vienen del snapshot
        const snapshotEdit = {}
        if (pubData.data && pubData.data.items) {
          const rawItems = typeof pubData.data.items === 'string' ? JSON.parse(pubData.data.items) : pubData.data.items
          rawItems.forEach(item => {
            snapshotEdit[item.producto_id] = item.cantidad_a_licitar
          })
        }
        setEditQty(snapshotEdit)
      }

    } catch (err) {
      setMsg({ text: err.message || 'No se pudo cargar la informacion', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCatalogData()
    loadWorkflowData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    loadWorkflowData(filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.director_area_id, filters.nivel, filters.estado])

  const directores = useMemo(() => {
    const map = new Map()
    for (const planilla of catalogPlanillas) {
      if (!planilla.director_area_id) continue
      map.set(String(planilla.director_area_id), {
        id: String(planilla.director_area_id),
        nombre: `${planilla.director_nombre || ''} ${planilla.director_apellido || ''}`.trim()
      })
    }
    return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [catalogPlanillas])

  const groupedDetalle = useMemo(() => {
    if (!detalle?.detalles) return []
    const grouped = detalle.detalles.reduce((acc, item) => {
      if (!acc[item.institucion]) {
        acc[item.institucion] = {
          institucion: item.institucion,
          cue: item.cue,
          nivel: item.nivel,
          items: []
        }
      }
      acc[item.institucion].items.push(item)
      return acc
    }, {})
    return Object.values(grouped)
  }, [detalle])

  const handleVerDetalle = async (id) => {
    if (detalle?.planilla?.id === id) {
      setDetalle(null)
      return
    }

    try {
      const res = await apiFetch(`/api/compras/planillas/${id}`, { token })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar el detalle')
      setDetalle(data)
    } catch (err) {
      setMsg({ text: err.message, type: 'error' })
    }
  }

  const handleAceptarPlanilla = async (id) => {
    setUpdatingId(id)
    try {
      const res = await apiFetch(`/api/compras/planillas/${id}/aceptar`, {
        token,
        method: 'PATCH'
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const faltantes = (data.validacion_cobertura?.faltantes || [])
          .map((item) => `${item.nombre}${item.cue ? ` (${item.cue})` : ''}`)
          .join(', ')
        throw new Error(faltantes ? `${data.error} Faltan: ${faltantes}` : (data.error || 'No se pudo aceptar'))
      }
      setMsg({ text: `Planilla #${id} aceptada y disponible para la licitacion.`, type: 'success' })
      if (detalle?.planilla?.id === id) setDetalle(null)
      await loadCatalogData()
      await loadWorkflowData(filters)
    } catch (err) {
      setMsg({ text: err.message, type: 'error' })
    } finally {
      setUpdatingId(null)
    }
  }

  const handleExportCSV = () => {
    if (!consolidado.length) return
    const headers = ['Producto', 'Cantidad Total', 'Unidad de Medida']
    const rows = consolidado.map(item => [
      item.producto,
      item.cantidad_total,
      item.unidad_medida
    ])
    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `licitacion_${new Date().getFullYear()}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleFormChange = (productoId, field, value) => {
    setFormByProduct((prev) => ({
      ...prev,
      [productoId]: {
        ...prev[productoId],
        [field]: value
      }
    }))
  }

  const handleEditQty = (idProducto, val) => {
    setEditQty(prev => ({
      ...prev,
      [idProducto]: Number(val)
    }))
  }

  const handlePublicar = async () => {
    setSaving(true)
    try {
      const anio = new Date().getFullYear()
      const payload = {
        anio,
        items: consolidado.map(item => ({
          ...item,
          cantidad_a_licitar: editQty[item.producto_id] !== undefined ? editQty[item.producto_id] : item.cantidad_total
        }))
      }
      const res = await apiFetch('/api/compras/licitacion/anual/publicar', {
        token,
        method: 'POST',
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        setShowConfirmPublicar(false)
        await loadWorkflowData()
        setMsg({ text: 'Licitación publicada con éxito', type: 'success' })
      } else {
        const data = await res.json()
        throw new Error(data.error || 'Error al publicar')
      }
    } catch (err) {
      setMsg({ text: err.message, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleReabrir = async () => {
    if (!window.confirm('¿Estás seguro que deseas reabrir la licitación? Las cantidades volverán a ser editables y la adjudicación se bloqueará.')) return
    
    setLoading(true)
    try {
      const anio = new Date().getFullYear()
      const res = await apiFetch(`/api/compras/licitacion/anual/publicar/${anio}`, {
        token,
        method: 'DELETE'
      })
      if (res.ok) {
        await loadWorkflowData()
        setMsg({ text: 'Licitación reabierta. Ahora puedes editar las cantidades en el paso anterior.', type: 'success' })
      } else {
        const data = await res.json()
        throw new Error(data.error || 'Error al reabrir')
      }
    } catch (err) {
      setMsg({ text: err.message, type: 'error' })
      setLoading(false)
    }
  }

  const handleGuardarAdjudicacion = async () => {
    const incomplete = adjudicacion.find((item) => {
      const current = formByProduct[String(item.producto_id)] || {}
      return !current.proveedor_id || !current.precio_compra_real
    })

    if (incomplete) {
      setMsg({ text: `Completa proveedor y precio para ${incomplete.producto}.`, type: 'error' })
      return
    }

    setSaving(true)
    try {
      const payload = {
        items: adjudicacion.map((item) => {
          const current = formByProduct[String(item.producto_id)] || {}
          return {
            producto_id: item.producto_id,
            proveedor_id: Number(current.proveedor_id),
            precio_compra_real: Number(current.precio_compra_real)
          }
        })
      }

      const res = await apiFetch('/api/compras/adjudicacion', {
        token,
        method: 'POST',
        body: JSON.stringify(payload)
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar la adjudicacion')

      setMsg({ text: 'La adjudicacion se guardo correctamente.', type: 'success' })
      await loadCatalogData()
      await loadWorkflowData(filters)
    } catch (err) {
      setMsg({ text: err.message, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const headerBySection = {
    licitacion: {
      title: `Licitacion Anual ${new Date().getFullYear()}`,
      subtitle: 'Consolidado general de pedidos aprobados por directores de area.'
    },
    'listado-final': {
      title: publicacionStatus.publicada ? `Licitación Publicada — ${new Date().getFullYear()}` : 'Listado Final a Licitar',
      subtitle: publicacionStatus.publicada 
        ? `Licitación cerrada el ${new Date(publicacionStatus.data.fecha_publicacion).toLocaleString('es-AR')}.`
        : 'Listado detallado por institución para validación y ajuste de cantidades finales.'
    },
    adjudicacion: {
      title: 'Adjudicacion y Cierre de Compra',
      subtitle: 'Seleccion de proveedor ganador y carga del precio real con referencia historica.'
    }
  }

  const header = headerBySection[section] || headerBySection.licitacion

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>{header.title}</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '0.92rem' }}>{header.subtitle}</p>
        </div>
        <PrintButton targetRef={printRef} title={header.title} />
      </div>

      {msg.text && (
        <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`}>{msg.text}</div>
      )}

      <div ref={printRef} style={{ marginTop: 18 }}>
        {section === 'adjudicacion' && (
          <section style={{ 
            background: 'white', 
            padding: 24, 
            borderRadius: 12, 
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)', 
            marginBottom: 24 
          }}>
            <h3 style={{ marginTop: 0 }}>Filtros de búsqueda</h3>
            <Filters filters={filters} setFilters={setFilters} directores={directores} />
          </section>
        )}


        {section === 'licitacion' && (
          <div>
            <section className="card" style={{ padding: 24, marginBottom: 24, minHeight: 'auto' }}>
              <h3 style={{ marginTop: 0, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.5rem' }}>🚦</span> Sección B — Estado de envío por Director de Área
              </h3>
              <table style={{ marginBottom: 0 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th>NIVEL EDUCATIVO</th>
                    <th>DIRECTOR DE ÁREA</th>
                    <th style={{ textAlign: 'center' }}>ESTADO</th>
                  </tr>
                </thead>
                <tbody>
                  {estadoDirectores.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>
                        No hay directores de área registrados.
                      </td>
                    </tr>
                  ) : (
                    estadoDirectores.map((dir) => (
                      <tr key={dir.id_usuario}>
                        <td style={{ fontWeight: 600 }}>{dir.nivel_educativo || 'Sin nivel'}</td>
                        <td>{`${dir.nombre || ''} ${dir.apellido || ''}`.trim()}</td>
                        <td style={{ textAlign: 'center' }}>
                          {dir.enviado ? (
                            <span style={{ color: '#166534', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                              ✅ Enviado
                            </span>
                          ) : (
                            <span style={{ color: '#9a3412', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                              ⏳ Pendiente
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>

            <section className="card" style={{ padding: 24, marginBottom: 24, minHeight: 'auto' }}>
              <h3 style={{ marginTop: 0, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.5rem' }}>📜</span> Historial de Resúmenes Enviados
              </h3>
              <table style={{ marginBottom: 0 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th>AÑO</th>
                    <th>DIRECTOR DE ÁREA</th>
                    <th>ESTADO</th>
                    <th>FECHA ENVÍO</th>
                    <th>ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {planillas.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>
                        No hay resúmenes enviados aún.
                      </td>
                    </tr>
                  ) : (
                    planillas.map((p) => (
                      <tr key={p.id}>
                        <td>{p.anio}</td>
                        <td>{`${p.director_nombre || ''} ${p.director_apellido || ''}`.trim()}</td>
                        <td>
                          <span className={`badge badge-${ESTADO_BADGE[p.estado] || 'pendiente'}`}>
                            {p.estado}
                          </span>
                        </td>
                        <td>{p.enviada_at ? new Date(p.enviada_at).toLocaleString('es-AR') : '-'}</td>
                        <td>
                          <button className="secondary" onClick={() => handleVerDetalle(p.id)}>
                            {detalle?.planilla?.id === p.id ? 'Ocultar' : 'Ver Detalle'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>

            {detalle && detalle.planilla && (
              <section className="card" style={{ padding: 24, marginBottom: 24, minHeight: 'auto' }}>
                <h3 style={{ marginTop: 0, marginBottom: 20 }}>
                  Detalle del Resumen #{detalle.planilla.id} - {detalle.planilla.director_nombre} {detalle.planilla.director_apellido}
                </h3>
                <table>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th>PRODUCTO</th>
                      <th style={{ textAlign: 'center' }}>CANTIDAD</th>
                      <th>UNIDAD</th>
                      <th>INSTITUCIÓN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.detalles.map((det) => (
                      <tr key={det.id}>
                        <td style={{ fontWeight: 600 }}>{det.producto}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{det.cantidad}</td>
                        <td style={{ color: 'var(--muted)' }}>{det.unidad_medida}</td>
                        <td>{det.institucion} ({det.cue})</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            <section className="card" style={{ padding: 24, minHeight: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '1.5rem' }}>📋</span> Sección A — Consolidado general
                </h3>
                <button className="secondary" onClick={handleExportCSV} disabled={!consolidado.length}>
                  📥 Exportar Consolidado (CSV)
                </button>
              </div>

              {loading ? (
                <div className="sv-empty-state">Generando consolidado...</div>
              ) : consolidado.length === 0 ? (
                <div className="sv-empty-state">Todavía no hay solicitudes aprobadas para el año en curso.</div>
              ) : (
                <table style={{ marginBottom: 0 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th>PRODUCTO</th>
                      <th style={{ textAlign: 'center' }}>CANTIDAD TOTAL</th>
                      <th>UNIDAD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consolidado.map((item) => (
                      <tr key={item.producto_id}>
                        <td style={{ fontWeight: 600 }}>{item.producto}</td>
                        <td style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)' }}>
                          {item.cantidad_total}
                        </td>
                        <td style={{ color: 'var(--muted)' }}>{item.unidad_medida}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        )}

        {section === 'listado-final' && (
          <section className="card" style={{ padding: 24, minHeight: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>
                {publicacionStatus.publicada ? '📋 Licitación Publicada' : '📝 Listado Final a Licitar'}
              </h3>
              {!publicacionStatus.publicada && consolidado.length > 0 && (
                <button className="primary" onClick={() => setShowConfirmPublicar(true)}>
                  🔒 Cerrar Licitación
                </button>
              )}
            </div>

            {loading ? (
              <div className="sv-empty-state">Cargando listado...</div>
            ) : consolidado.length === 0 ? (
              <div className="sv-empty-state">No hay pedidos disponibles para el listado final.</div>
            ) : (
              <>
                <table style={{ marginBottom: 24 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th>PRODUCTO</th>
                      <th style={{ textAlign: 'center' }}>CANTIDAD TOTAL</th>
                      <th style={{ textAlign: 'center' }}>STOCK ACTUAL</th>
                      <th style={{ textAlign: 'center', width: 140 }}>CANT. A LICITAR</th>
                      <th>UNIDAD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consolidado.map((item) => {
                      const currentVal = editQty[item.producto_id]
                      return (
                        <tr key={item.producto_id}>
                          <td style={{ fontWeight: 600 }}>{item.producto}</td>
                          <td style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 700, color: 'var(--muted)' }}>
                            {item.cantidad_total}
                          </td>
                          <td style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 700, color: '#ca8a04' }}>
                            {item.stock_actual}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {publicacionStatus.publicada ? (
                              <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.1rem' }}>{currentVal !== undefined ? currentVal : item.cantidad_total}</span>
                            ) : (
                              <input
                                type="number"
                                min="0"
                                value={currentVal !== undefined ? currentVal : ''}
                                onChange={(e) => handleEditQty(item.producto_id, e.target.value)}
                                style={{ textAlign: 'center', fontWeight: 700, border: '1px solid #94a3b8', borderRadius: '6px', padding: '6px', width: '90px', margin: '0 auto', background: '#f8fafc' }}
                                title="Editar cantidad a licitar"
                              />
                            )}
                          </td>
                          <td style={{ color: 'var(--muted)' }}>{item.unidad_medida}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </>
            )}
          </section>
        )}

        {section === 'adjudicacion' && (
          <section className="card" style={{ padding: 18, minHeight: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <h3 style={{ margin: 0 }}>Cierre de compra</h3>
              {publicacionStatus.publicada && (
                <button className="secondary" onClick={handleReabrir}>
                  ⏪ Regresar a editar listado
                </button>
              )}
            </div>
            
            {!publicacionStatus.publicada ? (
              <div className="sv-empty-state" style={{ marginTop: 20 }}>
                <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: 12 }}>🔒</span>
                <strong style={{ display: 'block', marginBottom: 5, fontSize: '1.2rem', color: '#334155' }}>Adjudicación bloqueada</strong>
                <p style={{ color: 'var(--muted)', margin: 0 }}>Debes aprobar y subir el "Listado Final a Licitar" antes de poder adjudicar a proveedores.</p>
              </div>
            ) : (
              <>
                <p style={{ marginTop: 0, color: 'var(--muted)' }}>
                  Selecciona proveedor ganador y registra el precio de compra real. El precio historico queda visible como referencia.
                </p>

                {loading ? (
                  <div className="sv-empty-state">Cargando adjudicacion...</div>
                ) : adjudicacion.length === 0 ? (
                  <div className="sv-empty-state">No hay productos disponibles para adjudicar.</div>
                ) : (
                  <>
                    <table style={{ marginBottom: 14 }}>
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>Cantidad total</th>
                          <th>Proveedor ganador</th>
                          <th>Precio anterior</th>
                          <th>Precio real</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adjudicacion.map((item) => {
                          const form = formByProduct[String(item.producto_id)] || {}
                          return (
                            <tr key={item.producto_id}>
                              <td>
                                <div style={{ fontWeight: 700 }}>{item.producto}</div>
                                <div style={{ color: 'var(--muted)', fontSize: '0.84rem' }}>{item.unidad_medida}</div>
                              </td>
                              <td>{item.cantidad_total}</td>
                              <td style={{ minWidth: 220 }}>
                                <select
                                  value={form.proveedor_id || ''}
                                  onChange={(e) => handleFormChange(String(item.producto_id), 'proveedor_id', e.target.value)}
                                >
                                  <option value="">Seleccionar proveedor</option>
                                  {proveedores.map((proveedor) => (
                                    <option key={proveedor.id} value={proveedor.id}>{proveedor.nombre}</option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <div>{formatCurrency(item.precio_anterior)}</div>
                                <div style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
                                  {item.anio_referencia ? `Licitacion ${item.anio_referencia}` : 'Sin historial'}
                                </div>
                              </td>
                              <td style={{ minWidth: 160 }}>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={form.precio_compra_real || ''}
                                  onChange={(e) => handleFormChange(String(item.producto_id), 'precio_compra_real', e.target.value)}
                                  placeholder="0,00"
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button onClick={handleGuardarAdjudicacion} disabled={saving}>
                        {saving ? 'Guardando...' : 'Guardar adjudicacion'}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </section>
        )}
      </div>
      {showConfirmPublicar && (
        <div className="sv-modal-overlay">
          <div className="sv-modal">
            <h2 className="sv-modal-title" style={{ color: 'var(--primary)' }}>🔒 ¿Confirmar cierre de licitación?</h2>
            <div className="sv-modal-body">
              <p>Se registrará el listado final con las cantidades editadas y se habilitará la fase de Adjudicación.</p>
              <p style={{ fontWeight: 700, color: '#e11d48' }}>Esta acción no se puede deshacer.</p>
            </div>
            <div className="sv-modal-footer">
              <button className="secondary" onClick={() => setShowConfirmPublicar(false)} disabled={saving}>
                Cancelar
              </button>
              <button className="primary" onClick={handlePublicar} disabled={saving}>
                {saving ? 'Cerrando...' : 'Confirmar cierre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
