import SolicitudesTableRow from './SolicitudesTableRow'

export default function SolicitudesTable({ solicitudes, onView }) {
  if (solicitudes.length === 0) {
    return <div className="sv-empty-state">No hay solicitudes para los filtros seleccionados.</div>
  }

  return (
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Escuela</th>
          <th>Solicitante</th>
          <th>Producto</th>
          <th>Cantidad solicitada</th>
          <th>Matricula</th>
          <th>Ratio</th>
          <th>Fecha</th>
          <th>Estado</th>
          <th>Accion</th>
        </tr>
      </thead>
      <tbody>
        {solicitudes.map(solicitud => (
          <SolicitudesTableRow key={solicitud.id} solicitud={solicitud} onView={onView} />
        ))}
      </tbody>
    </table>
  )
}
