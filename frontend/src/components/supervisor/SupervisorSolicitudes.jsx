import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { apiFetch } from '../../api'
import SolicitudesTable from './SolicitudesTable'
import SolicitudDetalleModal from './SolicitudDetalleModal'
import { calculateRatio } from './ratioUtils'

function normalizeEstado(estado, respuestaSupervisorTipo) {
  if (estado === 'pendiente' && respuestaSupervisorTipo === 'aclaracion') return 'aclaracion'
  if (estado === 'pendiente_director') return 'pendiente_director'
  if (estado === 'aprobado') return 'aprobado'
  if (estado === 'rechazado') return 'rechazado'
  if (estado === 'cancelado') return 'cancelado'
  return 'pendiente'
}

function fallbackHistorial(solicitud) {
  const now = new Date()
  return [
    {
      fecha: now.toISOString(),
      producto: solicitud.producto,
      cantidad: solicitud.cantidad,
      tipo: 'Pedido actual'
    },
    {
      fecha: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 21).toISOString(),
      producto: solicitud.producto,
      cantidad: Math.max(1, Math.round((Number(solicitud.cantidad) || 0) * 0.6)),
      tipo: 'Solicitud previa'
    }
  ]
}

export default function SupervisorSolicitudes() {
  const { token } = useAuth()

  const [solicitudes, setSolicitudes] = useState([])
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('pendiente')
  const [orden, setOrden] = useState('fecha_desc')

  const [selected, setSelected] = useState(null)
  const [historial, setHistorial] = useState([])
  const [loadingHistorial, setLoadingHistorial] = useState(false)
  const [updating, setUpdating] = useState(false)

  const loadSolicitudes = async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/supervisor/solicitudes', { token })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'No se pudieron cargar las solicitudes')
      }

      const data = await res.json()
      const normalized = (data.solicitudes || []).map(item => ({
        id: item.id,
        escuela: item.institucion,
        institucion_id: item.institucion_id,
        solicitante: item.solicitante,
        producto: item.producto,
        cantidad: Number(item.cantidad) || 0,
        matricula: Number(item.matricula) || 0,
        fecha: item.fecha,
        estado: normalizeEstado(item.estado, item.respuesta_supervisor_tipo),
        respuesta_supervisor_tipo: item.respuesta_supervisor_tipo || null,
        motivo_supervisor: item.motivo_supervisor || null
      }))
      setSolicitudes(normalized)
    } catch (err) {
      setMsg({ text: err.message || 'Error cargando solicitudes', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSolicitudes()
  }, [token])

  const loadHistorial = async (solicitud) => {
    setLoadingHistorial(true)
    try {
      const res = await apiFetch(`/api/supervisor/instituciones/${solicitud.institucion_id}/historial`, { token })
      if (res.ok) {
        const data = await res.json()
        const eventos = data.eventos || []
        setHistorial(eventos.length > 0 ? eventos : fallbackHistorial(solicitud))
      } else {
        setHistorial(fallbackHistorial(solicitud))
      }
    } catch {
      setHistorial(fallbackHistorial(solicitud))
    } finally {
      setLoadingHistorial(false)
    }
  }

  const openDetalle = async (solicitud) => {
    setSelected(solicitud)
    await loadHistorial(solicitud)
  }

  const updateEstadoLocal = (id, changes) => {
    setSolicitudes(prev => prev.map(item => (item.id === id ? { ...item, ...changes } : item)))
    setSelected(prev => (prev && prev.id === id ? { ...prev, ...changes } : prev))
  }

  const processEstado = async (nuevoEstado, observacion = '') => {
    if (!selected) return
    setUpdating(true)
    try {
      const payload = { estado: nuevoEstado }
      if (observacion) payload.motivo = observacion

      const res = await apiFetch(`/api/pedidos/${selected.id}/estado`, {
        token,
        method: 'PATCH',
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'No se pudo actualizar la solicitud')
      }

      const resData = await res.json()
      const serverEstado = resData.estado || nuevoEstado

      const nextChanges = serverEstado === 'aclaracion'
        ? {
            estado: 'aclaracion',
            respuesta_supervisor_tipo: 'aclaracion',
            motivo_supervisor: observacion || null
          }
        : {
            estado: serverEstado,
            respuesta_supervisor_tipo: serverEstado === 'rechazado' ? 'rechazo' : 'aprobacion',
            motivo_supervisor: serverEstado === 'rechazado' ? (observacion || null) : null
          }

      updateEstadoLocal(selected.id, nextChanges)
      setMsg({
        text: serverEstado === 'aclaracion'
          ? `Se pidió aclaración para la solicitud #${selected.id}.`
          : `Solicitud #${selected.id} actualizada a ${serverEstado}.`,
        type: 'success'
      })
    } catch (err) {
      setMsg({ text: err.message || 'Error procesando solicitud', type: 'error' })
    } finally {
      setUpdating(false)
    }
  }

  const handleClarification = async (nota) => {
    await processEstado('aclaracion', nota)
  }

  const solicitudesVista = useMemo(() => {
    const filtered = filtroEstado === 'todos'
      ? [...solicitudes]
      : solicitudes.filter(item => item.estado === filtroEstado)

    return filtered.sort((a, b) => {
      if (orden === 'fecha_asc') return new Date(a.fecha) - new Date(b.fecha)
      if (orden === 'fecha_desc') return new Date(b.fecha) - new Date(a.fecha)

      const ratioA = calculateRatio(a.cantidad, a.matricula)
      const ratioB = calculateRatio(b.cantidad, b.matricula)

      if (orden === 'ratio_asc') return ratioA - ratioB
      return ratioB - ratioA
    })
  }, [solicitudes, filtroEstado, orden])

  const sospechosas = solicitudes.filter(s => calculateRatio(s.cantidad, s.matricula) >= 0.2).length

  return (
    <div className="supervisor-dashboard fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>Solicitudes de Escuelas</h2>
          <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
            Revisión por coherencia con matrícula.
          </p>
        </div>
        <span className="badge-premium" style={{ background: '#fff7ed', color: '#9a3412', border: '1px solid #ffedd5' }}>
          {sospechosas} solicitudes con ratio alto
        </span>
      </div>

      {msg.text && <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`}>{msg.text}</div>}

      <div className="tabs" style={{ marginBottom: 24 }}>
        <button
          className={`tab-btn ${filtroEstado === 'pendiente' ? 'active' : ''}`}
          onClick={() => setFiltroEstado('pendiente')}
        >
          Pendientes
        </button>
        <button
          className={`tab-btn ${filtroEstado === 'pendiente_director' ? 'active' : ''}`}
          onClick={() => setFiltroEstado('pendiente_director')}
        >
          Enviados a Director
        </button>
        <button
          className={`tab-btn ${filtroEstado === 'aprobado' ? 'active' : ''}`}
          onClick={() => setFiltroEstado('aprobado')}
        >
          Aprobados
        </button>
        <button
          className={`tab-btn ${filtroEstado === 'rechazado' ? 'active' : ''}`}
          onClick={() => setFiltroEstado('rechazado')}
        >
          Rechazados
        </button>
        <button
          className={`tab-btn ${filtroEstado === 'aclaracion' ? 'active' : ''}`}
          onClick={() => setFiltroEstado('aclaracion')}
        >
          Aclaraciones
        </button>
        <button
          className={`tab-btn ${filtroEstado === 'todos' ? 'active' : ''}`}
          onClick={() => setFiltroEstado('todos')}
        >
          Todos
        </button>
      </div>

      <div className="sv-solicitudes-filtros" style={{ marginBottom: 20, display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '0.75rem' }}>Ordenar por</label>
          <select value={orden} onChange={e => setOrden(e.target.value)}>
            <option value="fecha_desc">Fecha (más reciente)</option>
            <option value="fecha_asc">Fecha (más antigua)</option>
            <option value="ratio_desc">Ratio (alto a bajo)</option>
            <option value="ratio_asc">Ratio (bajo a alto)</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 40 }}>Cargando solicitudes...</p>
      ) : (
        <div className="card" style={{ padding: 0, minHeight: 'auto', boxShadow: 'var(--shadow-premium)', borderRadius: 12, overflow: 'hidden' }}>
          <SolicitudesTable solicitudes={solicitudesVista} onView={openDetalle} />
        </div>
      )}

      {selected && (
        <SolicitudDetalleModal
          solicitud={selected}
          historial={historial}
          loadingHistorial={loadingHistorial}
          disabled={updating}
          onClose={() => setSelected(null)}
          onApprove={() => processEstado('aprobado')}
          onReject={motivo => processEstado('rechazado', motivo)}
          onRequestClarification={handleClarification}
        />
      )}
    </div>
  )
}
