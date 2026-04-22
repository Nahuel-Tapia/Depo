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
  const [adjudicacion, setAdjudicacion] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [formByProduct, setFormByProduct] = useState({})
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)

  const loadCatalogData = async () => {
    const [planillasRes, proveedoresRes] = await Promise.all([
      apiFetch('/api/compras/planillas', { token }),
      apiFetch('/api/proveedores', { token })
    ])

    const planillasData = planillasRes.ok ? await planillasRes.json() : { planillas: [] }
    const proveedoresData = proveedoresRes.ok ? await proveedoresRes.json() : { proveedores: [] }

    setCatalogPlanillas(planillasData.planillas || [])
    setProveedores(proveedoresData.proveedores || [])
  }

  const loadWorkflowData = async (activeFilters = filters) => {
    setLoading(true)
    try {
      const query = buildQuery(activeFilters)
      const [planillasRes, consolidadoRes, adjudicacionRes] = await Promise.all([
        apiFetch(`/api/compras/planillas${query}`, { token }),
        apiFetch(`/api/compras/licitacion/consolidado${query}`, { token }),
        apiFetch(`/api/compras/adjudicacion${query}`, { token })
      ])

      const planillasData = planillasRes.ok ? await planillasRes.json() : { planillas: [] }
      const consolidadoData = consolidadoRes.ok ? await consolidadoRes.json() : { items: [] }
      const adjudicacionData = adjudicacionRes.ok ? await adjudicacionRes.json() : { items: [] }

      setPlanillas(planillasData.planillas || [])
      setConsolidado(consolidadoData.items || [])
      setAdjudicacion(adjudicacionData.items || [])
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

  const handleFormChange = (productoId, field, value) => {
    setFormByProduct((prev) => ({
      ...prev,
      [productoId]: {
        ...prev[productoId],
        [field]: value
      }
    }))
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
    pedidos: {
      title: 'Gestion de Pedidos Anuales',
      subtitle: 'Recepcion de planillas y validacion de integridad antes de aceptar.'
    },
    licitacion: {
      title: 'Licitacion Anual',
      subtitle: 'Filtros dinamicos para trabajar las planillas aceptadas por director, nivel y estado.'
    },
    'listado-final': {
      title: 'Listado Final a Licitar',
      subtitle: 'Reporte consolidado por producto, unidad de medida y cantidad total.'
    },
    adjudicacion: {
      title: 'Adjudicacion y Cierre de Compra',
      subtitle: 'Seleccion de proveedor ganador y carga del precio real con referencia historica.'
    }
  }

  const header = headerBySection[section] || headerBySection.pedidos

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
        {(section === 'licitacion' || section === 'listado-final' || section === 'adjudicacion') && (
          <section className="card" style={{ padding: 18, marginBottom: 18 }}>
            <h3 style={{ marginTop: 0 }}>Filtros</h3>
            <Filters filters={filters} setFilters={setFilters} directores={directores} />
          </section>
        )}

        {section === 'pedidos' && (
          <section className="card" style={{ padding: 18 }}>
            <h3 style={{ marginTop: 0 }}>Recepcion</h3>
            <p style={{ marginTop: 0, color: 'var(--muted)' }}>
              Se listan las planillas enviadas por Direccion de Area. El boton Aceptar solo se habilita si la cobertura de escuelas es completa.
            </p>

            <Filters filters={filters} setFilters={setFilters} directores={directores} compact />

            <div style={{ marginTop: 18 }}>
              {loading ? (
                <div className="sv-empty-state">Cargando planillas...</div>
              ) : planillas.length === 0 ? (
                <div className="sv-empty-state">No hay planillas para mostrar.</div>
              ) : (
                planillas.map((planilla) => {
                  const coverage = planilla.validacion_cobertura || {}
                  return (
                    <div
                      key={planilla.id}
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        padding: 16,
                        marginBottom: 14,
                        background: planilla.estado === 'aceptada' ? '#f0fdf4' : '#fff'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 14, flexWrap: 'wrap' }}>
                        <div>
                          <strong style={{ fontSize: '1.04rem' }}>Planilla #{planilla.id} - Ano {planilla.anio}</strong>
                          <span className={`badge badge-estado-${ESTADO_BADGE[planilla.estado] || 'pendiente'}`} style={{ marginLeft: 10 }}>
                            {planilla.estado}
                          </span>
                          <div style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: 6 }}>
                            Director/a: <strong>{`${planilla.director_nombre || ''} ${planilla.director_apellido || ''}`.trim()}</strong>
                          </div>
                          <div style={{ color: 'var(--muted)', fontSize: '0.88rem', marginTop: 4 }}>
                            Cobertura: {coverage.escuelas_cargadas || 0} de {coverage.escuelas_esperadas || 0} escuelas
                          </div>
                          {!coverage.ok && planilla.estado === 'enviada' && (
                            <div style={{ color: '#b45309', fontSize: '0.88rem', marginTop: 4 }}>
                              Faltan {coverage.escuelas_faltantes || 0} escuelas para aceptar.
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button className="secondary" style={{ margin: 0 }} onClick={() => handleVerDetalle(planilla.id)}>
                            {detalle?.planilla?.id === planilla.id ? 'Ocultar detalle' : 'Ver detalle'}
                          </button>
                          {planilla.estado === 'enviada' && (
                            <button
                              style={{ margin: 0 }}
                              onClick={() => handleAceptarPlanilla(planilla.id)}
                              disabled={updatingId === planilla.id}
                            >
                              {updatingId === planilla.id ? 'Validando...' : 'Aceptar'}
                            </button>
                          )}
                        </div>
                      </div>

                      {detalle?.planilla?.id === planilla.id && (
                        <div style={{ marginTop: 16 }}>
                          <div style={{ marginBottom: 10, padding: 12, borderRadius: 10, background: '#f8fafc', border: '1px solid var(--border)' }}>
                            <strong>Validacion de integridad</strong>
                            <div style={{ marginTop: 6, color: 'var(--muted)', fontSize: '0.9rem' }}>
                              {detalle.validacion_cobertura?.ok
                                ? 'La planilla cubre el 100% de las escuelas bajo su jurisdiccion.'
                                : `Escuelas faltantes: ${(detalle.validacion_cobertura?.faltantes || []).map((item) => `${item.nombre}${item.cue ? ` (${item.cue})` : ''}`).join(', ') || 'sin detalle'}`}
                            </div>
                          </div>

                          {groupedDetalle.map((grupo) => (
                            <div key={grupo.institucion} style={{ marginBottom: 14 }}>
                              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                                {grupo.institucion}
                                {grupo.cue && <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: 8 }}>CUE: {grupo.cue}</span>}
                                {grupo.nivel && <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: 8 }}>Nivel: {grupo.nivel}</span>}
                              </div>
                              <table style={{ marginBottom: 0 }}>
                                <thead>
                                  <tr>
                                    <th>Producto</th>
                                    <th>Unidad</th>
                                    <th>Cantidad</th>
                                    <th>Notas</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {grupo.items.map((item) => (
                                    <tr key={item.id}>
                                      <td>{item.producto}</td>
                                      <td>{item.unidad_medida || 'unidad'}</td>
                                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.cantidad}</td>
                                      <td>{item.notas || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </section>
        )}

        {section === 'licitacion' && (
          <section className="card" style={{ padding: 18 }}>
            <h3 style={{ marginTop: 0 }}>Panel de control</h3>
            <p style={{ marginTop: 0, color: 'var(--muted)' }}>
              Esta vista concentra las planillas para el trabajo de licitacion y deja a mano los filtros de director, nivel y estado.
            </p>

            {loading ? (
              <div className="sv-empty-state">Cargando datos...</div>
            ) : planillas.length === 0 ? (
              <div className="sv-empty-state">No hay planillas para los filtros seleccionados.</div>
            ) : (
              <table style={{ marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th>Planilla</th>
                    <th>Director de Area</th>
                    <th>Estado</th>
                    <th>Escuelas cargadas</th>
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {planillas.map((planilla) => (
                    <tr key={planilla.id}>
                      <td>#{planilla.id} - {planilla.anio}</td>
                      <td>{`${planilla.director_nombre || ''} ${planilla.director_apellido || ''}`.trim()}</td>
                      <td>{planilla.estado}</td>
                      <td>{planilla.validacion_cobertura?.escuelas_cargadas || 0} / {planilla.validacion_cobertura?.escuelas_esperadas || 0}</td>
                      <td>
                        <button className="secondary" style={{ margin: 0 }} onClick={() => handleVerDetalle(planilla.id)}>
                          {detalle?.planilla?.id === planilla.id ? 'Ocultar detalle' : 'Ver detalle'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {detalle?.planilla && (
              <div style={{ marginTop: 18 }}>
                <h3 style={{ marginBottom: 10 }}>Detalle de la planilla #{detalle.planilla.id}</h3>
                {groupedDetalle.map((grupo) => (
                  <div key={grupo.institucion} style={{ marginBottom: 14 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>{grupo.institucion}</div>
                    <table style={{ marginBottom: 0 }}>
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>Unidad</th>
                          <th>Cantidad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grupo.items.map((item) => (
                          <tr key={item.id}>
                            <td>{item.producto}</td>
                            <td>{item.unidad_medida || 'unidad'}</td>
                            <td>{item.cantidad}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {section === 'listado-final' && (
          <section className="card" style={{ padding: 18 }}>
            <h3 style={{ marginTop: 0 }}>Listado final</h3>
            <p style={{ marginTop: 0, color: 'var(--muted)' }}>
              Consolidado general por producto individual, unidad de medida y cantidad total a licitar.
            </p>

            {loading ? (
              <div className="sv-empty-state">Generando listado...</div>
            ) : consolidado.length === 0 ? (
              <div className="sv-empty-state">Todavia no hay planillas aceptadas para consolidar.</div>
            ) : (
              <table style={{ marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Unidad de medida</th>
                    <th>Cantidad total</th>
                    <th>Directores</th>
                    <th>Niveles</th>
                  </tr>
                </thead>
                <tbody>
                  {consolidado.map((item) => (
                    <tr key={item.producto_id}>
                      <td>{item.producto}</td>
                      <td>{item.unidad_medida}</td>
                      <td style={{ fontWeight: 700 }}>{item.cantidad_total}</td>
                      <td>{item.directores || '-'}</td>
                      <td>{item.niveles || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        {section === 'adjudicacion' && (
          <section className="card" style={{ padding: 18 }}>
            <h3 style={{ marginTop: 0 }}>Cierre de compra</h3>
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
          </section>
        )}
      </div>
    </div>
  )
}
