import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import Inicio from '../components/Inicio'
import Productos from '../components/Productos'
import Movimientos from '../components/Movimientos'
import Pedidos from '../components/Pedidos'
import Instituciones from '../components/Instituciones'
import Proveedores from '../components/Proveedores'
import Usuarios from '../components/Usuarios'

const TABS = [
  { key: 'inicio', label: 'Inicio', icon: '🏠', permission: null },
  { key: 'productos', label: 'Productos', icon: '📦', permission: 'productos.view' },
  { key: 'movimientos', label: 'Movimientos', icon: '📊', permission: 'movimientos.view' },
  { key: 'pedidos', label: 'Pedidos', icon: '🧾', permission: 'pedidos.view' },
  { key: 'instituciones', label: 'Instituciones', icon: '🏫', permission: 'instituciones.view' },
  { key: 'proveedores', label: 'Proveedores', icon: '🏭', permission: 'proveedores.view' },
  { key: 'usuarios', label: 'Usuarios', icon: '👥', permission: 'users.read' }
]

export default function Dashboard() {
  const { user, logout, hasPermission } = useAuth()
  const [activeTab, setActiveTab] = useState('inicio')

  const userInitial = user?.role === 'admin' ? 'A'
    : user?.role === 'directivo' ? 'D'
    : user?.role === 'operador' ? 'O'
    : 'C'

  const visibleTabs = TABS.filter(t => !t.permission || hasPermission(t.permission))

  const handleLogout = () => {
    logout()
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'inicio': return <Inicio />
      case 'productos': return <Productos />
      case 'movimientos': return <Movimientos />
      case 'pedidos': return <Pedidos />
      case 'instituciones': return <Instituciones />
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
            <img src="http://prod.eduge.com.ar/assets/logoGobierno-D5M0tUR9.png" alt="Logo Gobierno" style={{ maxWidth: 300, height: 'auto' }} />
          </div>
          <div className="user-info">
            <div>
              <span id="currentUser">{userInitial}</span>
            </div>
            <button className="secondary" onClick={handleLogout}>Cerrar sesión</button>
          </div>
        </div>

        <div className="tabs">
          {visibleTabs.map(tab => (
            <button
              key={tab.key}
              className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className="tab-icon" aria-hidden="true">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>

        {renderTab()}
      </section>
    </main>
  )
}
