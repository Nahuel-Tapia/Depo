import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

export default function Usuarios() {
  const { token, user, hasPermission } = useAuth()
  const [users, setUsers] = useState([])
  const [instituciones, setInstituciones] = useState([])
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ nombre: '', email: '', password: '', role: 'consulta', institucion: '' })

  const loadUsers = async () => {
    try {
      const res = await apiFetch('/api/users', { token })
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      } else if (res.status === 403) {
        setMsg('No tiene permiso para ver usuarios')
      }
    } catch { /* ignore */ }
  }

  const loadInstituciones = async () => {
    try {
      const res = await fetch('/api/instituciones/public/list')
      const data = await res.json()
      setInstituciones(data.instituciones || [])
    } catch { /* ignore */ }
  }

  useEffect(() => {
    loadUsers()
    loadInstituciones()
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setMsg('')

    if (form.role === 'directivo' && !form.institucion) {
      setMsg('La institución es obligatoria para rol directivo')
      return
    }

    const payload = {
      nombre: form.nombre.trim(),
      email: form.email.trim(),
      institucion: form.institucion || null,
      password: form.password,
      role: form.role
    }

    const res = await apiFetch('/api/users', {
      token,
      method: 'POST',
      body: JSON.stringify(payload)
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMsg(data.error || 'No se pudo crear usuario')
      return
    }

    setForm({ nombre: '', email: '', password: '', role: 'consulta', institucion: '' })
    loadUsers()
  }

  const handleChangeRole = async (id) => {
    const role = window.prompt('Nuevo rol (admin, directivo, operador, consulta):', 'operador')
    if (!role) return

    let institucion = null
    if (role === 'directivo') {
      institucion = window.prompt('Institución del usuario (obligatoria para directivo):', '')?.trim() || ''
      if (!institucion) {
        setMsg('La institución es obligatoria para rol directivo')
        return
      }
    }

    const res = await apiFetch(`/api/users/${id}/role`, {
      token,
      method: 'PATCH',
      body: JSON.stringify({ role, institucion })
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMsg(data.error || 'No se pudo actualizar rol')
      return
    }

    loadUsers()
  }

  const handleToggleActive = async (id, current) => {
    const res = await apiFetch(`/api/users/${id}/active`, {
      token,
      method: 'PATCH',
      body: JSON.stringify({ activo: !current })
    })

    if (!res.ok) {
      setMsg('No se pudo actualizar estado')
      return
    }

    loadUsers()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('¿Seguro que querés eliminar este usuario?')) return

    const res = await apiFetch(`/api/users/${id}`, { token, method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMsg(data.error || 'No se pudo eliminar usuario')
      return
    }

    setMsg('Usuario eliminado correctamente')
    loadUsers()
  }

  const canChangeRole = hasPermission('users.role.update')
  const canToggleStatus = hasPermission('users.status.update')
  const canDeleteUser = hasPermission('users.delete') && user?.role === 'admin'

  return (
    <div>
      <h2>Gestión de Usuarios</h2>

      {hasPermission('users.create') && (
        <div style={{ background: '#f9fafb', padding: 24, borderRadius: 8, marginBottom: 32 }}>
          <form onSubmit={handleCreate} className="grid">
            <div>
              <label>Nombre Completo</label>
              <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Juan García" required />
            </div>
            <div>
              <label>Correo Electrónico</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="usuario@depo.local" required />
            </div>
            <div>
              <label>Contraseña</label>
              <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="●●●●●●●●" required />
            </div>
            <div>
              <label>Rol</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} required>
                <option value="consulta">Consulta (Solo lectura)</option>
                <option value="operador">Operador</option>
                <option value="directivo">Directivo</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div>
              <label>Institución</label>
              <select value={form.institucion} onChange={e => setForm({ ...form, institucion: e.target.value })}>
                <option value="">-- Seleccionar (obligatorio para directivo) --</option>
                {instituciones.map(inst => (
                  <option key={inst.id} value={inst.id}>{inst.nombre}</option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit">Crear usuario</button>
            </div>
          </form>
        </div>
      )}

      {msg && <div className="msg show msg-error">{msg}</div>}

      <h3>Usuarios Registrados</h3>
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Email</th>
            <th>CUE</th>
            <th>Rol</th>
            <th>Activo</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.nombre}</td>
              <td>{u.email}</td>
              <td>{u.cue || '-'}</td>
              <td><span className="badge">{u.role}</span></td>
              <td>{u.activo ? 'Sí' : 'No'}</td>
              <td>
                <div className="inline-actions">
                  {canChangeRole && <button onClick={() => handleChangeRole(u.id)}>Rol +</button>}
                  {canToggleStatus && (
                    <button onClick={() => handleToggleActive(u.id, u.activo)}>
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  )}
                  {canDeleteUser && Number(u.id) !== Number(user?.id) && (
                    <button onClick={() => handleDelete(u.id)}>Eliminar</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
