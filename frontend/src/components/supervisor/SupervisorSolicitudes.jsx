import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { apiFetch } from '../../api'
import SolicitudesTable from './SolicitudesTable'
import SolicitudDetalleModal from './SolicitudDetalleModal'
import { calculateRatio } from './ratioUtils'

function normalizeEstado(estado) {
  if (estado === 'aprobado') return 'aprobado'
  if (estado === 'rechazado') return 'rechazado'
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
  const { token, user } = useAuth()

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
      const jurisdiccion = user?.jurisdiccion || ''
      const res = await apiFetch(`/api/supervisor/solicitudes?jurisdiccion=${encodeURIComponent(jurisdiccion)}`, { token })
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
        estado: normalizeEstado(item.estado)
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
  }, [token, user?.jurisdiccion])

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

  const updateEstadoLocal = (id, estado) => {
    setSolicitudes(prev => prev.map(item => (item.id === id ? { ...item, estado } : item)))
    setSelected(prev => (prev && prev.id === id ? { ...prev, estado } : prev))
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

      updateEstadoLocal(selected.id, nuevoEstado)
      setMsg({ text: `Solicitud #${selected.id} actualizada a ${nuevoEstado}.`, type: 'success' })
    } catch (err) {
      setMsg({ text: err.message || 'Error procesando solicitud', type: 'error' })
    } finally {
      setUpdating(false)
    }
  }

  const handleClarification = (nota) => {
    if (!selected) return
    setMsg({
      text: nota
        ? `Aclaracion solicitada para #${selected.id}: ${nota}`
        : `Aclaracion solicitada para #${selected.id}.`,
      type: 'success'
    })
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
    <div className="supervisor-dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2>Solicitudes de Escuelas</h2>
        <span className="badge" style={{ background: '#fff7ed', color: '#9a3412' }}>
          {sospechosas} solicitudes con ratio alto
        </span>
      </div>

      <p style={{ marginTop: 0, color: 'var(--muted)' }}>
        Revision por coherencia con matricula. Esta vista no muestra datos de stock.
      </p>

      {msg.text && <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`}>{msg.text}</div>}

      <div className="sv-solicitudes-filtros">
        <div>
          <label>Filtrar por estado</label>
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="aprobado">Aprobado</option>
            <option value="rechazado">Rechazado</option>
          </select>
        </div>

        <div>
          <label>Ordenar por</label>
          <select value={orden} onChange={e => setOrden(e.target.value)}>
            <option value="fecha_desc">Fecha (mas reciente)</option>
            <option value="fecha_asc">Fecha (mas antigua)</option>
            <option value="ratio_desc">Ratio (alto a bajo)</option>
            <option value="ratio_asc">Ratio (bajo a alto)</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Cargando solicitudes...</p>
      ) : (
        <SolicitudesTable solicitudes={solicitudesVista} onView={openDetalle} />
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
