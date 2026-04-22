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
    telefono: ''
  })

  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
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
          throw new Error(data.error || 'No se pudo cargar la información')
        }
        const u = data.user || {}
        if (!mounted) return
        setProfile({
          nombre: u.nombre || '',
          apellido: u.apellido || '',
          email: u.email || '',
          telefono: u.telefono || ''
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
  }, [token, logout])

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setProfileMsg({ text: '', type: '' })
    setSavingProfile(true)

    try {
      const res = await apiFetch('/api/users/me', {
        token,
        method: 'PATCH',
        body: JSON.stringify(profile)
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

      const updatedUser = data.user
      if (updatedUser) {
        login(token, { ...user, ...updatedUser })
      }

      setProfileMsg({ text: 'Datos actualizados correctamente', type: 'success' })
    } catch {
      setProfileMsg({ text: 'Error de conexión', type: 'error' })
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPasswordMsg({ text: '', type: '' })

    if (!passwords.currentPassword || !passwords.newPassword) {
      setPasswordMsg({ text: 'Completá la contraseña actual y la nueva', type: 'error' })
      return
    }

    if (passwords.newPassword.length < 6) {
      setPasswordMsg({ text: 'La contraseña nueva debe tener al menos 6 caracteres', type: 'error' })
      return
    }

    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordMsg({ text: 'La confirmación no coincide', type: 'error' })
      return
    }

    setSavingPassword(true)
    try {
      const res = await apiFetch('/api/users/me/password', {
        token,
        method: 'PATCH',
        body: JSON.stringify({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword })
      })

      if (res.status === 401) {
        logout()
        return
      }

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPasswordMsg({ text: data.error || 'No se pudo cambiar la contraseña', type: 'error' })
        return
      }

      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setPasswordMsg({ text: 'Contraseña actualizada', type: 'success' })
    } catch {
      setPasswordMsg({ text: 'Error de conexión', type: 'error' })
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) {
    return <p style={{ color: 'var(--muted)', padding: '24px 0' }}>Cargando mi cuenta...</p>
  }

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Mi cuenta</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <div style={{ background: '#f9fafb', padding: 16, borderRadius: 10 }}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>Mis datos</h3>

          <form onSubmit={handleSaveProfile} className="grid" style={{ gap: 12 }}>
            <div>
              <label>Nombre</label>
              <input value={profile.nombre} onChange={(e) => setProfile(p => ({ ...p, nombre: e.target.value }))} />
            </div>
            <div>
              <label>Apellido</label>
              <input value={profile.apellido} onChange={(e) => setProfile(p => ({ ...p, apellido: e.target.value }))} />
            </div>
            <div>
              <label>Email</label>
              <input type="email" value={profile.email} onChange={(e) => setProfile(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <label>Teléfono</label>
              <input value={profile.telefono} onChange={(e) => setProfile(p => ({ ...p, telefono: e.target.value }))} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit" disabled={savingProfile}>{savingProfile ? 'Guardando...' : 'Guardar cambios'}</button>
            </div>
          </form>

          {profileMsg.text && (
            <div className={`msg show ${profileMsg.type === 'success' ? 'msg-success' : 'msg-error'}`} style={{ marginTop: 10 }}>
              {profileMsg.text}
            </div>
          )}
        </div>

        <div style={{ background: '#f9fafb', padding: 16, borderRadius: 10 }}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>Cambiar contraseña</h3>

          <form onSubmit={handleChangePassword} className="grid" style={{ gap: 12 }}>
            <div>
              <label>Contraseña actual</label>
              <input type="password" value={passwords.currentPassword} onChange={(e) => setPasswords(p => ({ ...p, currentPassword: e.target.value }))} />
            </div>
            <div>
              <label>Contraseña nueva</label>
              <input type="password" value={passwords.newPassword} onChange={(e) => setPasswords(p => ({ ...p, newPassword: e.target.value }))} />
            </div>
            <div>
              <label>Confirmar contraseña nueva</label>
              <input type="password" value={passwords.confirmPassword} onChange={(e) => setPasswords(p => ({ ...p, confirmPassword: e.target.value }))} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit" disabled={savingPassword}>{savingPassword ? 'Guardando...' : 'Cambiar contraseña'}</button>
            </div>
          </form>

          {passwordMsg.text && (
            <div className={`msg show ${passwordMsg.type === 'success' ? 'msg-success' : 'msg-error'}`} style={{ marginTop: 10 }}>
              {passwordMsg.text}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
