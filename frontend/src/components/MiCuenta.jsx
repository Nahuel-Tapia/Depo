import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

export default function MiCuenta() {
  const { user, token, login, logout } = useAuth()
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [profileMsg, setProfileMsg] = useState({ text: '', type: '' })
  const [passwordMsg, setPasswordMsg] = useState({ text: '', type: '' })

  const [profile, setProfile] = useState({
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
  })

  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoading(true)

      try {
        const res = await apiFetch('/api/users/me', { token })
        if (res.status === 401) {
          logout()
          return
        }

        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data.error || 'No se pudo cargar la informacion')
        }

        const nextUser = data.user || {}
        if (!mounted) return

        setProfile({
          nombre: nextUser.nombre || '',
          apellido: nextUser.apellido || '',
          email: nextUser.email || '',
          telefono: nextUser.telefono || '',
        })
      } catch (err) {
        if (!mounted) return
        setProfileMsg({ text: err.message || 'Error al cargar', type: 'error' })
      } finally {
        if (mounted) setLoading(false)
      }
    }

    if (token) load()

    return () => {
      mounted = false
    }
  }, [logout, token])

  const handleSaveProfile = async (event) => {
    event.preventDefault()
    setProfileMsg({ text: '', type: '' })
    setSavingProfile(true)

    try {
      const res = await apiFetch('/api/users/me', {
        token,
        method: 'PATCH',
        body: JSON.stringify(profile),
      })

      if (res.status === 401) {
        logout()
        return
      }

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setProfileMsg({ text: data.error || 'No se pudo guardar', type: 'error' })
        return
      }

      if (data.user) {
        login(token, { ...user, ...data.user })
      }

      setProfileMsg({ text: 'Datos actualizados correctamente', type: 'success' })
    } catch {
      setProfileMsg({ text: 'Error de conexion', type: 'error' })
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async (event) => {
    event.preventDefault()
    setPasswordMsg({ text: '', type: '' })

    if (!passwords.currentPassword || !passwords.newPassword) {
      setPasswordMsg({ text: 'Completa la contrasena actual y la nueva', type: 'error' })
      return
    }

    if (passwords.newPassword.length < 6) {
      setPasswordMsg({ text: 'La contrasena nueva debe tener al menos 6 caracteres', type: 'error' })
      return
    }

    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordMsg({ text: 'La confirmacion no coincide', type: 'error' })
      return
    }

    setSavingPassword(true)

    try {
      const res = await apiFetch('/api/users/me/password', {
        token,
        method: 'PATCH',
        body: JSON.stringify({
          currentPassword: passwords.currentPassword,
          newPassword: passwords.newPassword,
        }),
      })

      if (res.status === 401) {
        logout()
        return
      }

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPasswordMsg({ text: data.error || 'No se pudo cambiar la contrasena', type: 'error' })
        return
      }

      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setPasswordMsg({ text: 'Contrasena actualizada', type: 'success' })
    } catch {
      setPasswordMsg({ text: 'Error de conexion', type: 'error' })
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) {
    return <p className="dashboard-muted-copy">Cargando mi cuenta...</p>
  }

  return (
    <div className="dashboard-stack">
      <div className="dashboard-page-header">
        <div>
          <h2>Mi cuenta</h2>
          <p>Actualiza tus datos personales y la seguridad de acceso.</p>
        </div>
      </div>

      <div className="dashboard-section-grid">
        <section className="dashboard-section-card dashboard-section-card--span-6">
          <div className="dashboard-subsection-header">
            <h3>Mis datos</h3>
            <p>Informacion visible de tu perfil.</p>
          </div>

          <form onSubmit={handleSaveProfile} className="grid">
            <div>
              <label>Nombre</label>
              <input value={profile.nombre} onChange={(event) => setProfile((prev) => ({ ...prev, nombre: event.target.value }))} />
            </div>
            <div>
              <label>Apellido</label>
              <input value={profile.apellido} onChange={(event) => setProfile((prev) => ({ ...prev, apellido: event.target.value }))} />
            </div>
            <div>
              <label>Email</label>
              <input type="email" value={profile.email} onChange={(event) => setProfile((prev) => ({ ...prev, email: event.target.value }))} />
            </div>
            <div>
              <label>Telefono</label>
              <input value={profile.telefono} onChange={(event) => setProfile((prev) => ({ ...prev, telefono: event.target.value }))} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit" disabled={savingProfile}>
                {savingProfile ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>

          {profileMsg.text && (
            <div className={`msg show ${profileMsg.type === 'success' ? 'msg-success' : 'msg-error'}`}>
              {profileMsg.text}
            </div>
          )}
        </section>

        <section className="dashboard-section-card dashboard-section-card--span-6">
          <div className="dashboard-subsection-header">
            <h3>Cambiar contrasena</h3>
            <p>Mantene protegida tu cuenta.</p>
          </div>

          <form onSubmit={handleChangePassword} className="grid">
            <div>
              <label>Contrasena actual</label>
              <input type="password" value={passwords.currentPassword} onChange={(event) => setPasswords((prev) => ({ ...prev, currentPassword: event.target.value }))} />
            </div>
            <div>
              <label>Contrasena nueva</label>
              <input type="password" value={passwords.newPassword} onChange={(event) => setPasswords((prev) => ({ ...prev, newPassword: event.target.value }))} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label>Confirmar contrasena nueva</label>
              <input type="password" value={passwords.confirmPassword} onChange={(event) => setPasswords((prev) => ({ ...prev, confirmPassword: event.target.value }))} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit" disabled={savingPassword}>
                {savingPassword ? 'Guardando...' : 'Cambiar contrasena'}
              </button>
            </div>
          </form>

          {passwordMsg.text && (
            <div className={`msg show ${passwordMsg.type === 'success' ? 'msg-success' : 'msg-error'}`}>
              {passwordMsg.text}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
