import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

export default function HistorialInstitucion() {
  const { token } = useAuth()
  const [instituciones, setInstituciones] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [selectedNombre, setSelectedNombre] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [historial, setHistorial] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadInstituciones()
  }, [])

  const loadInstituciones = async () => {
    try {
      const res = await apiFetch('/api/instituciones', { token })
      if (res.ok) {
        const data = await res.json()
        setInstituciones(data.instituciones || [])
      }
    } catch { /* ignore */ }
  }

  const filtradas = busqueda.length >= 2
    ? instituciones.filter(i =>
        i.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
        i.cue?.includes(busqueda)
      ).slice(0, 20)
    : []

  const selectInstitucion = (inst) => {
    setSelectedId(inst.id)
    setSelectedNombre(`${inst.nombre} (CUE: ${inst.cue})`)
    setBusqueda('')
  }

  const loadHistorial = async () => {
    if (!selectedId) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (desde) params.set('desde', desde)
      if (hasta) params.set('hasta', hasta)
      if (filtroTipo) params.set('tipo', filtroTipo)

      const res = await apiFetch(`/api/instituciones/${selectedId}/historial?${params}`, { token })
      if (res.ok) {
        const data = await res.json()
        setHistorial(data)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  const formatFecha = (fecha) => {
    if (!fecha) return '-'
    const d = new Date(fecha)
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  }

  const tipoBadgeColor = (tipo) => {
    switch (tipo) {
      case 'Pedido': return { bg: '#dbeafe', color: '#1d4ed8' }
      case 'Entrega': return { bg: '#d1fae5', color: '#065f46' }
      case 'Devolución': return { bg: '#fef3c7', color: '#92400e' }
      case 'Ingreso': return { bg: '#e0e7ff', color: '#3730a3' }
      case 'Ajuste': return { bg: '#f3e8ff', color: '#6b21a8' }
      default: return { bg: '#f3f4f6', color: '#374151' }
    }
  }

  const estadoBadgeColor = (estado) => {
    switch (estado) {
      case 'pendiente': return { bg: '#fef3c7', color: '#92400e' }
      case 'aprobado': case 'OK': return { bg: '#d1fae5', color: '#065f46' }
      case 'rechazado': return { bg: '#fee2e2', color: '#991b1b' }
      case 'en_revision': case 'aprobado_parcial': return { bg: '#dbeafe', color: '#1d4ed8' }
      case 'finalizado': return { bg: '#e0e7ff', color: '#3730a3' }
      default: return { bg: '#f3f4f6', color: '#374151' }
    }
  }

  return (
    <div>
      <h2>Historial por Institución</h2>

      {/* Buscador */}
      <div style={{ background: '#f9fafb', padding: 24, borderRadius: 8, marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 16, alignItems: 'end' }}>
          <div style={{ position: 'relative' }}>
            <label>Institución</label>
            {selectedId ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.9rem', flex: 1 }}>{selectedNombre}</span>
                <button type="button" className="secondary" style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                  onClick={() => { setSelectedId(null); setSelectedNombre(''); setHistorial(null) }}>
                  Cambiar
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre o CUE..."
                />
                {filtradas.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                    background: 'white', border: '1px solid #e5e7eb', borderRadius: 6,
                    maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}>
                    {filtradas.map(i => (
                      <div key={i.id} onClick={() => selectInstitucion(i)} style={{
                        padding: '8px 12px', cursor: 'pointer', fontSize: '0.85rem',
                        borderBottom: '1px solid #f3f4f6'
                      }}
                        onMouseEnter={e => e.target.style.background = '#f0f9ff'}
                        onMouseLeave={e => e.target.style.background = 'white'}
                      >
                        <strong>{i.nombre}</strong>
                        <span style={{ color: '#6b7280', marginLeft: 8 }}>CUE: {i.cue}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <label>Desde</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} />
          </div>

          <div>
            <label>Hasta</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
          </div>

          <div>
            <label>Tipo</label>
            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
              <option value="">Todos</option>
              <option value="pedido">Pedidos</option>
              <option value="movimiento">Movimientos</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <button onClick={loadHistorial} disabled={!selectedId || loading}>
            {loading ? 'Cargando...' : 'Buscar historial'}
          </button>
        </div>
      </div>

      {/* Resumen */}
      {historial && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Pedidos', value: historial.resumen.total_pedidos, color: '#1d4ed8' },
              { label: 'Entregas', value: historial.resumen.total_entregas, color: '#065f46' },
              { label: 'Devoluciones', value: historial.resumen.total_devoluciones, color: '#92400e' },
              { label: 'Ingresos', value: historial.resumen.total_ingresos, color: '#3730a3' },
              { label: 'Ajustes', value: historial.resumen.total_ajustes, color: '#6b21a8' }
            ].map(item => (
              <div key={item.label} style={{
                background: 'white', border: '1px solid #e5e7eb', borderRadius: 8,
                padding: 16, textAlign: 'center'
              }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: item.color }}>{item.value}</div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{item.label}</div>
              </div>
            ))}
          </div>

          {/* Tabla de eventos */}
          <h3>Timeline de actividad</h3>
          {historial.eventos.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No hay actividad registrada para los filtros seleccionados.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Detalle</th>
                  <th>Estado</th>
                  <th>Usuario</th>
                  <th>Observación</th>
                </tr>
              </thead>
              <tbody>
                {historial.eventos.map((e, i) => {
                  const tipoBadge = tipoBadgeColor(e.tipo)
                  const estadoBadge = estadoBadgeColor(e.estado)
                  return (
                    <tr key={`${e.tipo}-${e.id}-${i}`}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{formatFecha(e.fecha)}</td>
                      <td>
                        <span style={{
                          display: 'inline-block', padding: '2px 10px', borderRadius: 12,
                          fontSize: '0.75rem', fontWeight: 600,
                          background: tipoBadge.bg, color: tipoBadge.color
                        }}>
                          {e.tipo}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>{e.detalle}</td>
                      <td>
                        <span style={{
                          display: 'inline-block', padding: '2px 10px', borderRadius: 12,
                          fontSize: '0.75rem', fontWeight: 600,
                          background: estadoBadge.bg, color: estadoBadge.color
                        }}>
                          {e.estado || '-'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>{e.usuario || '-'}</td>
                      <td style={{ fontSize: '0.8rem', color: '#6b7280', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {e.observacion || '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}
