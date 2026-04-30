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
import DirectorAreaPanel from '../components/DirectorAreaPanel'
import ComprasPanel from '../components/ComprasPanel'
import ProductKitsManager from '../components/ProductKitsManager'
import MiCuenta from '../components/MiCuenta'
import Depositos from '../components/Depositos'

const TABS = [
  { key: 'inicio', label: 'Inicio', permission: null },
  { key: 'gestion-escuelas', label: 'Gestión de Zonas', permission: 'supervision.manage', role: 'director_area' },
  { key: 'solicitud-anual', label: 'Solicitud Anual', permission: 'supervision.manage', role: 'director_area' },
  { key: 'resumen-anual', label: 'Resumen Solicitud Anual', permission: 'supervision.manage', role: 'director_area' },
  { key: 'compras-pedidos', label: 'Gestión de Pedidos Anuales', permission: 'planilla.view', role: 'area_compras' },
  { key: 'compras-licitacion', label: 'Licitación Anual', permission: 'planilla.view', role: 'area_compras' },
  { key: 'compras-listado-final', label: 'Listado Final a Licitar', permission: 'planilla.view', role: 'area_compras' },
  { key: 'compras-adjudicacion', label: 'Adjudicación y Cierre', permission: 'planilla.manage', role: 'area_compras' },
  { key: 'supervisor', label: 'Patrimonio Escolar', permission: 'pedidos.manage', role: 'supervisor' },
  { key: 'mis-escuelas', label: 'Mis Escuelas', permission: 'instituciones.view', role: 'supervisor', hideForRoles: ['admin'] },
  { key: 'productos', label: 'Productos', permission: 'productos.view', hideForRoles: ['supervisor', 'director_area'] },
  { key: 'movimientos', label: 'Movimientos', permission: 'movimientos.view', hideForRoles: ['supervisor', 'director_area'] },
  { key: 'pedidos', label: 'Pedidos', permission: 'pedidos.view', hideForRoles: ['admin'] },
  { key: 'instituciones', label: 'Instituciones', permission: 'instituciones.view', hideForRoles: ['supervisor', 'director_area'] },
  { key: 'historial', label: 'Historial', permission: 'instituciones.view', hideForRoles: ['supervisor', 'director_area'] },
  { key: 'proveedores', label: 'Proveedores', permission: 'proveedores.view', hideForRoles: ['supervisor', 'director_area'] },
  { key: 'usuarios', label: 'Usuarios', permission: 'users.read' },
  { key: 'kits', label: 'Kits de Productos', permission: 'supervision.manage', role: 'director_area' },
  { key: 'depositos', label: 'Depósitos', permission: 'stock.view' },
  { key: 'mi-cuenta', label: 'Mi cuenta', permission: null },
]

export default function Dashboard() {
  const { user, logout, hasPermission } = useAuth()
  const [activeTab, setActiveTab] = useState('inicio')

  const userInitial = user?.role === 'admin' ? 'A'
    : user?.role === 'supervisor' ? 'S'
    : user?.role === 'director_area' ? 'DA'
    : user?.role === 'directivo' ? 'D'
    : user?.role === 'operador' ? 'O'
    : user?.role === 'area_compras' ? 'AC'
    : 'C'

  const userDisplay = userInitial

  const visibleTabs = TABS.filter(tab => {
    if (user?.role === 'directivo') {
      return tab.key === 'inicio' || tab.key === 'pedidos' || tab.key === 'mi-cuenta'
    }
    if (user?.role === 'area_compras') {
      return [
        'inicio',
        'mi-cuenta',
        'compras-pedidos',
        'compras-licitacion',
        'compras-listado-final',
        'compras-adjudicacion'
      ].includes(tab.key)
    }
    // Hide tabs explicitly hidden for this role
    if (tab.hideForRole && tab.hideForRole === user?.role) return false
    if (tab.hideForRoles && tab.hideForRoles.includes(user?.role)) return false
    if (tab.role && tab.role !== user?.role) return false
    return !tab.permission || hasPermission(tab.permission)
  })

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(visibleTabs[0]?.key || 'inicio')
    }
  }, [activeTab, visibleTabs])

  const renderTab = () => {
    switch (activeTab) {
      case 'inicio': return <Inicio onNavigate={setActiveTab} />
      case 'mi-cuenta': return <MiCuenta />
      case 'gestion-escuelas': return <DirectorAreaPanel initialSection="gestion-escuelas" />
      case 'gestion-pedidos': return <DirectorAreaPanel initialSection="gestion-pedidos" />
      case 'solicitud-anual': return <DirectorAreaPanel initialSection="solicitud-anual" />
      case 'resumen-anual': return <DirectorAreaPanel initialSection="resumen-anual" />
      case 'compras-pedidos': return <ComprasPanel section="pedidos" />
      case 'compras-licitacion': return <ComprasPanel section="licitacion" />
      case 'compras-listado-final': return <ComprasPanel section="listado-final" />
      case 'compras-adjudicacion': return <ComprasPanel section="adjudicacion" />
      case 'productos': return <Productos />
      case 'movimientos': return <Movimientos />
      case 'pedidos': return <Pedidos />
      case 'instituciones': return <Instituciones />
      case 'mis-escuelas': return <Instituciones supervisorMode />
      case 'historial': return <HistorialInstitucion />
      case 'supervisor': return <SupervisorDashboard />
      case 'proveedores': return <Proveedores />
      case 'usuarios': return <Usuarios />
      case 'kits': return <ProductKitsManager />
      case 'depositos': return <Depositos />
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
            <span id="currentUser">{userDisplay}</span>
            <button
              className="secondary"
              onClick={() => setActiveTab('mi-cuenta')}
              style={{ fontSize: '0.8rem' }}
            >
              Mi cuenta
            </button>
            <button className="secondary" onClick={logout} style={{ fontSize: '0.8rem' }}>Salir</button>
          </div>
        </div>

        <div className="tabs">
          {visibleTabs.filter(tab => tab.key !== 'mi-cuenta').map(tab => (
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
