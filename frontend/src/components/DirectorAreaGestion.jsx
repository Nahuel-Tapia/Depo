export default function DirectorAreaGestion({
  nivelEducativo,
  supervisores,
  escuelas,
  asignaciones,
  informes,
  asigForm,
  setAsigForm,
  handleAsignar,
  handleEliminarAsignacion,
  informeForm,
  setInformeForm,
  handleSolicitarInforme,
  msg,
  supervisorMap
}) {
  return (
    <>
      <section style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, background: '#fff', marginBottom: 18 }}>
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>Nivel Educativo Asignado</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="badge">{nivelEducativo || 'Sin configurar'}</span>
          <span style={{ color: 'var(--muted)', fontSize: '0.92rem' }}>
            Las escuelas disponibles en esta seccion ya estan filtradas automaticamente por este nivel.
          </span>
        </div>
      </section>

      {msg.text && (
        <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`}>{msg.text}</div>
      )}

      {/* Sección de asignación directa de escuelas a supervisores eliminada por migración a zonas */}

        <section style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14, background: '#fff' }}>
          <h3 style={{ marginTop: 0 }}>Solicitar Informes a Supervisores</h3>
          <form onSubmit={handleSolicitarInforme}>
            <label>Supervisor</label>
            <select value={informeForm.supervisor_id} onChange={(e) => setInformeForm({ ...informeForm, supervisor_id: e.target.value })}>
              <option value="">Seleccionar supervisor</option>
              {supervisores.map((s) => (
                <option key={s.id} value={s.id}>{`${s.nombre || ''} ${s.apellido || ''}`.trim()}</option>
              ))}
            </select>

            <label>Asunto</label>
            <input
              type="text"
              value={informeForm.asunto}
              onChange={(e) => setInformeForm({ ...informeForm, asunto: e.target.value })}
              placeholder="Ej: Informe mensual de solicitudes"
            />

            <label>Detalle</label>
            <textarea
              className="sv-rechazo-input"
              rows={3}
              value={informeForm.detalle}
              onChange={(e) => setInformeForm({ ...informeForm, detalle: e.target.value })}
              placeholder="Alcance, formato esperado, indicadores..."
            />

            <label>Fecha limite</label>
            <input
              type="date"
              value={informeForm.fecha_limite}
              onChange={(e) => setInformeForm({ ...informeForm, fecha_limite: e.target.value })}
            />

            <button type="submit">Solicitar informe</button>
          </form>
        </section>

      {/* Tabla de asignaciones actuales eliminada por migración a zonas */}

      <h3>Solicitudes de informe</h3>
      <table>
        <thead>
          <tr>
            <th>Supervisor</th>
            <th>Asunto</th>
            <th>Fecha limite</th>
            <th>Estado</th>
            <th>Creado</th>
          </tr>
        </thead>
        <tbody>
          {informes.length === 0 ? (
            <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>Sin solicitudes.</td></tr>
          ) : informes.map((i) => (
            <tr key={i.id}>
              <td>{supervisorMap[String(i.supervisor_id)] || `${i.supervisor_nombre || ''} ${i.supervisor_apellido || ''}`.trim()}</td>
              <td>
                <strong>{i.asunto}</strong>
                {i.detalle ? <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{i.detalle}</div> : null}
              </td>
              <td>{i.fecha_limite ? new Date(i.fecha_limite).toLocaleDateString('es-AR') : '-'}</td>
              <td><span className="badge badge-estado-pendiente">{i.estado || 'pendiente'}</span></td>
              <td>{i.created_at ? new Date(i.created_at).toLocaleDateString('es-AR') : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
