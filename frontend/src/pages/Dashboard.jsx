import { useEffect, useMemo, useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'
import Inicio from '../components/Inicio'
import Productos from '../components/Productos'
import Movimientos from '../components/Movimientos'
import Pedidos from '../components/Pedidos'
import SolicitudesRetiro from '../components/SolicitudesRetiro'
import Instituciones from '../components/Instituciones'
import Proveedores from '../components/Proveedores'
import Usuarios from '../components/Usuarios'
import HistorialInstitucion from '../components/HistorialInstitucion'
import SupervisorDashboard from '../components/SupervisorDashboard'
import SupervisorStatsDashboard from '../components/SupervisorStatsDashboard'
import AsignarKit from '../components/AsignarKit'
import DirectorAreaPanel from '../components/DirectorAreaPanel'
import MiStock from '../components/MiStock'
import ComprasPanel from '../components/ComprasPanel'
import ProductKitsManager from '../components/ProductKitsManager'
import MiCuenta from '../components/MiCuenta'
import Depositos from '../components/Depositos'
import LicitacionesCerradas from '../components/LicitacionesCerradas'
import RecepcionLicitacion from '../components/RecepcionLicitacion'
import DistribucionEscuelas from '../components/DistribucionEscuelas'

const LOGO_URL = '/logo-sidebar.png'

const ROLE_LABELS = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  director_area: 'Director de area',
  directivo: 'Directivo',
  operador: 'Operador',
  area_compras: 'Area Compras',
  consulta: 'Consulta',
  control_ministerio: 'Control Ministerio',
  master: 'Master',
}

const TABS = [
  { key: 'inicio', label: 'Inicio', permission: null, icon: GridIcon },
  { key: 'zonas', label: 'Gestion de Zonas', permission: 'supervision.manage', roleFor: 'director_area', icon: BuildingIcon },
  { key: 'solicitud_anual', label: 'Solicitud Anual', permission: 'supervision.manage', roleFor: 'director_area', icon: ClipboardIcon },
  { key: 'resumen', label: 'Resumen Solicitud Anual', permission: 'supervision.manage', roleFor: 'director_area', icon: ListIcon },
  { key: 'compras-licitacion', label: 'Licitacion Anual', permission: 'planilla.view', roleFor: 'area_compras', icon: DocumentIcon },
  { key: 'compras-listado-final', label: 'Listado Final a Licitar', permission: 'planilla.view', roleFor: 'area_compras', icon: ListIcon },
  { key: 'compras-adjudicacion', label: 'Adjudicacion y Cierre', permission: 'planilla.manage', roleFor: 'area_compras', icon: ShieldIcon },
  { key: 'compras-entregas', label: 'Gestion de Entregas', permission: 'planilla.view', roleFor: 'area_compras', icon: TruckIcon },
  { key: 'deposito-recepcion', label: 'Recepcion Licitacion', permission: 'stock.movement.create', roleFor: 'operador', icon: DocumentIcon },
  { key: 'deposito-distribucion', label: 'Distribucion a Escuelas', permission: 'stock.movement.create', roleFor: 'operador', icon: TruckIcon },
  { key: 'solicitudes-retiro', label: 'Retiros Escolares', permission: 'stock.movement.create', roleFor: 'operador', icon: ClipboardIcon },
  { key: 'supervisor', label: 'Patrimonio Escolar', permission: 'pedidos.manage', roleFor: 'supervisor', icon: ActivityIcon },
  { key: 'asignar-kit', label: 'Asignar Kit', permission: 'pedidos.manage', roleFor: 'supervisor', icon: BoxIcon },
  { key: 'mis-escuelas', label: 'Mis Escuelas', permission: 'instituciones.view', roleFor: 'supervisor', hideForRoles: ['admin'], icon: BuildingIcon },
  { key: 'productos', label: 'Productos', permission: 'productos.view', hideForRoles: ['supervisor', 'director_area'], roleFor: 'admin', icon: BoxIcon },
  { key: 'movimientos', label: 'Movimientos', permission: 'movimientos.view', hideForRoles: ['supervisor', 'director_area'], roleFor: 'admin', icon: ActivityIcon },
  { key: 'pedidos', label: 'Pedidos', permission: 'pedidos.view', hideForRoles: ['admin'], roleFor: 'common', icon: ClipboardIcon },
  { key: 'instituciones', label: 'Instituciones', permission: 'instituciones.view', hideForRoles: ['supervisor'], roleFor: 'admin', icon: BuildingIcon },
  { key: 'historial', label: 'Historial', permission: 'instituciones.view', hideForRoles: ['supervisor', 'director_area'], roleFor: 'admin', icon: ListIcon },
  { key: 'proveedores', label: 'Proveedores', permission: 'proveedores.view', hideForRoles: ['supervisor', 'director_area'], roleFor: 'admin', icon: TruckIcon },
  { key: 'usuarios', label: 'Usuarios', permission: 'users.read', roleFor: 'admin', icon: UserIcon },
  { key: 'kits', label: 'Kits de Productos', permission: 'supervision.manage', roleFor: 'director_area', icon: BoxIcon },
  { key: 'depositos', label: 'Depositos', permission: 'stock.view', roleFor: 'admin', icon: BuildingIcon },
  { key: 'mi-cuenta', label: 'Mi cuenta', permission: null, icon: UserIcon },
  { key: 'mi-stock', label: 'Mi stock', permission: 'pedidos.view', roleFor: 'directivo', icon: BoxIcon },
]

