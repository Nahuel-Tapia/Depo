import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

export default function DirectorAreaPanel() {
  const { token } = useAuth()

  const [supervisores, setSupervisores] = useState([])
  const [escuelas, setEscuelas] = useState([])
  const [asignaciones, setAsignaciones] = useState([])
  const [informes, setInformes] = useState([])
  const [solicitudes, setSolicitudes] = useState([])
  const [planillas, setPlanillas] = useState([])
  const [planillaDetalle, setPlanillaDetalle] = useState(null)
  const [planillaObs, setPlanillaObs] = useState('')
  const [creandoPlanilla, setCreandoPlanilla] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)
  const [msg, setMsg] = useState({ text: '', type: '' })

  const [asigForm, setAsigForm] = useState({ supervisor_id: '', institucion_id: '' })
  const [informeForm, setInformeForm] = useState({ supervisor_id: '', asunto: '', detalle: '', fecha_limite: '' })

  const loadAll = async () => {
    try {
      const [catalogoRes, asigRes, informesRes, solicitudesRes] = await Promise.all([
        apiFetch('/api/director-area/catalogo', { token }),
        apiFetch('/api/director-area/asignaciones', { token }),
        apiFetch('/api/director-area/informes', { token }),
        apiFetch('/api/director-area/solicitudes', { token })
      ])

      if (!catalogoRes.ok || !asigRes.ok || !informesRes.ok) {
        throw new Error('No se pudo cargar la información de Dirección de Área')
      }

      const catalogo = await catalogoRes.json()
      const asignacionesData = await asigRes.json()
      const informesData = await informesRes.json()
      const solicitudesData = solicitudesRes.ok ? await solicitudesRes.json() : { solicitudes: [] }

      setSupervisores(catalogo.supervisores || [])
      setEscuelas(catalogo.escuelas || [])
      setAsignaciones(asignacionesData.asignaciones || [])
      setInformes(informesData.informes || [])
      setSolicitudes(solicitudesData.solicitudes || [])

      // Cargar planillas
      const planillasRes = await apiFetch('/api/compras/planillas', { token })
      if (planillasRes.ok) {
        const planillasData = await planillasRes.json()
        setPlanillas(planillasData.planillas || [])
      }
    } catch (err) {
      setMsg({ text: err.message || 'Error cargando datos', type: 'error' })
    }
  }

  useEffect(() => {
    loadAll()
  }, [token])

  const handleAsignar = async (e) => {
    e.preventDefault()
    setMsg({ text: '', type: '' })

    if (!asigForm.supervisor_id || !asigForm.institucion_id) {
      setMsg({ text: 'Debes seleccionar supervisor y escuela', type: 'error' })
      return
    }

    const res = await apiFetch('/api/director-area/asignaciones', {
      token,
      method: 'POST',
      body: JSON.stringify({
        supervisor_id: Number(asigForm.supervisor_id),
        institucion_id: Number(asigForm.institucion_id)
      })
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setMsg({ text: data.error || 'No se pudo crear la asignación', type: 'error' })
      return
    }

    setAsigForm({ supervisor_id: '', institucion_id: '' })
    setMsg({ text: 'Escuela asignada correctamente', type: 'success' })
    loadAll()
  }

  const handleEliminarAsignacion = async (id) => {
    const res = await apiFetch(`/api/director-area/asignaciones/${id}`, { token, method: 'DELETE' })
    if (!res.ok) {
      setMsg({ text: 'No se pudo eliminar asignación', type: 'error' })
      return
    }

    setMsg({ text: 'Asignación eliminada', type: 'success' })
    loadAll()
  }

  const handleSolicitarInforme = async (e) => {
    e.preventDefault()
    setMsg({ text: '', type: '' })

    if (!informeForm.supervisor_id || !informeForm.asunto.trim()) {
      setMsg({ text: 'Supervisor y asunto son obligatorios', type: 'error' })
      return
    }

    const res = await apiFetch('/api/director-area/informes', {
      token,
      method: 'POST',
      body: JSON.stringify({
        supervisor_id: Number(informeForm.supervisor_id),
        asunto: informeForm.asunto.trim(),
        detalle: informeForm.detalle.trim() || null,
        fecha_limite: informeForm.fecha_limite || null
      })
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setMsg({ text: data.error || 'No se pudo solicitar informe', type: 'error' })
      return
    }

    setInformeForm({ supervisor_id: '', asunto: '', detalle: '', fecha_limite: '' })
    setMsg({ text: 'Solicitud de informe registrada', type: 'success' })
    loadAll()
  }

  const handleEntregarSolicitud = async (id) => {
    setUpdatingId(id)
    try {
      const res = await apiFetch(`/api/pedidos/${id}/estado`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ estado: 'entregado' })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'No se pudo actualizar')
      }
      setSolicitudes(prev => prev.map(s => s.id === id ? { ...s, estado: 'entregado' } : s))
      setMsg({ text: `Solicitud #${id} marcada como entregada.`, type: 'success' })
    } catch (err) {
      setMsg({ text: err.message || 'Error al marcar entregada', type: 'error' })
    } finally {
      setUpdatingId(null)
    }
  }

  const handleCrearPlanilla = async () => {
    setCreandoPlanilla(true)
    try {
      const res = await apiFetch('/api/compras/planillas', {
        token,
        method: 'POST',
        body: JSON.stringify({ observaciones: planillaObs.trim() || null })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo crear la planilla')
      setPlanillaObs('')
      setMsg({ text: `Planilla creada con ${data.items} solicitudes. Revisala antes de enviarla.`, type: 'success' })
      loadAll()
    } catch (err) {
      setMsg({ text: err.message, type: 'error' })
    } finally {
      setCreandoPlanilla(false)
    }
  }

  const handleVerDetalle = async (id) => {
    if (planillaDetalle?.planilla?.id === id) { setPlanillaDetalle(null); return }
    try {
      const res = await apiFetch(`/api/compras/planillas/${id}`, { token })
      if (!res.ok) throw new Error('No se pudo cargar el detalle')
      const data = await res.json()
      setPlanillaDetalle(data)
    } catch (err) {
      setMsg({ text: err.message, type: 'error' })
    }
  }

  const handleEnviarPlanilla = async (id) => {
    try {
      const res = await apiFetch(`/api/compras/planillas/${id}/enviar`, { token, method: 'PATCH' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar')
      setMsg({ text: 'Planilla enviada a Área de Compras.', type: 'success' })
      if (planillaDetalle?.planilla?.id === id) setPlanillaDetalle(null)
      loadAll()
    } catch (err) {
      setMsg({ text: err.message, type: 'error' })
    }
  }

  const handleEliminarPlanilla = async (id) => {
    try {
      const res = await apiFetch(`/api/compras/planillas/${id}`, { token, method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo eliminar')
      setMsg({ text: 'Planilla eliminada.', type: 'success' })
      if (planillaDetalle?.planilla?.id === id) setPlanillaDetalle(null)
      loadAll()
    } catch (err) {
      setMsg({ text: err.message, type: 'error' })
    }
  }

  const anioActual = new Date().getFullYear()
  const planillaActivaAnio = planillas.find(p => p.anio === anioActual && p.estado !== 'procesada')
  const solicitudesAnualesPendientes = solicitudes.filter(s => (s.tipo || 'anual') === 'anual' && s.estado === 'aprobado')

  const supervisorMap = useMemo(() => {
    return Object.fromEntries(supervisores.map(s => [String(s.id), `${s.nombre || ''} ${s.apellido || ''}`.trim()]))
  }, [supervisores])

  return (
    <div>
      <h2>Dirección de Área</h2>
      <p style={{ marginTop: 0, color: 'var(--muted)' }}>
        Gestiona la asignación de escuelas a supervisores y solicita informes de seguimiento.
      </p>

      {msg.text && (
        <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`}>
          {msg.text}
        </div>
      )}

      <div className="grid" style={{ alignItems: 'start' }}>
        <section style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14, background: '#fff' }}>
          <h3 style={{ marginTop: 0 }}>Asignar Escuelas a Supervisores</h3>
          <form onSubmit={handleAsignar}>
            <label>Supervisor</label>
            <select value={asigForm.supervisor_id} onChange={e => setAsigForm({ ...asigForm, supervisor_id: e.target.value })}>
              <option value="">Seleccionar supervisor</option>
              {supervisores.map(s => (
                <option key={s.id} value={s.id}>{`${s.nombre || ''} ${s.apellido || ''}`.trim()}</option>
              ))}
            </select>

            <label>Escuela</label>
            <select value={asigForm.institucion_id} onChange={e => setAsigForm({ ...asigForm, institucion_id: e.target.value })}>
              <option value="">Seleccionar escuela</option>
              {escuelas.map(i => (
                <option key={i.id} value={i.id}>{i.nombre} ({i.cue || '-'})</option>
              ))}
            </select>

            <button type="submit">Asignar escuela</button>
          </form>
        </section>

        <section style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14, background: '#fff' }}>
          <h3 style={{ marginTop: 0 }}>Solicitar Informes a Supervisores</h3>
          <form onSubmit={handleSolicitarInforme}>
            <label>Supervisor</label>
            <select value={informeForm.supervisor_id} onChange={e => setInformeForm({ ...informeForm, supervisor_id: e.target.value })}>
              <option value="">Seleccionar supervisor</option>
              {supervisores.map(s => (
                <option key={s.id} value={s.id}>{`${s.nombre || ''} ${s.apellido || ''}`.trim()}</option>
              ))}
            </select>

            <label>Asunto</label>
            <input
              type="text"
              value={informeForm.asunto}
              onChange={e => setInformeForm({ ...informeForm, asunto: e.target.value })}
              placeholder="Ej: Informe mensual de solicitudes"
            />

            <label>Detalle</label>
            <textarea
              className="sv-rechazo-input"
              rows={3}
              value={informeForm.detalle}
              onChange={e => setInformeForm({ ...informeForm, detalle: e.target.value })}
              placeholder="Alcance, formato esperado, indicadores..."
            />

            <label>Fecha límite</label>
            <input
              type="date"
              value={informeForm.fecha_limite}
              onChange={e => setInformeForm({ ...informeForm, fecha_limite: e.target.value })}
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
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {asignaciones.length === 0 ? (
            <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>Sin asignaciones.</td></tr>
          ) : asignaciones.map(a => (
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

      <h3>Solicitudes aprobadas por supervisores</h3>
      <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
        Pedidos que el supervisor ya aprobó. Podés marcarlos como entregados una vez despachados.
      </p>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Institución</th>
            <th>Supervisor</th>
            <th>Producto</th>
            <th>Cantidad</th>
            <th>Solicitante</th>
            <th>Fecha</th>
            <th>Estado</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {solicitudes.length === 0 ? (
            <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)' }}>Sin solicitudes aprobadas.</td></tr>
          ) : solicitudes.map(s => (
            <tr key={s.id}>
              <td>#{s.id}</td>
              <td>{s.institucion}</td>
              <td>{`${s.supervisor_nombre || ''} ${s.supervisor_apellido || ''}`.trim()}</td>
              <td>{s.producto}</td>
              <td>{s.cantidad}</td>
              <td>{s.solicitante}</td>
              <td>{s.fecha ? new Date(s.fecha).toLocaleDateString('es-AR') : '-'}</td>
              <td>
                <span className={`badge badge-estado-${s.estado === 'aprobado' ? 'aprobado' : 'entregado'}`}>
                  {s.estado === 'entregado' || s.estado === 'finalizado' ? 'entregado' : s.estado}
                </span>
              </td>
              <td>
                {(s.estado === 'aprobado') ? (
                  <button
                    className="secondary"
                    style={{ margin: 0 }}
                    disabled={updatingId === s.id}
                    onClick={() => handleEntregarSolicitud(s.id)}
                  >
                    {updatingId === s.id ? '...' : 'Marcar entregado'}
                  </button>
                ) : '-'}
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
            <th>Fecha límite</th>
            <th>Estado</th>
            <th>Creado</th>
          </tr>
        </thead>
        <tbody>
          {informes.length === 0 ? (
            <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>Sin solicitudes.</td></tr>
          ) : informes.map(i => (
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

      {/* ── Planilla de Pedido Anual ── */}
      <h3 style={{ marginTop: 32 }}>Planilla de Pedido Anual {anioActual}</h3>
      <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
        Consolidá todas las solicitudes anuales aprobadas en una planilla y enviala al Área de Compras.
      </p>

      {!planillaActivaAnio ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, background: '#f8fafc', marginBottom: 16 }}>
          {solicitudesAnualesPendientes.length === 0 ? (
            <p style={{ color: 'var(--muted)', margin: 0 }}>
              No hay solicitudes anuales aprobadas para este año. Las verás aquí cuando los supervisores aprueben los pedidos.
            </p>
          ) : (
            <>
              <p style={{ margin: '0 0 10px 0' }}>
                <strong>{solicitudesAnualesPendientes.length}</strong> solicitudes anuales aprobadas listas para incluir en la planilla.
              </p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label>Observaciones (opcional)</label>
                  <input
                    type="text"
                    value={planillaObs}
                    onChange={e => setPlanillaObs(e.target.value)}
                    placeholder="Ej: Planilla anual 2026 — Zona Norte"
                    style={{ marginBottom: 0 }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCrearPlanilla}
                  disabled={creandoPlanilla}
                  style={{ marginBottom: 0 }}
                >
                  {creandoPlanilla ? 'Generando...' : 'Generar planilla anual'}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, background: '#f8fafc', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <strong>Planilla #{planillaActivaAnio.id}</strong>
              <span className={`badge badge-estado-${planillaActivaAnio.estado === 'enviada' ? 'aprobado' : 'pendiente'}`} style={{ marginLeft: 8 }}>
                {planillaActivaAnio.estado}
              </span>
              {planillaActivaAnio.observaciones && (
                <div style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: 4 }}>{planillaActivaAnio.observaciones}</div>
              )}
              <div style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: 2 }}>
                Creada: {new Date(planillaActivaAnio.created_at).toLocaleDateString('es-AR')}
                {planillaActivaAnio.enviada_at && ` · Enviada: ${new Date(planillaActivaAnio.enviada_at).toLocaleDateString('es-AR')}`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="secondary"
                style={{ margin: 0 }}
                onClick={() => handleVerDetalle(planillaActivaAnio.id)}
              >
                {planillaDetalle?.planilla?.id === planillaActivaAnio.id ? 'Ocultar detalle' : 'Ver detalle'}
              </button>
              {planillaActivaAnio.estado === 'borrador' && (
                <>
                  <button
                    style={{ margin: 0 }}
                    onClick={() => handleEnviarPlanilla(planillaActivaAnio.id)}
                  >
                    Enviar a Compras
                  </button>
                  <button
                    className="sv-btn-rechazar"
                    style={{ margin: 0 }}
                    onClick={() => handleEliminarPlanilla(planillaActivaAnio.id)}
                  >
                    Eliminar
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Detalle expandible */}
          {planillaDetalle?.planilla?.id === planillaActivaAnio.id && (
            <div style={{ marginTop: 16, overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Institución</th>
                    <th>CUE</th>
                    <th>Producto</th>
                    <th>Unidad</th>
                    <th>Cantidad</th>
                    <th>Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {(planillaDetalle.detalles || []).map(d => (
                    <tr key={d.id}>
                      <td>{d.institucion}</td>
                      <td>{d.cue || '-'}</td>
                      <td>{d.producto}</td>
                      <td>{d.unidad_medida || 'unidad'}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{d.cantidad}</td>
                      <td>{d.notas || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Historial de planillas anteriores */}
      {planillas.filter(p => p.id !== planillaActivaAnio?.id).length > 0 && (
        <>
          <h4 style={{ marginBottom: 8 }}>Planillas anteriores</h4>
          <table>
            <thead>
              <tr><th>ID</th><th>Año</th><th>Estado</th><th>Enviada</th></tr>
            </thead>
            <tbody>
              {planillas.filter(p => p.id !== planillaActivaAnio?.id).map(p => (
                <tr key={p.id}>
                  <td>#{p.id}</td>
                  <td>{p.anio}</td>
                  <td><span className={`badge badge-estado-${p.estado === 'procesada' ? 'entregado' : p.estado === 'enviada' ? 'aprobado' : 'pendiente'}`}>{p.estado}</span></td>
                  <td>{p.enviada_at ? new Date(p.enviada_at).toLocaleDateString('es-AR') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
