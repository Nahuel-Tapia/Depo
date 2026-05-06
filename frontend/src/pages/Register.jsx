import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const { login } = useAuth()
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [cue, setCue] = useState('')
  const [escuela, setEscuela] = useState('')
  const [cueStatus, setCueStatus] = useState({ text: '', color: '' })
  const [modalidades, setModalidades] = useState([])
  const [nivelEducativo, setNivelEducativo] = useState('')
  const [numero, setNumero] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState({ text: '', type: '' })

  const handleCueBlur = async () => {
    if (!cue || cue.length !== 9) {
      setEscuela('')
      setModalidades([])
      setNivelEducativo('')
      setCueStatus({ text: '', color: '' })
      return
    }

    try {
      const res = await fetch(`/api/instituciones/public/cue/${cue}`)
      const data = await res.json().catch(() => ({}))

      if (res.ok && data.nombre) {
        setEscuela(data.nombre)
        setCueStatus({ text: '✓ Escuela encontrada', color: '#10b981' })
        if (data.modalidades && data.modalidades.length > 0) {
          setModalidades(data.modalidades)
          if (data.modalidades.length === 1) {
            setNivelEducativo(data.modalidades[0].nivel_educativo)
          } else {
            setNivelEducativo('')
          }
        } else {
          setModalidades([])
          setNivelEducativo('')
        }
      } else {
        setEscuela('')
        setModalidades([])
        setNivelEducativo('')
        setCueStatus({ text: data.error || 'Escuela no encontrada', color: '#ef4444' })
      }
    } catch {
      setEscuela('')
      setModalidades([])
      setNivelEducativo('')
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
        body: JSON.stringify({ nombre, email, cue, nivel_educativo: nivelEducativo, numero, password })
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
        body: JSON.stringify({ email, cue: '', password })
      })

      const loginData = await loginRes.json().catch(() => ({}))

      if (!loginRes.ok) {
        setMsg({ text: 'Usuario creado, pero hubo un error al iniciar sesión. Por favor, iniciá sesión manualmente.', type: 'error' })
        return
      }

      login(loginData.token, loginData.user)
    } catch {
      setMsg({ text: 'Error de conexión', type: 'error' })
    }
  }

  return (
    <main className="container auth-container">
      <section className="card auth-card" style={{ width: 'min(480px, 100%)' }}>
        <div className="auth-header">
          <img
            src="http://prod.eduge.com.ar/assets/logoGobierno-D5M0tUR9.png"
            alt="San Juan Gobierno"
            className="auth-logo"
          />
          <h1>Registro Directivo</h1>
          <p className="subtitle">Ingrese el CUE de su institución para comenzar</p>
        </div>

          <form onSubmit={handleSubmit}>
            <div>
              <label>Nombre</label>
              <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required placeholder="Ej: María Gómez" />
            </div>
            <div>
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Ej: directivo@escuela.edu.ar" />
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
            {modalidades.length > 0 || nivelEducativo ? (
              <div>
                <label>Nivel Educativo</label>
                {modalidades.length > 1 ? (
                  <select 
                    value={nivelEducativo} 
                    onChange={(e) => setNivelEducativo(e.target.value)} 
                    required
                  >
                    <option value="">Seleccione su modalidad</option>
                    {modalidades.map((m) => (
                      <option key={m.id} value={m.nivel_educativo}>{m.nivel_educativo}</option>
                    ))}
                  </select>
                ) : (
                  <div className="read-only-field">
                    <input 
                      type="text" 
                      value={nivelEducativo} 
                      readOnly 
                    />
                    <span className="field-badge">Nivel Detectado</span>
                  </div>
                )}
              </div>
            ) : null}
            <div>
              <label>Número</label>
              <input type="text" value={numero} onChange={(e) => setNumero(e.target.value)} required placeholder="Ej: 3511234567" />
            </div>
            <div>
              <label>Contraseña</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Mínimo 6 caracteres" />
            </div>
            <button type="submit">Registrarse</button>
            <div style={{ textAlign: 'center', marginTop: 4 }}>
              <Link to="/" className="secondary auth-switch-btn auth-switch-link" style={{ fontSize: '0.85rem' }}>← Volver al inicio</Link>
            </div>
          </form>

          {msg.text && (
            <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`}>
              {msg.text}
            </div>
          )}
      </section>
    </main>
  )
}
