import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'
import DirectorAreaGestion from './DirectorAreaGestion'
import DirectorAreaPedidosAnuales from './DirectorAreaPedidosAnuales'
import DirectorAreaZonas from './DirectorAreaZonas'
import DirectorAreaResumenAnual from './DirectorAreaResumenAnual'

export default function DirectorAreaPanel({ initialSection }) {
  const { token, user } = useAuth()
  const [activeSection, setActiveSection] = useState(initialSection || 'zonas')
  const [supervisores, setSupervisores] = useState([])
  const [escuelas, setEscuelas] = useState([])
  const [nivelEducativo, setNivelEducativo] = useState('')
  const [asignaciones, setAsignaciones] = useState([])
  const [informes, setInformes] = useState([])
  const [solicitudes, setSolicitudes] = useState([])
  const [planillas, setPlanillas] = useState([])
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [updatingId, setUpdatingId] = useState(null)
  const [informeForm, setInformeForm] = useState({ supervisor_id: '', asunto: '', detalle: '', fecha_limite: '' })
  const [submissionStatus, setSubmissionStatus] = useState(null)
  
  const anioActual = new Date().getFullYear()

  useEffect(() => {
    if (initialSection && initialSection !== activeSection) {
      setActiveSection(initialSection)
    }
  }, [initialSection])

  const loadSolicitudes = async () => {
    try {
      const res = await apiFetch('/api/supervisor/solicitudes', { token })
      if (res.ok) {
        const data = await res.json()
        setSolicitudes(data.solicitudes || [])
      }
    } catch (err) {}
  }

  const loadAll = async () => {
    try {
      const [catalogoRes, asigRes] = await Promise.all([
        apiFetch('/api/director-area/catalogo', { token }),
        apiFetch('/api/director-area/asignaciones', { token })
      ])

      if (catalogoRes.ok) {
        const catalogo = await catalogoRes.json()
        setSupervisores(catalogo.supervisores || [])
        setEscuelas(catalogo.escuelas || [])
        setNivelEducativo(catalogo.nivel_educativo || '')
      }

      if (asigRes.ok) {
        const asignacionesData = await asigRes.json()
        setAsignaciones(asignacionesData.asignaciones || [])
      }
      
      const statusRes = await apiFetch(`/api/compras/licitacion/anual/enviada-status?anio=${anioActual}`, { token })
      if (statusRes.ok) {
        const data = await statusRes.json()
        setSubmissionStatus(data)
      }

      await loadSolicitudes()
    } catch (err) {}
  }

  useEffect(() => {
    loadAll()
  }, [token])

  const supervisorMap = useMemo(() => {
    const map = {}
    supervisores.forEach((s) => {
      map[String(s.id)] = `${s.nombre || ''} ${s.apellido || ''}`.trim()
    })
    return map
  }, [supervisores])

  const handleAsignar = async (form) => {
    try {
      const res = await apiFetch('/api/director-area/asignaciones', {
        token,
        method: 'POST',
        body: JSON.stringify(form)
      })
      if (res.ok) {
        setMsg({ text: 'Asignación exitosa', type: 'success' })
        loadAll()
      } else {
        const data = await res.json()
        setMsg({ text: data.error || 'Error al asignar', type: 'error' })
      }
    } catch (err) {
      setMsg({ text: 'Error de conexión', type: 'error' })
    }
  }

  const handleSolicitarInforme = async (e) => {
    e.preventDefault()
    // Implementación de solicitud de informe
  }

  return (
    <div className="container fade-in" style={{ padding: '40px 24px', background: 'var(--bg)', minHeight: '100vh', display: 'block' }}>
      <header className="directivo-header" style={{ background: 'var(--secondary-gradient)', padding: '32px 40px', borderRadius: 16, marginBottom: 32, boxShadow: 'var(--shadow-premium)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ color: 'white', margin: 0, fontSize: '2.2rem', fontWeight: 800 }}>Panel Director de Área</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', margin: '8px 0 0 0', fontSize: '1.1rem' }}>
            Nivel {nivelEducativo || 'Educativo'} — Control y Gestión
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 1 }}>Jurisdicción</div>
          <div style={{ color: 'var(--yellow)', fontSize: '1.2rem', fontWeight: 700 }}>{user?.jurisdiccion || 'San Juan'}</div>
        </div>
      </header>

      <div className="tabs" style={{ marginBottom: 32, background: 'white', padding: '0 20px', borderRadius: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <button className={`tab-btn ${activeSection === 'zonas' ? 'active' : ''}`} onClick={() => setActiveSection('zonas')}>
          <span className="tab-icon">🏢</span> <span className="tab-label">Gestión de Zonas</span>
        </button>
        <button className={`tab-btn ${activeSection === 'solicitud_anual' ? 'active' : ''}`} onClick={() => setActiveSection('solicitud_anual')}>
          <span className="tab-icon">📅</span> <span className="tab-label">Solicitud Anual</span>
        </button>
        <button className={`tab-btn ${activeSection === 'resumen' ? 'active' : ''}`} onClick={() => setActiveSection('resumen')}>
          <span className="tab-icon">📊</span> <span className="tab-label">Resumen Anual</span>
        </button>
      </div>

      {msg.text && <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`} style={{ marginBottom: 24 }}>{msg.text}</div>}

      <main>
        {activeSection === 'zonas' && (
          <section className="fade-in">
            <div className="card" style={{ padding: 32, borderRadius: 16, boxShadow: 'var(--shadow-premium)', minHeight: 'auto' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <span style={{ background: 'var(--orange)', color: 'white', width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>📍</span>
                Zonas y Supervisores
              </h2>
              <DirectorAreaZonas nivelEducativo={nivelEducativo} />
              
              <div style={{ marginTop: 40 }}>
                <DirectorAreaGestion
                  nivelEducativo={nivelEducativo}
                  supervisores={supervisores}
                  informes={informes}
                  informeForm={informeForm}
                  setInformeForm={setInformeForm}
                  handleSolicitarInforme={handleSolicitarInforme}
                  msg={msg}
                  supervisorMap={supervisorMap}
                  onAsignar={handleAsignar}
                />
              </div>
            </div>
          </section>
        )}

        {activeSection === 'solicitud_anual' && (
          <section className="fade-in">
            <DirectorAreaPedidosAnuales 
              solicitudes={solicitudes} 
              isSent={submissionStatus?.sent} 
            />
          </section>
        )}

        {activeSection === 'resumen' && (
          <section className="fade-in">
             <div className="card" style={{ padding: 32, borderRadius: 16, boxShadow: 'var(--shadow-premium)', minHeight: 'auto' }}>
               <DirectorAreaResumenAnual 
                 solicitudes={solicitudes} 
                 submissionStatus={submissionStatus}
                 onSent={loadAll}
               />
             </div>
          </section>
        )}
      </main>
    </div>
  )
}
