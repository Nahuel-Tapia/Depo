import { useAuth } from '../context/AuthContext'
import { useState, useEffect } from 'react'
import { apiFetch } from '../api'

const ROLE_LABELS = {
  admin: 'Administrador',
  directivo: 'Directivo',
  operador: 'Operador',
  consulta: 'Consulta',
  control_ministerio: 'Control Ministerio'
}

const TIPO_COLORS = {
  ingreso: { bg: '#ecfdf5', color: '#065f46' },
  egreso: { bg: '#fef2f2', color: '#b91c1c' },
  ajuste: { bg: '#fffbeb', color: '#92400e' },
  devolucion: { bg: '#eff6ff', color: '#1e40af' },
}

export default function Inicio() {
  const { user, token } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await apiFetch('/api/dashboard/stats', { token })
        if (!res.ok) throw new Error('Error al obtener datos')
        const data = await res.json()
        setStats(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [token])

  if (loading) return <p style={{ color: 'var(--muted)', padding: '24px 0' }}>Cargando resumen...</p>
  if (error) return <p style={{ color: '#b91c1c', padding: '24px 0' }}>Error: {error}</p>
  if (!stats) return null

  const mesActual = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  return (
    <div>
      {/* Bienvenida */}
      <div className="stock-alert-box">
        <div className="stock-alert-title">
          <span className="stock-alert-triangle"></span>
          Bienvenido, {user?.nombre || 'Usuario'}
        </div>
        <p className="stock-alert-role">
          {ROLE_LABELS[user?.role] || user?.role || 'Sin rol'}
        </p>
      </div>

      {/* Cards de resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard label="Productos" value={stats.productos.total} icon="📦" />
        <StatCard
          label="Stock bajo"
          value={stats.productos.stock_bajo}
          icon="⚠️"
          accent={stats.productos.stock_bajo > 0 ? '#E03C31' : '#065f46'}
        />
        <StatCard label="Sin stock" value={stats.productos.sin_stock} icon="🚫"
          accent={stats.productos.sin_stock > 0 ? '#b91c1c' : '#065f46'}
        />
        <StatCard label="Instituciones" value={stats.instituciones.total} icon="🏫" />
        <StatCard label="Proveedores" value={stats.proveedores.total} icon="🏢" />
      </div>

      {/* Movimientos del mes */}
      <h3 style={{ marginBottom: '12px' }}>Movimientos — {mesActual}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '28px' }}>
        <MiniCard label="Total" value={stats.movimientos_mes.total} color="var(--dark)" />
        <MiniCard label="Ingresos" value={stats.movimientos_mes.ingresos} color="#065f46" />
        <MiniCard label="Egresos" value={stats.movimientos_mes.egresos} color="#b91c1c" />
        <MiniCard label="Ajustes" value={stats.movimientos_mes.ajustes} color="#92400e" />
        <MiniCard label="Devoluciones" value={stats.movimientos_mes.devoluciones} color="#1e40af" />
      </div>

      {/* Stock bajo */}
      {stats.stock_bajo.length > 0 && (
        <>
          <h3 style={{ marginBottom: '12px' }}>Productos con stock bajo</h3>
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Stock actual</th>
                <th>Mínimo</th>
              </tr>
            </thead>
            <tbody>
              {stats.stock_bajo.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.nombre}</td>
                  <td>{p.categoria || '—'}</td>
                  <td style={{ color: p.stock_actual === 0 ? '#b91c1c' : '#92400e', fontWeight: 700 }}>
                    {p.stock_actual}
                  </td>
                  <td>{p.stock_minimo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Últimos movimientos */}
      {stats.ultimos_movimientos.length > 0 && (
        <>
          <h3 style={{ marginBottom: '12px' }}>Actividad reciente</h3>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Institución</th>
                <th>Usuario</th>
              </tr>
            </thead>
            <tbody>
              {stats.ultimos_movimientos.map(m => {
                const tipoStyle = TIPO_COLORS[m.tipo] || {}
                return (
                  <tr key={m.id}>
                    <td>{new Date(m.fecha).toLocaleDateString('es-AR')}</td>
                    <td>
                      <span className="badge" style={{ background: tipoStyle.bg, color: tipoStyle.color }}>
                        {m.tipo}
                      </span>
                    </td>
                    <td>{m.producto || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{m.cantidad}</td>
                    <td>{m.institucion || '—'}</td>
                    <td>{m.usuario || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, icon, accent }) {
  return (
    <div style={{
      background: 'white',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    }}>
      <span style={{ fontSize: '1.5rem' }}>{icon}</span>
      <span style={{
        fontSize: '1.75rem',
        fontWeight: 700,
        color: accent || 'var(--dark)',
        lineHeight: 1.1,
      }}>{value}</span>
      <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
        {label}
      </span>
    </div>
  )
}

function MiniCard({ label, value, color }) {
  return (
    <div style={{
      background: '#fafafa',
      border: '1px solid var(--border)',
      borderRadius: '6px',
      padding: '14px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 500, marginTop: '2px' }}>{label}</div>
    </div>
  )
}
