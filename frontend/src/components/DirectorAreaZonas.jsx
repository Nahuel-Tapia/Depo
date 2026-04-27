import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import { useAuth } from '../context/AuthContext'

export default function DirectorAreaZonas({ nivelEducativo }) {
  const { token } = useAuth()
  const [departamentos, setDepartamentos] = useState([])
  const [zonas, setZonas] = useState([])
  const [supervisores, setSupervisores] = useState([])
  const [institucionesDisponibles, setInstitucionesDisponibles] = useState([])
  const [institucionesSeleccionadas, setInstitucionesSeleccionadas] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [zonaIdCreada, setZonaIdCreada] = useState(null)
  const [modalSupervisores, setModalSupervisores] = useState([])
  const [selectedSupervisores, setSelectedSupervisores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  const [departamentoSeleccionado, setDepartamentoSeleccionado] = useState('')
  const [zonaCreada, setZonaCreada] = useState(false)
  const [creando, setCreando] = useState(false)

  const miNivel = nivelEducativo ? nivelEducativo.toUpperCase() : 'PRIMARIO'

  useEffect(() => {
    loadData()
  }, [])

  // When modal opens, fetch available supervisors for assignment
  useEffect(() => {
    if (modalOpen) {
      fetchModalSupervisores()
      setSelectedSupervisores([])
    }
  }, [modalOpen])

  const fetchModalSupervisores = async () => {
    try {
      const res = await apiFetch('/api/director-area/catalogo', { token })
      const data = await res.json().catch(() => ({}))
      setModalSupervisores(data.supervisores || [])
    } catch {
      setModalSupervisores([])
    }
  }

  const loadData = async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch('/api/director-area/zonas-edificio', { token })
      const data = await res.json().catch(() => ({}))
      
      if (res.ok) {
        setDepartamentos(data.departamentos || [])
        setZonas(data.zonas || [])
        // include nivel_educativo in instituciones for frontend filtering
        setInstitucionesDisponibles((data.instituciones || []) )
      } else {
        setError(data.error || 'Error al cargar')
      }
    } catch (err) {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const toggleInstitucion = (id) => {
    setInstitucionesSeleccionadas(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleCrear = async () => {
    if (!departamentoSeleccionado) {
      setError('Seleccioná un departamento')
      return
    }
    if (institucionesSeleccionadas.length === 0) {
      setError('Seleccioná al menos una institución')
      return
    }
    
    setError('')
    setCreando(true)
    
    try {
      const res = await apiFetch('/api/director-area/zonas', {
        token,
        method: 'POST',
        body: JSON.stringify({
          name: departamentoSeleccionado,
          departamento: departamentoSeleccionado,
          nivel_educativo: miNivel,
          institucionIds: institucionesSeleccionadas
        })
      })
      
      const data = await res.json().catch(() => ({}))
      
      if (res.ok) {
        // Zone created, open modal to assign supervisor
        const createdId = data.id || data.zoneId || null
        setZonaIdCreada(createdId)
        setModalOpen(true)
        setZonaCreada(true)
        setError('')
      } else {
        setError(data.error || 'Error al crear zona')
      }
    } catch (err) {
      setError('Error de conexión')
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
      // Success: close modal and refresh data
      setModalOpen(false)
      setSelectedSupervisores([])
      setZonaIdCreada(null)
      loadData()
    } catch (err) {
      setError('Error de conexión')
    }
  }

  const institucionesDelDepto = institucionesDisponibles.filter(i => 
    i.departamento === departamentoSeleccionado && (i.nivel_educativo || '').toUpperCase() === miNivel
  )

  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <h3>Gestión de Zonas</h3>
        <p>Cargando...</p>
      </div>
    )
  }

  // If director's level is not defined, warn the user
  if (!nivelEducativo) {
    return (
      <div style={{ padding: 16 }}>
        <h3>Gestión de Zonas</h3>
        <p style={{ color: '#a00' }}>Advertencia: no tienes definido un nivel educativo en tu perfil.</p>
      </div>
    )
  }

  return (
    <>
      <section style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, background: '#fff' }}>
      <h3>Gestión de Zonas</h3>
      <p>Nivel Educativo activo: <strong>{miNivel}</strong></p>

      {error && <div className="msg show msg-error">{error}</div>}

      <div style={{ marginBottom: 16 }}>
        <label>Departamento</label>
        <select 
          value={departamentoSeleccionado}
          onChange={(e) => { 
            setDepartamentoSeleccionado(e.target.value) 
            setInstitucionesSeleccionadas([])
          }}
        >
          <option value="">-- Seleccionar --</option>
          {departamentos.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {departamentoSeleccionado && (
        <div style={{ marginBottom: 16 }}>
          <label>Instituciones ({institucionesDelDepto.length})</label>
          {institucionesDelDepto.length === 0 ? (
            <p style={{ color: '#888' }}>No hay instituciones en este departamento</p>
          ) : (
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #ddd', padding: 8 }}>
                  {institucionesDelDepto.map(inst => (
                <label key={inst.id} style={{ display: 'flex', gap: 8, margin: '4px 0' }}>
                  <input
                    type="checkbox"
                    checked={institucionesSeleccionadas.includes(inst.id)}
                    onChange={() => toggleInstitucion(inst.id)}
                  />
                  {inst.nombre} ({inst.cue}) - {inst.nivel_educativo || ''}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {institucionesSeleccionadas.length > 0 && (
        <button type="button" onClick={handleCrear} disabled={creando}>
          {creando ? 'Creando...' : `Crear Zona (${institucionesSeleccionadas.length})`}
        </button>
      )}

      {zonas.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h4>Zonas ({zonas.length})</h4>
          {zonas.map(z => (
            <div key={z.id} style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
              <strong>{z.name}</strong>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>
                {(z.instituciones || []).map(i => i.nombre).join(', ')}
              </div>
            </div>
          ))}
        </div>
      )}

      {departamentos.length === 0 && !error && (
        <p style={{ color: '#888' }}>No hay departamentos disponibles</p>
      )}

      {zonaCreada && (
        <div className="msg show msg-success" style={{ marginTop: 16 }}>
          ✅ Zona creada correctamente
        </div>
      )}
      </section>
      {modalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: 20, borderRadius: 6, minWidth: 320, maxWidth: '90%' }}>
            <h4>Asignar Supervisor a la Zona</h4>
            {modalSupervisores.length === 0 ? (
              <p>Cargando supervisores...</p>
            ) : (
              <div style={{ maxHeight: 260, overflowY: 'auto', marginBottom: 12 }}>
                {modalSupervisores.map((s) => (
                  <label key={s.id} style={{ display: 'block', padding: '4px 0' }}>
                    <input
                      type="checkbox"
                      checked={selectedSupervisores.includes(s.id)}
                      onChange={() => {
                        setSelectedSupervisores((prev) =>
                          prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                        )
                      }}
                    />
                    {s.nombre} - {s.nivel_educativo}
                  </label>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setModalOpen(false)}>Cancelar</button>
              <button onClick={handleAssignSupervisores} disabled={selectedSupervisores.length === 0}>Asignar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
