function formatEstado(estado) {
  if (estado === 'aclaracion') return 'Aclaracion solicitada'
  if (estado === 'pendiente_director') return 'Enviado a Director'
  if (estado === 'aprobado') return 'Aprobado'
  if (estado === 'rechazado') return 'Rechazado'
  if (estado === 'cancelado') return 'Cancelado'
  return 'Pendiente'
}

function getGrupoEstado(solicitud) {
  const solicitudes = solicitud.solicitudes || [solicitud]
  const pendientes = solicitudes.filter(item => item.estado === 'pendiente').length
  if (pendientes > 0) return `${pendientes} pendiente${pendientes === 1 ? '' : 's'}`
  return formatEstado(solicitudes[0]?.estado)
}

export default function SolicitudesTableRow({ solicitud, onView }) {
  const fecha = solicitud.fecha ? new Date(solicitud.fecha).toLocaleDateString('es-AR') : '-'
  const totalSolicitudes = solicitud.cantidad_solicitudes || 1
  const resumen = totalSolicitudes > 1 ? `${totalSolicitudes} pedidos de la escuela` : (solicitud.producto || '-')

  return (
    <tr>
      <td>{totalSolicitudes > 1 ? '-' : `#${solicitud.solicitudes?.[0]?.id || solicitud.id}`}</td>
      <td><strong>{solicitud.escuela}</strong></td>
      <td style={{ textAlign: 'center', fontWeight: 700 }}>{totalSolicitudes}</td>
      <td>{resumen}</td>
      <td style={{ textAlign: 'center', fontWeight: 600 }}>{solicitud.cantidad_total || solicitud.cantidad}</td>
      <td style={{ textAlign: 'center' }}>{solicitud.matricula}</td>
      <td>{fecha}</td>
      <td>
        <span className={`badge badge-estado-${solicitud.estado}`}>
          {getGrupoEstado(solicitud)}
        </span>
      </td>
      <td>
        <button className="secondary sv-btn-ver" onClick={() => onView(solicitud)}>
          Ver detalle
        </button>
      </td>
    </tr>
  )
}
