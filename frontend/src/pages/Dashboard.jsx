import { useEffect, useMemo, useState } from 'react'
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

const LOGO_URL = 'http://prod.eduge.com.ar/assets/logoGobierno-D5M0tUR9.png'

const ROLE_LABELS = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  director_area: 'Director de area',
  directivo: 'Directivo',
  operador: 'Operador',
  area_compras: 'Area de compras',
  consulta: 'Consulta',
  control_ministerio: 'Control ministerio',
}

const TABS = [
  { key: 'inicio', label: 'Inicio', permission: null, icon: GridIcon },
  { key: 'mi-cuenta', label: 'Mi cuenta', permission: null, icon: UserIcon },
  { key: 'gestion-escuelas', label: 'Gestion de Escuelas', permission: 'supervision.manage', role: 'director_area', icon: BuildingIcon },
  { key: 'gestion-pedidos', label: 'Gestion de Pedidos', permission: 'supervision.manage', role: 'director_area', icon: ClipboardIcon },
  { key: 'compras-pedidos', label: 'Pedidos Anuales', permission: 'planilla.view', role: 'area_compras', icon: ClipboardIcon },
  { key: 'compras-licitacion', label: 'Licitacion Anual', permission: 'planilla.view', role: 'area_compras', icon: DocumentIcon },
  { key: 'compras-listado-final', label: 'Listado Final', permission: 'planilla.view', role: 'area_compras', icon: ListIcon },
  { key: 'compras-adjudicacion', label: 'Adjudicacion', permission: 'planilla.manage', role: 'area_compras', icon: ShieldIcon },
  { key: 'supervisor', label: 'Patrimonio Escolar', permission: 'pedidos.manage', role: 'supervisor', icon: ActivityIcon },
  { key: 'mis-escuelas', label: 'Mis Escuelas', permission: 'instituciones.view', role: 'supervisor', hideForRoles: ['admin'], icon: BuildingIcon },
  { key: 'productos', label: 'Productos', permission: 'productos.view', hideForRoles: ['supervisor', 'director_area'], icon: BoxIcon },
  { key: 'movimientos', label: 'Movimientos', permission: 'movimientos.view', hideForRoles: ['supervisor', 'director_area'], icon: ActivityIcon },
  { key: 'pedidos', label: 'Pedidos', permission: 'pedidos.view', hideForRoles: ['director_area'], icon: ClipboardIcon },
  { key: 'instituciones', label: 'Instituciones', permission: 'instituciones.view', hideForRoles: ['supervisor', 'director_area'], icon: BuildingIcon },
  { key: 'historial', label: 'Historial', permission: 'instituciones.view', hideForRoles: ['supervisor', 'director_area'], icon: ListIcon },
  { key: 'proveedores', label: 'Proveedores', permission: 'proveedores.view', hideForRoles: ['supervisor', 'director_area'], icon: TruckIcon },
  { key: 'usuarios', label: 'Usuarios', permission: 'users.read', icon: UserIcon },
  { key: 'kits', label: 'Kits de Productos', permission: 'supervision.manage', role: 'director_area', icon: BoxIcon },
]

