import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { apiFetch } from '../api.js'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import L from 'leaflet'
import 'leaflet.markercluster'

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

export default function Instituciones({ supervisorMode = false }) {
  const [instituciones, setInstituciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchNombre, setSearchNombre] = useState('')
  const [searchCUE, setSearchCUE] = useState('')
  const [searchCUI, setSearchCUI] = useState('')
  const [filterDepartamento, setFilterDepartamento] = useState('')
  const [filterNivel, setFilterNivel] = useState('')
  const [selectedEdificioKey, setSelectedEdificioKey] = useState(null)
  const [expandedInstitucionId, setExpandedInstitucionId] = useState(null)
  const [pedidosByInstitucion, setPedidosByInstitucion] = useState({})
  const [loadingPedidosId, setLoadingPedidosId] = useState(null)
  const [pedidosError, setPedidosError] = useState('')

  useEffect(() => {
    const fetchInstituciones = async () => {
      try {
        const token = localStorage.getItem('token')
        const response = await apiFetch('/api/instituciones', { token })
        const data = await response.json()
        let list = data.instituciones || []

        // En modo supervisor, filtrar solo las escuelas de la jurisdicción
        if (supervisorMode) {
          const user = JSON.parse(localStorage.getItem('user') || '{}')
          const jurisdiccion = (user.jurisdiccion || '').toLowerCase()
          if (jurisdiccion) {
            list = list.filter(i =>
              (i.jurisdiccion || i.departamento || '').toLowerCase() === jurisdiccion
            )
          }
          // Excluir comedores — solo escuelas
          list = list.filter(i =>
            !(i.tipo || i.categoria || '').toLowerCase().includes('comedor')
          )
        }

        setInstituciones(list)
      } catch (err) {
        setError('Error al cargar instituciones')
      } finally {
        setLoading(false)
      }
    }
    fetchInstituciones()
  }, [supervisorMode])

  const departamentos = Array.from(new Set(
    instituciones
      .map(inst => String(inst.departamento || '').trim())
      .filter(Boolean)
  )).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))

  const niveles = Array.from(new Set(
    instituciones
      .map(inst => String(inst.nivel || '').trim())
      .filter(Boolean)
  )).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))

  // Filtrar instituciones
  const filteredInstituciones = instituciones.filter(inst =>
    inst.nombre.toLowerCase().includes(searchNombre.toLowerCase()) &&
    inst.cue.toLowerCase().includes(searchCUE.toLowerCase()) &&
    (inst.cui || '').toLowerCase().includes(searchCUI.toLowerCase()) &&
    (!filterDepartamento || String(inst.departamento || '').trim() === filterDepartamento) &&
    (!filterNivel || String(inst.nivel || '').trim() === filterNivel)
  )

  const validInstituciones = filteredInstituciones.filter(inst =>
    Number.isFinite(Number(inst.latitud)) && Number.isFinite(Number(inst.longitud))
  )

  // Agrupar por edificio para que cada pin represente un edificio
  const groupedByEdificio = validInstituciones.reduce((acc, inst) => {
    const edificioId = inst.edificio_id ? String(inst.edificio_id) : ''
    const fallbackCoords = `${inst.latitud},${inst.longitud}`
    const buildingKey = edificioId || fallbackCoords
    if (!buildingKey) return acc
    if (!acc[buildingKey]) acc[buildingKey] = []
    acc[buildingKey].push(inst)
    return acc
  }, {})

  const selectedInstituciones = selectedEdificioKey ? (groupedByEdificio[selectedEdificioKey] || []) : []
  const cuesDelEdificio = Array.from(new Set(selectedInstituciones.map(i => String(i.cue || '').trim()).filter(Boolean))).sort()

  const handleSelectEdificio = (buildingKey) => {
    setSelectedEdificioKey(buildingKey)
    setExpandedInstitucionId(null)
    setPedidosError('')
  }

  const handleToggleInstitucion = async (inst) => {
    const institucionId = inst.id

    if (expandedInstitucionId === institucionId) {
      setExpandedInstitucionId(null)
      return
    }

    setExpandedInstitucionId(institucionId)
    setPedidosError('')

    if (pedidosByInstitucion[institucionId]) return

    try {
      setLoadingPedidosId(institucionId)
      const token = localStorage.getItem('token')
      const res = await apiFetch(`/api/pedidos/institucion/${institucionId}`, { token })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setPedidosError(data.error || 'No se pudo cargar el historial de pedidos')
        return
      }

      setPedidosByInstitucion(prev => ({
        ...prev,
        [institucionId]: data.pedidos || []
      }))
    } catch {
      setPedidosError('No se pudo cargar el historial de pedidos')
    } finally {
      setLoadingPedidosId(null)
    }
  }

  // Crear iconos
  const createIcon = (status) => L.icon({
    iconUrl: status === 'retiraron' 
      ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png'
      : 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  })

  if (loading) return <div>Cargando mapa...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div>
      <h2>{supervisorMode ? 'Mis Escuelas' : 'Mapa de Instituciones - San Juan'}</h2>
      
      {/* Filtros */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Buscar por Nombre"
          value={searchNombre}
          onChange={(e) => setSearchNombre(e.target.value)}
          style={{ flex: 1, padding: '8px' }}
        />
        <input
          type="text"
          placeholder="Buscar por CUE"
          value={searchCUE}
          onChange={(e) => setSearchCUE(e.target.value)}
          style={{ flex: 1, padding: '8px' }}
        />
        <input
          type="text"
          placeholder="Buscar por CUI"
          value={searchCUI}
          onChange={(e) => setSearchCUI(e.target.value)}
          style={{ flex: 1, padding: '8px' }}
        />
        <select
          value={filterDepartamento}
          onChange={(e) => setFilterDepartamento(e.target.value)}
          style={{ padding: '8px' }}
        >
          <option value="">Todos los departamentos</option>
          {departamentos.map(dep => (
            <option key={dep} value={dep}>{dep}</option>
          ))}
        </select>
        <select
          value={filterNivel}
          onChange={(e) => setFilterNivel(e.target.value)}
          style={{ padding: '8px' }}
        >
          <option value="">Todos los niveles</option>
          {niveles.map(niv => (
            <option key={niv} value={niv}>{niv}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(320px, 1fr)', gap: 16, alignItems: 'start' }}>
        {/* Mapa */}
        <div style={{ height: '540px', border: '1px solid #ccc', borderRadius: 8, overflow: 'hidden' }}>
          <MapContainer
            center={[-31.5375, -68.5364]}
            zoom={10}
            minZoom={9}
            maxZoom={15}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            {Object.entries(groupedByEdificio).map(([buildingKey, insts]) => {
              const firstInst = insts[0]
              const lat = Number(firstInst.latitud)
              const lng = Number(firstInst.longitud)
              const cueCount = new Set(insts.map(i => i.cue)).size

              return (
                <Marker
                  key={buildingKey}
                  position={[lat, lng]}
                  icon={createIcon(firstInst.status)}
                  eventHandlers={{ click: () => handleSelectEdificio(buildingKey) }}
                >
                  <Popup>
                    <div>
                      <strong>Edificio: {firstInst.cui || 'Sin CUI'}</strong>
                      <div>{cueCount} CUE(s) - {insts.length} escuela(s)</div>
                      <div style={{ marginTop: 6, color: '#6b7280', fontSize: '0.85rem' }}>Hace click en el pin para ver las CUE del edificio.</div>
                    </div>
                  </Popup>
                </Marker>
              )
            })}
          </MapContainer>
        </div>

        {/* Panel derecho */}
        <aside style={{ border: '1px solid var(--border)', borderRadius: 8, background: '#fff', padding: 12, maxHeight: '540px', overflowY: 'auto' }}>
          <h3 style={{ marginTop: 4 }}>CUE por Edificio</h3>

          {!selectedEdificioKey && (
            <p style={{ color: 'var(--muted)', marginTop: 8 }}>
              Seleccioná un pin en el mapa para ver las CUE del edificio y su historial de pedidos.
            </p>
          )}

          {selectedEdificioKey && (
            <>
              <p style={{ marginTop: 8, marginBottom: 12 }}>
                <strong>Edificio:</strong> {selectedInstituciones[0]?.cui || selectedEdificioKey}
              </p>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 6 }}>CUE en este edificio</div>
                {cuesDelEdificio.length === 0 ? (
                  <div style={{ color: 'var(--muted)' }}>Sin CUE registrados</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {cuesDelEdificio.map(cue => (
                      <span key={cue} className="badge">{cue}</span>
                    ))}
                  </div>
                )}
              </div>

              {pedidosError && <div className="msg show msg-error">{pedidosError}</div>}

              <div style={{ display: 'grid', gap: 10 }}>
                {selectedInstituciones.map(inst => {
                  const expanded = expandedInstitucionId === inst.id
                  const pedidos = pedidosByInstitucion[inst.id] || []

                  return (
                    <div key={inst.id} style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleInstitucion(inst)}
                        style={{
                          width: '100%',
                          margin: 0,
                          borderRadius: 0,
                          textAlign: 'left',
                          justifyContent: 'space-between',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          background: '#f9fafb',
                          color: 'var(--dark)',
                          border: 'none',
                          minHeight: 46,
                          padding: '10px 12px'
                        }}
                      >
                        <span>{inst.nombre}</span>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{expanded ? 'Ocultar' : 'Ver pedidos'}</span>
                      </button>

                      {expanded && (
                        <div style={{ padding: 10, background: '#fff' }}>
                          {loadingPedidosId === inst.id && <p style={{ margin: 0, color: 'var(--muted)' }}>Cargando pedidos...</p>}

                          {loadingPedidosId !== inst.id && pedidos.length === 0 && (
                            <p style={{ margin: 0, color: 'var(--muted)' }}>Sin pedidos registrados.</p>
                          )}

                          {loadingPedidosId !== inst.id && pedidos.length > 0 && (
                            <ul style={{ margin: 0, paddingLeft: 18 }}>
                              {pedidos.map(p => (
                                <li key={p.id} style={{ marginBottom: 6 }}>
                                  #{p.id} - {p.producto_nombre || '-'} x {p.cantidad} - {p.estado} - {new Date(p.created_at).toLocaleDateString('es-AR')}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </aside>
      </div>

      <p>Mostrando {Object.keys(groupedByEdificio).length} edificio(s) en mapa con {filteredInstituciones.length} instituciones</p>
    </div>
  )
}

