import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import { useAuth } from '../context/AuthContext'

function normalizeText(value) {
  return String(value || '').trim()
}

function normalizeKey(value) {
  return normalizeText(value).toUpperCase()
}

function normalizeSearch(value) {
  return normalizeText(value).toLowerCase()
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

function getZoneDepartmentsLabel(zone) {
  const departments = [...new Set(
    (zone?.instituciones || [])
      .map((institucion) => normalizeText(institucion.departamento))
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, 'es'))

  if (departments.length === 0) return '-'
  return departments.join(', ')
}

function getInstitutionOptionLabel(institucion) {
  return [
    institucion.nombre,
    institucion.cue ? `CUE ${institucion.cue}` : '',
    institucion.departamento || '',
    institucion.nivel_educativo || ''
  ]
    .filter(Boolean)
    .join(' - ')
}

export default function DirectorAreaZonas({ nivelEducativo }) {
  const { token, withMasterDirector } = useAuth()
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
  const [busquedaEscuela, setBusquedaEscuela] = useState('')
  const [nombreZona, setNombreZona] = useState('')
  const [editingZoneId, setEditingZoneId] = useState(null)
  const [creando, setCreando] = useState(false)
  const [deletingZoneId, setDeletingZoneId] = useState(null)
  const [expandedZonas, setExpandedZonas] = useState({})

  const toggleEscuelas = (zonaId) => {
    setExpandedZonas((prev) => ({ ...prev, [zonaId]: !prev[zonaId] }))
  }

  const miNivel = normalizeKey(nivelEducativo || nivelActivo)

  useEffect(() => {
    loadData()
  }, [token, withMasterDirector])

  useEffect(() => {
    if (modalOpen) {
      fetchModalSupervisores()
    }
  }, [modalOpen, token, withMasterDirector])

  const fetchModalSupervisores = async () => {
    setModalLoading(true)
    try {
      const res = await apiFetch(withMasterDirector('/api/director-area/catalogo'), { token })
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
      const res = await apiFetch(withMasterDirector('/api/director-area/zonas-edificio'), { token })
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
    setBusquedaEscuela('')
    setInstitucionesSeleccionadas([])
    setEditingZoneId(null)
  }

  const startEditZone = (zona) => {
    setEditingZoneId(zona.id)
    setNombreZona(zona.name || '')
    setDepartamentoSeleccionado('')
    setBusquedaEscuela('')
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
    if (institucionesSeleccionadas.length === 0) {
      setError('Selecciona al menos una institucion')
      return
    }

    setError('')
    setSuccess('')
    setCreando(true)

    try {
      const isEditing = Boolean(editingZoneId)
      const res = await apiFetch(
        withMasterDirector(isEditing ? `/api/director-area/zonas/${editingZoneId}` : '/api/director-area/zonas'),
        {
          token,
          method: isEditing ? 'PATCH' : 'POST',
          body: JSON.stringify({
            name: normalizeText(nombreZona),
            departamento: null,
            nivel_educativo: miNivel,
            institucionIds: institucionesSeleccionadas
          })
        }
      )

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
      const res = await apiFetch(withMasterDirector(`/api/director-area/zonas/${zonaIdCreada}/supervisores`), {
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
      const res = await apiFetch(withMasterDirector(`/api/director-area/zonas/${zona.id}`), {
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

  const institucionesFiltradas = institucionesDisponibles.filter((institucion) => (
    normalizeKey(institucion.nivel_educativo) === miNivel &&
    !institucionesAsignadas.has(institucion.id) &&
    (!departamentoSeleccionado || normalizeKey(institucion.departamento) === normalizeKey(departamentoSeleccionado))
  ))

  const terminoBusquedaEscuela = normalizeSearch(busquedaEscuela)
  const institucionesBuscadas = terminoBusquedaEscuela
    ? institucionesFiltradas
      .filter((institucion) => {
        const nombre = normalizeSearch(institucion.nombre)
        const cue = normalizeSearch(institucion.cue)
        return (nombre.includes(terminoBusquedaEscuela) || cue.includes(terminoBusquedaEscuela))
          && !institucionesSeleccionadas.includes(institucion.id)
      })
      .sort((a, b) => normalizeText(a.nombre).localeCompare(normalizeText(b.nombre), 'es'))
      .slice(0, 25)
    : []

  const institucionesSeleccionadasDetalle = institucionesDisponibles
    .filter((institucion) => institucionesSeleccionadas.includes(institucion.id))
    .sort((a, b) => normalizeText(a.nombre).localeCompare(normalizeText(b.nombre), 'es'))

  const renderInstitucionesSelector = () => {
    return (
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
          Escuelas disponibles ({institucionesFiltradas.length})
        </label>
        {institucionesSeleccionadasDetalle.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              Escuelas seleccionadas ({institucionesSeleccionadasDetalle.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {institucionesSeleccionadasDetalle.map((institucion) => (
                <div
                  key={`selected-${institucion.id}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    border: '1px solid #cfe2ff',
                    borderRadius: 20,
                    background: '#e7f1ff',
                    color: '#084298',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                  }}
                  title={getInstitutionOptionLabel(institucion)}
                >
                  <span style={{
                    maxWidth: '220px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.2
                  }}>
                    {institucion.nombre}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleInstitucion(institucion.id)}
                    style={{
                      margin: 0,
                      minHeight: 'auto',
                      padding: 0,
                      background: 'transparent',
                      border: 'none',
                      color: '#dc3545',
                      fontSize: '1rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                      width: 16,
                      height: 16,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)' }}>Buscar por CUE o nombre</label>
          <input
            type="text"
            value={busquedaEscuela}
            onChange={(e) => setBusquedaEscuela(e.target.value)}
            placeholder="Ej: 700057900 o Escuela Tecnica"
            style={{ fontSize: '0.9rem', padding: '10px 12px' }}
          />
          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 6 }}>
            Los resultados se actualizan mientras escribís
          </div>
        </div>

        {institucionesFiltradas.length === 0 ? (
          <p style={{ color: '#888', fontSize: '0.9rem', fontStyle: 'italic' }}>
            {departamentoSeleccionado
              ? 'No hay instituciones disponibles de tu nivel para el filtro seleccionado'
              : 'No hay instituciones disponibles de tu nivel'}
          </p>
        ) : !terminoBusquedaEscuela ? (
          <p style={{ color: '#6b7280', fontSize: '0.9rem', fontStyle: 'italic' }}>Escribí en el buscador para ver coincidencias.</p>
        ) : institucionesBuscadas.length === 0 ? (
          <p style={{ color: '#888', fontSize: '0.9rem', fontStyle: 'italic' }}>No se encontraron escuelas con ese CUE o nombre.</p>
        ) : (
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 10,
              display: 'grid',
              gap: 8,
              background: '#fcfcfd',
              maxHeight: '260px',
              overflowY: 'auto'
            }}
          >
            {institucionesBuscadas.map((institucion) => (
              <div
                key={institucion.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '8px 12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  background: '#fff'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--dark)', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {institucion.nombre}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                    CUE: {institucion.cue} • {institucion.departamento}
                  </span>
                </div>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => toggleInstitucion(institucion.id)}
                  style={{ margin: 0, minHeight: 'auto', padding: '6px 12px', whiteSpace: 'nowrap', fontSize: '0.82rem' }}
                >
                  Agregar
                </button>
              </div>
            ))}
            {terminoBusquedaEscuela && institucionesBuscadas.length === 25 && (
              <div style={{ fontSize: '0.8rem', color: '#6b7280', textAlign: 'center', padding: '4px 0' }}>
                Mostrando los primeros 25 resultados. Seguí escribiendo para acotar.
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderZoneForm = ({ inline = false } = {}) => (
    <div
      style={{
        marginTop: inline ? 16 : 0,
        padding: inline ? 16 : 0,
        border: inline ? '1px solid #e6e6e6' : 'none',
        borderRadius: inline ? 8 : 0,
        background: inline ? '#fafafa' : 'transparent'
      }}
    >
      {inline && <h5 style={{ margin: '0 0 12px 0', fontSize: '1rem' }}>Editar zona</h5>}

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)' }}>Nombre de la zona</label>
        <input
          type="text"
          value={nombreZona}
          onChange={(e) => {
            setNombreZona(e.target.value)
            setSuccess('')
          }}
          placeholder="Ej: Zona Centro Norte"
          style={{ fontSize: '0.9rem', padding: '10px 12px' }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)' }}>Filtrar escuelas por departamento</label>
        <select
          value={departamentoSeleccionado}
          onChange={(e) => {
            setDepartamentoSeleccionado(e.target.value)
            setSuccess('')
          }}
          style={{ fontSize: '0.9rem', padding: '10px 12px' }}
        >
          <option value="">Todos los departamentos</option>
          {departamentos.map((departamento) => (
            <option key={departamento} value={departamento}>{departamento}</option>
          ))}
        </select>
      </div>

      {renderInstitucionesSelector()}

      {(institucionesSeleccionadas.length > 0 || editingZoneId) && (
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button type="button" onClick={handleGuardarZona} disabled={creando || institucionesSeleccionadas.length === 0} style={{ margin: 0, padding: '10px 20px' }}>
            {creando
              ? 'Guardando...'
              : editingZoneId
                ? `Guardar cambios (${institucionesSeleccionadas.length})`
                : `Crear Zona (${institucionesSeleccionadas.length})`}
          </button>
          {editingZoneId && (
            <button type="button" className="secondary" onClick={resetForm} disabled={creando} style={{ margin: 0, padding: '10px 20px' }}>
              Cancelar edición
            </button>
          )}
        </div>
      )}
    </div>
  )

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <h3>Gestión de Zonas</h3>
        <p style={{ color: 'var(--muted)' }}>Cargando datos del sistema...</p>
      </div>
    )
  }

  if (!miNivel) {
    return (
      <div style={{ padding: 24 }}>
        <h3>Gestión de Zonas</h3>
        <p style={{ color: '#dc2626', fontWeight: 600 }}>Advertencia: no tienes definido un nivel educativo en tu perfil.</p>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @media (min-width: 1024px) {
          .responsive-split-zones {
            grid-template-columns: 4.5fr 5.5fr !important;
          }
          .btn-label-text {
            display: inline !important;
          }
        }
        @media (max-width: 1023px) {
          .btn-label-text {
            display: none !important;
          }
        }
      `}</style>

      <div className="responsive-split-zones" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '28px', alignItems: 'flex-start' }}>
        
        {/* Columna Izquierda: Formulario de Creación/Edición */}
        <section style={{ border: '1px solid var(--border)', borderRadius: 16, padding: 28, background: '#fff', boxShadow: 'var(--shadow-premium)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>
              {editingZoneId ? '✏️ Editar Zona' : '➕ Nueva Zona'}
            </h3>
            <span style={{
              background: '#fff7ed',
              color: '#ea580c',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: 700,
              border: '1px solid #ffedd5'
            }}>
              Nivel: {miNivel}
            </span>
          </div>

          {error && <div className="msg show msg-error" style={{ marginBottom: 16 }}>{error}</div>}
          {success && !error && (
            <div className="msg show msg-success" style={{ marginBottom: 16 }}>
              {success}
            </div>
          )}

          {!editingZoneId && renderZoneForm()}
          {editingZoneId && (
            <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '12px 0' }}>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem' }}>Editando la zona seleccionada a la derecha.</p>
              <button type="button" className="secondary" onClick={resetForm} style={{ width: '100%' }}>
                Cancelar edición para crear una nueva
              </button>
            </div>
          )}
        </section>

        {/* Columna Derecha: Listado de Zonas Registradas */}
        <section style={{ border: '1px solid var(--border)', borderRadius: 16, padding: 28, background: '#fff', boxShadow: 'var(--shadow-premium)' }}>
          <h3 style={{ marginBottom: 20, fontSize: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>
            Zonas Registradas ({zonas.length})
          </h3>

          {zonas.length === 0 ? (
            <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '32px 0', fontStyle: 'italic' }}>
              No hay zonas registradas para tu nivel.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: '18px' }}>
              {zonas.map((zona) => {
                const isEditing = editingZoneId === zona.id;
                return (
                  <div
                    key={zona.id}
                    style={{
                      padding: '20px',
                      borderRadius: '12px',
                      border: isEditing ? '2px solid var(--orange)' : '1px solid #e2e8f0',
                      background: isEditing ? '#fffbf7' : '#fff',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <h4 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--dark)' }}>
                          {getZoneLabel(zona)}
                        </h4>
                        
                        {/* Badges de Departamentos */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', marginRight: 4 }}>Dptos:</span>
                          {(zona.instituciones || []).length === 0 ? (
                            <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>-</span>
                          ) : (
                            [...new Set((zona.instituciones || []).map(i => i.departamento).filter(Boolean))].map(d => (
                              <span key={d} style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600 }}>
                                {d}
                              </span>
                            ))
                          )}
                        </div>

                        {/* Supervisor Badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: '#475569', marginTop: 8 }}>
                          <span style={{ fontWeight: 700, color: 'var(--muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Supervisor:</span>
                          <span style={{
                            background: (zona.supervisores || []).length > 0 ? '#f0fdf4' : '#fff1f2',
                            color: (zona.supervisores || []).length > 0 ? '#166534' : '#991b1b',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            border: (zona.supervisores || []).length > 0 ? '1px solid #dcfce7' : '1px solid #ffe4e6'
                          }}>
                            {getZoneSupervisorLabel(zona)}
                          </span>
                        </div>
                      </div>

                      {/* Botones de acción rápidos */}
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => startEditZone(zona)}
                          style={{ margin: 0, minHeight: 'auto', padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 }}
                          title="Editar nombre y escuelas"
                        >
                          ✏️ <span className="btn-label-text">Editar</span>
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => openSupervisorModal(zona)}
                          style={{ margin: 0, minHeight: 'auto', padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 }}
                          title="Asignar Supervisor"
                        >
                          👤 <span className="btn-label-text">Supervisor</span>
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => handleDeleteZone(zona)}
                          disabled={deletingZoneId === zona.id}
                          style={{ margin: 0, minHeight: 'auto', padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4, borderColor: '#fecaca', color: '#dc2626' }}
                          title="Eliminar Zona"
                        >
                          🗑️ <span className="btn-label-text">Eliminar</span>
                        </button>
                      </div>
                    </div>

                    {/* Acordeón de escuelas */}
                    {(zona.instituciones || []).length > 0 && (
                      <div style={{ marginTop: 14, borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
                        <button
                          type="button"
                          onClick={() => toggleEscuelas(zona.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            fontSize: '0.82rem',
                            color: '#0284c7',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                          }}
                        >
                          <span style={{ transition: 'transform 0.2s', display: 'inline-block', transform: expandedZonas[zona.id] ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                          {expandedZonas[zona.id] ? 'Ocultar' : 'Ver'} escuelas ({zona.instituciones.length})
                        </button>
                        {expandedZonas[zona.id] && (
                          <div style={{ display: 'grid', gap: 6, marginTop: 10, paddingLeft: 12, borderLeft: '2px solid #e2e8f0' }}>
                            {zona.instituciones.map((institucion) => (
                              <div key={institucion.id} style={{ fontSize: '0.78rem', color: '#334155', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🏫 {institucion.nombre}</span>
                                <span style={{ color: 'var(--muted)', fontSize: '0.72rem', flexShrink: 0 }}>CUE {institucion.cue} ({institucion.departamento})</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Formulario de edición inline */}
                    {isEditing && (
                      <div style={{ marginTop: 16, borderTop: '2px dashed var(--orange)', paddingTop: 16 }}>
                        {renderZoneForm({ inline: true })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {departamentos.length === 0 && !error && (
            <p style={{ color: '#888', textAlign: 'center', marginTop: 16, fontSize: '0.9rem' }}>No hay departamentos disponibles</p>
          )}
        </section>
      </div>

      {modalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card fade-in" style={{ padding: 28, borderRadius: 16, minWidth: 420, maxWidth: '90%', minHeight: 'auto', boxShadow: 'var(--shadow-premium)' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '1.25rem' }}>👤 Asignar Supervisor</h4>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: 20 }}>Selecciona los supervisores que estarán a cargo de esta zona:</p>
            {modalLoading ? (
              <p style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: '0.9rem' }}>Cargando supervisores...</p>
            ) : modalSupervisores.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: '0.9rem' }}>No hay supervisores disponibles para este nivel.</p>
            ) : (
              <div style={{ maxHeight: 260, overflowY: 'auto', marginBottom: 24, padding: '4px', display: 'grid', gap: 10 }}>
                {modalSupervisores.map((supervisor) => (
                  <label
                    key={supervisor.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      cursor: 'pointer',
                      background: selectedSupervisores.includes(supervisor.id) ? '#f0fdf4' : 'transparent',
                      borderColor: selectedSupervisores.includes(supervisor.id) ? '#bbf7d0' : '#e2e8f0',
                      transition: 'all 0.2s',
                      margin: 0
                    }}
                  >
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
                      style={{ width: 'auto', minHeight: 'auto' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--dark)' }}>
                        {supervisor.nombre} {supervisor.apellido}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                        {supervisor.email || supervisor.username || 'Supervisor'}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                className="secondary"
                onClick={() => {
                  setModalOpen(false)
                  setZonaIdCreada(null)
                }}
                style={{ margin: 0, padding: '8px 16px' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleAssignSupervisores}
                disabled={modalLoading}
                style={{ margin: 0, padding: '8px 20px' }}
              >
                Guardar asignación
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
