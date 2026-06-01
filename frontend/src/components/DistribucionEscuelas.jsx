import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

export default function DistribucionEscuelas() {
  const { token } = useAuth()
  const [vista, setVista] = useState('envios')
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
  const [loteImprimible, setLoteImprimible] = useState(null)
  const [expandedSols, setExpandedSols] = useState({})

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

  const escuelasSede = useMemo(() => {
    if (!detalleDepartamento?.solicitudes) return []
    const unique = new Map()
    for (const sol of detalleDepartamento.solicitudes) {
      if (sol.id_institucion && !unique.has(sol.id_institucion)) {
        unique.set(sol.id_institucion, {
          id_institucion: sol.id_institucion,
          nombre: sol.institucion_nombre,
          cue: sol.cue,
          establecimiento_cabecera: sol.establecimiento_cabecera
        })
      }
    }
    return Array.from(unique.values()).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [detalleDepartamento])

  const resumenEgresos = useMemo(() => {
    const map = new Map()
    if (!detalleDepartamento?.solicitudes) return []
    for (const sol of detalleDepartamento.solicitudes) {
      for (const item of (sol.productos_pedido_anual || [])) {
        if (!item.en_solicitud || !item.cantidad_solicitada_solicitud) continue
        const qty = Number(item.cantidad_solicitada_solicitud)
        if (qty <= 0) continue
        const id = Number(item.producto_id)
        if (!map.has(id)) {
          map.set(id, {
            producto_id: id,
            producto_nombre: item.producto_nombre,
            unidad_medida: item.unidad_medida,
            cantidad: 0
          })
        }
        map.get(id).cantidad += qty
      }
    }
    return Array.from(map.values())
  }, [detalleDepartamento])

  const toggleSolicitudDetalle = (solicitudId) => {
    setExpandedSols(prev => ({
      ...prev,
      [solicitudId]: !prev[solicitudId]
    }))
  }

  const handlePrintLote = async (loteId) => {
    try {
      const res = await apiFetch(`/api/entregas/solicitudes-envio/seguimiento/${loteId}`, { token })
      if (!res.ok) {
        setMsg({ text: 'No se pudo cargar la información para imprimir el comprobante', type: 'error' })
        return
      }
      const data = await res.json()
      const { lote, instituciones } = data

      if (!lote) {
        setMsg({ text: 'Información del lote no encontrada', type: 'error' })
        return
      }

      const printWindow = window.open('', '_blank', 'width=900,height=700')
      if (!printWindow) return

      const fmtDate = v => v ? new Date(v).toLocaleDateString('es-AR') : '-'

      // Build resumen consolidado de productos
      const resumenMap = {}
      for (const inst of (instituciones || [])) {
        for (const item of (inst.items || [])) {
          const key = item.producto_nombre
          if (!resumenMap[key]) resumenMap[key] = { nombre: key, unidad: item.unidad_medida || 'unidad', total: 0 }
          resumenMap[key].total += Number(item.cantidad_planificada || 0)
        }
      }
      const resumenList = Object.values(resumenMap)
      let resumenHtml = resumenList.map(r =>
        '<tr>' +
        '<td style="border:1px solid #d1d5db;padding:6px 8px;font-weight:600">' + r.nombre + '</td>' +
        '<td style="border:1px solid #d1d5db;padding:6px 8px;text-align:center;font-weight:bold;font-size:1.1rem;color:#ff8200">' + r.total + '</td>' +
        '<td style="border:1px solid #d1d5db;padding:6px 8px;text-align:center;color:#555">' + r.unidad + '</td>' +
        '</tr>'
      ).join('')

      let itemsHtml = ''
      for (const inst of (instituciones || [])) {
        const rowsHtml = (inst.items || []).map(item =>
          '<tr>' +
          '<td style="border:1px solid #d1d5db;padding:6px 8px">' + item.producto_nombre + '</td>' +
          '<td style="border:1px solid #d1d5db;padding:6px 8px;text-align:center;font-weight:bold">' + item.cantidad_planificada + '</td>' +
          '<td style="border:1px solid #d1d5db;padding:6px 8px;text-align:center;color:#555">' + (item.unidad_medida || 'unidad') + '</td>' +
          '</tr>'
        ).join('')
        itemsHtml +=
          '<div style="margin-top:20px;border:1px solid #e2e8f0;border-radius:8px;padding:12px;page-break-inside:avoid">' +
          '<div style="font-weight:bold;font-size:1.05rem;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:10px">' +
          inst.institucion_nombre + ' (CUE: ' + (inst.cue || '-') + ')' +
          '</div>' +
          '<table style="width:100%;border-collapse:collapse">' +
          '<thead><tr style="background:#f3f4f6">' +
          '<th style="border:1px solid #d1d5db;padding:6px 8px;text-align:left">Producto</th>' +
          '<th style="border:1px solid #d1d5db;padding:6px 8px;text-align:center;width:120px">Cantidad</th>' +
          '<th style="border:1px solid #d1d5db;padding:6px 8px;text-align:center;width:120px">Unidad</th>' +
          '</tr></thead>' +
          '<tbody>' + rowsHtml + '</tbody>' +
          '</table></div>'
      }

      const modalidad = lote.tipo_envio === 'escuela_sede' ? 'Agrupado en Escuela Sede' : 'Envío Directo a Escuelas'
      const operador = ((lote.usuario_nombre || '') + ' ' + (lote.usuario_apellido || '')).trim()
      const obsHtml = lote.observaciones
        ? '<div style="grid-column:1/-1"><strong>Observaciones:</strong> ' + lote.observaciones + '</div>'
        : ''

      const html =
        '<!DOCTYPE html><html><head>' +
        '<title>Comprobante Lote #' + lote.lote_id + '</title>' +
        '<style>' +
        '* { box-sizing: border-box; font-family: Arial, sans-serif; }' +
        'body { margin: 24px; color: #111827; font-size: 13px; }' +
        'table { width: 100%; border-collapse: collapse; page-break-inside: avoid; }' +
        '@media print { .no-print { display:none; } body { margin: 12px; } }' +
        '</style></head><body>' +
        // Header
        '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #FF8200;padding-bottom:12px;margin-bottom:18px">' +
        '<div style="display:flex;align-items:center;gap:12px">' +
        '<img src="/faviconmin.png" alt="Logo" style="height:44px;width:auto" />' +
        '<div><strong style="font-size:1.1rem;display:block">San Juan Gobierno</strong>' +
        '<span style="color:#666;font-size:0.85rem">Ministerio de Educación</span></div>' +
        '</div>' +
        '<div style="text-align:right">' +
        '<strong style="font-size:1.1rem;display:block">Comprobante de Egreso Consolidado</strong>' +
        '<span style="color:#666;font-size:0.9rem">Lote de Envío #' + lote.lote_id + '</span>' +
        '</div></div>' +
        // Datos del lote
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;background:#f8fafc;padding:12px;border-radius:6px;border:1px solid #e2e8f0">' +
        '<div><strong>Departamento Destino:</strong> ' + (lote.departamento || '-') + '</div>' +
        '<div><strong>Depósito de Origen:</strong> ' + (lote.deposito_nombre || '-') + '</div>' +
        '<div><strong>Fecha Emisión:</strong> ' + fmtDate(lote.created_at) + '</div>' +
        '<div><strong>Modalidad:</strong> ' + modalidad + '</div>' +
        '<div style="grid-column:1/-1"><strong>Operador Emisor:</strong> ' + operador + '</div>' +
        obsHtml +
        '</div>' +
        // Resumen consolidado
        '<h3 style="margin-top:20px;border-bottom:2px solid #FF8200;padding-bottom:6px;color:#ff8200">Resumen Total de Productos a Egresar</h3>' +
        '<table style="margin-bottom:20px">' +
        '<thead><tr style="background:#fff7ed">' +
        '<th style="border:1px solid #d1d5db;padding:6px 8px;text-align:left">Producto</th>' +
        '<th style="border:1px solid #d1d5db;padding:6px 8px;text-align:center;width:120px">Total</th>' +
        '<th style="border:1px solid #d1d5db;padding:6px 8px;text-align:center;width:120px">Unidad</th>' +
        '</tr></thead>' +
        '<tbody>' + resumenHtml + '</tbody>' +
        '</table>' +
        // Detalle por institución
        '<h3 style="margin-top:20px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;color:#ff8200">Detalle de Entregas por Institución</h3>' +
        itemsHtml +
        // Firmas
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-top:60px;page-break-inside:avoid">' +
        '<div style="border-top:1px solid #111827;padding-top:8px;text-align:center">Firma de Operador de Depósito</div>' +
        '<div style="border-top:1px solid #111827;padding-top:8px;text-align:center">Firma y Sello de Recepción</div>' +
        '</div>' +
        '</body></html>'

      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => { printWindow.print(); printWindow.close() }, 300)
    } catch {
      setMsg({ text: 'Error de conexión al cargar comprobante del lote', type: 'error' })
    }
  }

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

    // Armar payload directo desde los items solicitados (sin inputs del usuario)
    const payloadEntregas = (detalleDepartamento.solicitudes || [])
      .map((sol) => {
        const items = (sol.productos_pedido_anual || [])
          .filter(p => p.en_solicitud && Number(p.cantidad_solicitada_solicitud) > 0)
          .map(p => ({ id_producto: Number(p.producto_id), cantidad: Number(p.cantidad_solicitada_solicitud) }))
        return { id_solicitud: Number(sol.id), items }
      })
      .filter((row) => row.items.length > 0)

    if (payloadEntregas.length === 0) {
      setMsg({ text: 'No hay productos solicitados para egresar en este departamento', type: 'error' })
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
        setLoteImprimible(data.lote_id)
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
                {(escuelasSede || []).map((inst) => (
                  <option key={inst.id_institucion} value={inst.id_institucion}>
                    {inst.nombre} {inst.cue ? `(CUE: ${inst.cue})` : ''}
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

        {resumenEgresos.length > 0 && (
          <div style={{ background: '#fff7ed', border: '2px solid #fb923c', borderRadius: 10, padding: 14, marginBottom: 20 }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#9a3412', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📦</span> Resumen consolidado de productos a egresar
            </h4>
            <table style={{ marginBottom: 0 }}>
              <thead>
                <tr style={{ background: '#ffedd5' }}>
                  <th style={{ textAlign: 'left' }}>Producto</th>
                  <th style={{ textAlign: 'center', width: 120 }}>Total a enviar</th>
                  <th style={{ textAlign: 'center', width: 120 }}>Unidad</th>
                </tr>
              </thead>
              <tbody>
                {resumenEgresos.map(p => (
                  <tr key={p.producto_id}>
                    <td style={{ fontWeight: 600 }}>{p.producto_nombre}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '1.05rem', color: '#c2410c' }}>{p.cantidad}</td>
                    <td style={{ textAlign: 'center', color: 'var(--muted)' }}>{p.unidad_medida}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(detalleDepartamento.solicitudes || []).map((solicitud) => {
          const isExpanded = !!expandedSols[solicitud.id]
          const productosSolicitados = (solicitud.productos_pedido_anual || []).filter(p => p.en_solicitud && Number(p.cantidad_solicitada_solicitud) > 0)
          const totalASolicitar = productosSolicitados.reduce((acc, p) => acc + Number(p.cantidad_solicitada_solicitud), 0)
          return (
            <div key={solicitud.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{solicitud.institucion_nombre}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: 2 }}>
                    Solicitud #{solicitud.id} | CUE: {solicitud.cue || '-'} | Estado: {solicitud.estado}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                    <span className="badge" style={{ background: '#dcfce7', color: '#166534' }}>
                      A enviar: {totalASolicitar}
                    </span>
                    <span className="badge" style={{ background: '#f8fafc', color: '#334155' }}>
                      {productosSolicitados.length} producto{productosSolicitados.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="secondary"
                  style={{ width: 'auto', margin: 0, fontSize: '0.85rem', padding: '5px 12px' }}
                  onClick={() => toggleSolicitudDetalle(solicitud.id)}
                >
                  {isExpanded ? '▲ Ocultar detalle' : '▼ Ver detalle de productos'}
                </button>
              </div>

              {isExpanded && (
                productosSolicitados.length === 0 ? (
                  <div style={{ color: 'var(--muted)', fontSize: '0.85rem', fontStyle: 'italic', padding: '8px 0' }}>
                    No hay productos solicitados en esta solicitud.
                  </div>
                ) : (
                  <table style={{ marginBottom: 0 }}>
                    <thead>
                      <tr style={{ background: '#f0fdf4' }}>
                        <th>Producto</th>
                        <th style={{ textAlign: 'center' }}>Unidad</th>
                        <th style={{ textAlign: 'center', width: 140 }}>Cantidad a enviar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productosSolicitados.map((item) => (
                        <tr key={solicitud.id + '-' + item.producto_id}>
                          <td style={{ fontWeight: 600 }}>{item.producto_nombre}</td>
                          <td style={{ textAlign: 'center', color: 'var(--muted)' }}>{item.unidad_medida || '-'}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-block',
                              background: '#dcfce7',
                              color: '#166534',
                              fontWeight: 700,
                              fontSize: '1rem',
                              borderRadius: 6,
                              padding: '4px 16px',
                              minWidth: 60
                            }}>
                              {item.cantidad_solicitada_solicitud}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}

              {!isExpanded && (
                <div style={{ color: 'var(--muted)', fontSize: '0.82rem', fontStyle: 'italic' }}>
                  {productosSolicitados.length} producto{productosSolicitados.length !== 1 ? 's' : ''} — expandí para ver el detalle
                </div>
              )}
            </div>
          )
        })}

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
          className={vista === 'envios' ? 'primary' : 'secondary'}
          onClick={() => setVista('envios')}
          style={{ width: 'auto', margin: 0 }}
        >
          Envíos por Departamento
        </button>
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
          className={vista === 'sedes' ? 'primary' : 'secondary'}
          onClick={() => setVista('sedes')}
          style={{ width: 'auto', margin: 0 }}
        >
          Entregas desde Sede
        </button>
      </div>

      {msg.text && (
        <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`} style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span>{msg.text}</span>
          {msg.type === 'success' && loteImprimible && (
            <button
              type="button"
              className="primary"
              onClick={() => handlePrintLote(loteImprimible)}
              style={{ width: 'auto', margin: 0, padding: '6px 12px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
            >
              🖨️ Imprimir Comprobante
            </button>
          )}
        </div>
      )}

      {vista === 'zonas' && renderZonas()}
      {vista === 'envios' && renderEnviosDepartamento()}
      {vista === 'sedes' && renderSedes()}
    </div>
  )
}