export default function Dashboard() {
  const { user, logout, hasPermission } = useAuth()
  const [activeTab, setActiveTab] = useState('inicio')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentDate, setCurrentDate] = useState(() => new Date())

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentDate(new Date())
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [])

  const visibleTabs = useMemo(() => {
    if (!user) return []

    if (user.role === 'directivo') {
      return TABS.filter((tab) => ['inicio', 'pedidos', 'mi-cuenta'].includes(tab.key))
    }

    if (user.role === 'area_compras') {
      return TABS.filter((tab) => [
        'inicio',
        'mi-cuenta',
        'compras-pedidos',
        'compras-licitacion',
        'compras-listado-final',
        'compras-adjudicacion',
      ].includes(tab.key))
    }

    if (user.role === 'admin') {
      return TABS.filter((tab) => !tab.role && tab.key !== 'mis-escuelas')
    }

    return TABS.filter((tab) => {
      if (tab.hideForRole && tab.hideForRole === user.role) return false
      if (tab.hideForRoles && tab.hideForRoles.includes(user.role)) return false
      if (tab.role && tab.role !== user.role) return false
      return !tab.permission || hasPermission(tab.permission)
    })
  }, [hasPermission, user])

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(visibleTabs[0]?.key || 'inicio')
    }
  }, [activeTab, visibleTabs])

  useEffect(() => {
    const root = document.body
    if (sidebarOpen) {
      root.classList.add('dashboard-nav-open')
    } else {
      root.classList.remove('dashboard-nav-open')
    }

    return () => root.classList.remove('dashboard-nav-open')
  }, [sidebarOpen])

  const formattedDate = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(currentDate)

  const formattedTime = new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(currentDate)

  const closeSidebar = () => setSidebarOpen(false)

  const renderTab = () => {
    switch (activeTab) {
      case 'inicio':
        return <Inicio onNavigate={setActiveTab} />
      case 'mi-cuenta':
        return <MiCuenta />
      case 'gestion-escuelas':
        return <DirectorAreaPanel initialSection="gestion-escuelas" />
      case 'gestion-pedidos':
        return <DirectorAreaPanel initialSection="gestion-pedidos" />
      case 'compras-pedidos':
        return <ComprasPanel section="pedidos" />
      case 'compras-licitacion':
        return <ComprasPanel section="licitacion" />
      case 'compras-listado-final':
        return <ComprasPanel section="listado-final" />
      case 'compras-adjudicacion':
        return <ComprasPanel section="adjudicacion" />
      case 'productos':
        return <Productos />
      case 'movimientos':
        return <Movimientos />
      case 'pedidos':
        return <Pedidos />
      case 'instituciones':
        return <Instituciones />
      case 'mis-escuelas':
        return <Instituciones supervisorMode />
      case 'historial':
        return <HistorialInstitucion />
      case 'supervisor':
        return <SupervisorDashboard />
      case 'proveedores':
        return <Proveedores />
      case 'usuarios':
        return <Usuarios />
      case 'kits':
        return <ProductKitsManager />
      default:
        return <Inicio onNavigate={setActiveTab} />
    }
  }

  return (
    <>
      <div className={`dashboard-shell ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <aside className="dashboard-sidebar">
          <div className="dashboard-brand">
            <img className="dashboard-sidebar-logo" src={LOGO_URL} alt="San Juan Gobierno" />
          </div>

          <nav className="dashboard-nav" aria-label="Panel administrativo">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon || GridIcon
              const isActive = activeTab === tab.key

              return (
                <button
                  key={tab.key}
                  type="button"
                  className={`dashboard-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab(tab.key)
                    closeSidebar()
                  }}
                >
                  <span className="dashboard-nav-icon" aria-hidden="true">
                    <Icon />
                  </span>
                  <span className="dashboard-nav-copy">
                    <span className="dashboard-nav-label">{tab.label}</span>
                  </span>
                </button>
              )
            })}
          </nav>

          <footer className="dashboard-sidebar-footer">
            <p className="dashboard-sidebar-caption">Depo Panel Administrativo</p>
          </footer>
        </aside>

        <div className="dashboard-main">
          <header className="dashboard-header">
            <div className="dashboard-header-left">
              <button
                type="button"
                className="dashboard-menu-toggle"
                onClick={() => setSidebarOpen((prev) => !prev)}
                aria-label="Abrir navegacion"
              >
                <MenuIcon />
              </button>

              <div className="dashboard-datetime">
                <span className="dashboard-datetime-date">{formattedDate}</span>
                <span className="dashboard-datetime-time">{formattedTime}</span>
              </div>
            </div>

            <div className="dashboard-header-center" />

            <div className="dashboard-header-right">
              <div className="dashboard-user-meta">
                <span className="dashboard-user-icon" aria-hidden="true">
                  <UserIcon />
                </span>
                <div className="dashboard-user-copy">
                  <strong>{user?.nombre || 'Usuario'}</strong>
                  <span>{ROLE_LABELS[user?.role] || user?.role || 'Sin rol'}</span>
                </div>
              </div>

              <button type="button" className="secondary dashboard-logout" onClick={logout}>
                Salir
              </button>
            </div>
          </header>

          <div className="dashboard-content">
            <div className="dashboard-view-frame">
              <section className="dashboard-module-card">
                {renderTab()}
              </section>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        aria-label="Cerrar navegacion"
        className="dashboard-sidebar-backdrop"
        onClick={closeSidebar}
      />
    </>
  )
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  )
}

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 4.5h6" />
      <rect x="6" y="3" width="12" height="18" rx="2.5" />
      <path d="M9 8.5h6M9 12.5h6M9 16.5h4" />
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 20.5V6.5A1.5 1.5 0 0 1 5.5 5H12v15.5" />
      <path d="M12 8h6.5A1.5 1.5 0 0 1 20 9.5v11" />
      <path d="M7.5 8.5h1M7.5 12h1M7.5 15.5h1M15.5 11.5h1M15.5 15h1" />
    </svg>
  )
}

function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3 4.5 7v10L12 21l7.5-4V7L12 3Z" />
      <path d="M4.5 7 12 11l7.5-4M12 11v10" />
    </svg>
  )
}

function ActivityIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 12h4l2.5-5 4 10 2.5-5H21" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 6.5h10M9 12h10M9 17.5h10" />
      <circle cx="5.5" cy="6.5" r="1.25" />
      <circle cx="5.5" cy="12" r="1.25" />
      <circle cx="5.5" cy="17.5" r="1.25" />
    </svg>
  )
}

function TruckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 6.5h10v8H3zM13 10h4l3 3v1.5h-7" />
      <circle cx="7" cy="17.5" r="2" />
      <circle cx="18" cy="17.5" r="2" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3.5 5.5 6v5.5c0 4.2 2.5 7.5 6.5 9 4-1.5 6.5-4.8 6.5-9V6L12 3.5Z" />
      <path d="m9.5 12 1.7 1.7 3.6-3.7" />
    </svg>
  )
}

function DocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V5A1.5 1.5 0 0 1 7.5 3.5Z" />
      <path d="M14 3.5V8h4M9 12h6M9 16h6" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}
