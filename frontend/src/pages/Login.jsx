import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState({ text: '', type: '' })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMsg({ text: '', type: '' })

    const cue = /^\d+$/.test(email.trim()) ? email.trim() : ''

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), cue, password })
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        const invalidCredentialsCodes = ['INVALID_PASSWORD', 'INVALID_CREDENTIALS']
        const errorText = String(data.error || '').toLowerCase()
        const isInvalidCredentialsText = errorText.includes('credenciales') && errorText.includes('invalid')
        const shouldUseUnifiedMessage = invalidCredentialsCodes.includes(data.code) || res.status === 401 || isInvalidCredentialsText

        const message = shouldUseUnifiedMessage
          ? 'Contraseña o usuario incorrectos'
          : (data.error || 'No se pudo iniciar sesión. Intente nuevamente en unos minutos.')

        setMsg({ text: message, type: 'error' })
        return
      }

      login(data.token, data.user)
    } catch {
      setMsg({ text: 'Error de conexión', type: 'error' })
    }
  }

  return (
    <main className="container auth-container">
      <section className="card auth-card">
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img
            src="http://prod.eduge.com.ar/assets/logoGobierno-D5M0tUR9.png"
            alt="San Juan Gobierno"
            style={{ height: 48, width: 'auto', marginBottom: 20 }}
          />
          <h1 style={{ marginBottom: 4 }}>Depósito</h1>
          <p className="subtitle" style={{ marginBottom: 0 }}>Control de Stock</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div>
            <label>CUE o Correo Electrónico</label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@depo.local"
            />
          </div>
          <div>
            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="●●●●●●●●"
            />
          </div>
          <button type="submit">Iniciar sesión</button>
          {msg.text && (
            <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`}>
              {msg.text}
            </div>
          )}
        </form>

        <div className="auth-divider"></div>
        <div className="auth-alt-action">
          <p className="auth-helper">¿Sos directivo y no tenés cuenta?</p>
          <Link to="/registro" className="register-institution-btn auth-switch-link">
            Registrarse
          </Link>
        </div>
      </section>
    </main>
  )
}
