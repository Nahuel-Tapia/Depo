import { useMemo } from 'react'
import { useAuth } from '../context/AuthContext'

export default function DirectorAreaDashboard({ escuelas = [], supervisores = [], solicitudes = [], submissionStatus = {}, nivelEducativo = '', asignaciones = [], onNavigate }) {
  const { user } = useAuth()
  const anioActual = new Date().getFullYear()

  const metrics = useMemo(() => {
    const totalEscuelas = escuelas.length
    const totalSupervisores = supervisores.length

    const anuales = solicitudes.filter(s => (s.tipo || 'anual') === 'anual')
    const aprobadas = anuales.filter(s => s.estado === 'aprobado').length
    const pendientesDirector = anuales.filter(s => s.estado === 'pendiente_director').length
    const enProceso = anuales.filter(s => s.estado === 'pendiente' || s.estado === 'borrador').length

    const escuelasConSolicitud = new Set(anuales.map(s => s.institucion_id))
    const sinSolicitud = escuelas.filter(e => !escuelasConSolicitud.has(e.id)).length
    const avancePct = totalEscuelas > 0 ? Math.round((aprobadas / totalEscuelas) * 100) : 0

    return { totalEscuelas, totalSupervisores, aprobadas, pendientesDirector, enProceso, sinSolicitud, avancePct, envioFinal: submissionStatus?.sent || false }
  }, [escuelas, supervisores, solicitudes, submissionStatus])

  const solicitudesPendientesDirector = useMemo(() =>
    solicitudes.filter(s => (s.tipo || 'anual') === 'anual' && s.estado === 'pendiente_director').slice(0, 5),
    [solicitudes]
  )

  const estadoPorSupervisor = useMemo(() => {
    return supervisores.map(sup => {
      const escuelasAsig = asignaciones.filter(a => String(a.supervisor_id) === String(sup.id)).map(a => a.institucion_id)
      const total = escuelasAsig.length
      const aprobadas = solicitudes.filter(s => escuelasAsig.includes(s.institucion_id) && s.estado === 'aprobado').length
      const pendientes = solicitudes.filter(s => escuelasAsig.includes(s.institucion_id) && s.estado === 'pendiente_director').length
      return { id: sup.id, nombre: `${sup.nombre || ''} ${sup.apellido || ''}`.trim(), total, aprobadas, pendientes, pct: total > 0 ? Math.round((aprobadas / total) * 100) : 0 }
    }).filter(s => s.total > 0)
  }, [supervisores, asignaciones, solicitudes])

  const chartData = useMemo(() => {
    const { totalEscuelas, aprobadas, enProceso, pendientesDirector, sinSolicitud } = metrics
    if (totalEscuelas === 0) return { aprobadasPct: 0, pendDirPct: 0, enProcesoPct: 0, sinSolicitudPct: 0 }
    return {
      aprobadasPct: (aprobadas / totalEscuelas) * 100,
      pendDirPct: (pendientesDirector / totalEscuelas) * 100,
      enProcesoPct: (enProceso / totalEscuelas) * 100,
      sinSolicitudPct: (sinSolicitud / totalEscuelas) * 100
    }
  }, [metrics])

  return (
    <div className="fade-in" style={{ padding: '4px 0 24px' }}>

      {/* Banner Hero Premium */}
      <section className="dashboard-hero" style={{ marginBottom: '28px' }}>
        <div className="dashboard-hero-copy">
          <span className="dashboard-hero-chip">Director de Área</span>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '8px 0 6px', color: '#ffffff' }}>
            Bienvenido, {user?.nombre || 'Director'}
          </h2>
          <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.95rem' }}>
            Supervisión, gestión de zonas y consolidación de solicitudes anuales de material escolar.
          </p>
        </div>

        <div className="dashboard-hero-aside">
          <div className="dashboard-status-list" style={{ width: '100%' }}>
            <div className="dashboard-status-row">
              <span className="dashboard-status-label">Nivel Educativo</span>
              <span className="dashboard-status-value" style={{ fontWeight: 700 }}>{nivelEducativo || 'No asignado'}</span>
            </div>
            <div className="dashboard-status-row">
              <span className="dashboard-status-label">Ciclo Lectivo</span>
              <span className="dashboard-status-value" style={{ fontWeight: 700 }}>{anioActual}</span>
            </div>
            <div className="dashboard-status-row">
              <span className="dashboard-status-label">Nivel Educativo</span>
              <span className="dashboard-status-value" style={{ fontWeight: 700 }}>{user?.nivel_educativo || 'General'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '28px' }}>

        <div className="dashboard-stat-card dashboard-stat-card-clickable" onClick={() => onNavigate('gestion-escuelas')}>
          <div className="dashboard-stat-icon" style={{ background: 'rgba(30, 58, 138, 0.08)', color: '#1e3a8a' }}>
            <BuildingIcon />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="dashboard-stat-label">Total Escuelas</span>
            <span className="dashboard-stat-value">{metrics.totalEscuelas}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 4 }}>
              {metrics.totalSupervisores} supervisor{metrics.totalSupervisores !== 1 ? 'es' : ''} asignado{metrics.totalSupervisores !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="dashboard-stat-card dashboard-stat-card-clickable" onClick={() => onNavigate('solicitud-anual')}>
          <div className="dashboard-stat-icon" style={{ background: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}>
            <ClipboardIcon />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
            <span className="dashboard-stat-label">Aprobadas Final</span>
            <span className="dashboard-stat-value" style={{ color: '#10b981' }}>{metrics.aprobadas}</span>
            <div style={{ marginTop: 8, width: '100%' }}>
              <div style={{ height: 6, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${metrics.avancePct}%`, background: '#10b981', borderRadius: 4, transition: 'width 0.5s ease' }} />
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 6, fontWeight: 500 }}>
                {metrics.avancePct}% del total de escuelas
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-stat-card dashboard-stat-card-clickable" 
          onClick={() => onNavigate('solicitud-anual')}
          style={{
            borderColor: metrics.pendientesDirector > 0 ? '#f59e0b' : 'var(--border)',
            background: metrics.pendientesDirector > 0 ? '#fffbeb' : 'white',
          }}
        >
          <div className="dashboard-stat-icon" style={{ 
            background: metrics.pendientesDirector > 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(29, 37, 45, 0.05)', 
            color: metrics.pendientesDirector > 0 ? '#d97706' : 'var(--muted)' 
          }}>
            <AlertTriangleIcon />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="dashboard-stat-label">Pendientes mi aprobación</span>
            <span className="dashboard-stat-value" style={{ color: metrics.pendientesDirector > 0 ? '#d97706' : 'var(--dark)' }}>
              {metrics.pendientesDirector}
            </span>
            <span style={{ 
              fontSize: '0.8rem', 
              color: metrics.pendientesDirector > 0 ? '#b45309' : 'var(--muted)', 
              fontWeight: metrics.pendientesDirector > 0 ? 600 : 400,
              marginTop: 4 
            }}>
              {metrics.pendientesDirector > 0 ? '⚠ Requieren tu atención' : 'Al día'}
            </span>
          </div>
        </div>

        <div className="dashboard-stat-card">
          <div className="dashboard-stat-icon" style={{ 
            background: metrics.envioFinal ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)', 
            color: metrics.envioFinal ? '#10b981' : '#d97706' 
          }}>
            {metrics.envioFinal ? <CheckIcon /> : <ClockIcon />}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="dashboard-stat-label">Estado Envío Final</span>
            <div style={{ marginTop: 8 }}>
              {metrics.envioFinal
                ? <span style={{ background: '#d1fae5', color: '#065f46', padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>✓ Enviado</span>
                : <span style={{ background: '#fef3c7', color: '#92400e', padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>⌛ Pendiente</span>
              }
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 8 }}>
              {metrics.envioFinal ? 'Consolidado enviado a Compras' : 'Esperando aprobación final'}
            </span>
          </div>
        </div>

      </div>

      {/* Barra de avance + alerta */}
      <div style={{ display: 'grid', gridTemplateColumns: solicitudesPendientesDirector.length > 0 ? '1fr 1fr' : '1fr', gap: '20px', marginBottom: '28px' }}>

        <div className="dashboard-section-card" style={{ padding: '24px', borderRadius: '16px', background: 'white', border: '1px solid var(--border)', minHeight: 'auto' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', color: 'var(--dark)', fontWeight: 700 }}>Estado de Solicitudes Anuales</h3>
          <p style={{ margin: '0 0 20px', color: 'var(--muted)', fontSize: '0.85rem' }}>Distribución del ciclo lectivo {anioActual} para {nivelEducativo}</p>
          
          <div style={{ height: 16, width: '100%', background: '#f1f5f9', borderRadius: 8, overflow: 'hidden', display: 'flex', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)' }}>
            {chartData.aprobadasPct > 0 && <div style={{ width: `${chartData.aprobadasPct}%`, background: '#10b981', height: '100%', transition: 'width 0.5s ease' }} title={`Aprobadas: ${metrics.aprobadas}`} />}
            {chartData.pendDirPct > 0 && <div style={{ width: `${chartData.pendDirPct}%`, background: '#f59e0b', height: '100%', transition: 'width 0.5s ease' }} title={`Pendientes Director: ${metrics.pendientesDirector}`} />}
            {chartData.enProcesoPct > 0 && <div style={{ width: `${chartData.enProcesoPct}%`, background: '#3b82f6', height: '100%', transition: 'width 0.5s ease' }} title={`En proceso: ${metrics.enProceso}`} />}
            {chartData.sinSolicitudPct > 0 && <div style={{ width: `${chartData.sinSolicitudPct}%`, background: '#ef4444', height: '100%', transition: 'width 0.5s ease' }} title={`Sin solicitud: ${metrics.sinSolicitud}`} />}
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginTop: 20 }}>
            {[
              { color: '#10b981', bg: 'rgba(16, 185, 129, 0.08)', label: 'Aprobadas', value: metrics.aprobadas },
              { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)', label: 'Pend. director', value: metrics.pendientesDirector },
              { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.08)', label: 'En proceso', value: metrics.enProceso },
              { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)', label: 'Sin solicitud', value: metrics.sinSolicitud }
            ].map(({ color, bg, label, value }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: bg, border: `1px solid ${color}1a` }}>
                <span style={{ width: 8, height: 8, background: color, borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--dark)' }}>{value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {solicitudesPendientesDirector.length > 0 && (
          <div className="dashboard-section-card" style={{ 
            padding: '24px', 
            borderRadius: '16px', 
            border: '1px solid rgba(245, 158, 11, 0.25)', 
            background: 'linear-gradient(135deg, #fffbeb 0%, #fffbeb 100%)', 
            boxShadow: '0 10px 25px -15px rgba(245, 158, 11, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 'auto'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ color: '#d97706', fontSize: '1.2rem' }}>⚠</span>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#92400e', fontWeight: 700 }}>Requieren tu aprobación</h3>
              </div>
              <p style={{ margin: '0 0 16px', color: '#b45309', fontSize: '0.85rem', fontWeight: 500 }}>
                Solicitudes esperando decisión del Director de Área
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {solicitudesPendientesDirector.map((s, i) => (
                  <div key={i} 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '10px 14px', 
                      background: 'white', 
                      borderRadius: 10, 
                      border: '1px solid rgba(245, 158, 11, 0.15)', 
                      fontSize: '0.88rem',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                    }}
                    onMouseOver={e => { e.currentTarget.style.transform = 'translateX(3px)'; e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.03)'; }}
                    onMouseOut={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.01)'; }}
                  >
                    <span style={{ fontWeight: 700, color: 'var(--dark)' }}>
                      {s.institucion_nombre || `Escuela ID ${s.institucion_id}`}
                    </span>
                    <span style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', padding: '2px 8px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700 }}>
                      Anual {s.anio || anioActual}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            <button 
              onClick={() => onNavigate('solicitud-anual')} 
              className="primary"
              style={{ 
                marginTop: 20, 
                width: '100%', 
                padding: '10px 16px', 
                background: '#f59e0b', 
                color: 'white', 
                border: 'none', 
                borderRadius: '10px', 
                fontSize: '0.85rem', 
                fontWeight: 700, 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'background 0.2s ease',
              }}
              onMouseOver={e => e.currentTarget.style.background = '#d97706'}
              onMouseOut={e => e.currentTarget.style.background = '#f59e0b'}
            >
              Revisar pendientes →
            </button>
          </div>
        )}
      </div>

      {/* Estado por Supervisor */}
      {estadoPorSupervisor.length > 0 && (
        <div className="dashboard-section-card" style={{ padding: '24px', borderRadius: '16px', background: 'white', border: '1px solid var(--border)', marginBottom: 28 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', color: 'var(--dark)', fontWeight: 700 }}>Estado por Supervisor</h3>
          <p style={{ margin: '0 0 20px', color: 'var(--muted)', fontSize: '0.85rem' }}>Avance de escuelas asignadas a cada zona de supervisión</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {estadoPorSupervisor.map(sup => {
              const isComplete = sup.pct === 100
              const progressColor = isComplete ? '#10b981' : '#1e3a8a'
              
              return (
                <div key={sup.id} 
                  style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '220px 1fr 100px 120px', 
                    alignItems: 'center', 
                    gap: 16, 
                    padding: '12px 16px', 
                    borderRadius: 12, 
                    border: '1px solid rgba(29, 37, 45, 0.04)',
                    background: 'rgba(29, 37, 45, 0.01)',
                    transition: 'background 0.15s ease' 
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(29, 37, 45, 0.03)'}
                  onMouseOut={e => e.currentTarget.style.background = 'rgba(29, 37, 45, 0.01)'}
                >
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sup.nombre}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden', flex: 1 }}>
                      <div style={{ height: '100%', width: `${sup.pct}%`, background: progressColor, borderRadius: 4, transition: 'width 0.5s ease' }} />
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: progressColor, width: 36, textAlign: 'right' }}>
                      {sup.pct}%
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--muted)', textAlign: 'center', fontWeight: 600 }}>
                    {sup.aprobadas} / {sup.total} esc.
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {sup.pendientes > 0 ? (
                      <span style={{ background: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 700, display: 'inline-block' }}>
                        {sup.pendientes} pend.
                      </span>
                    ) : isComplete ? (
                      <span style={{ background: '#d1fae5', color: '#065f46', padding: '4px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 700, display: 'inline-block' }}>
                        ✓ Completo
                      </span>
                    ) : (
                      <span style={{ background: 'rgba(29, 37, 45, 0.05)', color: 'var(--muted)', padding: '4px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 700, display: 'inline-block' }}>
                        En proceso
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Accesos Rápidos */}
      <div>
        <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', color: 'var(--dark)', fontWeight: 700 }}>Accesos Rápidos</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {[
            { key: 'gestion-escuelas', icon: <MapIcon />, label: 'Zonas y Supervisores' },
            { key: 'solicitud-anual', icon: <ClipboardIcon />, label: 'Solicitud Anual', badge: metrics.pendientesDirector > 0 ? metrics.pendientesDirector : null },
            { key: 'resumen-anual', icon: <ChartBarIcon />, label: 'Resumen Anual' },
          ].map(({ key, icon, label, badge }) => (
            <button key={key} onClick={() => onNavigate(key)}
              className="dashboard-stat-card dashboard-stat-card-clickable"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: '24px 16px',
                gap: '12px',
                position: 'relative',
                background: 'white',
                border: '1px solid var(--border)',
                borderRadius: '16px',
              }}
            >
              {badge && (
                <span style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  background: '#f59e0b',
                  color: 'white',
                  borderRadius: '50%',
                  width: 22,
                  height: 22,
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(245, 158, 11, 0.4)'
                }}>
                  {badge}
                </span>
              )}
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: 'rgba(30, 58, 138, 0.08)',
                color: '#1e3a8a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}>
                {icon}
              </div>
              <span style={{ fontWeight: 700, color: 'var(--dark)', fontSize: '0.9rem', marginTop: 4 }}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// Iconos SVG de apoyo
function BuildingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <line x1="9" y1="22" x2="9" y2="16" />
      <line x1="15" y1="22" x2="15" y2="16" />
      <line x1="9" y1="16" x2="15" y2="16" />
      <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M12 6h.01M12 10h.01M8 14h.01M16 14h.01" />
    </svg>
  )
}

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  )
}

function AlertTriangleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  )
}

function ChartBarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}
