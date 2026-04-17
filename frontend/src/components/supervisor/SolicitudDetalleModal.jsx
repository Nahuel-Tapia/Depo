import { useState } from 'react'
import { formatRatio, getRatioMeta } from './ratioUtils'

function formatEstado(estado) {
  if (estado === 'aprobado') return 'Aprobado'
  if (estado === 'rechazado') return 'Rechazado'
  return 'Pendiente'
}

export default function SolicitudDetalleModal({ solicitud, historial, loadingHistorial, onClose, onApprove, onReject, onRequestClarification, disabled }) {
  const [observacion, setObservacion] = useState('')
  const ratioMeta = getRatioMeta(solicitud.cantidad, solicitud.matricula)

  const submitReject = () => {
    onReject(observacion.trim())
  }

  const submitClarification = () => {
    onRequestClarification(observacion.trim())
  }

  return (
    <div className="sv-modal-overlay" onClick={onClose}>
      <aside className="sv-modal-panel" onClick={e => e.stopPropagation()}>
        <div className="sv-modal-header">
          <h3>Solicitud #{solicitud.id}</h3>
          <button className="secondary" onClick={onClose}>Cerrar</button>
        </div>

        <div className="sv-detalle-grid">
          <div><strong>Escuela:</strong> {solicitud.escuela}</div>
          <div><strong>Solicitante:</strong> {solicitud.solicitante || '-'}</div>
          <div><strong>Matricula:</strong> {solicitud.matricula}</div>
          <div><strong>Producto:</strong> {solicitud.producto || '-'}</div>
          <div><strong>Cantidad solicitada:</strong> {solicitud.cantidad}</div>
          <div>
            <strong>Ratio:</strong>{' '}
            <span className={`sv-ratio-pill ${ratioMeta.className}`}>
              {formatRatio(ratioMeta.ratio)}
            </span>
          </div>
          <div><strong>Estado:</strong> {formatEstado(solicitud.estado)}</div>
          <div><strong>Fecha:</strong> {solicitud.fecha ? new Date(solicitud.fecha).toLocaleDateString('es-AR') : '-'}</div>
        </div>

        <div style={{ marginTop: 12 }}>
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

        <div className="inline-actions" style={{ marginTop: 12 }}>
          <button disabled={disabled || solicitud.estado !== 'pendiente'} onClick={onApprove}>Aprobar solicitud</button>
          <button disabled={disabled || solicitud.estado !== 'pendiente'} className="sv-btn-rechazar" onClick={submitReject}>Rechazar solicitud</button>
          <button disabled={disabled} className="sv-btn-reparar" onClick={submitClarification}>Pedir aclaracion</button>
        </div>
      </aside>
    </div>
  )
}
