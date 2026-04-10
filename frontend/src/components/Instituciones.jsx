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

export default function Instituciones() {
  const [instituciones, setInstituciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchNombre, setSearchNombre] = useState('')
  const [searchCUE, setSearchCUE] = useState('')
  const [searchCUI, setSearchCUI] = useState('')

  useEffect(() => {
    const fetchInstituciones = async () => {
      try {
        const token = localStorage.getItem('token')
        const response = await apiFetch('/api/instituciones', { token })
        const data = await response.json()
        setInstituciones(data.instituciones || [])
      } catch (err) {
        setError('Error al cargar instituciones')
      } finally {
        setLoading(false)
      }
    }
    fetchInstituciones()
  }, [])

  // Filtrar instituciones
  const filteredInstituciones = instituciones.filter(inst =>
    inst.nombre.toLowerCase().includes(searchNombre.toLowerCase()) &&
    inst.cue.toLowerCase().includes(searchCUE.toLowerCase()) &&
    (inst.cui || '').toLowerCase().includes(searchCUI.toLowerCase())
  )

  // Agrupar por coordenadas
  const grouped = filteredInstituciones.reduce((acc, inst) => {
    const key = `${inst.latitud},${inst.longitud}`
    if (!acc[key]) acc[key] = []
    acc[key].push(inst)
    return acc
  }, {})

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
      <h2>Mapa de Instituciones - San Juan</h2>
      
      {/* Filtros */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
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
      </div>

      {/* Mapa */}
      <div style={{ height: '700px', border: '1px solid #ccc' }}>
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
          {Object.entries(grouped).map(([coords, insts]) => {
            const [lat, lng] = coords.split(',').map(Number)
            const firstInst = insts[0]
            return (
              <Marker
                key={coords}
                position={[lat, lng]}
                icon={createIcon(firstInst.status)}
              >
                <Popup>
                  <div>
                    {insts.length === 1 ? (
                      <>
                        <h3>{firstInst.nombre}</h3>
                        <p>CUE: {firstInst.cue}</p>
                        {firstInst.cui && <p>CUI: {firstInst.cui}</p>}
                        <p>Status: {firstInst.status === 'retiraron' ? 'Retiraron material' : 'No retiraron'}</p>
                      </>
                    ) : (
                      <>
                        <h3>{insts.length} Instituciones en esta ubicación</h3>
                        <ul>
                          {insts.map(inst => (
                            <li key={inst.id}>
                              <strong>{inst.nombre}</strong> (CUE: {inst.cue}) - {inst.status === 'retiraron' ? 'Retiraron' : 'No retiraron'}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </div>

      <p>Mostrando {Object.keys(grouped).length} ubicaciones con {filteredInstituciones.length} instituciones</p>
    </div>
  )
}

