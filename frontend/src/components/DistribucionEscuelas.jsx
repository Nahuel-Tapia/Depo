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
  const [seguimientoEnvio, setSeguimientoEnvio] = useState([])
  const [resumenSeguimiento, setResumenSeguimiento] = useState(null)
  const [detalleSeguimiento, setDetalleSeguimiento] = useState(null)
  const [depositos, setDepositos] = useState([])
  const [selectedDeposito, setSelectedDeposito] = useState('')
  const [entregas, setEntregas] = useState({})
  const [entregasEnvio, setEntregasEnvio] = useState({})
  const [loading, setLoading] = useState(false)
  const [loadingEnvio, setLoadingEnvio] = useState(false)
  const [loadingSeguimiento, setLoadingSeguimiento] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingEnvio, setSavingEnvio] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: '' })

  const [tipoEnvio, setTipoEnvio] = useState('directo')
  const [selectedSede, setSelectedSede] = useState('')

  const [solicitudesSede, setSolicitudesSede] = useState([])
  const [loadingSedes, setLoadingSedes] = useState(false)

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

  const loadSeguimientoEnvio = async () => {
    setLoadingSeguimiento(true)
    try {
      const res = await apiFetch(`/api/entregas/solicitudes-envio/seguimiento?anio=${anioActual}`, { token })
      if (res.ok) {
        const data = await res.json()
        setSeguimientoEnvio(data.lotes || [])
        setResumenSeguimiento(data.resumen || null)
      } else {
        const data = await res.json().catch(() => ({}))
        setMsg({ text: data.error || 'No se pudo cargar seguimiento de envíos', type: 'error' })
      }
    } catch {
      setMsg({ text: 'Error de conexión al cargar seguimiento de envíos', type: 'error' })
    } finally {
      setLoadingSeguimiento(false)
    }
  }

  const verDetalleSeguimiento = async (loteId) => {
    setLoadingSeguimiento(true)
    try {
      const res = await apiFetch(`/api/entregas/solicitudes-envio/seguimiento/${loteId}`, { token })
      if (res.ok) {
        const data = await res.json()
        setDetalleSeguimiento(data)
      } else {
        const data = await res.json().catch(() => ({}))
        setMsg({ text: data.error || 'No se pudo cargar el detalle del lote', type: 'error' })
      }
    } catch {
      setMsg({ text: 'Error de conexión al cargar detalle de seguimiento', type: 'error' })
    } finally {
      setLoadingSeguimiento(false)
    }
  }

  const loadSedes = async () => {
    setLoadingSedes(true)
    try {
      const res = await apiFetch(`/api/entregas/sedes/en-sede`, { token })
      if (res.ok) {
        const data = await res.json()
        setSolicitudesSede(data.solicitudes || [])
      } else {
        const data = await res.json().catch(() => ({}))
        setMsg({ text: data.error || 'No se pudieron cargar las solicitudes en Sede', type: 'error' })
      }
    } catch {
      setMsg({ text: 'Error de conexión al cargar solicitudes en Sede', type: 'error' })
    } finally {
      setLoadingSedes(false)
    }
  }

  useEffect(() => {
    if (vista === 'envios') {
      loadDepartamentosEnvio()
      loadSeguimientoEnvio()
    } else if (vista === 'sedes') {
      loadSedes()
    } else {
      loadZonas()
    }
    loadDepositos()
  }, [vista])

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
    if (tipoEnvio === 'escuela_sede' && !selectedSede) {
      setMsg({ text: 'Debe seleccionar una Escuela Sede cabecera', type: 'error' })
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
          tipo_envio: tipoEnvio,
          id_institucion_sede: tipoEnvio === 'escuela_sede' ? Number(selectedSede) : null,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setMsg({ text: `Egreso por departamento registrado. Lote: #${data.lote_id}`, type: 'success' })
        setDetalleDepartamento(null)
        setEntregasEnvio({})
        loadDepartamentosEnvio()
        loadSeguimientoEnvio()
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
    const renderBadgeEstadoLote = (estado) => {
      const value = String(estado || '').toLowerCase()
      if (value === 'recibido_total') return <span className="badge" style={{ background: '#dcfce7', color: '#166534' }}>Recibido total</span>
      if (value === 'con_reclamos') return <span className="badge" style={{ background: '#fee2e2', color: '#991b1b' }}>Con reclamos</span>
      if (value === 'parcialmente_recibido') return <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>Parcial</span>
      return <span className="badge" style={{ background: '#e0f2fe', color: '#0c4a6e' }}>En tránsito</span>
    }

    const renderPanelSeguimiento = () => (
      <section style={{ marginTop: 18, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
        <h4 style={{ margin: '0 0 8px 0' }}>Seguimiento de Envíos</h4>
        <p style={{ marginTop: 0, color: 'var(--muted)' }}>
          Corroborá estado de recepción por institución luego de confirmar el egreso.
        </p>

        {resumenSeguimiento && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <span className="badge" style={{ background: '#f8fafc', color: '#334155' }}>Lotes: {resumenSeguimiento.total_lotes || 0}</span>
            <span className="badge" style={{ background: '#e0f2fe', color: '#0c4a6e' }}>En tránsito: {resumenSeguimiento.en_transito || 0}</span>
            <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>Parciales: {resumenSeguimiento.parcialmente_recibidos || 0}</span>
            <span className="badge" style={{ background: '#fee2e2', color: '#991b1b' }}>Con reclamos: {resumenSeguimiento.con_reclamos || 0}</span>
            <span className="badge" style={{ background: '#dcfce7', color: '#166534' }}>Recibidos totales: {resumenSeguimiento.recibidos_totales || 0}</span>
          </div>
        )}

        {loadingSeguimiento ? (
          <div className="sv-empty-state">Cargando seguimiento...</div>
        ) : seguimientoEnvio.length === 0 ? (
          <div className="sv-empty-state">Todavía no hay lotes de envío por departamento.</div>
        ) : (
          <table>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th>LOTE</th>
                <th>DEPARTAMENTO</th>
                <th>DEPÓSITO</th>
                <th style={{ textAlign: 'center' }}>INSTITUCIONES</th>
                <th style={{ textAlign: 'center' }}>PLANIFICADA</th>
                <th style={{ textAlign: 'center' }}>RECIBIDA</th>
                <th style={{ textAlign: 'center' }}>ESTADO</th>
                <th style={{ textAlign: 'right' }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {seguimientoEnvio.map((lote) => (
                <tr key={lote.lote_id}>
                  <td style={{ fontWeight: 700 }}>#{lote.lote_id}</td>
                  <td>{lote.departamento || 'SIN_DEPARTAMENTO'}</td>
                  <td>{lote.deposito_nombre || '-'}</td>
                  <td style={{ textAlign: 'center' }}>{lote.total_instituciones || 0}</td>
                  <td style={{ textAlign: 'center' }}>{lote.cantidad_planificada_total || 0}</td>
                  <td style={{ textAlign: 'center' }}>{lote.cantidad_recibida_total || 0}</td>
                  <td style={{ textAlign: 'center' }}>{renderBadgeEstadoLote(lote.estado_lote)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" onClick={() => verDetalleSeguimiento(lote.lote_id)}>Ver Seguimiento</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {detalleSeguimiento?.lote && (
          <div style={{ marginTop: 14, border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              <div>
                <strong>Lote #{detalleSeguimiento.lote.lote_id}</strong>
                <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                  Departamento: {detalleSeguimiento.lote.departamento} | Depósito: {detalleSeguimiento.lote.deposito_nombre || '-'}
                </div>
              </div>
              <button className="secondary" type="button" onClick={() => setDetalleSeguimiento(null)}>Cerrar detalle</button>
            </div>

            {(detalleSeguimiento.instituciones || []).map((institucion) => (
              <div key={institucion.id_institucion} style={{ border: '1px solid #f1f5f9', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                <div style={{ fontWeight: 700 }}>{institucion.institucion_nombre}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 8 }}>CUE: {institucion.cue || '-'}</div>
                <table style={{ marginBottom: 0 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th>Producto</th>
                      <th style={{ textAlign: 'center' }}>Planificada</th>
                      <th style={{ textAlign: 'center' }}>Recibida</th>
                      <th style={{ textAlign: 'center' }}>Dañada</th>
                      <th style={{ textAlign: 'center' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(institucion.items || []).map((item) => (
                      <tr key={item.lote_item_id}>
                        <td>{item.producto_nombre}</td>
                        <td style={{ textAlign: 'center' }}>{item.cantidad_planificada}</td>
                        <td style={{ textAlign: 'center' }}>{item.cantidad_recibida}</td>
                        <td style={{ textAlign: 'center' }}>{item.cantidad_danada || 0}</td>
                        <td style={{ textAlign: 'center' }}>{renderBadgeEstadoLote(item.estado_recepcion === 'recibido' ? 'recibido_total' : item.estado_recepcion === 'reclamo' ? 'con_reclamos' : item.estado_recepcion === 'parcial' ? 'parcialmente_recibido' : 'en_transito')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </section>
    )

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

          {renderPanelSeguimiento()}
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

        <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: '0.9rem', fontWeight: 600, display: 'block', marginBottom: 6 }}>Metodología de Envío</label>
            <div style={{ display: 'flex', gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="radio" name="tipoEnvio" value="directo" checked={tipoEnvio === 'directo'} onChange={(e) => setTipoEnvio(e.target.value)} />
                <span>Envío Directo a Escuelas</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="radio" name="tipoEnvio" value="escuela_sede" checked={tipoEnvio === 'escuela_sede'} onChange={(e) => setTipoEnvio(e.target.value)} />
                <span>Agrupado en Escuela Sede</span>
              </label>
            </div>
          </div>
          {tipoEnvio === 'escuela_sede' && (
            <div style={{ flex: 1, minWidth: 250 }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 600, display: 'block', marginBottom: 6 }}>Seleccionar Escuela Sede (Cabecera)</label>
              <select value={selectedSede} onChange={(e) => setSelectedSede(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, width: '100%', borderColor: '#cbd5e1' }}>
                <option value="">-- Seleccionar Institución Sede --</option>
                {(detalleDepartamento.sedes_posibles || []).map((inst) => (
                  <option key={inst.id_institucion} value={inst.id_institucion}>
                    {inst.nombre} {inst.establecimiento_cabecera ? `(Sede: ${inst.establecimiento_cabecera})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
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

        {renderPanelSeguimiento()}
      </section>
    )
  }

  const handleEntregarSede = async (solicitudId) => {
    if (!window.confirm('¿Confirmar la entrega final de esta solicitud desde la Sede?')) return
    setSavingEnvio(true)
    try {
      const res = await apiFetch(`/api/entregas/sedes/${solicitudId}/entregar`, {
        method: 'POST',
        token
      })
      if (res.ok) {
        setMsg({ text: 'Entrega confirmada correctamente.', type: 'success' })
        loadSedes()
      } else {
        const data = await res.json().catch(() => ({}))
        setMsg({ text: data.error || 'Error al confirmar la entrega', type: 'error' })
      }
    } catch {
      setMsg({ text: 'Error de conexión', type: 'error' })
    } finally {
      setSavingEnvio(false)
    }
  }

  const renderSedes = () => {
    return (
      <section>
        <div style={{ marginBottom: 16 }}>
          <h3>Solicitudes en Escuela Sede</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: 4 }}>
            Estas solicitudes se encuentran físicamente en un Sub-depósito Sede. Haz clic en "Confirmar Entrega" cuando el responsable de la escuela periférica retire su pedido.
          </p>
        </div>

        {loadingSedes ? (
          <div className="spinner" style={{ margin: '40px auto' }}></div>
        ) : solicitudesSede.length === 0 ? (
          <div className="sv-empty-state">No hay solicitudes actualmente en estado "En Sede".</div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Solicitud #</th>
                  <th>Institución Destino</th>
                  <th>Sede Cabecera</th>
                  <th>Fecha En Sede</th>
                  <th style={{ textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {solicitudesSede.map((sol) => (
                  <tr key={sol.id}>
                    <td>#{sol.id}</td>
                    <td><strong style={{ display: 'block' }}>{sol.institucion_nombre}</strong></td>
                    <td>{sol.sede_nombre}</td>
                    <td>{new Date(sol.created_at).toLocaleDateString()}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="primary" onClick={() => handleEntregarSede(sol.id)} disabled={savingEnvio}>
                        Confirmar Entrega
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
        <button
          type="button"
          className={vista === 'sedes' ? 'primary' : 'secondary'}
          onClick={() => setVista('sedes')}
          style={{ width: 'auto', margin: 0 }}
        >
          Entregas desde Sede
        </button>
      </div>

      {msg.text && (
        <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`} style={{ marginBottom: 20 }}>
          {msg.text}
        </div>
      )}

      {vista === 'zonas' && renderZonas()}
      {vista === 'envios' && renderEnviosDepartamento()}
      {vista === 'sedes' && renderSedes()}
    </div>
  )
}
