import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

export default function Usuarios() {
  const { token, user, hasPermission } = useAuth()
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [instituciones, setInstituciones] = useState([])
  const [msg, setMsg] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [roleModal, setRoleModal] = useState(null)
  const [form, setForm] = useState({ nombre: '', email: '', password: '', role: 'consulta', institucion: '', cue: '', nivel: '' })
  const [cueInfo, setCueInfo] = useState(null)
  const [cueLoading, setCueLoading] = useState(false)

  const nivelesDisponibles = [...new Set(instituciones.map((inst) => String(inst.nivel_educativo || '').trim()).filter(Boolean))]

  const loadUsers = async () => {
    try {
      const res = await apiFetch('/api/users', { token })
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      } else if (res.status === 403) {
        setMsg('No tenes permiso para ver usuarios')
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
    if (form.role === 'directivo' && form.cue && form.cue.length === 9) {
      setCueLoading(true)
      fetch(`/api/instituciones/public/cue/${form.cue}`)
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          setCueInfo(data)
          setCueLoading(false)
        })
        .catch(() => {
          setCueInfo(null)
          setCueLoading(false)
        })
    } else {
      setCueInfo(null)
    }
  }, [form.cue, form.role])

  const loadRoles = async () => {
    try {
      const res = await apiFetch('/api/roles', { token })
      if (res.ok) {
        const data = await res.json()
        const roleNames = (data.roles || []).map((r) => r.nombre).filter(Boolean)
        setRoles(roleNames)
      }
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadUsers()
    loadInstituciones()
    loadRoles()
  }, [])

  const availableRoles = roles.length
    ? roles
    : ['consulta', 'operador', 'supervisor', 'director_area', 'directivo', 'admin']

  const formatRoleLabel = (roleName) => {
    const normalized = String(roleName || '').toLowerCase()
    const labels = {
      admin: 'Administrador',
      supervisor: 'Supervisor',
      director_area: 'Director de Area',
      directivo: 'Directivo',
      operador: 'Operador',
      consulta: 'Consulta'
    }
    return labels[normalized] || normalized.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setMsg('')

    if (form.role === 'directivo') {
      if (!cueInfo || !cueInfo.cue) {
        setMsg('Debe ingresar un CUE valido para un directivo')
        return
      }
      if (!form.nivel) {
        setMsg('Debe seleccionar un nivel educativo para el CUE')
        return
      }
    }

    if (form.role === 'director_area' && !form.nivel) {
      setMsg('Debe seleccionar un nivel educativo para Director de Area')
      return
    }

    const payload = {
      nombre: form.nombre.trim(),
      email: form.email.trim(),
      password: form.password,
      role: form.role,
      institucion: form.role === 'directivo' && cueInfo
        ? cueInfo.modalidades.find((m) => m.nivel_educativo === form.nivel)?.id
        : (form.institucion || null),
      cue: form.role === 'directivo' ? form.cue : undefined,
      nivel: ['directivo', 'director_area'].includes(form.role) ? form.nivel : undefined
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

    setForm({ nombre: '', email: '', password: '', role: 'consulta', institucion: '', cue: '', nivel: '' })
    setFormOpen(false)
    loadUsers()
  }

  const handleChangeRole = async (u) => {
    setRoleModal({
      id: u.id,
      nombre: u.nombre,
      role: u.role || 'consulta',
      institucion: '',
      nivel: u.nivel_educativo || '',
      error: ''
    })
  }

  const handleSaveRole = async () => {
    if (!roleModal) return

    const role = roleModal.role
    const institucion = roleModal.institucion || null
    const nivel = roleModal.nivel || null

    if (role === 'directivo' && !institucion) {
      setRoleModal({ ...roleModal, error: 'La institucion es obligatoria para rol directivo' })
      return
    }
    if (role === 'director_area' && !nivel) {
      setRoleModal({ ...roleModal, error: 'El nivel educativo es obligatorio para Director de Area' })
      return
    }

    const res = await apiFetch(`/api/users/${roleModal.id}/role`, {
      token,
      method: 'PATCH',
      body: JSON.stringify({ role, institucion, nivel })
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setRoleModal({ ...roleModal, error: data.error || 'No se pudo actualizar rol' })
      return
    }

    setRoleModal(null)
    setMsg('Rol actualizado correctamente')
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
    if (!window.confirm('Seguro que queres eliminar este usuario?')) return

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

  if (user?.role !== 'admin') {
    return (
      <div>
        <h2>Gestion de Usuarios</h2>
        <div className="msg show msg-error">No tenes permiso para acceder a esta seccion.</div>
      </div>
    )
  }

  return (
    <div>
      <h2>Gestion de Usuarios</h2>

      {hasPermission('users.create') && (
        <div style={{ marginBottom: 24 }}>
          <button
            type="button"
            style={{ width: 'auto', margin: 0, padding: '10px 18px' }}
            onClick={() => setFormOpen(true)}
          >
            Crear usuario
          </button>
        </div>
      )}

      {msg && <div className="msg show msg-error">{msg}</div>}

      <h3>Usuarios Registrados</h3>
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Email</th>
            <th>Nivel</th>
            <th>Rol</th>
            <th>Activo</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.nombre}</td>
              <td>{u.email}</td>
              <td>{u.nivel_educativo || '-'}</td>
              <td><span className="badge">{u.role}</span></td>
              <td>{u.activo ? 'Si' : 'No'}</td>
              <td>
                <div className="inline-actions">
                  {canChangeRole && <button onClick={() => handleChangeRole(u)}>Rol +</button>}
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

      {formOpen && hasPermission('users.create') && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setFormOpen(false)
          }}
        >
          <div style={{ background: '#f9fafb', padding: 24, borderRadius: 10, width: 'min(720px, 100%)' }}>
            <h3>Crear usuario</h3>
            <form onSubmit={handleCreate} className="grid">
              <div>
                <label>Nombre Completo</label>
                <input type="text" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Juan Garcia" required />
              </div>
              <div>
                <label>Correo Electronico</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="usuario@depo.local" required />
              </div>
              <div>
                <label>Contrasena</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </div>
              <div>
                <label>Rol</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, nivel: '', institucion: '', cue: '' })} required>
                  {availableRoles.map((roleName) => (
                    <option key={roleName} value={roleName}>{formatRoleLabel(roleName)}</option>
                  ))}
                </select>
              </div>

              {form.role === 'directivo' ? (
                <>
                  <div>
                    <label>CUE</label>
                    <input
                      type="text"
                      value={form.cue}
                      onChange={(e) => setForm({ ...form, cue: e.target.value.replace(/\D/g, '').slice(0, 9), nivel: '' })}
                      placeholder="Ingresar CUE (9 digitos)"
                      required
                    />
                  </div>
                  {cueLoading && <div style={{ color: '#888', fontSize: 13 }}>Buscando CUE...</div>}
                  {cueInfo && cueInfo.nombre && (
                    <div style={{ marginTop: 6 }}>
                      <div><b>Escuela:</b> {cueInfo.nombre}</div>
                      <label style={{ marginTop: 8 }}>Nivel educativo</label>
                      <select value={form.nivel} onChange={(e) => setForm({ ...form, nivel: e.target.value })} required>
                        <option value="">-- Seleccionar nivel --</option>
                        {cueInfo.modalidades.map((m) => (
                          <option key={m.id} value={m.nivel_educativo}>{m.nivel_educativo}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {cueInfo && !cueInfo.nombre && <div style={{ color: 'red', fontSize: 13 }}>CUE no encontrado</div>}
                </>
              ) : form.role === 'director_area' ? (
                <div>
                  <label>Nivel educativo</label>
                  <select value={form.nivel} onChange={(e) => setForm({ ...form, nivel: e.target.value })} required>
                    <option value="">-- Seleccionar nivel --</option>
                    {nivelesDisponibles.map((nivel) => (
                      <option key={nivel} value={nivel}>{nivel}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label>Institucion</label>
                  <select value={form.institucion} onChange={(e) => setForm({ ...form, institucion: e.target.value })}>
                    <option value="">-- Seleccionar --</option>
                    {instituciones.map((inst) => (
                      <option key={inst.id} value={inst.id}>{inst.nombre}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="secondary" onClick={() => setFormOpen(false)}>Cancelar</button>
                <button type="submit" style={{ width: 'auto', margin: 0, padding: '10px 18px' }}>Guardar usuario</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {roleModal && canChangeRole && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setRoleModal(null)
          }}
        >
          <div style={{ background: '#f9fafb', padding: 24, borderRadius: 10, width: 'min(560px, 100%)' }}>
            <h3>Cambiar rol</h3>
            <p style={{ marginTop: 8, marginBottom: 16 }}>Usuario: {roleModal.nombre}</p>

            <label style={{ marginTop: 0 }}>Seleccionar rol</label>
            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              {availableRoles.map((roleName) => (
                <label key={roleName} style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', letterSpacing: 0, fontSize: '0.95rem', margin: 0 }}>
                  <input
                    type="radio"
                    name="rol_usuario"
                    value={roleName}
                    checked={roleModal.role === roleName}
                    onChange={(e) => setRoleModal({ ...roleModal, role: e.target.value, error: '' })}
                    style={{ width: 16, minHeight: 16, margin: 0 }}
                  />
                  {formatRoleLabel(roleName)}
                </label>
              ))}
            </div>

            {roleModal.role === 'directivo' && (
              <div style={{ marginTop: 16 }}>
                <label>Institucion</label>
                <select value={roleModal.institucion} onChange={(e) => setRoleModal({ ...roleModal, institucion: e.target.value, error: '' })}>
                  <option value="">-- Seleccionar institucion --</option>
                  {instituciones.map((inst) => (
                    <option key={inst.id} value={inst.id}>{inst.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            {roleModal.role === 'director_area' && (
              <div style={{ marginTop: 16 }}>
                <label>Nivel educativo</label>
                <select value={roleModal.nivel} onChange={(e) => setRoleModal({ ...roleModal, nivel: e.target.value, error: '' })}>
                  <option value="">-- Seleccionar nivel --</option>
                  {nivelesDisponibles.map((nivel) => (
                    <option key={nivel} value={nivel}>{nivel}</option>
                  ))}
                </select>
              </div>
            )}

            {roleModal.error && <div className="msg show msg-error" style={{ marginTop: 12 }}>{roleModal.error}</div>}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button type="button" className="secondary" onClick={() => setRoleModal(null)}>Cancelar</button>
              <button type="button" onClick={handleSaveRole} style={{ width: 'auto', margin: 0, padding: '10px 18px' }}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