export default function Dashboard() {
  const { user, logout, hasPermission, token, masterDirectorAreaId, setMasterDirectorAreaId } = useAuth()
  const [activeTab, setActiveTab] = useState('inicio')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [directoresMaster, setDirectoresMaster] = useState([])
  const masterDirectorIdRef = useRef(masterDirectorAreaId)

  masterDirectorIdRef.current = masterDirectorAreaId

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentDate(new Date())
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (user?.role !== 'master' || !token) {
      setDirectoresMaster([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await apiFetch('/api/users', { token })
        if (!res.ok || cancelled) return
        const data = await res.json()
        const dirs = (data.users || []).filter(
          (u) => String(u.role || '').toLowerCase() === 'director_area' && u.activo !== false
        )
        if (cancelled) return
        setDirectoresMaster(dirs)
        const valid = new Set(dirs.map((d) => String(d.id)))
        const prev = String(masterDirectorIdRef.current || '')
        const next = prev && valid.has(prev) ? prev : dirs[0] ? String(dirs[0].id) : ''
        if (next !== prev) setMasterDirectorAreaId(next)
      } catch {
        if (!cancelled) setDirectoresMaster([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.role, token, setMasterDirectorAreaId])

  const visibleTabs = useMemo(() => {
    if (!user) return []

    // Master role sees all tabs with role labels
    if (user.role === 'master') {
      return TABS
    }

    if (user.role === 'directivo') {
      return TABS.filter((tab) => ['inicio', 'pedidos', 'mi-stock', 'mi-cuenta'].includes(tab.key))
    }

    if (user.role === 'operador') {
      return TABS.filter((tab) => [
        'inicio',
        'mi-cuenta',
        'productos',
        'movimientos',
        'proveedores',
        'depositos',
        'deposito-recepcion',
        'deposito-distribucion',
        'solicitudes-retiro',
      ].includes(tab.key))
    }

    if (user.role === 'operador_escolar') {
      return TABS.filter((tab) => [
        'inicio',
        'mi-cuenta',
        'productos',
        'movimientos',
        'proveedores',
        'pedidos',
        'instituciones'
      ].includes(tab.key))
    }

    if (user.role === 'area_compras') {
      return TABS.filter((tab) => [
        'inicio',
        'mi-cuenta',
        'compras-licitacion',
        'compras-listado-final',
        'compras-adjudicacion',
        'compras-entregas',
        'proveedores',
      ].includes(tab.key))
    }

    if (user.role === 'admin' || user.role === 'master') {
      return TABS.filter((tab) => !tab.roleFor || tab.roleFor === 'admin' || tab.roleFor === 'common' && tab.key !== 'mis-escuelas')
    }

    return TABS.filter((tab) => {
      if (tab.hideForRole && tab.hideForRole === user.role) return false
      if (tab.hideForRoles && tab.hideForRoles.includes(user.role)) return false
      if (tab.roleFor && tab.roleFor !== user.role && tab.roleFor !== 'common') return false
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
        if (user?.role === 'director_area') {
          return <DirectorAreaPanel initialSection="dashboard" standalone={true} />
        }
        if (user?.role === 'supervisor') {
          return <SupervisorStatsDashboard />
        }
        return <Inicio onNavigate={setActiveTab} />
      case 'zonas':
        return <DirectorAreaPanel initialSection="gestion-escuelas" standalone={true} />
      case 'solicitud_anual':
        return <DirectorAreaPanel initialSection="solicitud-anual" standalone={true} />
      case 'resumen':
        return <DirectorAreaPanel initialSection="resumen-anual" standalone={true} />
      case 'compras-licitacion':
        return <ComprasPanel section="licitacion" />
      case 'compras-listado-final':
        return <ComprasPanel section="listado-final" />
      case 'compras-adjudicacion':
        return <ComprasPanel section="adjudicacion" />
      case 'compras-entregas':
        return <LicitacionesCerradas />
      case 'deposito-recepcion':
        return <RecepcionLicitacion />
      case 'deposito-distribucion':
        return <DistribucionEscuelas />
      case 'solicitudes-retiro':
        return <SolicitudesRetiro />
      case 'supervisor':
        return <SupervisorDashboard />
      case 'asignar-kit':
        return <AsignarKit />
      case 'mis-escuelas':
        return <Instituciones supervisorMode />
      case 'productos':
        return <Productos />
      case 'movimientos':
        return <Movimientos />
      case 'pedidos':
        return <Pedidos />
      case 'mi-stock':
        return <MiStock />
      case 'instituciones':
        return <Instituciones />
      case 'historial':
        return <HistorialInstitucion />
      case 'proveedores':
        return <Proveedores />
      case 'usuarios':
        return <Usuarios />
      case 'kits':
        return <ProductKitsManager />
      case 'depositos':
        return <Depositos />
      case 'mi-cuenta':
        return <MiCuenta />
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
              const label = tab.key === 'usuarios' && user?.role === 'director_area' ? 'Supervisores' : tab.label
              const roleLabel = user?.role === 'master' && tab.roleFor ? tab.roleFor : null

              return (
                <button
                  key={tab.key}
                  type="button"
                  className={`dashboard-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab(tab.key)
                    closeSidebar()
                  }}
                  title={roleLabel ? `Rol: ${roleLabel}` : ''}
                >
                  <span className="dashboard-nav-icon" aria-hidden="true">
                    <Icon />
                  </span>
                  <span className="dashboard-nav-copy">
                    <span className="dashboard-nav-label">{label}</span>
                    {roleLabel && <span className="dashboard-nav-role">{roleLabel}</span>}
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

          {user?.role === 'master' && (
            <div
              className="dashboard-master-context"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '12px 20px',
                padding: '12px 20px',
                margin: '0 20px',
                background: 'linear-gradient(90deg, #f0f7ff 0%, #fff 100%)',
                border: '1px solid #cfe2ff',
                borderRadius: 12,
                fontSize: '0.95rem',
              }}
            >
              <label htmlFor="master-director-select" style={{ fontWeight: 600, color: '#1e3a5f' }}>
                Director de area (contexto de prueba)
              </label>
              <select
                id="master-director-select"
                value={masterDirectorAreaId}
                onChange={(e) => setMasterDirectorAreaId(e.target.value)}
                disabled={directoresMaster.length === 0}
                style={{ minWidth: 260, padding: '8px 10px', borderRadius: 8, border: '1px solid #94a3b8' }}
              >
                {directoresMaster.length === 0 ? (
                  <option value="">Sin directores en el sistema</option>
                ) : (
                  directoresMaster.map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {[d.nombre, d.apellido].filter(Boolean).join(' ')}
                      {d.nivel_educativo ? ` — ${d.nivel_educativo}` : ''}
                    </option>
                  ))
                )}
              </select>
              {directoresMaster.length === 0 && (
                <span style={{ color: '#b45309', fontSize: '0.85rem' }}>
                  Creá un usuario con rol Director de area para usar los paneles de direccion y planillas.
                </span>
              )}
            </div>
          )}

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

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 6h13M8 12h13M8 18h13" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="18" r="1" />
    </svg>
  )
}

function DocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 2l7 3v5c0 5-3.5 9.7-7 11-3.5-1.3-7-6-7-11V5z" />
    </svg>
  )
}

function TruckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M1 3h13v13H1z" />
      <path d="M14 8h6v5h-6z" />
      <circle cx="6" cy="19" r="1.5" />
      <circle cx="18" cy="19" r="1.5" />
    </svg>
  )
}

function ActivityIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 12h4l2-6 4 12 2-6h4" />
    </svg>
  )
}

function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 16V8a2 2 0 0 0-1-1.73L13 3l-7 3.27A2 2 0 0 0 5 8v8a2 2 0 0 0 1 1.73L11 21l7-3.27A2 2 0 0 0 21 16z" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M4 21v-2a4 4 0 0 1 3-3.87" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

