import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

const FALLBACK_NIVELES = ['INICIAL', 'PRIMARIO', 'SECUNDARIO', 'SUPERIOR']

const INITIAL_FORM = {
  nombre: '',
  email: '',
  password: '',
  role: 'consulta',
  institucion: '',
  cue: '',
  nivel: '',
  director_area_id: '',
  jurisdiccion: ''
}

function normalizeText(value) {
  return String(value || '').trim()
}

function normalizeLevel(value) {
  return normalizeText(value).toUpperCase()
}

export default function Usuarios() {
  const { token, user, hasPermission } = useAuth()
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [instituciones, setInstituciones] = useState([])
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [formOpen, setFormOpen] = useState(false)
  const [roleModal, setRoleModal] = useState(null)
  const [editModal, setEditModal] = useState(null)
  const [form, setForm] = useState(INITIAL_FORM)
  const [cueInfo, setCueInfo] = useState(null)
  const [cueLoading, setCueLoading] = useState(false)

  const isDirectorArea = user?.role === 'director_area'
  const nivelesDisponibles = [...new Set([
    ...instituciones.map((inst) => normalizeText(inst.nivel_educativo)),
    ...users.map((u) => normalizeText(u.nivel_educativo)),
    normalizeText(user?.nivel_educativo),
    ...FALLBACK_NIVELES
  ].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
  const jurisdiccionesDisponibles = [...new Set(instituciones.map((inst) => String(inst.departamento || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
  const directorAreas = users.filter((u) => String(u.role || '').toLowerCase() === 'director_area' && u.activo)

  const isManagedSupervisor = (targetUser) => (
    String(targetUser?.role || '').toLowerCase() === 'supervisor' &&
    Number(targetUser?.director_area_id) === Number(user?.id) &&
    normalizeLevel(targetUser?.nivel_educativo) === normalizeLevel(user?.nivel_educativo)
  )

  const visibleUsers = isDirectorArea
    ? users.filter((targetUser) => isManagedSupervisor(targetUser))
    : users

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

  let availableRoles = roles.length ? roles : ['consulta', 'operador', 'supervisor', 'director_area', 'directivo', 'admin']
  if (isDirectorArea) {
    availableRoles = ['supervisor']
  }

  const selectedCueModalidad = cueInfo?.modalidades?.find((modalidad) => modalidad.nivel_educativo === form.nivel) || null

  const getDirectorAreaDefaultForm = () => ({
    ...INITIAL_FORM,
    role: 'supervisor',
    nivel: normalizeText(user?.nivel_educativo),
    director_area_id: user?.id ? String(user.id) : ''
  })

  const getInitialCreateForm = () => (isDirectorArea ? getDirectorAreaDefaultForm() : INITIAL_FORM)

  const resetCreateForm = () => {
    setForm(getInitialCreateForm())
    setCueInfo(null)
  }

  const openCreateForm = () => {
    setMsg({ text: '', type: '' })
    setForm(getInitialCreateForm())
    setCueInfo(null)
    setFormOpen(true)
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

    let nivelFinal = form.nivel
    let directorAreaIdFinal = form.director_area_id
    let jurisdiccionFinal = form.jurisdiccion

    if (isDirectorArea) {
      if (normalizeText(user?.nivel_educativo) === '') {
        setMsg({ text: 'Su usuario no tiene nivel educativo configurado. Contacte al administrador.', type: 'error' })
        return
      }
      if (form.role !== 'supervisor') {
        setMsg({ text: 'Solo puede crear supervisores', type: 'error' })
        return
      }

      nivelFinal = user.nivel_educativo || ''
      directorAreaIdFinal = user.id
    }

    if (form.role === 'directivo') {
      if (!cueInfo || !selectedCueModalidad) {
        setMsg({ text: 'Debe seleccionar un CUE y nivel validos para Directivo', type: 'error' })
        return
      }
    }

    if (form.role === 'director_area' && !form.nivel) {
      setMsg({ text: 'Debe seleccionar un nivel educativo para Director de Area', type: 'error' })
      return
    }
    if (form.role === 'supervisor') {
      if (!nivelFinal) {
        setMsg({ text: 'Debe seleccionar un nivel educativo para Supervisor', type: 'error' })
        return
      }
      if (!directorAreaIdFinal) {
        setMsg({ text: 'Debe vincular el supervisor a un Area de Direccion', type: 'error' })
        return
      }
    }

    const payload = {
      nombre: form.nombre.trim(),
      email: form.email.trim(),
      password: form.password,
      role: form.role
    }

    if (form.role === 'directivo') {
      payload.institucion = selectedCueModalidad.id
      payload.nivel = form.nivel
    } else if (isDirectorArea) {
      payload.nivel = nivelFinal
      payload.director_area_id = directorAreaIdFinal
    } else {
      if (nivelFinal) payload.nivel = nivelFinal
      if (directorAreaIdFinal) payload.director_area_id = directorAreaIdFinal
      if (jurisdiccionFinal) payload.jurisdiccion = jurisdiccionFinal
    }

    try {
      const res = await apiFetch('/api/users', {
        token,
        method: 'POST',
        body: JSON.stringify(payload)
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg({ text: data.error || 'No se pudo crear usuario', type: 'error' })
        return
      }

      setMsg({ text: 'Usuario creado correctamente', type: 'success' })
      setFormOpen(false)
      resetCreateForm()
      loadUsers()
    } catch {
      setMsg({ text: 'Error de conexion al crear usuario', type: 'error' })
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
  const canCreateUsers = hasPermission('users.create') || isDirectorArea
  const canEditUsers = user?.role === 'admin' || isDirectorArea
  const canChangeRoleForCurrentUser = canChangeRole && !isDirectorArea

  const openEditModal = (targetUser) => {
    setMsg({ text: '', type: '' })
    setEditModal({
      id: targetUser.id,
      role: targetUser.role,
      nombre: targetUser.nombre || '',
      apellido: targetUser.apellido || '',
      email: targetUser.email || '',
      dni: targetUser.dni || '',
      telefono: targetUser.telefono || '',
      nivel: targetUser.nivel_educativo || user?.nivel_educativo || '',
      director_area_id: targetUser.director_area_id || user?.id || '',
      jurisdiccion: targetUser.jurisdiccion || user?.jurisdiccion || '',
      password: '',
      confirmPassword: '',
      error: ''
    })
  }

  const handleSaveUser = async () => {
    if (!editModal) return

    if (!normalizeText(editModal.nombre) || !normalizeText(editModal.email)) {
      setEditModal({ ...editModal, error: 'Nombre e email son obligatorios' })
      return
    }

    if (editModal.password && editModal.password !== editModal.confirmPassword) {
      setEditModal({ ...editModal, error: 'La confirmacion de contrasena no coincide' })
      return
    }

    if (isDirectorArea && normalizeLevel(editModal.nivel) !== normalizeLevel(user?.nivel_educativo)) {
      setEditModal({ ...editModal, error: 'El nivel del supervisor debe coincidir con el suyo' })
      return
    }

    const payload = {
      nombre: normalizeText(editModal.nombre),
      apellido: normalizeText(editModal.apellido) || null,
      email: normalizeText(editModal.email),
      dni: normalizeText(editModal.dni) || null,
      telefono: normalizeText(editModal.telefono) || null,
      nivel: isDirectorArea ? normalizeText(user?.nivel_educativo) : normalizeText(editModal.nivel) || null,
      director_area_id: isDirectorArea ? user?.id : (editModal.director_area_id || null),
      jurisdiccion: normalizeText(editModal.jurisdiccion) || null
    }

    if (normalizeText(editModal.password)) {
      payload.password = editModal.password
    }

    try {
      const res = await apiFetch(`/api/users/${editModal.id}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify(payload)
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setEditModal({ ...editModal, error: data.error || 'No se pudo actualizar el usuario' })
        return
      }

      setEditModal(null)
      setMsg({ text: 'Usuario actualizado correctamente', type: 'success' })
      loadUsers()
    } catch {
      setEditModal({ ...editModal, error: 'Error de conexion' })
    }
  }

  const handleChangeRole = (u) => {
    if (!u) return
    setMsg({ text: '', type: '' })
    setRoleModal({
      id: u.id,
      nombre: u.nombre,
      role: u.role,
      institucion: u.id_institucion || '',
      nivel: u.nivel_educativo || '',
      director_area_id: u.director_area_id || '',
      jurisdiccion: u.jurisdiccion || '',
      error: ''
    })
  }

  const handleSaveRole = async () => {
    if (!roleModal) return

    const nextRole = String(roleModal.role || '').trim()
    if (!nextRole) {
      setRoleModal({ ...roleModal, error: 'Debe seleccionar un rol' })
      return
    }

    if ((nextRole === 'director_area' || nextRole === 'supervisor') && !String(roleModal.nivel || '').trim()) {
      setRoleModal({ ...roleModal, error: 'Debe seleccionar un nivel educativo' })
      return
    }

    if (nextRole === 'supervisor') {
      if (!roleModal.director_area_id) {
        setRoleModal({ ...roleModal, error: 'Debe seleccionar un Area de Direccion' })
        return
      }
    }

    const payload = {
      role: nextRole,
      institucion: roleModal.institucion || null,
      nivel: roleModal.nivel || null,
      director_area_id: roleModal.director_area_id || null,
      jurisdiccion: roleModal.jurisdiccion || null,
    }

    try {
      const res = await apiFetch(`/api/users/${roleModal.id}/role`, {
        token,
        method: 'PATCH',
        body: JSON.stringify(payload)
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setRoleModal({ ...roleModal, error: data.error || 'No se pudo actualizar rol' })
        return
      }

      setRoleModal(null)
      setMsg({ text: 'Rol actualizado correctamente', type: 'success' })
      loadUsers()
    } catch {
      setRoleModal({ ...roleModal, error: 'Error de conexión' })
    }
  }

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

      {canCreateUsers && (
        <div style={{ marginBottom: 24 }}>
          <button
            type="button"
            style={{ width: 'auto', margin: 0, padding: '10px 18px' }}
            onClick={openCreateForm}
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
          {visibleUsers.map((u) => (
            <tr key={u.id}>
              <td>{[u.nombre, u.apellido].filter(Boolean).join(' ') || u.nombre}</td>
              <td>{u.email}</td>
              <td>{u.director_area_nombre ? `${u.director_area_nombre || ''} ${u.director_area_apellido || ''}`.trim() : '-'}</td>
              <td>{u.jurisdiccion || '-'}</td>
              <td>{u.nivel_educativo || '-'}</td>
              <td><span className="badge">{u.role}</span></td>
              <td>{u.activo ? 'Si' : 'No'}</td>
              <td>
                <div className="inline-actions">
                  {canEditUsers && <button onClick={() => openEditModal(u)}>Editar</button>}
                  {canChangeRoleForCurrentUser && <button onClick={() => handleChangeRole(u)}>Rol +</button>}
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

      {formOpen && canCreateUsers && (
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
            if (e.target === e.currentTarget) {
              setFormOpen(false)
              resetCreateForm()
            }
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
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...getInitialCreateForm(), nombre: form.nombre, email: form.email, password: form.password, role: e.target.value })}
                  disabled={isDirectorArea}
                  required
                >
                  {availableRoles.map((roleName) => (
                    <option key={roleName} value={roleName}>{formatRoleLabel(roleName)}</option>
                  ))}
                </select>
              </div>

              {form.role === 'directivo' && (
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
              )}

              {form.role === 'director_area' && (
                <div>
                  <label>Nivel educativo</label>
                  <select value={form.nivel} onChange={(e) => setForm({ ...form, nivel: e.target.value })} required>
                    <option value="">-- Seleccionar nivel --</option>
                    {nivelesDisponibles.map((nivel) => (
                      <option key={nivel} value={nivel}>{nivel}</option>
                    ))}
                  </select>
                </div>
              )}

              {form.role === 'supervisor' && (
                <>
                  {user?.role !== 'director_area' && (
                    <div>
                      <label>Area de Direccion</label>
                      <select value={form.director_area_id} onChange={(e) => {
                        const selected = directorAreas.find((area) => String(area.id) === e.target.value)
                        setForm({
                          ...form,
                          director_area_id: e.target.value,
                          nivel: selected?.nivel_educativo || form.nivel
                        })
                      }} required>
                        <option value="">-- Seleccionar area --</option>
                        {directorAreas.map((area) => (
                          <option key={area.id} value={area.id}>{area.nombre} - {area.nivel_educativo || 'Sin nivel'}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {user?.role === 'director_area' && (
                    <input type="hidden" name="director_area_id" value={user.id} />
                  )}
                  {user?.role === 'director_area' ? (
                    <div>
                      <label>Nivel educativo</label>
                      <select value={user.nivel_educativo || ''} disabled>
                        {nivelesDisponibles
                          .filter((nivel) => nivel === normalizeText(user.nivel_educativo))
                          .map((nivel) => (
                            <option key={nivel} value={nivel}>{nivel}</option>
                          ))}
                      </select>
                      <input type="hidden" name="nivel" value={user.nivel_educativo || ''} />
                    </div>
                  ) : (
                    <div>
                      <label>Nivel educativo</label>
                      <select value={form.nivel} onChange={(e) => setForm({ ...form, nivel: e.target.value })} required>
                        <option value="">-- Seleccionar nivel --</option>
                        {nivelesDisponibles.map((nivel) => (
                          <option key={nivel} value={nivel}>{nivel}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="secondary" onClick={() => {
                  setFormOpen(false)
                  resetCreateForm()
                }}>Cancelar</button>
                <button type="submit" style={{ width: 'auto', margin: 0, padding: '10px 18px' }}>Guardar usuario</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editModal && canEditUsers && (
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
            if (e.target === e.currentTarget) setEditModal(null)
          }}
        >
          <div style={{ background: '#f9fafb', padding: 24, borderRadius: 10, width: 'min(720px, 100%)' }}>
            <h3>Editar usuario</h3>
            <div className="grid">
              <div>
                <label>Nombre</label>
                <input value={editModal.nombre} onChange={(e) => setEditModal({ ...editModal, nombre: e.target.value, error: '' })} />
              </div>
              <div>
                <label>Apellido</label>
                <input value={editModal.apellido} onChange={(e) => setEditModal({ ...editModal, apellido: e.target.value, error: '' })} />
              </div>
              <div>
                <label>Email</label>
                <input type="email" value={editModal.email} onChange={(e) => setEditModal({ ...editModal, email: e.target.value, error: '' })} />
              </div>
              <div>
                <label>DNI</label>
                <input value={editModal.dni} onChange={(e) => setEditModal({ ...editModal, dni: e.target.value.replace(/\D/g, ''), error: '' })} />
              </div>
              <div>
                <label>Telefono</label>
                <input value={editModal.telefono} onChange={(e) => setEditModal({ ...editModal, telefono: e.target.value, error: '' })} />
              </div>
              <div>
                <label>Nivel educativo</label>
                {isDirectorArea ? (
                  <select value={user?.nivel_educativo || ''} disabled>
                    {nivelesDisponibles
                      .filter((nivel) => nivel === normalizeText(user?.nivel_educativo))
                      .map((nivel) => (
                        <option key={nivel} value={nivel}>{nivel}</option>
                      ))}
                  </select>
                ) : (
                  <select value={editModal.nivel || ''} onChange={(e) => setEditModal({ ...editModal, nivel: e.target.value, error: '' })}>
                    <option value="">-- Seleccionar nivel --</option>
                    {nivelesDisponibles.map((nivel) => (
                      <option key={nivel} value={nivel}>{nivel}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label>Jurisdiccion</label>
                <select value={editModal.jurisdiccion || ''} onChange={(e) => setEditModal({ ...editModal, jurisdiccion: e.target.value, error: '' })}>
                  <option value="">-- Seleccionar jurisdiccion --</option>
                  {jurisdiccionesDisponibles.map((jur) => (
                    <option key={jur} value={jur}>{jur}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Nueva contrasena</label>
                <input type="password" value={editModal.password} onChange={(e) => setEditModal({ ...editModal, password: e.target.value, error: '' })} placeholder="Dejar vacia para no cambiar" />
              </div>
              <div>
                <label>Confirmar contrasena</label>
                <input type="password" value={editModal.confirmPassword} onChange={(e) => setEditModal({ ...editModal, confirmPassword: e.target.value, error: '' })} />
              </div>
            </div>

            {editModal.error && <div className="msg show msg-error" style={{ marginTop: 12 }}>{editModal.error}</div>}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button type="button" className="secondary" onClick={() => setEditModal(null)}>Cancelar</button>
              <button type="button" onClick={handleSaveUser} style={{ width: 'auto', margin: 0, padding: '10px 18px' }}>Guardar cambios</button>
            </div>
          </div>
        </div>
      )}

      {roleModal && canChangeRoleForCurrentUser && (
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
                    setRoleModal({
                      ...roleModal,
                      director_area_id: e.target.value,
                      nivel: selected?.nivel_educativo || roleModal.nivel,
                      error: ''
                    })
                  }}>
                    <option value="">-- Seleccionar area --</option>
                    {directorAreas.map((area) => (
                      <option key={area.id} value={area.id}>{area.nombre} - {area.nivel_educativo || 'Sin nivel'}</option>
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
