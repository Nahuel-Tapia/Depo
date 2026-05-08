import { useMemo } from 'react'

export default function DirectorAreaDashboard({ escuelas = [], supervisores = [], solicitudes = [], submissionStatus = {}, nivelEducativo = '', onNavigate }) {
  const anioActual = new Date().getFullYear()

  const metrics = useMemo(() => {
    const totalEscuelas = escuelas.length
    const totalSupervisores = supervisores.length
    
    const aprobadas = solicitudes.filter(s => (s.tipo || 'anual') === 'anual' && s.estado === 'aprobado').length
    const pendientes = solicitudes.filter(s => (s.tipo || 'anual') === 'anual' && (s.estado === 'pendiente_director' || s.estado === 'pendiente')).length
    
    // Escuelas que no hicieron nada aún
    const escuelasConSolicitud = new Set(solicitudes.map(s => s.institucion_id))
    const sinSolicitud = escuelas.filter(e => !escuelasConSolicitud.has(e.id)).length

    return {
      totalEscuelas,
      totalSupervisores,
      aprobadas,
      pendientes,
      sinSolicitud,
      envioFinal: submissionStatus?.sent || false
    }
  }, [escuelas, supervisores, solicitudes, submissionStatus])

  const chartData = useMemo(() => {
    const { totalEscuelas, aprobadas, pendientes, sinSolicitud } = metrics
    if (totalEscuelas === 0) return { aprobadasPct: 0, pendientesPct: 0, sinSolicitudPct: 0 }

    return {
      aprobadasPct: (aprobadas / totalEscuelas) * 100,
      pendientesPct: (pendientes / totalEscuelas) * 100,
      sinSolicitudPct: (sinSolicitud / totalEscuelas) * 100
    }
  }, [metrics])

  return (
    <div className="fade-in" style={{ padding: '20px 0' }}>
      {/* Banner de Bienvenida */}
      <div style={{ 
        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', 
        color: 'white', 
        padding: '32px', 
        borderRadius: '16px', 
        marginBottom: '32px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
      }}>
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>Panel de Control</h1>
        <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: '1.1rem' }}>
          Nivel Educativo: <strong>{nivelEducativo || 'No asignado'}</strong> | Ciclo Lectivo {anioActual}
        </p>
      </div>

      {/* Tarjetas de Métricas */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
        gap: '24px', 
        marginBottom: '32px' 
      }}>
        <div className="card" style={{ padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', minHeight: 'auto' }}>
          <div style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase' }}>Total Escuelas</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#1e293b', marginTop: '8px' }}>{metrics.totalEscuelas}</div>
        </div>
        <div className="card" style={{ padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', minHeight: 'auto' }}>
          <div style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase' }}>Supervisores</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#1e293b', marginTop: '8px' }}>{metrics.totalSupervisores}</div>
        </div>
        <div className="card" style={{ padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', minHeight: 'auto' }}>
          <div style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase' }}>Estado Envío Final</div>
          <div style={{ marginTop: '12px' }}>
            {metrics.envioFinal ? (
              <span style={{ background: '#def7ec', color: '#03543f', padding: '6px 12px', borderRadius: '20px', fontSize: '0.875rem', fontWeight: 700 }}>
                ✓ ENVIADO A COMPRAS
              </span>
            ) : (
              <span style={{ background: '#fef3c7', color: '#92400e', padding: '6px 12px', borderRadius: '20px', fontSize: '0.875rem', fontWeight: 700 }}>
                ⌛ PENDIENTE
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Gráfico de Estado de Escuelas */}
      <div className="card" style={{ padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '32px', minHeight: 'auto' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', color: '#1e293b' }}>Estado de Solicitudes Anuales</h3>
        <p style={{ margin: '0 0 24px 0', color: '#64748b', fontSize: '0.95rem' }}>Distribución del estado de las escuelas de su nivel.</p>
        
        {/* Gráfico de Barra Apilada CSS */}
        <div style={{ 
          height: '24px', 
          width: '100%', 
          background: '#f1f5f9', 
          borderRadius: '12px', 
          overflow: 'hidden', 
          display: 'flex',
          boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)'
        }}>
          <div style={{ width: `${chartData.aprobadasPct}%`, background: '#10b981', height: '100%', transition: 'width 0.5s ease' }} title={`Aprobadas: ${metrics.aprobadas}`} />
          <div style={{ width: `${chartData.pendientesPct}%`, background: '#f59e0b', height: '100%', transition: 'width 0.5s ease' }} title={`En Proceso: ${metrics.pendientes}`} />
          <div style={{ width: `${chartData.sinSolicitudPct}%`, background: '#ef4444', height: '100%', transition: 'width 0.5s ease' }} title={`Sin Solicitud: ${metrics.sinSolicitud}`} />
        </div>

        {/* Leyenda */}
        <div style={{ display: 'flex', gap: '24px', marginTop: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '12px', height: '12px', background: '#10b981', borderRadius: '3px' }}></span>
            <span style={{ fontSize: '0.875rem', color: '#334155', fontWeight: 600 }}>Aprobadas Final ({metrics.aprobadas})</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '12px', height: '12px', background: '#f59e0b', borderRadius: '3px' }}></span>
            <span style={{ fontSize: '0.875rem', color: '#334155', fontWeight: 600 }}>En Proceso ({metrics.pendientes})</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '3px' }}></span>
            <span style={{ fontSize: '0.875rem', color: '#334155', fontWeight: 600 }}>No hizo nada aún ({metrics.sinSolicitud})</span>
          </div>
        </div>
      </div>

      {/* Accesos Rápidos */}
      <div>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', color: '#1e293b' }}>Accesos Rápidos</h3>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '16px' 
        }}>
          <button 
            onClick={() => onNavigate('gestion-escuelas')}
            style={{ 
              padding: '20px', 
              background: 'white', 
              border: '1px solid #e2e8f0', 
              borderRadius: '12px', 
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.2s ease',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
            }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <span style={{ fontSize: '2rem' }}>📍</span>
            <span style={{ fontWeight: 600, color: '#1e293b' }}>Zonas y Supervisores</span>
          </button>
          
          <button 
            onClick={() => onNavigate('solicitud-anual')}
            style={{ 
              padding: '20px', 
              background: 'white', 
              border: '1px solid #e2e8f0', 
              borderRadius: '12px', 
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.2s ease',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
            }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <span style={{ fontSize: '2rem' }}>📋</span>
            <span style={{ fontWeight: 600, color: '#1e293b' }}>Solicitud Anual</span>
          </button>
          
          <button 
            onClick={() => onNavigate('resumen-anual')}
            style={{ 
              padding: '20px', 
              background: 'white', 
              border: '1px solid #e2e8f0', 
              borderRadius: '12px', 
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.2s ease',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
            }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <span style={{ fontSize: '2rem' }}>📊</span>
            <span style={{ fontWeight: 600, color: '#1e293b' }}>Resumen Anual</span>
          </button>
        </div>
      </div>
    </div>
  )
}
