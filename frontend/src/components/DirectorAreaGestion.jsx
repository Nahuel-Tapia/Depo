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

      <div className="grid" style={{ alignItems: 'start' }}>
        <section style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14, background: '#fff' }}>
          <h3 style={{ marginTop: 0 }}>Asignar Escuelas a Supervisores</h3>
          <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
            Solo podés asignar escuelas del nivel {nivelEducativo || 'configurado'}.
          </p>

          <form onSubmit={handleAsignar}>
            <label>Supervisor</label>
            <select value={asigForm.supervisor_id} onChange={(e) => setAsigForm({ ...asigForm, supervisor_id: e.target.value })}>
              <option value="">Seleccionar supervisor</option>
              {supervisores.map((s) => (
                <option key={s.id} value={s.id}>{`${s.nombre || ''} ${s.apellido || ''}`.trim()}</option>
              ))}
            </select>

            <label>CUE de la escuela</label>
            <input
              type="text"
              value={asigForm.cue || ''}
              onChange={(e) => {
                const cue = e.target.value.replace(/[^0-9]/g, '').slice(0, 9)
                let institucion_id = ''
                let nombre = ''
                let nivel = ''
                let opciones = []

                if (cue.length >= 5) {
                  opciones = escuelas.filter((i) => String(i.cue) === cue)
                  if (opciones.length === 1) {
                    institucion_id = opciones[0].id
                    nombre = opciones[0].nombre
                    nivel = opciones[0].nivel || ''
                  }
                }

                setAsigForm({ ...asigForm, cue, institucion_id, nombre, nivel, opciones })
              }}
              placeholder="Ej: 540123400"
              autoComplete="off"
            />

            {asigForm.cue && (asigForm.nombre || asigForm.nivel) && (
              <div style={{ margin: '8px 0 10px 0', color: '#333', fontSize: '1em' }}>
                <div><b>CUE:</b> {asigForm.cue}</div>
                {asigForm.nombre && <div><b>Escuela:</b> {asigForm.nombre}</div>}
                {asigForm.nivel && <div><b>Nivel:</b> {asigForm.nivel}</div>}
              </div>
            )}

            {asigForm.opciones && asigForm.opciones.length > 1 && (
              <>
                <label>Seleccionar escuela</label>
                <select
                  value={asigForm.institucion_id || ''}
                  onChange={(e) => {
                    const institucion_id = e.target.value
                    const escuela = asigForm.opciones.find((i) => String(i.id) === institucion_id)
                    setAsigForm({
                      ...asigForm,
                      institucion_id,
                      nombre: escuela ? escuela.nombre : '',
                      nivel: escuela ? escuela.nivel : ''
                    })
                  }}
                >
                  <option value="">Seleccionar escuela</option>
                  {asigForm.opciones.map((i) => (
                    <option key={i.id} value={i.id}>{i.nombre} - {i.nivel || 'Sin nivel'}</option>
                  ))}
                </select>
              </>
            )}

            <button type="submit">Asignar escuela</button>
          </form>
        </section>

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
      </div>

      <h3>Asignaciones actuales</h3>
      <table>
        <thead>
          <tr>
            <th>Supervisor</th>
            <th>Escuela</th>
            <th>CUE</th>
            <th>Fecha</th>
            <th>Accion</th>
          </tr>
        </thead>
        <tbody>
          {asignaciones.length === 0 ? (
            <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>Sin asignaciones.</td></tr>
          ) : asignaciones.map((a) => (
            <tr key={a.id}>
              <td>{`${a.supervisor_nombre || ''} ${a.supervisor_apellido || ''}`.trim()}</td>
              <td>{a.institucion_nombre}</td>
              <td>{a.cue || '-'}</td>
              <td>{a.created_at ? new Date(a.created_at).toLocaleDateString('es-AR') : '-'}</td>
              <td>
                <button className="secondary" style={{ margin: 0 }} onClick={() => handleEliminarAsignacion(a.id)}>
                  Quitar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

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
