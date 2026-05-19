import { useMemo, useState } from 'react'

function formatEstado(estado) {
  if (estado === 'aclaracion') return 'Aclaracion solicitada'
  if (estado === 'pendiente_director') return 'Enviado a Director'
  if (estado === 'aprobado') return 'Aprobado'
  if (estado === 'rechazado') return 'Rechazado'
  if (estado === 'cancelado') return 'Cancelado'
  if (estado === 'entregado' || estado === 'finalizado') return 'Entregado'
  return 'Pendiente'
}

export default function SolicitudDetalleModal({
  solicitud,
  historial,
  loadingHistorial,
  onClose,
  onApprove,
  onReject,
  onRequestClarification,
  disabled
}) {
  const solicitudes = useMemo(() => solicitud.solicitudes || [solicitud], [solicitud])
  const firstPending = solicitudes.find(item => item.estado === 'pendiente') || solicitudes[0]
  const [selectedId, setSelectedId] = useState(firstPending?.id)
  const [observacion, setObservacion] = useState('')

  const selected = solicitudes.find(item => item.id === selectedId) || firstPending
  const canAct = selected.estado === 'pendiente'

  const submitReject = () => {
    onReject(observacion.trim(), selected)
  }

  const submitClarification = () => {
    onRequestClarification(observacion.trim(), selected)
  }

  return (
    <div className="sv-modal-overlay" onClick={onClose}>
      <aside className="sv-modal-panel" onClick={e => e.stopPropagation()}>
        <div className="sv-modal-header">
          <div>
            <h3 style={{ marginBottom: 4 }}>{solicitud.escuela}</h3>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.85rem' }}>
              {solicitudes.length} solicitud{solicitudes.length === 1 ? '' : 'es'} para revisar
            </p>
          </div>
          <button className="secondary" onClick={onClose}>Cerrar</button>
        </div>

        <div className="sv-modal-body-scroll">
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 0.9fr) 1.4fr', gap: 18 }}>
          <div>
            <h4 style={{ marginTop: 0 }}>Solicitudes</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {solicitudes.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === selected.id ? 'primary' : 'secondary'}
                  onClick={() => {
                    setSelectedId(item.id)
                    setObservacion('')
                  }}
                  style={{ textAlign: 'left', justifyContent: 'space-between' }}
                >
                  <span>#{item.id} - {item.producto || 'Solicitud'}</span>
                  <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{formatEstado(item.estado)}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="sv-detalle-grid">
              <div><strong>Solicitud:</strong> #{selected.id}</div>
              <div><strong>Solicitante:</strong> {selected.solicitante || '-'}</div>
              <div><strong>Matricula:</strong> {selected.matricula}</div>
              <div><strong>Tipo:</strong> {selected.tipo || 'anual'}</div>
              <div><strong>Cantidad solicitada:</strong> {selected.cantidad}</div>
              <div><strong>Estado:</strong> {formatEstado(selected.estado)}</div>
              <div><strong>Fecha:</strong> {selected.fecha ? new Date(selected.fecha).toLocaleDateString('es-AR') : '-'}</div>
            </div>

            <h4 style={{ marginTop: 16 }}>Detalle del pedido</h4>
            {selected.items?.length > 0 ? (
              <table className="sv-historial-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items.map((item, idx) => (
                    <tr key={`${item.producto || 'producto'}-${idx}`}>
                      <td>{item.producto || '-'}</td>
                      <td style={{ textAlign: 'center' }}>{item.cantidad || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: 'var(--muted)' }}>{selected.producto || 'Sin detalle de productos.'}</p>
            )}

            {selected.notas && (
              <div className="msg show" style={{ marginTop: 12, background: '#f8fafc', color: '#334155', border: '1px solid #e2e8f0' }}>
                <strong>Notas de la escuela:</strong> {selected.notas}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <label htmlFor="sv-observacion" style={{ marginTop: 0 }}>Observacion</label>
          <textarea
            id="sv-observacion"
            className="sv-rechazo-input"
            rows={3}
            placeholder="Agregar motivo de rechazo o pedir aclaracion..."
            value={observacion}
            onChange={e => setObservacion(e.target.value)}
          />
        </div>

        {selected.motivo_supervisor && (
          <div className="msg show" style={{ marginTop: 12, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
            <strong>Ultima observacion del supervisor:</strong> {selected.motivo_supervisor}
          </div>
        )}

        <h4 style={{ marginTop: 20 }}>Historial de pedidos de la escuela</h4>
        {loadingHistorial ? (
          <p style={{ color: 'var(--muted)' }}>Cargando historial...</p>
        ) : historial.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>Sin historial disponible.</p>
        ) : (
          <table className="sv-historial-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Tipo</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((item, idx) => (
                <tr key={`${item.fecha || 'sin-fecha'}-${idx}`}>
                  <td>{item.fecha ? new Date(item.fecha).toLocaleDateString('es-AR') : '-'}</td>
                  <td>{item.producto || '-'}</td>
                  <td style={{ textAlign: 'center' }}>{item.cantidad || '-'}</td>
                  <td>{item.tipo || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        </div>

        <div className="inline-actions sv-modal-actions">
          <button disabled={disabled || !canAct} onClick={() => onApprove(selected)}>Aceptar solicitud</button>
          <button disabled={disabled || !canAct} className="sv-btn-rechazar" onClick={submitReject}>Rechazar solicitud</button>
          <button disabled={disabled || !canAct} className="sv-btn-reparar" onClick={submitClarification}>Pedir aclaracion</button>
        </div>
      </aside>
    </div>
  )
}
