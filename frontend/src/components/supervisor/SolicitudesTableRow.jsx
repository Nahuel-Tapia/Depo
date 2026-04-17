import { formatRatio, getRatioMeta } from './ratioUtils'

function formatEstado(estado) {
  if (estado === 'aprobado') return 'Aprobado'
  if (estado === 'rechazado') return 'Rechazado'
  if (estado === 'cancelado') return 'Cancelado'
  return 'Pendiente'
}

export default function SolicitudesTableRow({ solicitud, onView }) {
  const ratioMeta = getRatioMeta(solicitud.cantidad, solicitud.matricula)
  const fecha = solicitud.fecha ? new Date(solicitud.fecha).toLocaleDateString('es-AR') : '-'
  const isHighRatio = ratioMeta.level === 'alto'

  return (
    <tr className={isHighRatio ? 'sv-sospechosa' : ''}>
      <td>#{solicitud.id}</td>
      <td><strong>{solicitud.escuela}</strong></td>
      <td>{solicitud.solicitante || '-'}</td>
      <td>{solicitud.producto || '-'}</td>
      <td style={{ textAlign: 'center', fontWeight: 600 }}>{solicitud.cantidad}</td>
      <td style={{ textAlign: 'center' }}>{solicitud.matricula}</td>
      <td>
        <span className={`sv-ratio-pill ${ratioMeta.className}`}>
          {formatRatio(ratioMeta.ratio)}
        </span>
      </td>
      <td>{fecha}</td>
      <td>
        <span className={`badge badge-estado-${solicitud.estado}`}>
          {formatEstado(solicitud.estado)}
        </span>
      </td>
      <td>
        <button className="secondary sv-btn-ver" onClick={() => onView(solicitud)}>
          Ver
        </button>
      </td>
    </tr>
  )
}
