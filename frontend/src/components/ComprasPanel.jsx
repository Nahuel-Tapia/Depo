import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'
import PrintButton from './PrintButton'
import { useRef } from 'react'

const ESTADO_BADGE = {
  enviada: 'aprobado',
  procesada: 'entregado',
  borrador: 'pendiente'
}

export default function ComprasPanel() {
  const { token } = useAuth()
  const printRef = useRef(null)

  const [planillas, setPlanillas] = useState([])
  const [detalle, setDetalle] = useState(null)
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [procesandoId, setProcesandoId] = useState(null)

  const loadPlanillas = async () => {
    try {
      const res = await apiFetch('/api/compras/planillas', { token })
      if (!res.ok) throw new Error('No se pudieron cargar las planillas')
      const data = await res.json()
      setPlanillas(data.planillas || [])
    } catch (err) {
      setMsg({ text: err.message, type: 'error' })
    }
  }

  useEffect(() => { loadPlanillas() }, [token])

  const handleVerDetalle = async (id) => {
    if (detalle?.planilla?.id === id) { setDetalle(null); return }
    try {
      const res = await apiFetch(`/api/compras/planillas/${id}`, { token })
      if (!res.ok) throw new Error('No se pudo cargar el detalle')
      const data = await res.json()
      setDetalle(data)
    } catch (err) {
      setMsg({ text: err.message, type: 'error' })
    }
  }

  const handleProcesar = async (id) => {
    setProcesandoId(id)
    try {
      const res = await apiFetch(`/api/compras/planillas/${id}/procesar`, { token, method: 'PATCH' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo procesar')
      setMsg({ text: `Planilla #${id} marcada como procesada.`, type: 'success' })
      if (detalle?.planilla?.id === id) setDetalle(null)
      loadPlanillas()
    } catch (err) {
      setMsg({ text: err.message, type: 'error' })
    } finally {
      setProcesandoId(null)
    }
  }

  // Agrupar detalle por institución para una vista más clara
  const detalleAgrupado = detalle
    ? Object.values(
        (detalle.detalles || []).reduce((acc, d) => {
          if (!acc[d.institucion]) acc[d.institucion] = { institucion: d.institucion, cue: d.cue, items: [] }
          acc[d.institucion].items.push(d)
          return acc
        }, {})
      )
    : []

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>Área de Compras</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>
            Planillas de pedido anual enviadas por las Direcciones de Área.
          </p>
        </div>
        <PrintButton targetRef={printRef} title="Planillas de Compra" />
      </div>

      {msg.text && (
        <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`}>{msg.text}</div>
      )}

      <div ref={printRef} style={{ marginTop: 16 }}>
        {planillas.length === 0 ? (
          <div className="sv-empty-state">No hay planillas recibidas aún.</div>
        ) : (
          planillas.map(p => (
            <div
              key={p.id}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: 16,
                marginBottom: 14,
                background: p.estado === 'procesada' ? '#f0fdf4' : '#fff'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <strong style={{ fontSize: '1.05rem' }}>Planilla #{p.id} — Año {p.anio}</strong>
                  <span
                    className={`badge badge-estado-${ESTADO_BADGE[p.estado] || 'pendiente'}`}
                    style={{ marginLeft: 10 }}
                  >
                    {p.estado}
                  </span>
                  <div style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: 4 }}>
                    Director/a: <strong>{`${p.director_nombre || ''} ${p.director_apellido || ''}`.trim()}</strong>
                    {p.enviada_at && ` · Recibida: ${new Date(p.enviada_at).toLocaleDateString('es-AR')}`}
                  </div>
                  {p.observaciones && (
                    <div style={{ color: 'var(--muted)', fontSize: '0.83rem', marginTop: 2 }}>{p.observaciones}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    className="secondary"
                    style={{ margin: 0 }}
                    onClick={() => handleVerDetalle(p.id)}
                  >
                    {detalle?.planilla?.id === p.id ? 'Ocultar detalle' : 'Ver detalle'}
                  </button>
                  {p.estado === 'enviada' && (
                    <button
                      style={{ margin: 0 }}
                      disabled={procesandoId === p.id}
                      onClick={() => handleProcesar(p.id)}
                    >
                      {procesandoId === p.id ? '...' : 'Marcar procesada'}
                    </button>
                  )}
                </div>
              </div>

              {/* Detalle expandible agrupado por institución */}
              {detalle?.planilla?.id === p.id && (
                <div style={{ marginTop: 16 }}>
                  {detalleAgrupado.map(grupo => (
                    <div key={grupo.institucion} style={{ marginBottom: 12 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>
                        {grupo.institucion}
                        {grupo.cue && <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: 8, fontSize: '0.85rem' }}>CUE: {grupo.cue}</span>}
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
                          {grupo.items.map(item => (
                            <tr key={item.id}>
                              <td>{item.producto}</td>
                              <td>{item.unidad_medida || 'unidad'}</td>
                              <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.cantidad}</td>
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
          ))
        )}
      </div>
    </div>
  )
}
