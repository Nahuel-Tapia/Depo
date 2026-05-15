import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

export default function DistribucionEscuelas() {
  const { token } = useAuth()
  const [vista, setVista] = useState('zonas')
  const [zonas, setZonas] = useState([])
  const [detalleZona, setDetalleZona] = useState(null)
  const [departamentosEnvio, setDepartamentosEnvio] = useState([])
  const [detalleDepartamento, setDetalleDepartamento] = useState(null)
  const [depositos, setDepositos] = useState([])
  const [selectedDeposito, setSelectedDeposito] = useState('')
  const [entregas, setEntregas] = useState({})
  const [entregasEnvio, setEntregasEnvio] = useState({})
  const [loading, setLoading] = useState(false)
  const [loadingEnvio, setLoadingEnvio] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingEnvio, setSavingEnvio] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: '' })

  const anioActual = new Date().getFullYear()

  const totalEscuelasConCarga = useMemo(() => {
    return Object.values(entregas).filter((items) => {
      return Object.values(items || {}).some((qty) => Number(qty) > 0)
    }).length
  }, [entregas])

  const totalSolicitudesConCarga = useMemo(() => {
    return Object.values(entregasEnvio).filter((items) => {
      return Object.values(items || {}).some((qty) => Number(qty) > 0)
    }).length
  }, [entregasEnvio])

  const loadZonas = async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/depositos/distribucion/zonas-pendientes?anio=${anioActual}`, { token })
      if (res.ok) {
        const data = await res.json()
        setZonas(data.zonas || [])
      } else {
        const data = await res.json().catch(() => ({}))
        setMsg({ text: data.error || 'No se pudieron cargar zonas pendientes', type: 'error' })
      }
    } catch {
      setMsg({ text: 'Error de conexión al cargar zonas pendientes', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const loadDepositos = async () => {
    const res = await apiFetch('/api/depositos', { token })
    if (res.ok) {
      const data = await res.json()
      setDepositos(data.depositos || [])
      if (data.depositos?.length > 0) setSelectedDeposito(String(data.depositos[0].id))
    }
  }

  const loadDepartamentosEnvio = async () => {
    setLoadingEnvio(true)
    try {
      const res = await apiFetch(`/api/entregas/solicitudes-envio/departamentos?anio=${anioActual}`, { token })
      if (res.ok) {
        const data = await res.json()
        setDepartamentosEnvio(data.departamentos || [])
      } else {
        const data = await res.json().catch(() => ({}))
        setMsg({ text: data.error || 'No se pudieron cargar departamentos con envíos pendientes', type: 'error' })
      }
    } catch {
      setMsg({ text: 'Error de conexión al cargar envíos por departamento', type: 'error' })
    } finally {
      setLoadingEnvio(false)
    }
  }

  useEffect(() => {
    loadZonas()
    loadDepositos()
    loadDepartamentosEnvio()
  }, [])

  const verDetalleZona = async (zona) => {
    setLoading(true)
    setEntregas({})
    try {
      const res = await apiFetch(`/api/depositos/distribucion/zonas/${zona.zona_id}/detalle?anio=${anioActual}`, { token })
      if (res.ok) {
        const data = await res.json()
        setDetalleZona(data)
      } else {
        const data = await res.json().catch(() => ({}))
        setMsg({ text: data.error || 'No se pudo cargar detalle zonal', type: 'error' })
      }
    } catch {
      setMsg({ text: 'Error de conexión al cargar detalle zonal', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleQtyChange = (institucionId, productoId, value) => {
    setEntregas((prev) => ({
      ...prev,
      [institucionId]: {
        ...(prev[institucionId] || {}),
        [productoId]: value,
      },
    }))
  }

  const handleQtyChangeEnvio = (solicitudId, productoId, value) => {
    setEntregasEnvio((prev) => ({
      ...prev,
      [solicitudId]: {
        ...(prev[solicitudId] || {}),
        [productoId]: value,
      },
    }))
  }

  const handleConfirmarEgresoMultiple = async () => {
    if (!detalleZona?.zona?.id) {
      setMsg({ text: 'Seleccione una zona para distribuir', type: 'error' })
      return
    }
    if (!selectedDeposito) {
      setMsg({ text: 'Seleccione un depósito de origen', type: 'error' })
      return
    }

    const payloadEntregas = Object.entries(entregas)
      .map(([idInstitucion, productos]) => {
        const items = Object.entries(productos || {})
          .filter(([, qty]) => Number(qty) > 0)
          .map(([idProducto, qty]) => ({ id_producto: Number(idProducto), cantidad: Number(qty) }))
        return { id_institucion: Number(idInstitucion), items }
      })
      .filter((row) => row.items.length > 0)

    if (payloadEntregas.length === 0) {
      setMsg({ text: 'Cargue al menos una cantidad para una escuela de la zona', type: 'error' })
      return
    }

    setSaving(true)
    try {
      const res = await apiFetch('/api/depositos/distribucion/egreso-multiple', {
        token,
        method: 'POST',
        body: JSON.stringify({
          zona_id: Number(detalleZona.zona.id),
          anio: anioActual,
          id_deposito: Number(selectedDeposito),
          observaciones: `Distribución zonal ${detalleZona.zona.nombre}`,
          entregas: payloadEntregas,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setMsg({ text: `Egreso múltiple registrado. Lote #${data.lote_id}`, type: 'success' })
        setDetalleZona(null)
        setEntregas({})
        loadZonas()
      } else {
        const data = await res.json().catch(() => ({}))
        setMsg({ text: data.error || 'No se pudo registrar el egreso múltiple', type: 'error' })
      }
    } catch {
      setMsg({ text: 'Error de conexión al registrar egreso múltiple', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const verDetalleDepartamento = async (departamento) => {
    setLoadingEnvio(true)
    setEntregasEnvio({})
    try {
      const encoded = encodeURIComponent(departamento)
      const res = await apiFetch(`/api/entregas/solicitudes-envio/departamentos/${encoded}/detalle?anio=${anioActual}`, { token })
      if (res.ok) {
        const data = await res.json()
        setDetalleDepartamento(data)
      } else {
        const data = await res.json().catch(() => ({}))
        setMsg({ text: data.error || 'No se pudo cargar el detalle de envíos por departamento', type: 'error' })
      }
    } catch {
      setMsg({ text: 'Error de conexión al cargar el detalle del departamento', type: 'error' })
    } finally {
      setLoadingEnvio(false)
    }
  }

  const handleConfirmarEgresoDepartamento = async () => {
    if (!detalleDepartamento?.departamento) {
      setMsg({ text: 'Seleccione un departamento para distribuir', type: 'error' })
      return
    }
    if (!selectedDeposito) {
      setMsg({ text: 'Seleccione un depósito de origen', type: 'error' })
      return
    }

    const payloadEntregas = Object.entries(entregasEnvio)
      .map(([idSolicitud, productos]) => {
        const items = Object.entries(productos || {})
          .filter(([, qty]) => Number(qty) > 0)
          .map(([idProducto, qty]) => ({ id_producto: Number(idProducto), cantidad: Number(qty) }))
        return { id_solicitud: Number(idSolicitud), items }
      })
      .filter((row) => row.items.length > 0)

    if (payloadEntregas.length === 0) {
      setMsg({ text: 'Cargue al menos una cantidad para una solicitud del departamento', type: 'error' })
      return
    }

    setSavingEnvio(true)
    try {
      const res = await apiFetch('/api/entregas/solicitudes-envio/egreso-multiple', {
        token,
        method: 'POST',
        body: JSON.stringify({
          departamento: detalleDepartamento.departamento,
          id_deposito: Number(selectedDeposito),
          observaciones: `Distribución por envío - ${detalleDepartamento.departamento}`,
          entregas: payloadEntregas,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setMsg({ text: `Egreso por departamento registrado. Movimientos: ${data.movimientos_creados}`, type: 'success' })
        setDetalleDepartamento(null)
        setEntregasEnvio({})
        loadDepartamentosEnvio()
      } else {
        const data = await res.json().catch(() => ({}))
        setMsg({ text: data.error || 'No se pudo registrar el egreso por departamento', type: 'error' })
      }
    } catch {
      setMsg({ text: 'Error de conexión al registrar egreso por departamento', type: 'error' })
    } finally {
      setSavingEnvio(false)
    }
  }

  const renderZonas = () => {
    if (!detalleZona) {
      if (loading) return <div className="sv-empty-state">Buscando zonas con pendientes...</div>
      if (zonas.length === 0) return <div className="sv-empty-state">No hay zonas con distribución pendiente.</div>

      return (
        <table>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th>ZONA</th>
              <th style={{ textAlign: 'center' }}>ESCUELAS CON PENDIENTE</th>
              <th style={{ textAlign: 'center' }}>PRODUCTOS PENDIENTES</th>
              <th style={{ textAlign: 'center' }}>CANTIDAD TOTAL PENDIENTE</th>
              <th style={{ textAlign: 'right' }}>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {zonas.map((z) => (
              <tr key={z.zona_id}>
                <td style={{ fontWeight: 700 }}>{z.zona_nombre}</td>
                <td style={{ textAlign: 'center' }}>{z.escuelas_pendientes}</td>
                <td style={{ textAlign: 'center' }}>{z.productos_pendientes}</td>
                <td style={{ textAlign: 'center' }}>{z.cantidad_pendiente_total}</td>
                <td style={{ textAlign: 'right' }}>
                  <button onClick={() => verDetalleZona(z)}>Armar Egreso Múltiple</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    }

    return (
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <button className="secondary" onClick={() => setDetalleZona(null)} disabled={saving}>Volver a zonas</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ fontSize: '0.85rem' }}>Depósito de origen:</label>
            <select
              value={selectedDeposito}
              onChange={(e) => setSelectedDeposito(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, minWidth: 220 }}
            >
              {depositos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
          </div>
        </div>

        <h3 style={{ borderBottom: '2px solid var(--primary)', paddingBottom: 10, marginBottom: 10 }}>
          Zona: {detalleZona.zona?.nombre}
        </h3>
        <p style={{ marginTop: 0, color: 'var(--muted)' }}>
          Escuelas con carga actual: {totalEscuelasConCarga}. Año operativo: {detalleZona.anio || anioActual}.
        </p>

        {(detalleZona.escuelas || []).map((escuela) => (
          <div key={escuela.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{escuela.nombre}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>CUE: {escuela.cue || '-'} | Nivel: {escuela.nivel || '-'}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Ubicación: {escuela.ubicacion || '-'}</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--muted)' }}>
                <div>Productos pendientes: {escuela.productos_pendientes}</div>
                <div>Cantidad pendiente total: {escuela.cantidad_pendiente_total}</div>
              </div>
            </div>

            <table style={{ marginBottom: 0 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th>Producto</th>
                  <th style={{ textAlign: 'center' }}>Adjudicado</th>
                  <th style={{ textAlign: 'center' }}>Entregado</th>
                  <th style={{ textAlign: 'center' }}>Pendiente</th>
                  <th style={{ textAlign: 'center', width: 160 }}>Enviar Ahora</th>
                </tr>
              </thead>
              <tbody>
                {(escuela.items || []).map((item) => {
                  const pendiente = Number(item.cantidad_pendiente || 0)
                  return (
                    <tr key={`${escuela.id}-${item.id}`}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.producto}</div>
                        <div style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{item.unidad_medida || '-'}</div>
                      </td>
                      <td style={{ textAlign: 'center' }}>{item.cantidad_adjudicada}</td>
                      <td style={{ textAlign: 'center' }}>{item.cantidad_entregada}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{pendiente}</td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="number"
                          min="0"
                          max={pendiente}
                          value={entregas[escuela.id]?.[item.id] || ''}
                          placeholder={`0-${pendiente}`}
                          onChange={(e) => handleQtyChange(escuela.id, item.id, e.target.value)}
                          style={{ width: 120, textAlign: 'center' }}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button className="secondary" onClick={() => setDetalleZona(null)} disabled={saving}>Cancelar</button>
          <button className="primary" onClick={handleConfirmarEgresoMultiple} disabled={saving}>
            {saving ? 'Registrando...' : 'Confirmar Egreso Múltiple'}
          </button>
        </div>
      </section>
    )
  }

  const renderEnviosDepartamento = () => {
    if (!detalleDepartamento) {
      if (loadingEnvio) return <div className="sv-empty-state">Buscando departamentos con envíos pendientes...</div>
      if (departamentosEnvio.length === 0) return <div className="sv-empty-state">No hay solicitudes con envío pendientes.</div>

      return (
        <>
          <table>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th>DEPARTAMENTO</th>
                <th style={{ textAlign: 'center' }}>SOLICITUDES</th>
                <th style={{ textAlign: 'center' }}>ESCUELAS</th>
                <th style={{ textAlign: 'center' }}>PRODUCTOS</th>
                <th style={{ textAlign: 'center' }}>CANTIDAD TOTAL PENDIENTE</th>
                <th style={{ textAlign: 'right' }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {departamentosEnvio.map((d) => (
                <tr key={d.departamento}>
                  <td style={{ fontWeight: 700 }}>{d.departamento}</td>
                  <td style={{ textAlign: 'center' }}>{d.cantidad_solicitudes}</td>
                  <td style={{ textAlign: 'center' }}>{d.cantidad_escuelas}</td>
                  <td style={{ textAlign: 'center' }}>{d.cantidad_productos}</td>
                  <td style={{ textAlign: 'center' }}>{d.cantidad_total_pendiente}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button onClick={() => verDetalleDepartamento(d.departamento)}>Ver Detalle y Armar Egreso</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p style={{ marginTop: 10, color: 'var(--muted)', fontSize: '0.88rem' }}>
            Para ver qué solicitó cada escuela y las instituciones faltantes por solicitar retiro, entrá al detalle del departamento.
          </p>
        </>
      )
    }

    return (
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <button className="secondary" onClick={() => setDetalleDepartamento(null)} disabled={savingEnvio}>Volver a departamentos</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ fontSize: '0.85rem' }}>Depósito de origen:</label>
            <select
              value={selectedDeposito}
              onChange={(e) => setSelectedDeposito(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, minWidth: 220 }}
            >
              {depositos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
          </div>
        </div>

        <h3 style={{ borderBottom: '2px solid var(--primary)', paddingBottom: 10, marginBottom: 10 }}>
          Departamento: {detalleDepartamento.departamento}
        </h3>
        <p style={{ marginTop: 0, color: 'var(--muted)' }}>
          Solicitudes con carga actual: {totalSolicitudesConCarga}. Año operativo: {detalleDepartamento.anio || anioActual}.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div className="badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
            Solicitudes: {detalleDepartamento.resumen?.total_solicitudes || 0}
          </div>
          <div className="badge" style={{ background: '#f0fdf4', color: '#166534' }}>
            Escuelas con solicitud: {detalleDepartamento.resumen?.total_escuelas || 0}
          </div>
          <div className="badge" style={{ background: '#fff7ed', color: '#9a3412' }}>
            Cantidad solicitada pendiente: {detalleDepartamento.resumen?.total_cantidad || 0}
          </div>
        </div>

        {(detalleDepartamento.solicitudes || []).map((solicitud) => (
          <div key={solicitud.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 16 }}>
            {(() => {
              const totalSolicitado = (solicitud.items || []).reduce((acc, item) => acc + Number(item.cantidad_solicitada || 0), 0)
              const totalEntregado = (solicitud.items || []).reduce((acc, item) => acc + Number(item.cantidad_entregada || 0), 0)
              const totalPendiente = Math.max(0, totalSolicitado - totalEntregado)
              return (
                <div style={{ marginBottom: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span className="badge" style={{ background: '#f8fafc', color: '#334155' }}>
                    Pedido solicitado: {totalSolicitado}
                  </span>
                  <span className="badge" style={{ background: '#ecfeff', color: '#155e75' }}>
                    Ya entregado: {totalEntregado}
                  </span>
                  <span className="badge" style={{ background: '#fff7ed', color: '#9a3412' }}>
                    Pendiente: {totalPendiente}
                  </span>
                </div>
              )
            })()}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{solicitud.institucion_nombre}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                  Solicitud #{solicitud.id} | CUE: {solicitud.cue || '-'}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--muted)' }}>
                <div>Estado: {solicitud.estado}</div>
                <div>Fecha retiro: {solicitud.fecha_retiro ? new Date(solicitud.fecha_retiro).toLocaleDateString('es-AR') : '-'}</div>
              </div>
            </div>

            <table style={{ marginBottom: 0 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th>Producto</th>
                  <th style={{ textAlign: 'center' }}>Solicitado</th>
                  <th style={{ textAlign: 'center' }}>Entregado</th>
                  <th style={{ textAlign: 'center' }}>Pendiente</th>
                  <th style={{ textAlign: 'center', width: 160 }}>Enviar Ahora</th>
                </tr>
              </thead>
              <tbody>
                {(solicitud.items || []).map((item) => {
                  const pendiente = Math.max(0, Number(item.cantidad_solicitada || 0) - Number(item.cantidad_entregada || 0))
                  return (
                    <tr key={`${solicitud.id}-${item.producto_id}`}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.producto_nombre}</div>
                        <div style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{item.unidad_medida || '-'}</div>
                      </td>
                      <td style={{ textAlign: 'center' }}>{item.cantidad_solicitada}</td>
                      <td style={{ textAlign: 'center' }}>{item.cantidad_entregada}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{pendiente}</td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="number"
                          min="0"
                          max={pendiente}
                          value={entregasEnvio[solicitud.id]?.[item.producto_id] || ''}
                          placeholder={`0-${pendiente}`}
                          onChange={(e) => handleQtyChangeEnvio(solicitud.id, item.producto_id, e.target.value)}
                          style={{ width: 120, textAlign: 'center' }}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}

        <div style={{ marginTop: 18, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
          <h4 style={{ margin: '0 0 8px 0' }}>Instituciones del departamento sin solicitud de retiro</h4>
          <p style={{ marginTop: 0, color: 'var(--muted)' }}>
            Información para gestión preventiva: escuelas con pedido anual aprobado y saldo pendiente que aún no iniciaron solicitud de retiro este año.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div className="badge" style={{ background: '#fef2f2', color: '#991b1b' }}>
              Instituciones faltantes: {detalleDepartamento.resumen_faltantes?.total_instituciones || 0}
            </div>
            <div className="badge" style={{ background: '#fffbeb', color: '#92400e' }}>
              Productos pendientes: {detalleDepartamento.resumen_faltantes?.total_productos_pendientes || 0}
            </div>
            <div className="badge" style={{ background: '#fff7ed', color: '#9a3412' }}>
              Cantidad pendiente total: {detalleDepartamento.resumen_faltantes?.total_cantidad_pendiente || 0}
            </div>
          </div>

          {(detalleDepartamento.faltantes_solicitud || []).length === 0 ? (
            <div className="sv-empty-state" style={{ marginTop: 8 }}>
              No hay instituciones faltantes por solicitar retiro en este departamento.
            </div>
          ) : (
            <table>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th>Institución</th>
                  <th>CUE</th>
                  <th style={{ textAlign: 'center' }}>Productos pendientes</th>
                  <th style={{ textAlign: 'center' }}>Cantidad pendiente total</th>
                </tr>
              </thead>
              <tbody>
                {(detalleDepartamento.faltantes_solicitud || []).map((inst) => (
                  <tr key={inst.id_institucion}>
                    <td style={{ fontWeight: 600 }}>{inst.institucion_nombre}</td>
                    <td>{inst.cue || '-'}</td>
                    <td style={{ textAlign: 'center' }}>{inst.productos_pendientes}</td>
                    <td style={{ textAlign: 'center' }}>{inst.cantidad_pendiente_total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button className="secondary" onClick={() => setDetalleDepartamento(null)} disabled={savingEnvio}>Cancelar</button>
          <button className="primary" onClick={handleConfirmarEgresoDepartamento} disabled={savingEnvio}>
            {savingEnvio ? 'Registrando...' : 'Confirmar Egreso por Departamento'}
          </button>
        </div>
      </section>
    )
  }

  return (
    <div className="card" style={{ padding: 24, minHeight: 'auto' }}>
      <h2 style={{ marginTop: 0 }}>Distribución por Zonas (Egreso Múltiple)</h2>
      <p style={{ color: 'var(--muted)', marginTop: 0 }}>
        Gestiona entregas por zona o por solicitudes de envío agrupadas por departamento.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          type="button"
          className={vista === 'zonas' ? 'primary' : 'secondary'}
          onClick={() => setVista('zonas')}
          style={{ width: 'auto', margin: 0 }}
        >
          Distribución por Zonas
        </button>
        <button
          type="button"
          className={vista === 'envios' ? 'primary' : 'secondary'}
          onClick={() => setVista('envios')}
          style={{ width: 'auto', margin: 0 }}
        >
          Envíos por Departamento
        </button>
      </div>

      {msg.text && (
        <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`} style={{ marginBottom: 20 }}>
          {msg.text}
        </div>
      )}

      {vista === 'zonas' ? renderZonas() : renderEnviosDepartamento()}
    </div>
  )
}
