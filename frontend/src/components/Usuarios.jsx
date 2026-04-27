import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

export default function Usuarios() {
  const { token, user, hasPermission } = useAuth()
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [instituciones, setInstituciones] = useState([])
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [formOpen, setFormOpen] = useState(false)
  const [roleModal, setRoleModal] = useState(null)
  const [form, setForm] = useState({ nombre: '', email: '', password: '', role: 'consulta', institucion: '', cue: '', nivel: '', director_area_id: '', jurisdiccion: '' })
  const [cueInfo, setCueInfo] = useState(null)
  const [cueLoading, setCueLoading] = useState(false)

  const nivelesDisponibles = [...new Set(instituciones.map((inst) => String(inst.nivel_educativo || '').trim()).filter(Boolean))]
  const jurisdiccionesDisponibles = [...new Set(instituciones.map((inst) => String(inst.departamento || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
  const directorAreas = users.filter((u) => String(u.role || '').toLowerCase() === 'director_area' && u.activo)

  const loadUsers = async () => {
    try {
      const res = await apiFetch('/api/users', { token })
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      } else if (res.status === 403) {
        setMsg({ text: 'No tenes permiso para ver usuarios', type: 'error' })
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

  // Si el usuario es director de área, solo puede crear supervisores de su nivel
  let availableRoles = roles.length
    ? roles
    : ['consulta', 'operador', 'supervisor', 'director_area', 'directivo', 'admin']
  if (user?.role === 'director_area') {
    availableRoles = ['supervisor']
  }

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
    setMsg({ text: '', type: '' })

    // Restricción para director de área: solo puede crear supervisores de su nivel
    if (user?.role === 'director_area') {
      if (form.role !== 'supervisor') {
        setMsg({ text: 'Solo puede crear supervisores', type: 'error' })
        return
      }
    }

    if (form.role === 'directivo') {
      if (!cueInfo || !cueInfo.cue) {
        setMsg({ text: 'Debe ingresar un CUE valido para un directivo', type: 'error' })
        return
      }
      if (!form.nivel) {
        setMsg({ text: 'Debe seleccionar un nivel educativo para el CUE', type: 'error' })
        return
      }
    }

    if (form.role === 'director_area' && !form.nivel) {
      setMsg({ text: 'Debe seleccionar un nivel educativo para Director de Area', type: 'error' })
      return
    }
    if (form.role === 'supervisor') {
      if (!form.nivel) {
        setMsg({ text: 'Debe seleccionar un nivel educativo para Supervisor', type: 'error' })
        return
      }
      if (!form.director_area_id) {
        setMsg({ text: 'Debe vincular el supervisor a un Area de Direccion', type: 'error' })
        return
      }
      if (!form.jurisdiccion) {
        setMsg({ text: 'Debe seleccionar una jurisdiccion para Supervisor', type: 'error' })
        return
      }
    }

    // Forzar nivel educativo del director de área al crear supervisor
    let nivelFinal = form.nivel
    if (user?.role === 'director_area') {
      nivelFinal = user.nivel_educativo || ''
    }

    const payload = {
      nombre: form.nombre.trim(),
      email: form.email.trim(),
      password: form.password,
      role: form.role,
    }

    if (form.role === 'directivo') {
      payload.institucion = cueInfo?.id_institucion || ''
      payload.nivel = form.nivel
    }

    if (form.role === 'director_area') {
      payload.nivel = form.nivel
    }

    if (form.role === 'supervisor') {
      payload.nivel = nivelFinal
      payload.director_area_id = user?.role === 'director_area' ? user?.id : form.director_area_id
      payload.jurisdiccion = form.jurisdiccion
    }

    try {
      const res = await apiFetch('/api/users', {
        token,
        method: 'POST',
        body: JSON.stringify(payload)
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg({ text: data.error || 'No se pudo crear el usuario', type: 'error' })
        return
      }

      setMsg({ text: 'Usuario creado correctamente', type: 'success' })
      setFormOpen(false)
      setForm({ nombre: '', email: '', password: '', role: 'consulta', institucion: '', cue: '', nivel: '', director_area_id: '', jurisdiccion: '' })
      setCueInfo(null)
      loadUsers()
    } catch {
      setMsg({ text: 'Error de conexión', type: 'error' })
    }
  }

  const handleToggleActive = async (id, current) => {
    const res = await apiFetch(`/api/users/${id}/active`, {
      token,
      method: 'PATCH',
      body: JSON.stringify({ activo: !current })
    })

    if (!res.ok) {
      setMsg({ text: 'No se pudo actualizar estado', type: 'error' })
      return
    }

    loadUsers()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Seguro que queres eliminar este usuario?')) return

    const res = await apiFetch(`/api/users/${id}`, { token, method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMsg({ text: data.error || 'No se pudo eliminar usuario', type: 'error' })
      return
    }

    setMsg({ text: 'Usuario eliminado correctamente', type: 'success' })
    loadUsers()
  }

  const canChangeRole = hasPermission('users.role.update')
  const canToggleStatus = hasPermission('users.status.update')
  const canDeleteUser = hasPermission('users.delete') && user?.role === 'admin'

  // Permitir acceso a directores de área para crear supervisores
  if (user?.role !== 'admin' && user?.role !== 'director_area') {
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

      {msg.text && (
        <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`}>
          {msg.text}
        </div>
      )}

      <h3>Usuarios Registrados</h3>
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Email</th>
            <th>Area</th>
            <th>Jurisdiccion</th>
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
              <td>{u.director_area_nombre ? `${u.director_area_nombre || ''} ${u.director_area_apellido || ''}`.trim() : '-'}</td>
              <td>{u.jurisdiccion || '-'}</td>
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
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, nivel: '', institucion: '', cue: '', director_area_id: '', jurisdiccion: '' })} required>
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
              ) : form.role === 'supervisor' ? (
                <>
                  {/* Si el usuario es director_area, el area y nivel se asignan automáticamente */}
                  {user?.role !== 'director_area' && (
                    <div>
                      <label>Area de Direccion</label>
                      <select value={form.director_area_id} onChange={(e) => {
                        const selected = directorAreas.find((area) => String(area.id) === e.target.value)
                        setForm({ ...form, director_area_id: e.target.value, nivel: selected?.nivel_educativo || form.nivel })
                      }} required>
                        <option value="">-- Seleccionar area --</option>
                        {directorAreas.map((area) => (
                          <option key={area.id} value={area.id}>{area.nombre} - {area.nivel_educativo || 'Sin nivel'}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {/* Nivel educativo siempre visible para supervisor */}
                  <div>
                    <label>Nivel educativo</label>
                    {user?.role === 'director_area' ? (
                      <>
                        <input type="text" value={user.nivel_educativo || ''} disabled />
                        {/* Campo oculto para enviar el nivel real */}
                        <input type="hidden" name="nivel" value={user.nivel_educativo || ''} />
                      </>
                    ) : (
                      <select value={form.nivel} onChange={(e) => setForm({ ...form, nivel: e.target.value })} required>
                        <option value="">-- Seleccionar nivel --</option>
                        {nivelesDisponibles.map((nivel) => (
                          <option key={nivel} value={nivel}>{nivel}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </>
              ) : null}

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

            {(roleModal.role === 'director_area' || roleModal.role === 'supervisor') && (
              <div style={{ marginTop: 16 }}>
                <label>Nivel educativo</label>
                <select value={roleModal.nivel || ''} onChange={(e) => setRoleModal({ ...roleModal, nivel: e.target.value, error: '' })}>
                  <option value="">-- Seleccionar nivel --</option>
                  {nivelesDisponibles.map((nivel) => (
                    <option key={nivel} value={nivel}>{nivel}</option>
                  ))}
                </select>
              </div>
            )}

            {roleModal.role === 'supervisor' && (
              <>
                <div style={{ marginTop: 16 }}>
                  <label>Area de Direccion</label>
                  <select value={roleModal.director_area_id || ''} onChange={(e) => {
                    const selected = directorAreas.find((area) => String(area.id) === e.target.value)
                    setRoleModal({ ...roleModal, director_area_id: e.target.value, nivel: selected?.nivel_educativo || roleModal.nivel, error: '' })
                  }}>
                    <option value="">-- Seleccionar area --</option>
                    {directorAreas.map((area) => (
                      <option key={area.id} value={area.id}>{area.nombre} - {area.nivel_educativo || 'Sin nivel'}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginTop: 16 }}>
                  <label>Jurisdiccion</label>
                  <select value={roleModal.jurisdiccion || ''} onChange={(e) => setRoleModal({ ...roleModal, jurisdiccion: e.target.value, error: '' })}>
                    <option value="">-- Seleccionar jurisdiccion --</option>
                    {jurisdiccionesDisponibles.map((jur) => (
                      <option key={jur} value={jur}>{jur}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginTop: 16 }}>
                  <label>Nivel educativo</label>
                  <select value={roleModal.nivel} onChange={(e) => setRoleModal({ ...roleModal, nivel: e.target.value, error: '' })}>
                    <option value="">-- Seleccionar nivel --</option>
                    {nivelesDisponibles.map((nivel) => (
                      <option key={nivel} value={nivel}>{nivel}</option>
                    ))}
                  </select>
                </div>
              </>
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
