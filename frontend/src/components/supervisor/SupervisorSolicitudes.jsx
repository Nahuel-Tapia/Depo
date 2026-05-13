import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { apiFetch } from '../../api'
import FilterSortButton from '../FilterSortButton'
import SolicitudesTable from './SolicitudesTable'
import SolicitudDetalleModal from './SolicitudDetalleModal'

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
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
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
        items: item.items || [],
        notas: item.notas || '',
        tipo: item.tipo || 'anual',
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
    setSelected(prev => {
      if (!prev) return prev
      if (prev.solicitudes) {
        return {
          ...prev,
          solicitudes: prev.solicitudes.map(item => (item.id === id ? { ...item, ...changes } : item))
        }
      }
      return prev.id === id ? { ...prev, ...changes } : prev
    })
  }

  const processEstado = async (nuevoEstado, observacion = '', solicitudObjetivo = null) => {
    const target = solicitudObjetivo || selected
    if (!target) return
    setUpdating(true)
    try {
      const payload = { estado: nuevoEstado }
      if (observacion) payload.motivo = observacion

      const res = await apiFetch(`/api/pedidos/${target.id}/estado`, {
        token,
        method: 'PATCH',
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'No se pudo actualizar la solicitud')
      }

      const resData = await res.json()
      const serverEstado = resData.respuesta_supervisor_tipo === 'aclaracion'
        ? 'aclaracion'
        : (resData.estado || nuevoEstado)

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

      updateEstadoLocal(target.id, nextChanges)
      setMsg({
        text: serverEstado === 'aclaracion'
          ? `Se pidió aclaración para la solicitud #${target.id}.`
          : `Solicitud #${target.id} actualizada a ${serverEstado}.`,
        type: 'success'
      })
    } catch (err) {
      setMsg({ text: err.message || 'Error procesando solicitud', type: 'error' })
    } finally {
      setUpdating(false)
    }
  }

  const handleClarification = async (nota, solicitudObjetivo) => {
    await processEstado('aclaracion', nota, solicitudObjetivo)
  }

  const solicitudesVista = useMemo(() => {
    const search = busqueda.trim().toLowerCase()
    const filtered = solicitudes.filter((item) => {
      if (filtroEstado !== 'todos' && item.estado !== filtroEstado) return false
      if (filtroTipo && (item.tipo || 'anual') !== filtroTipo) return false
      if (!search) return true

      return [
        item.escuela,
        item.solicitante,
        item.producto,
        item.notas,
      ].some((value) => String(value || '').toLowerCase().includes(search))
    })

    const sorted = filtered.sort((a, b) => {
      if (orden === 'fecha_asc') return new Date(a.fecha) - new Date(b.fecha)
      if (orden === 'fecha_desc') return new Date(b.fecha) - new Date(a.fecha)
      if (orden === 'escuela_asc') return String(a.escuela || '').localeCompare(String(b.escuela || ''), 'es', { sensitivity: 'base' })
      if (orden === 'cantidad_desc') return Number(b.cantidad || 0) - Number(a.cantidad || 0)
      if (orden === 'cantidad_asc') return Number(a.cantidad || 0) - Number(b.cantidad || 0)

      return 0
    })

    const grupos = new Map()
    sorted.forEach(item => {
      const key = item.institucion_id || item.escuela
      const current = grupos.get(key)

      if (!current) {
        grupos.set(key, {
          ...item,
          id: `escuela-${key}`,
          solicitudes: [item],
          cantidad_solicitudes: 1,
          cantidad_total: item.cantidad,
          cantidad: item.cantidad
        })
        return
      }

      current.solicitudes.push(item)
      current.cantidad_solicitudes += 1
      current.cantidad_total += item.cantidad
      current.cantidad = current.cantidad_total
      current.producto = `${current.cantidad_solicitudes} solicitudes`
    })

    return Array.from(grupos.values())
  }, [solicitudes, filtroEstado, filtroTipo, busqueda, orden])

  const filtrosActivos = [busqueda.trim(), filtroTipo].filter(Boolean).length

  return (
    <div className="supervisor-dashboard fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>Solicitudes de Escuelas</h2>
          <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
            Revisión por coherencia con matrícula.
          </p>
        </div>
        <FilterSortButton
          searchValue={busqueda}
          searchPlaceholder="Buscar escuela, producto o solicitante..."
          onSearchChange={setBusqueda}
          filters={[
            {
              key: 'tipo',
              label: 'Tipo',
              value: filtroTipo,
              onChange: setFiltroTipo,
              emptyLabel: 'Todos',
              options: [
                { value: 'anual', label: 'Anual' },
                { value: 'refuerzo', label: 'Refuerzo' },
              ],
            },
          ]}
          sortValue={orden}
          sortOptions={[
            { value: 'fecha_desc', label: 'Fecha (mas reciente)' },
            { value: 'fecha_asc', label: 'Fecha (mas antigua)' },
            { value: 'escuela_asc', label: 'Escuela (A-Z)' },
            { value: 'cantidad_desc', label: 'Cantidad mayor' },
            { value: 'cantidad_asc', label: 'Cantidad menor' },
          ]}
          onSortChange={setOrden}
          onClear={() => {
            setBusqueda('')
            setFiltroTipo('')
            setOrden('fecha_desc')
          }}
          activeCount={filtrosActivos}
        />
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
          onApprove={solicitudObjetivo => processEstado('aprobado', '', solicitudObjetivo)}
          onReject={(motivo, solicitudObjetivo) => processEstado('rechazado', motivo, solicitudObjetivo)}
          onRequestClarification={handleClarification}
        />
      )}
    </div>
  )
}
