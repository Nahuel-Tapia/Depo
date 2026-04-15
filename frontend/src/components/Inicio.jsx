import { useAuth } from '../context/AuthContext'
import { useState, useEffect, useRef } from 'react'
import { apiFetch } from '../api'
import PrintButton from './PrintButton'

const ROLE_LABELS = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
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

export default function Inicio({ onNavigate }) {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalType, setModalType] = useState(null)
  const printRef = useRef(null)

  useEffect(() => {
    if (user?.role === 'supervisor') {
      setLoading(false)
      return
    }

    const fetchStats = async () => {
      try {
        const data = await apiFetch('/dashboard/stats') // ✅ FIX
        setStats(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) return <p style={{ color: 'var(--muted)', padding: '24px 0' }}>Cargando resumen...</p>

  if (user?.role === 'supervisor') {
    return (
      <div>
        <div className="stock-alert-box">
          <div className="stock-alert-title">
            <span className="stock-alert-triangle"></span>
            Bienvenido, {user?.nombre || 'Usuario'}
          </div>
          <p className="stock-alert-role">Supervisor</p>
        </div>
        <SupervisorInicio onNavigate={onNavigate} user={user} />
      </div>
    )
  }

  if (error) return <p style={{ color: '#b91c1c', padding: '24px 0' }}>Error: {error}</p>
  if (!stats) return null

  const mesActual = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  const sinStockList = stats.sin_stock_list || []

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span></span>
        <PrintButton targetRef={printRef} title="Resumen General — Dashboard" />
      </div>

      <div ref={printRef}>
        <div className="stock-alert-box">
          <div className="stock-alert-title">
            <span className="stock-alert-triangle"></span>
            Bienvenido, {user?.nombre || 'Usuario'}
          </div>
          <p className="stock-alert-role">
            {ROLE_LABELS[user?.role] || user?.role || 'Sin rol'}
          </p>
        </div>

        {/* resto del código igual... */}
      </div>
    </div>
  )
}

// ── Vista de Inicio para Supervisor ──
function SupervisorInicio({ onNavigate, user }) {
  const [instituciones, setInstituciones] = useState([])

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiFetch(
          `/supervisor/instituciones?jurisdiccion=${encodeURIComponent(user?.jurisdiccion || '')}`
        ) // ✅ FIX

        setInstituciones(data.instituciones || [])
      } catch (err) {
        console.error('Error cargando instituciones del supervisor:', err)
      }
    }
    load()
  }, [])

  const totalPendientes = instituciones.reduce((sum, i) => sum + (i.pedidos_pendientes || 0), 0)
  const totalTickets = instituciones.reduce((sum, i) => sum + (i.tickets_patrimonio || 0), 0)

  return (
    <div>
      <div className="sv-jurisdiction-banner">
        <span className="sv-jurisdiction-dot"></span>
        <span>Jurisdicción: <strong>{user?.jurisdiccion || '-'}</strong></span>
        <span className="sv-jurisdiction-count">{instituciones.length} escuelas asignadas</span>
      </div>

      {/* resto igual */}
    </div>
  )
}