import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

export default function SupervisorStatsDashboard({ onNavigate }) {
  const { token, user } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadStats = async () => {
      try {
        const res = await apiFetch('/api/supervisor/dashboard/stats', { token })
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        } else {
          setError('No se pudieron cargar las estadísticas')
        }
      } catch (err) {
        console.error('Error cargando stats del dashboard:', err)
        setError('Error de conexión')
      } finally {
        setLoading(false)
      }
    }
    loadStats()
  }, [token])

  const chartData = useMemo(() => {
    if (!stats || !stats.totales || stats.totales.total === 0) {
      return { sinKitPct: 0, sinSolicitudPct: 0, enviadaPct: 0, aprobadaPct: 0 }
    }
    const { total, sin_kit, sin_solicitud, solicitud_enviada, solicitud_aprobada } = stats.totales
    return {
      sinKitPct: (sin_kit / total) * 100,
      sinSolicitudPct: (sin_solicitud / total) * 100,
      enviadaPct: (solicitud_enviada / total) * 100,
      aprobadaPct: (solicitud_aprobada / total) * 100
    }
  }, [stats])

  if (loading) return <div style={{ padding: 20 }}>Cargando dashboard...</div>
  if (error) return <div style={{ padding: 20, color: 'red' }}>Error: {error}</div>
  if (!stats) return null

  const { totales, pedidos_recientes = [], entregas_recientes = [] } = stats

  return (
    <div className="fade-in" style={{ padding: '20px 0' }}>
      {/* Banner de Bienvenida */}
      <div style={{ 
        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', 
        color: 'white', 
        padding: '32px', 
        borderRadius: '16px', 
        marginBottom: '32px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
      }}>
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>Panel de Control del Supervisor</h1>
        <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: '1.1rem' }}>
          Monitoreo de solicitudes y entregas de tus escuelas asignadas.
        </p>
      </div>

      {/* Tarjetas de Métricas */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '20px', 
        marginBottom: '32px' 
      }}>
        <div className="card" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', minHeight: 'auto' }}>
          <div style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: 600 }}>TOTAL ESCUELAS</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#1e293b', marginTop: '8px' }}>{totales.total}</div>
        </div>
        <div className="card" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #ef4444', background: '#fef2f2', minHeight: 'auto' }}>
          <div style={{ color: '#b91c1c', fontSize: '0.875rem', fontWeight: 600 }}>SIN KIT</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#b91c1c', marginTop: '8px' }}>{totales.sin_kit}</div>
        </div>
        <div className="card" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #f59e0b', background: '#fffbeb', minHeight: 'auto' }}>
          <div style={{ color: '#b45309', fontSize: '0.875rem', fontWeight: 600 }}>SIN SOLICITUD</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#b45309', marginTop: '8px' }}>{totales.sin_solicitud}</div>
        </div>
        <div className="card" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #ea580c', background: '#fff7ed', minHeight: 'auto' }}>
          <div style={{ color: '#c2410c', fontSize: '0.875rem', fontWeight: 600 }}>SOLICITUD ENVIADA</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#c2410c', marginTop: '8px' }}>{totales.solicitud_enviada}</div>
        </div>
        <div className="card" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #10b981', background: '#f0fdf4', minHeight: 'auto' }}>
          <div style={{ color: '#047857', fontSize: '0.875rem', fontWeight: 600 }}>ACEPTADAS</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#047857', marginTop: '8px' }}>{totales.solicitud_aprobada}</div>
        </div>
      </div>

      {/* Gráfico de Barra Apilada */}
      <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '32px', minHeight: 'auto' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', color: '#1e293b' }}>Estado General de Escuelas</h3>
        <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '0.95rem' }}>Proporción según el estado de gestión.</p>
        
        <div style={{ 
          height: '24px', 
          width: '100%', 
          background: '#f1f5f9', 
          borderRadius: '12px', 
          overflow: 'hidden', 
          display: 'flex',
          boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)'
        }}>
          <div style={{ width: `${chartData.sinKitPct}%`, background: '#ef4444', height: '100%' }} title={`Sin Kit: ${totales.sin_kit}`} />
          <div style={{ width: `${chartData.sinSolicitudPct}%`, background: '#f59e0b', height: '100%' }} title={`Sin Solicitud: ${totales.sin_solicitud}`} />
          <div style={{ width: `${chartData.enviadaPct}%`, background: '#ea580c', height: '100%' }} title={`Enviada: ${totales.solicitud_enviada}`} />
          <div style={{ width: `${chartData.aprobadaPct}%`, background: '#10b981', height: '100%' }} title={`Aprobada: ${totales.solicitud_aprobada}`} />
        </div>

        {/* Leyenda */}
        <div style={{ display: 'flex', gap: '20px', marginTop: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '3px' }}></span>
            <span style={{ fontSize: '0.875rem', color: '#334155' }}>Sin Kit ({totales.sin_kit})</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '12px', height: '12px', background: '#f59e0b', borderRadius: '3px' }}></span>
            <span style={{ fontSize: '0.875rem', color: '#334155' }}>Sin Solicitud ({totales.sin_solicitud})</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '12px', height: '12px', background: '#ea580c', borderRadius: '3px' }}></span>
            <span style={{ fontSize: '0.875rem', color: '#334155' }}>Enviada ({totales.solicitud_enviada})</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '12px', height: '12px', background: '#10b981', borderRadius: '3px' }}></span>
            <span style={{ fontSize: '0.875rem', color: '#334155' }}>Aprobada ({totales.solicitud_aprobada})</span>
          </div>
        </div>
      </div>

      {/* Listas de Movimientos Recientes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        {/* Pedidos Recientes */}
        <div className="card" style={{ padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', minHeight: 'auto' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#1e293b' }}>Últimas Solicitudes</h3>
          {pedidos_recientes.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No hay solicitudes recientes.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pedidos_recientes.map(p => (
                <div key={p.id} style={{ padding: '12px', border: '1px solid #f1f5f9', borderRadius: '8px', background: '#f8fafc' }}>
                  <div style={{ fontWeight: 600, color: '#1e293b' }}>{p.institucion}</div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
                    {new Date(p.fecha).toLocaleDateString()} | <span style={{ textTransform: 'capitalize' }}>{p.estado}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Entregas Recientes */}
        <div className="card" style={{ padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', minHeight: 'auto' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#1e293b' }}>Últimas Entregas</h3>
          {entregas_recientes.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No hay entregas recientes.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {entregas_recientes.map(e => (
                <div key={e.id} style={{ padding: '12px', border: '1px solid #f1f5f9', borderRadius: '8px', background: '#f8fafc' }}>
                  <div style={{ fontWeight: 600, color: '#1e293b' }}>{e.institucion}</div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
                    {e.producto} x{e.cantidad} | {new Date(e.fecha).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
