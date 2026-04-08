import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

export default function Instituciones() {
  const { token, hasPermission } = useAuth()
  const [instituciones, setInstituciones] = useState([])
  const [filtered, setFiltered] = useState(null)
  const [buscarCue, setBuscarCue] = useState('')
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [modal, setModal] = useState(null)

  const loadInstituciones = async () => {
    try {
      const res = await apiFetch('/api/instituciones', { token })
      if (res.ok) {
        const data = await res.json()
        setInstituciones(data.instituciones || [])
        setFiltered(null)
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    loadInstituciones()
  }, [])

  const handleBuscar = () => {
    const cue = buscarCue.trim()
    if (!cue) {
      setFiltered(null)
      setMsg({ text: '', type: '' })
      return
    }
    const encontradas = instituciones.filter(i => String(i.cue).includes(cue))
    if (encontradas.length === 0) {
      setMsg({ text: `No se encontró ninguna institución con CUE "${cue}"`, type: 'error' })
    } else {
      setMsg({ text: '', type: '' })
    }
    setFiltered(encontradas)
  }

  const handleLimpiar = () => {
    setBuscarCue('')
    setFiltered(null)
    setMsg({ text: '', type: '' })
  }

  const handleToggle = async (id, activo) => {
    const res = await apiFetch(`/api/instituciones/${id}`, {
      token,
      method: 'PATCH',
      body: JSON.stringify({ activo: !activo })
    })
    if (res.ok) {
      loadInstituciones()
    } else {
      const data = await res.json().catch(() => ({}))
      setMsg({ text: data.error || 'No se pudo actualizar', type: 'error' })
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta institución y sus asignaciones?')) return
    const res = await apiFetch(`/api/instituciones/${id}`, { token, method: 'DELETE' })
    if (res.ok) {
      loadInstituciones()
      setMsg({ text: 'Institución eliminada', type: 'success' })
    } else {
      const data = await res.json().catch(() => ({}))
      setMsg({ text: data.error || 'No se pudo eliminar', type: 'error' })
    }
  }

  const handleEdit = async (id) => {
    const inst = instituciones.find(i => i.id === id)
    if (!inst) return
    const nuevoMatriculados = window.prompt(`Editar matrícula de ${inst.nombre}:`, inst.matriculados)
    if (nuevoMatriculados === null) return

    const res = await apiFetch(`/api/instituciones/${id}`, {
      token,
      method: 'PATCH',
      body: JSON.stringify({ matriculados: parseInt(nuevoMatriculados, 10) || 0 })
    })

    if (res.ok) {
      loadInstituciones()
      setMsg({ text: 'Institución actualizada', type: 'success' })
    } else {
      const data = await res.json().catch(() => ({}))
      setMsg({ text: data.error || 'No se pudo actualizar', type: 'error' })
    }
  }

  const handleVerAsignaciones = async (id) => {
    const inst = instituciones.find(i => i.id === id)
    if (!inst) return

    const res = await apiFetch(`/api/instituciones/${id}/asignaciones`, { token })
    if (!res.ok) {
      setMsg({ text: 'No se pudieron cargar asignaciones', type: 'error' })
      return
    }

    const data = await res.json()
    setModal({ inst, asignaciones: data.asignaciones || [] })
  }

  const items = filtered !== null ? filtered : instituciones
  const canEdit = hasPermission('instituciones.edit')
  const canDelete = hasPermission('instituciones.delete')
  const canAsignar = hasPermission('instituciones.asignar')

  return (
    <div>
      <h2>Instituciones</h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <input
          type="text"
          value={buscarCue}
          onChange={e => setBuscarCue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleBuscar()}
          placeholder="Buscar por CUE..."
          style={{ width: 220, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
          maxLength={9}
        />
        <button onClick={handleBuscar} style={{ padding: '8px 16px' }}>Buscar</button>
        <button onClick={handleLimpiar} className="secondary" style={{ padding: '8px 16px' }}>Ver todas</button>
        {msg.text && (
          <span className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`} style={{ flex: 1 }}>{msg.text}</span>
        )}
      </div>

      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 10 }}>
        Mostrando {items.length} de {instituciones.length} instituciones
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>CUE</th>
              <th>Nombre</th>
              <th>Nivel</th>
              <th>Dirección</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map(inst => {
              const direccion = [inst.direccion, inst.localidad, inst.departamento].filter(Boolean).join(' - ') || '-'
              return (
                <tr key={inst.id}>
                  <td>{inst.id}</td>
                  <td>{inst.cue}</td>
                  <td>{inst.nombre.trim()}</td>
                  <td>{inst.nivel || '-'}</td>
                  <td>{direccion}</td>
                  <td>
                    <div className="inline-actions">
                      {canEdit && <button onClick={() => handleEdit(inst.id)}>Editar</button>}
                      {canEdit && (
                        <button onClick={() => handleToggle(inst.id, inst.activo)}>
                          {inst.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      )}
                      {canAsignar && <button onClick={() => handleVerAsignaciones(inst.id)}>Asignaciones</button>}
                      {canDelete && <button onClick={() => handleDelete(inst.id)}>Eliminar</button>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => { if (e.target === e.currentTarget) setModal(null) }}
        >
          <div style={{ background: 'white', padding: 24, borderRadius: 8, maxWidth: 600, maxHeight: '80vh', overflow: 'auto' }}>
            <h4>Asignaciones de {modal.inst.nombre} (CUE: {modal.inst.cue})</h4>
            {modal.asignaciones.length === 0 ? (
              <p>No hay asignaciones registradas.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Período</th>
                    <th>Asignado</th>
                    <th>Entregado</th>
                    <th>Pendiente</th>
                  </tr>
                </thead>
                <tbody>
                  {modal.asignaciones.map((a, i) => (
                    <tr key={i}>
                      <td>{a.producto_nombre}</td>
                      <td>{a.periodo}</td>
                      <td>{a.cantidad_asignada}</td>
                      <td>{a.cantidad_entregada}</td>
                      <td>{a.pendiente}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <button onClick={() => setModal(null)} style={{ marginTop: 16 }}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  )
}
