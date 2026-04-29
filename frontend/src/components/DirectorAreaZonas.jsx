import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import { useAuth } from '../context/AuthContext'

function normalizeText(value) {
  return String(value || '').trim()
}

function normalizeKey(value) {
  return normalizeText(value).toUpperCase()
}

function getZoneLabel(zone) {
  const zoneName = normalizeText(zone?.name)
  const departamento = normalizeText(zone?.departamento)
  if (zoneName && normalizeKey(zoneName) !== normalizeKey(departamento)) {
    return zoneName
  }
  return `Zona ${zone?.id || ''}`.trim()
}

function getZoneSupervisorLabel(zone) {
  const supervisors = zone?.supervisores || []
  if (supervisors.length === 0) return 'Sin supervisor asignado'
  return supervisors
    .map((supervisor) => [supervisor.nombre, supervisor.apellido].filter(Boolean).join(' ').trim())
    .filter(Boolean)
    .join(', ')
}

export default function DirectorAreaZonas({ nivelEducativo }) {
  const { token } = useAuth()
  const [departamentos, setDepartamentos] = useState([])
  const [zonas, setZonas] = useState([])
  const [institucionesDisponibles, setInstitucionesDisponibles] = useState([])
  const [institucionesSeleccionadas, setInstitucionesSeleccionadas] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [zonaIdCreada, setZonaIdCreada] = useState(null)
  const [modalSupervisores, setModalSupervisores] = useState([])
  const [selectedSupervisores, setSelectedSupervisores] = useState([])
  const [modalLoading, setModalLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [nivelActivo, setNivelActivo] = useState('')
  const [departamentoSeleccionado, setDepartamentoSeleccionado] = useState('')
  const [nombreZona, setNombreZona] = useState('')
  const [editingZoneId, setEditingZoneId] = useState(null)
  const [creando, setCreando] = useState(false)
  const [deletingZoneId, setDeletingZoneId] = useState(null)

  const miNivel = normalizeKey(nivelEducativo || nivelActivo)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (modalOpen) {
      fetchModalSupervisores()
    }
  }, [modalOpen])

  const fetchModalSupervisores = async () => {
    setModalLoading(true)
    try {
      const res = await apiFetch('/api/director-area/catalogo', { token })
      const data = await res.json().catch(() => ({}))
      setModalSupervisores(data.supervisores || [])
    } catch {
      setModalSupervisores([])
    } finally {
      setModalLoading(false)
    }
  }

  const loadData = async () => {
    if (!token) return
    setLoading(true)
    setError('')

    try {
      const res = await apiFetch('/api/director-area/zonas-edificio', { token })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error || 'Error al cargar')
        return
      }

      const nivelServidor = normalizeText(data.nivel_educativo)
      const institucionesFiltradas = (data.instituciones || []).filter((institucion) => (
        !nivelServidor || normalizeKey(institucion.nivel_educativo) === normalizeKey(nivelServidor)
      ))

      setDepartamentos(data.departamentos || [])
      setZonas(data.zonas || [])
      setNivelActivo(nivelServidor)
      setInstitucionesDisponibles(institucionesFiltradas)
    } catch {
      setError('Error de conexion')
    } finally {
      setLoading(false)
    }
  }

  const toggleInstitucion = (id) => {
    setInstitucionesSeleccionadas((prev) => (
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    ))
  }

  const resetForm = () => {
    setNombreZona('')
    setDepartamentoSeleccionado('')
    setInstitucionesSeleccionadas([])
    setEditingZoneId(null)
  }

  const startEditZone = (zona) => {
    setEditingZoneId(zona.id)
    setNombreZona(zona.name || '')
    setDepartamentoSeleccionado(zona.departamento || '')
    setInstitucionesSeleccionadas((zona.instituciones || []).map((institucion) => institucion.id))
    setError('')
    setSuccess('')
  }

  const openSupervisorModal = (zona) => {
    setZonaIdCreada(zona.id)
    setSelectedSupervisores((zona.supervisores || []).map((supervisor) => supervisor.id))
    setModalOpen(true)
    setError('')
    setSuccess('')
  }

  const handleGuardarZona = async () => {
    if (!miNivel) {
      setError('No se encontro el nivel educativo del director de area')
      return
    }
    if (!normalizeText(nombreZona)) {
      setError('Ingresa un nombre para la zona')
      return
    }
    if (!departamentoSeleccionado) {
      setError('Selecciona un departamento')
      return
    }
    if (normalizeKey(nombreZona) === normalizeKey(departamentoSeleccionado)) {
      setError('El nombre de la zona debe ser distinto del departamento')
      return
    }
    if (institucionesSeleccionadas.length === 0) {
      setError('Selecciona al menos una institucion')
      return
    }

    setError('')
    setSuccess('')
    setCreando(true)

    try {
      const isEditing = Boolean(editingZoneId)
      const res = await apiFetch(isEditing ? `/api/director-area/zonas/${editingZoneId}` : '/api/director-area/zonas', {
        token,
        method: isEditing ? 'PATCH' : 'POST',
        body: JSON.stringify({
          name: normalizeText(nombreZona),
          departamento: departamentoSeleccionado,
          nivel_educativo: miNivel,
          institucionIds: institucionesSeleccionadas
        })
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error || 'Error al guardar la zona')
        return
      }

      const zone = data.zone || null

      if (zone) {
        setZonas((prev) => {
          const filtered = prev.filter((item) => item.id !== zone.id)
          return isEditing ? [zone, ...filtered] : [zone, ...filtered]
        })
      }

      if (isEditing) {
        setSuccess('Zona actualizada correctamente')
        resetForm()
        return
      }

      const createdId = data.id || data.zoneId || zone?.id || null
      resetForm()
      setZonaIdCreada(createdId)
      setSelectedSupervisores([])
      setModalOpen(true)
      setSuccess('Zona creada correctamente')
    } catch {
      setError('Error de conexion')
    } finally {
      setCreando(false)
    }
  }

  const handleAssignSupervisores = async () => {
    if (!zonaIdCreada) return

    try {
      const res = await apiFetch(`/api/director-area/zonas/${zonaIdCreada}/supervisores`, {
        token,
        method: 'POST',
        body: JSON.stringify({ supervisorIds: selectedSupervisores })
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error || 'Error al asignar supervisores')
        return
      }

      if (data.zone) {
        setZonas((prev) => [data.zone, ...prev.filter((zona) => zona.id !== data.zone.id)])
      }
      setModalOpen(false)
      setSelectedSupervisores([])
      setZonaIdCreada(null)
      setSuccess('Supervisores actualizados correctamente')
    } catch {
      setError('Error de conexion')
    }
  }

  const handleDeleteZone = async (zona) => {
    const confirmed = window.confirm(`Se eliminara la zona "${getZoneLabel(zona)}".`)
    if (!confirmed) return

    setDeletingZoneId(zona.id)
    setError('')
    setSuccess('')

    try {
      const res = await apiFetch(`/api/director-area/zonas/${zona.id}`, {
        token,
        method: 'DELETE'
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error || 'Error al eliminar zona')
        return
      }

      setZonas((prev) => prev.filter((item) => item.id !== zona.id))
      if (editingZoneId === zona.id) {
        resetForm()
      }
      setSuccess('Zona eliminada correctamente')
    } catch {
      setError('Error de conexion')
    } finally {
      setDeletingZoneId(null)
    }
  }

  const institucionesAsignadas = new Set()
  zonas.forEach((zona) => {
    if (zona.id === editingZoneId) return
    ;(zona.instituciones || []).forEach((institucion) => {
      institucionesAsignadas.add(institucion.id)
    })
  })

  const institucionesDelDepto = institucionesDisponibles.filter((institucion) => (
    normalizeKey(institucion.departamento) === normalizeKey(departamentoSeleccionado) &&
    normalizeKey(institucion.nivel_educativo) === miNivel &&
    !institucionesAsignadas.has(institucion.id)
  ))

  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <h3>Gestion de Zonas</h3>
        <p>Cargando...</p>
      </div>
    )
  }

  if (!miNivel) {
    return (
      <div style={{ padding: 16 }}>
        <h3>Gestion de Zonas</h3>
        <p style={{ color: '#a00' }}>Advertencia: no tienes definido un nivel educativo en tu perfil.</p>
      </div>
    )
  }

  return (
    <>
      <section style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, background: '#fff' }}>
        <h3>Gestion de Zonas</h3>
        <p>Nivel Educativo activo: <strong>{miNivel}</strong></p>

        {error && <div className="msg show msg-error">{error}</div>}
        {success && !error && (
          <div className="msg show msg-success" style={{ marginTop: 16 }}>
            {success}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label>Nombre de la zona</label>
          <input
            type="text"
            value={nombreZona}
            onChange={(e) => {
              setNombreZona(e.target.value)
              setSuccess('')
            }}
            placeholder="Ej: Zona Centro Norte"
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>Departamento</label>
          <select
            value={departamentoSeleccionado}
            onChange={(e) => {
              setDepartamentoSeleccionado(e.target.value)
              setInstitucionesSeleccionadas([])
              setSuccess('')
            }}
          >
            <option value="">-- Seleccionar --</option>
            {departamentos.map((departamento) => (
              <option key={departamento} value={departamento}>{departamento}</option>
            ))}
          </select>
        </div>

        {departamentoSeleccionado && (
          <div style={{ marginBottom: 16 }}>
            <label>Instituciones ({institucionesDelDepto.length})</label>
            {institucionesDelDepto.length === 0 ? (
              <p style={{ color: '#888' }}>
                {editingZoneId
                  ? 'No hay otras instituciones disponibles de tu nivel en este departamento'
                  : 'No hay instituciones disponibles de tu nivel en este departamento'}
              </p>
            ) : (
              <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #ddd', padding: 8 }}>
                {institucionesDelDepto.map((institucion) => (
                  <label key={institucion.id} style={{ display: 'flex', gap: 8, margin: '4px 0' }}>
                    <input
                      type="checkbox"
                      checked={institucionesSeleccionadas.includes(institucion.id)}
                      onChange={() => toggleInstitucion(institucion.id)}
                    />
                    {institucion.nombre} ({institucion.cue}) - {institucion.nivel_educativo || ''}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {institucionesSeleccionadas.length > 0 && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={handleGuardarZona} disabled={creando}>
              {creando
                ? 'Guardando...'
                : editingZoneId
                  ? `Guardar cambios (${institucionesSeleccionadas.length})`
                  : `Crear Zona (${institucionesSeleccionadas.length})`}
            </button>
            {editingZoneId && (
              <button type="button" className="secondary" onClick={resetForm} disabled={creando}>
                Cancelar edicion
              </button>
            )}
          </div>
        )}

        {zonas.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h4>Zonas ({zonas.length})</h4>
            {zonas.map((zona) => (
              <div key={zona.id} style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
                <strong>{getZoneLabel(zona)}</strong>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>
                  Departamento: {zona.departamento || '-'}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>
                  {(zona.instituciones || []).map((institucion) => institucion.nombre).join(', ')}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>
                  Supervisores: {getZoneSupervisorLabel(zona)}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button type="button" className="secondary" onClick={() => startEditZone(zona)}>
                    Editar
                  </button>
                  <button type="button" className="secondary" onClick={() => openSupervisorModal(zona)}>
                    Supervisores
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => handleDeleteZone(zona)}
                    disabled={deletingZoneId === zona.id}
                  >
                    {deletingZoneId === zona.id ? 'Eliminando...' : 'Eliminar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {departamentos.length === 0 && !error && (
          <p style={{ color: '#888' }}>No hay departamentos disponibles</p>
        )}
      </section>

      {modalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: 20, borderRadius: 6, minWidth: 320, maxWidth: '90%' }}>
            <h4>Asignar Supervisor a la Zona</h4>
            {modalLoading ? (
              <p>Cargando supervisores...</p>
            ) : modalSupervisores.length === 0 ? (
              <p>No hay supervisores disponibles para este nivel.</p>
            ) : (
              <div style={{ maxHeight: 260, overflowY: 'auto', marginBottom: 12 }}>
                {modalSupervisores.map((supervisor) => (
                  <label key={supervisor.id} style={{ display: 'block', padding: '4px 0' }}>
                    <input
                      type="checkbox"
                      checked={selectedSupervisores.includes(supervisor.id)}
                      onChange={() => {
                        setSelectedSupervisores((prev) => (
                          prev.includes(supervisor.id)
                            ? prev.filter((id) => id !== supervisor.id)
                            : [...prev, supervisor.id]
                        ))
                      }}
                    />
                    {supervisor.nombre} - {supervisor.nivel_educativo}
                  </label>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => {
                setModalOpen(false)
                setZonaIdCreada(null)
              }}
              >
                Cancelar
              </button>
              <button onClick={handleAssignSupervisores} disabled={modalLoading || selectedSupervisores.length === 0}>
                Guardar asignacion
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
