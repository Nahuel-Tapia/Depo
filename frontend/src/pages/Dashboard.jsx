import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import Inicio from '../components/Inicio'
import Productos from '../components/Productos'
import Movimientos from '../components/Movimientos'
import Pedidos from '../components/Pedidos'
import Instituciones from '../components/Instituciones'
import Proveedores from '../components/Proveedores'
import Usuarios from '../components/Usuarios'
import HistorialInstitucion from '../components/HistorialInstitucion'
import SupervisorDashboard from '../components/SupervisorDashboard'

const TABS = [
  { key: 'inicio', label: 'Inicio', permission: null },
  { key: 'supervisor', label: 'Patrimonio Escolar', permission: 'pedidos.manage', role: 'supervisor' },
  { key: 'mis-escuelas', label: 'Mis Escuelas', permission: 'instituciones.view', role: 'supervisor' },
  { key: 'productos', label: 'Productos', permission: 'productos.view', hideForRole: 'supervisor' },
  { key: 'movimientos', label: 'Movimientos', permission: 'movimientos.view', hideForRole: 'supervisor' },
  { key: 'pedidos', label: 'Pedidos', permission: 'pedidos.view' },
  { key: 'instituciones', label: 'Instituciones', permission: 'instituciones.view', hideForRole: 'supervisor' },
  { key: 'historial', label: 'Historial', permission: 'instituciones.view', hideForRole: 'supervisor' },
  { key: 'proveedores', label: 'Proveedores', permission: 'proveedores.view', hideForRole: 'supervisor' },
  { key: 'usuarios', label: 'Usuarios', permission: 'users.read' }
]

export default function Dashboard() {
  const { user, logout, hasPermission } = useAuth()
  const [activeTab, setActiveTab] = useState('inicio')

  const userInitial = user?.role === 'admin' ? 'A'
    : user?.role === 'supervisor' ? 'S'
    : user?.role === 'directivo' ? 'D'
    : user?.role === 'operador' ? 'O'
    : 'C'

  const visibleTabs = TABS.filter(t => {
    if (t.hideForRole && t.hideForRole === user?.role) return false
    if (t.role && t.role !== user?.role && user?.role !== 'admin') return false
    return !t.permission || hasPermission(t.permission)
  })

  const handleLogout = () => {
    logout()
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'inicio': return <Inicio onNavigate={setActiveTab} />
      case 'productos': return <Productos />
      case 'movimientos': return <Movimientos />
      case 'pedidos': return <Pedidos />
      case 'instituciones': return <Instituciones />
      case 'mis-escuelas': return <Instituciones supervisorMode />
      case 'historial': return <HistorialInstitucion />
      case 'supervisor': return <SupervisorDashboard />
      case 'proveedores': return <Proveedores />
      case 'usuarios': return <Usuarios />
      default: return <Inicio />
    }
  }

  return (
    <main className="container">
      <section className="card">
        <div className="topbar">
          <div className="logo-container">
            <img src="http://prod.eduge.com.ar/assets/logoGobierno-D5M0tUR9.png" alt="San Juan Gobierno" />
          </div>
          <div className="user-info">
            <span id="currentUser">{userInitial}</span>
            <button className="secondary" onClick={handleLogout} style={{ fontSize: '0.8rem' }}>Salir</button>
          </div>
        </div>

        <div className="tabs">
          {visibleTabs.map(tab => (
            <button
              key={tab.key}
              className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>

        {renderTab()}
      </section>
    </main>
  )
}
