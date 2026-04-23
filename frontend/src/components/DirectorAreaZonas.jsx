import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import { useAuth } from '../context/AuthContext'

export default function DirectorAreaZonas({ nivelEducativo }) {
  const { token } = useAuth()
  const [zonas, setZonas] = useState([])
  const [nombreZona, setNombreZona] = useState('')
  const [escuelas, setEscuelas] = useState([])
  const [supervisores, setSupervisores] = useState([])
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [zonaSeleccionada, setZonaSeleccionada] = useState(null)
  const [escuelasSeleccionadas, setEscuelasSeleccionadas] = useState([])
  const [supervisoresSeleccionados, setSupervisoresSeleccionados] = useState([])
  // Formulario de nuevo supervisor
  const [nuevoSupervisor, setNuevoSupervisor] = useState({ nombre: '', apellido: '', email: '', dni: '', password: '' })
  // Crear supervisor
  const handleCrearSupervisor = async (e) => {
    e.preventDefault()
    setMsg({ text: '', type: '' })
    const { nombre, apellido, email, dni, password } = nuevoSupervisor
    if (!nombre || !apellido || !email || !dni || !password) {
      setMsg({ text: 'Todos los campos son obligatorios', type: 'error' })
      return
    }
    const res = await apiFetch('/api/director-area/supervisores', {
      token,
      method: 'POST',
      body: JSON.stringify({ nombre, apellido, email, dni, password })
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setMsg({ text: data.error || 'No se pudo crear el supervisor', type: 'error' })
      return
    }
    setNuevoSupervisor({ nombre: '', apellido: '', email: '', dni: '', password: '' })
    setMsg({ text: 'Supervisor creado correctamente', type: 'success' })
    loadData()
  }

  // Cargar zonas, escuelas y supervisores
  const loadData = async () => {
    setMsg({ text: '', type: '' })
    try {
      const zonasRes = await apiFetch('/api/zones', { token })
      const escuelasRes = await apiFetch('/api/director-area/catalogo', { token })
      if (!zonasRes.ok || !escuelasRes.ok) throw new Error('Error cargando datos')
      setZonas(await zonasRes.json())
      setEscuelas((await escuelasRes.json()).escuelas || [])
      setSupervisores((await escuelasRes.json()).supervisores || [])
    } catch (err) {
      setMsg({ text: err.message || 'Error cargando datos', type: 'error' })
    }
  }

  useEffect(() => { loadData() }, [token])

  // Crear zona
  const handleCrearZona = async (e) => {
    e.preventDefault()
    setMsg({ text: '', type: '' })
    if (!nombreZona.trim()) {
      setMsg({ text: 'El nombre es obligatorio', type: 'error' })
      return
    }
    const res = await apiFetch('/api/zones', {
      token,
      method: 'POST',
      body: JSON.stringify({ name: nombreZona.trim(), nivel_educativo: nivelEducativo })
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setMsg({ text: data.error || 'No se pudo crear la zona', type: 'error' })
      return
    }
    setNombreZona('')
    setMsg({ text: 'Zona creada correctamente', type: 'success' })
    loadData()
  }

  // Seleccionar zona
  const handleSeleccionarZona = (zona) => {
    setZonaSeleccionada(zona)
    setEscuelasSeleccionadas([])
    setSupervisoresSeleccionados([])
    setMsg({ text: '', type: '' })
  }

  // Añadir escuelas a zona
  const handleAgregarEscuelas = async (e) => {
    e.preventDefault()
    if (!zonaSeleccionada || escuelasSeleccionadas.length === 0) {
      setMsg({ text: 'Selecciona una zona y al menos una escuela', type: 'error' })
      return
    }
    const res = await apiFetch(`/api/zones/${zonaSeleccionada.id}/escuelas`, {
      token,
      method: 'POST',
      body: JSON.stringify({ escuelaIds: escuelasSeleccionadas })
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setMsg({ text: data.error || 'No se pudieron agregar escuelas', type: 'error' })
      return
    }
    setMsg({ text: 'Escuelas agregadas a la zona', type: 'success' })
    loadData()
  }

  // Añadir supervisores a zona
  const handleAgregarSupervisores = async (e) => {
    e.preventDefault()
    if (!zonaSeleccionada || supervisoresSeleccionados.length === 0) {
      setMsg({ text: 'Selecciona una zona y al menos un supervisor', type: 'error' })
      return
    }
    const res = await apiFetch(`/api/zones/${zonaSeleccionada.id}/supervisores`, {
      token,
      method: 'POST',
      body: JSON.stringify({ supervisorIds: supervisoresSeleccionados })
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setMsg({ text: data.error || 'No se pudieron agregar supervisores', type: 'error' })
      return
    }
    setMsg({ text: 'Supervisores agregados a la zona', type: 'success' })
    loadData()
  }

  return (
    <section style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, background: '#fff', marginBottom: 18 }}>
      <h3>Zonas de Escuelas</h3>
      {msg.text && <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`}>{msg.text}</div>}
      {/* Gestión de supervisores ahora solo desde la sección Usuarios. */}
      <form onSubmit={handleCrearZona} style={{ marginBottom: 18 }}>
        <label>Nombre de la zona</label>
        <input value={nombreZona} onChange={e => setNombreZona(e.target.value)} placeholder="Ej: Zona Norte" />
        <button type="submit">Crear zona</button>
      </form>
      <div style={{ marginBottom: 18 }}>
        <label>Zonas existentes</label>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {zonas.length === 0 ? <li>No hay zonas creadas.</li> : zonas.map(z => (
            <li key={z.id} style={{ marginBottom: 6 }}>
              <button className={zonaSeleccionada && zonaSeleccionada.id === z.id ? 'selected' : ''} onClick={() => handleSeleccionarZona(z)}>
                {z.name} ({z.nivel_educativo})
              </button>
            </li>
          ))}
        </ul>
      </div>
      {zonaSeleccionada && (
        <div style={{ border: '1px solid #eee', borderRadius: 6, padding: 12, marginBottom: 18 }}>
          <h4>Zona: {zonaSeleccionada.name}</h4>
          <form onSubmit={handleAgregarEscuelas} style={{ marginBottom: 12 }}>
            <label>Escuelas para agregar</label>
            <select multiple value={escuelasSeleccionadas} onChange={e => setEscuelasSeleccionadas(Array.from(e.target.selectedOptions, o => o.value))}>
              {escuelas.map(e => <option key={e.id} value={e.id}>{e.nombre} ({e.cue})</option>)}
            </select>
            <button type="submit">Agregar escuelas</button>
          </form>
          <form onSubmit={handleAgregarSupervisores}>
            <label>Supervisores para agregar</label>
            <select multiple value={supervisoresSeleccionados} onChange={e => setSupervisoresSeleccionados(Array.from(e.target.selectedOptions, o => o.value))}>
              {supervisores.map(s => <option key={s.id} value={s.id}>{s.nombre} {s.apellido}</option>)}
            </select>
            <button type="submit">Agregar supervisores</button>
          </form>
        </div>
      )}
    </section>
  )
}
