import { useMemo } from 'react'

export default function DirectorAreaDashboard({ escuelas = [], supervisores = [], solicitudes = [], submissionStatus = {}, nivelEducativo = '', asignaciones = [], onNavigate }) {
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

  const cardStyle = { padding: '20px 24px', borderRadius: '10px', border: '1px solid var(--border)', background: 'white', minHeight: 'auto', cursor: 'pointer', transition: 'box-shadow 0.15s ease' }

  return (
    <div className="fade-in" style={{ padding: '4px 0 24px' }}>

      {/* Banner */}
      <div style={{ background: 'white', border: '1px solid var(--border)', padding: '28px 32px', borderRadius: '12px', marginBottom: '28px' }}>
        <h1 style={{ margin: 0, fontSize: '1.7rem', fontWeight: 800, color: 'var(--dark)' }}>Panel de Control</h1>
        <p style={{ margin: '6px 0 0', fontSize: '1rem', color: 'var(--muted)' }}>
          Nivel Educativo: <strong style={{ color: 'var(--dark)' }}>{nivelEducativo || 'No asignado'}</strong> | Ciclo Lectivo {anioActual}
        </p>
      </div>

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>

        <div className="card" style={cardStyle} onClick={() => onNavigate('gestion-escuelas')}
          onMouseOver={e => e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.1)'}
          onMouseOut={e => e.currentTarget.style.boxShadow = ''}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.5px', marginBottom: 8 }}>Total Escuelas</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--dark)' }}>{metrics.totalEscuelas}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 4 }}>{metrics.totalSupervisores} supervisor{metrics.totalSupervisores !== 1 ? 'es' : ''}</div>
        </div>

        <div className="card" style={cardStyle} onClick={() => onNavigate('solicitud-anual')}
          onMouseOver={e => e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.1)'}
          onMouseOut={e => e.currentTarget.style.boxShadow = ''}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.5px', marginBottom: 8 }}>Aprobadas Final</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#10b981' }}>{metrics.aprobadas}</div>
          <div style={{ marginTop: 6 }}>
            <div style={{ height: 5, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${metrics.avancePct}%`, background: '#10b981', borderRadius: 4, transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 4 }}>{metrics.avancePct}% del total</div>
          </div>
        </div>

        <div className="card" style={{ ...cardStyle, borderColor: metrics.pendientesDirector > 0 ? '#f59e0b' : 'var(--border)', background: metrics.pendientesDirector > 0 ? '#fffbeb' : 'white' }}
          onClick={() => onNavigate('solicitud-anual')}
          onMouseOver={e => e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.1)'}
          onMouseOut={e => e.currentTarget.style.boxShadow = ''}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.5px', marginBottom: 8 }}>Pendientes mi aprobación</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: metrics.pendientesDirector > 0 ? '#d97706' : 'var(--dark)' }}>{metrics.pendientesDirector}</div>
          {metrics.pendientesDirector > 0 && <div style={{ fontSize: '0.75rem', color: '#92400e', marginTop: 4, fontWeight: 600 }}>⚠ Requieren atención</div>}
        </div>

        <div className="card" style={cardStyle}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.5px', marginBottom: 12 }}>Estado Envío Final</div>
          {metrics.envioFinal
            ? <span style={{ background: '#d1fae5', color: '#065f46', padding: '6px 12px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 700 }}>✓ Enviado a Compras</span>
            : <span style={{ background: '#fef3c7', color: '#92400e', padding: '6px 12px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 700 }}>⌛ Pendiente</span>
          }
        </div>
      </div>

      {/* Barra de avance + alerta */}
      <div style={{ display: 'grid', gridTemplateColumns: solicitudesPendientesDirector.length > 0 ? '1fr 1fr' : '1fr', gap: 16, marginBottom: 24 }}>

        <div className="card" style={{ padding: '24px', borderRadius: '10px', border: '1px solid var(--border)', minHeight: 'auto' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '1rem', color: 'var(--dark)' }}>Estado de Solicitudes Anuales</h3>
          <p style={{ margin: '0 0 16px', color: 'var(--muted)', fontSize: '0.85rem' }}>Distribución del ciclo lectivo {anioActual}</p>
          <div style={{ height: 20, width: '100%', background: '#f1f5f9', borderRadius: 10, overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${chartData.aprobadasPct}%`, background: '#10b981', height: '100%', transition: 'width 0.5s ease' }} />
            <div style={{ width: `${chartData.pendDirPct}%`, background: '#f59e0b', height: '100%', transition: 'width 0.5s ease' }} />
            <div style={{ width: `${chartData.enProcesoPct}%`, background: '#93c5fd', height: '100%', transition: 'width 0.5s ease' }} />
            <div style={{ width: `${chartData.sinSolicitudPct}%`, background: '#ef4444', height: '100%', transition: 'width 0.5s ease' }} />
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
            {[
              { color: '#10b981', label: `Aprobadas (${metrics.aprobadas})` },
              { color: '#f59e0b', label: `Pend. director (${metrics.pendientesDirector})` },
              { color: '#93c5fd', label: `En proceso (${metrics.enProceso})` },
              { color: '#ef4444', label: `Sin solicitud (${metrics.sinSolicitud})` }
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, background: color, borderRadius: 3, flexShrink: 0 }} />
                <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 600 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {solicitudesPendientesDirector.length > 0 && (
          <div className="card" style={{ padding: '24px', borderRadius: '10px', border: '1px solid #fbbf24', background: '#fffbeb', minHeight: 'auto' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '1rem', color: '#92400e' }}>⚠ Requieren tu aprobación</h3>
            <p style={{ margin: '0 0 12px', color: '#b45309', fontSize: '0.82rem' }}>Solicitudes esperando decisión del Director de Área</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {solicitudesPendientesDirector.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'white', borderRadius: 8, border: '1px solid #fde68a', fontSize: '0.85rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--dark)' }}>{s.institucion_nombre || `Escuela ID ${s.institucion_id}`}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{s.anio || anioActual}</span>
                </div>
              ))}
            </div>
            <button onClick={() => onNavigate('solicitud-anual')} style={{ marginTop: 12, padding: '6px 14px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: 6, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
              Ver todas →
            </button>
          </div>
        )}
      </div>

      {/* Estado por Supervisor */}
      {estadoPorSupervisor.length > 0 && (
        <div className="card" style={{ padding: '24px', borderRadius: '10px', border: '1px solid var(--border)', marginBottom: 24, minHeight: 'auto' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '1rem', color: 'var(--dark)' }}>Estado por Supervisor</h3>
          <p style={{ margin: '0 0 16px', color: 'var(--muted)', fontSize: '0.85rem' }}>Avance de escuelas asignadas</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {estadoPorSupervisor.map(sup => (
              <div key={sup.id} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 90px 100px', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sup.nombre}</div>
                <div>
                  <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${sup.pct}%`, background: sup.pct === 100 ? '#10b981' : '#2563eb', borderRadius: 4, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textAlign: 'center' }}>{sup.aprobadas}/{sup.total} esc.</div>
                <div style={{ textAlign: 'center' }}>
                  {sup.pendientes > 0
                    ? <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 10, fontSize: '0.73rem', fontWeight: 700 }}>{sup.pendientes} pend.</span>
                    : sup.pct === 100
                      ? <span style={{ background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: 10, fontSize: '0.73rem', fontWeight: 700 }}>✓ Completo</span>
                      : null
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accesos Rápidos */}
      <div>
        <h3 style={{ margin: '0 0 14px', fontSize: '1rem', color: 'var(--dark)', fontWeight: 700 }}>Accesos Rápidos</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          {[
            { key: 'gestion-escuelas', icon: '📍', label: 'Zonas y Supervisores' },
            { key: 'solicitud-anual', icon: '📋', label: 'Solicitud Anual', badge: metrics.pendientesDirector > 0 ? metrics.pendientesDirector : null },
            { key: 'resumen-anual', icon: '📊', label: 'Resumen Anual' },
          ].map(({ key, icon, label, badge }) => (
            <button key={key} onClick={() => onNavigate(key)}
              style={{ padding: '18px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: '10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', transition: 'all 0.15s ease', position: 'relative' }}
              onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--orange)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = ''; }}
            >
              {badge && <span style={{ position: 'absolute', top: 10, right: 10, background: '#f59e0b', color: 'white', borderRadius: '50%', width: 20, height: 20, fontSize: '0.7rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span>}
              <span style={{ fontSize: '1.8rem' }}>{icon}</span>
              <span style={{ fontWeight: 600, color: 'var(--dark)', fontSize: '0.88rem', textAlign: 'center' }}>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
