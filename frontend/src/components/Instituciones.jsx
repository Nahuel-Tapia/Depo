import { useState, useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { apiFetch } from '../api.js'
import { useAuth } from '../context/AuthContext'
import FilterSortButton from './FilterSortButton'
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
  const { user } = useAuth()
  const [instituciones, setInstituciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchNombre, setSearchNombre] = useState('')
  const [searchCUE, setSearchCUE] = useState('')
  const [searchCUI, setSearchCUI] = useState('')
  const [searchText, setSearchText] = useState('')
  const [filterDepartamento, setFilterDepartamento] = useState('')
  const [filterNivel, setFilterNivel] = useState('')
  const [filterPedido, setFilterPedido] = useState('')
  const [sortBy, setSortBy] = useState('nombre_asc')
  const [selectedEdificioKey, setSelectedEdificioKey] = useState(null)
  const [expandedInstitucionId, setExpandedInstitucionId] = useState(null)
  const [pedidosByInstitucion, setPedidosByInstitucion] = useState({})
  const [loadingPedidosId, setLoadingPedidosId] = useState(null)
  const [pedidosError, setPedidosError] = useState('')

  useEffect(() => {
    const fetchInstituciones = async () => {
      try {
        const token = localStorage.getItem('token')
        const response = await apiFetch(supervisorMode ? '/api/supervisor/instituciones' : '/api/instituciones', { token })
        const data = await response.json()
        let list = data.instituciones || []

        // En modo supervisor, el backend ya devuelve solo escuelas asignadas.
        if (supervisorMode) {
          // Excluir comedores — solo escuelas
          list = list.filter(i =>
            !(i.tipo || i.categoria || '').toLowerCase().includes('comedor')
          )
        }

        if (user?.role === 'director_area' && user?.nivel_educativo) {
          list = list.filter(i => 
            String(i.nivel || '').toLowerCase().trim() === String(user.nivel_educativo).toLowerCase().trim()
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
  const filteredInstituciones = useMemo(() => {
    const search = searchText.trim().toLowerCase()

    return [...instituciones]
      .filter(inst => {
        const matchesSearch = !search || [
          inst.nombre,
          inst.cue,
          inst.cui,
          inst.departamento,
          inst.nivel,
        ].some((value) => String(value || '').toLowerCase().includes(search))

        return matchesSearch &&
          String(inst.nombre || '').toLowerCase().includes(searchNombre.toLowerCase()) &&
          String(inst.cue || '').toLowerCase().includes(searchCUE.toLowerCase()) &&
          (inst.cui || '').toLowerCase().includes(searchCUI.toLowerCase()) &&
          (!filterDepartamento || String(inst.departamento || '').trim() === filterDepartamento) &&
          (!filterNivel || String(inst.nivel || '').trim() === filterNivel) &&
          (!filterPedido || inst.pedido_status === filterPedido)
      })
      .sort((a, b) => {
        if (sortBy === 'departamento_asc') return String(a.departamento || '').localeCompare(String(b.departamento || ''), 'es', { sensitivity: 'base' })
        if (sortBy === 'nivel_asc') return String(a.nivel || '').localeCompare(String(b.nivel || ''), 'es', { sensitivity: 'base' })
        if (sortBy === 'cue_asc') return String(a.cue || '').localeCompare(String(b.cue || ''), 'es', { sensitivity: 'base', numeric: true })
        if (sortBy === 'cui_asc') return String(a.cui || '').localeCompare(String(b.cui || ''), 'es', { sensitivity: 'base', numeric: true })
        return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { sensitivity: 'base' })
      })
  }, [instituciones, searchText, searchNombre, searchCUE, searchCUI, filterDepartamento, filterNivel, filterPedido, sortBy])

  const filtrosActivos = [searchText.trim(), searchNombre.trim(), searchCUE.trim(), searchCUI.trim(), filterDepartamento, filterNivel, filterPedido].filter(Boolean).length

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

  const pinLegendItems = useMemo(() => {
    if (supervisorMode) {
      return [
        { color: '#e74c3c', label: 'Rojo: sin kit' },
        { color: '#f1c40f', label: 'Amarillo: sin solicitud' },
        { color: '#f39c12', label: 'Naranja: solicitud enviada' },
        { color: '#2ecc71', label: 'Verde: solicitud aprobada' },
      ]
    }

    return [
      { color: '#2ecc71', label: 'Verde: retiraron mercaderia' },
      { color: '#f1c40f', label: 'Amarillo: con pedido' },
      { color: '#e74c3c', label: 'Rojo: sin retiro / pendiente' },
    ]
  }, [supervisorMode])

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
        setPedidosError(data.error || 'No se pudo cargar el historial de egresos')
        return
      }

      setPedidosByInstitucion(prev => ({
        ...prev,
        [institucionId]: data.pedidos || []
      }))
    } catch {
      setPedidosError('No se pudo cargar el historial de egresos')
    } finally {
      setLoadingPedidosId(null)
    }
  }

  // Crear iconos
  const createIcon = (status, pedido_status) => {
    let color = 'red';
    if (supervisorMode) {
      if (status === 'sin_kit') {
        color = 'red';
      } else if (status === 'sin_solicitud') {
        color = 'yellow';
      } else if (status === 'solicitud_enviada') {
        color = 'orange';
      } else if (status === 'solicitud_aprobada') {
        color = 'green';
      }
    } else {
      if (status === 'retiraron') {
        color = 'green';
      } else if (pedido_status === 'con_pedido') {
        color = 'yellow';
      }
    }
    
    return L.icon({
      iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    })
  }

  if (loading) return <div>Cargando mapa...</div>
  if (error) return <div>Error: {error}</div>



  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', position: 'relative', zIndex: 100 }}>
        <h2>{supervisorMode ? 'Mis Escuelas' : 'Mapa de Instituciones - San Juan'}</h2>
        <FilterSortButton
          searchValue={searchText}
          searchPlaceholder="Buscar nombre, CUE, CUI o departamento..."
          onSearchChange={setSearchText}
          filters={[
            {
              key: 'departamento',
              label: 'Departamento',
              value: filterDepartamento,
              onChange: setFilterDepartamento,
              emptyLabel: 'Todos',
              options: departamentos.map((dep) => ({ value: dep, label: dep })),
            },
            {
              key: 'nivel',
              label: 'Nivel',
              value: filterNivel,
              onChange: setFilterNivel,
              emptyLabel: 'Todos',
              options: niveles.map((nivel) => ({ value: nivel, label: nivel })),
            },
          ]}
          sortValue={sortBy}
          sortOptions={[
            { value: 'nombre_asc', label: 'Nombre (A-Z)' },
            { value: 'departamento_asc', label: 'Departamento' },
            { value: 'nivel_asc', label: 'Nivel educativo' },
            { value: 'cue_asc', label: 'CUE' },
            { value: 'cui_asc', label: 'CUI' },
          ]}
          onSortChange={setSortBy}
          onClear={() => {
            setSearchText('')
            setSearchNombre('')
            setSearchCUE('')
            setSearchCUI('')
            setFilterDepartamento('')
            setFilterNivel('')
            setFilterPedido('')
            setSortBy('nombre_asc')
          }}
          activeCount={filtrosActivos}
        />
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <span className="badge">Instituciones cargadas: {filteredInstituciones.length}</span>
        <span className="badge">Con coordenadas: {validInstituciones.length}</span>
        <span className="badge">Edificios en mapa: {Object.keys(groupedByEdificio).length}</span>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: '#fff', padding: 12, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, color: 'var(--dark)', marginBottom: 8 }}>Referencia de colores del pin</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {pinLegendItems.map((item) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #e5e7eb', borderRadius: 999, padding: '6px 10px', background: '#fafafa' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, display: 'inline-block' }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--dark)' }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="instituciones-map-layout">
        {/* Mapa */}
        <div className="instituciones-map-container" style={{ isolation: 'isolate' }}>
          {validInstituciones.length === 0 ? (
            <div style={{ padding: 20, color: 'var(--muted)' }}>
              No hay instituciones georreferenciadas para mostrar en el mapa con los filtros actuales.
            </div>
          ) : (
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
                    icon={createIcon(firstInst.status, firstInst.pedido_status)}
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
          )}
        </div>

        {/* Panel derecho */}
        <aside className="instituciones-map-aside">
          <h3 style={{ marginTop: 4 }}>CUE por Edificio</h3>

          {!selectedEdificioKey && (
            <p style={{ color: 'var(--muted)', marginTop: 8 }}>
              Seleccioná un pin en el mapa para ver las CUE del edificio y los últimos egresos.
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
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{expanded ? 'Ocultar' : 'Ver egresos'}</span>
                      </button>

                      {expanded && (
                        <div style={{ padding: 10, background: '#fff' }}>
                          {loadingPedidosId === inst.id && <p style={{ margin: 0, color: 'var(--muted)' }}>Cargando egresos...</p>}

                          {loadingPedidosId !== inst.id && pedidos.length === 0 && (
                            <p style={{ margin: 0, color: 'var(--muted)' }}>Sin egresos registrados.</p>
                          )}

                          {loadingPedidosId !== inst.id && pedidos.length > 0 && (
                            <ul style={{ margin: 0, paddingLeft: 18 }}>
                              {pedidos.map(p => (
                                <li key={p.id} style={{ marginBottom: 6 }}>
                                  #{p.id} - {p.producto_nombre || '-'} x {p.cantidad} {p.unidad_medida || ''} - Egreso - {new Date(p.created_at).toLocaleDateString('es-AR')}
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

