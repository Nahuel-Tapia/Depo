import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const { login } = useAuth()
  const [nombre, setNombre] = useState('')
  const [cue, setCue] = useState('')
  const [escuela, setEscuela] = useState('')
  const [cueStatus, setCueStatus] = useState({ text: '', color: '' })
  const [numero, setNumero] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState({ text: '', type: '' })

  const handleCueBlur = async () => {
    if (!cue || cue.length !== 9) {
      setEscuela('')
      setCueStatus({ text: '', color: '' })
      return
    }

    try {
      const res = await fetch(`/api/instituciones/public/cue/${cue}`)
      const data = await res.json().catch(() => ({}))

      if (res.ok && data.nombre) {
        setEscuela(data.nombre)
        setCueStatus({ text: '✓ Escuela encontrada', color: '#10b981' })
      } else {
        setEscuela('')
        setCueStatus({ text: data.error || 'Escuela no encontrada', color: '#ef4444' })
      }
    } catch {
      setEscuela('')
      setCueStatus({ text: 'Error al buscar escuela', color: '#ef4444' })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMsg({ text: '', type: '' })

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, cue, numero, password })
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (data.message) {
          setMsg({ text: data.message, type: 'error' })
        } else if (data.error && data.helpCode) {
          setMsg({ text: `${data.error}. Número de ayuda: ${data.helpCode}`, type: 'error' })
        } else {
          setMsg({ text: data.error || 'No se pudo registrar', type: 'error' })
        }
        return
      }

      // Login automático
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cue, password })
      })

      const loginData = await loginRes.json().catch(() => ({}))

      if (!loginRes.ok) {
        setMsg({ text: 'Usuario creado pero hay error al iniciar sesión. Por favor inicia sesión manualmente.', type: 'error' })
        return
      }

      login(loginData.token, loginData.user)
    } catch {
      setMsg({ text: 'Error de conexión', type: 'error' })
    }
  }

  return (
    <main className="container auth-container">
      <section className="card auth-card">
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <img
            src="http://prod.eduge.com.ar/assets/logoGobierno-D5M0tUR9.png"
            alt="Logo Gobierno"
            style={{ width: 300, height: 'auto', display: 'block', margin: '0 auto 32px' }}
          />
          <h1 style={{ textAlign: 'center', marginBottom: 8 }}>Registro Directivo</h1>
          <p className="subtitle" style={{ textAlign: 'center', marginBottom: 32 }}>
            Ingrese sus datos con el CUE de su institución para acceder al sistema.
          </p>

          <form onSubmit={handleSubmit}>
            <div>
              <label>Nombre</label>
              <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required placeholder="Ej: María Gómez" />
            </div>
            <div>
              <label>CUE</label>
              <input
                type="text"
                value={cue}
                onChange={(e) => setCue(e.target.value)}
                onBlur={handleCueBlur}
                required
                placeholder="9 dígitos"
                inputMode="numeric"
                maxLength={9}
                minLength={9}
                pattern="[0-9]{9}"
              />
            </div>
            <div>
              <label>Escuela</label>
              <input type="text" value={escuela} placeholder="Se cargará automáticamente" readOnly disabled />
              {cueStatus.text && (
                <small style={{ fontSize: '0.75rem', color: cueStatus.color, marginTop: 4, display: 'block' }}>
                  {cueStatus.text}
                </small>
              )}
            </div>
            <div>
              <label>Número</label>
              <input type="text" value={numero} onChange={(e) => setNumero(e.target.value)} required placeholder="Ej: 3511234567" />
            </div>
            <div>
              <label>Contraseña</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Mínimo 6 caracteres" />
            </div>
            <button type="submit">Registrarse</button>
            <Link to="/" className="secondary auth-switch-btn auth-switch-link">Volver al inicio</Link>
          </form>

          {msg.text && (
            <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`}>
              {msg.text}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
