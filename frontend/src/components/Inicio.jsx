import { useAuth } from '../context/AuthContext'
import { useEffect, useRef, useState } from 'react'
import { printMovimiento } from '../utils/printHelpers'
import { motion } from 'framer-motion'
import { apiFetch } from '../api'
import PrintButton from './PrintButton'
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts'

const ROLE_LABELS = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  director_area: 'Director de Area',
  directivo: 'Directivo',
  operador: 'Operador',
  operador_escolar: 'Operador Escolar',
  consulta: 'Consulta',
  control_ministerio: 'Control Ministerio',
  area_compras: 'Area Compras',
}

const TIPO_COLORS = {
  ingreso: { bg: '#ecfdf5', color: '#065f46' },
  egreso: { bg: '#fef2f2', color: '#b91c1c' },
  ajuste: { bg: '#fffbeb', color: '#92400e' },
  devolucion: { bg: '#eff6ff', color: '#1e40af' },
}

export default function Inicio({ onNavigate }) {
  const { user, token } = useAuth()
  const [stats, setStats] = useState(null)
  const [vencimientos, setVencimientos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalType, setModalType] = useState(null)
  const [movimientosModalInfo, setMovimientosModalInfo] = useState(null)
  const [movimientosList, setMovimientosList] = useState([])
  const printRef = useRef(null)

  const handleMovimientoClick = async (tipo, titulo) => {
    setMovimientosModalInfo({ tipo, titulo })
    setMovimientosList(null) // Representa estado de carga
    try {
      const res = await apiFetch(`/api/dashboard/movimientos-mes?tipo=${tipo}`, { token })
      if (res.ok) {
        const data = await res.json()
        setMovimientosList(data.movimientos || [])
      } else {
        setMovimientosList([])
      }
    } catch (err) {
      console.error(err)
      setMovimientosList([])
    }
  }

  useEffect(() => {
    if (user?.role === 'supervisor' || user?.role === 'directivo' || user?.role === 'director_area' || user?.role === 'area_compras') {
      setLoading(false)
      return
    }

    const fetchStats = async () => {
      try {
        const [statsRes, vencimientosRes] = await Promise.all([
          apiFetch('/api/dashboard/stats', { token }),
          apiFetch('/api/depositos/vencimientos-proximos?dias=60', { token }),
        ])

        if (!statsRes.ok) {
          throw new Error('Error al obtener datos')
        }

        const data = await statsRes.json()
        setStats(data)

        if (vencimientosRes.ok) {
          const vencimientosData = await vencimientosRes.json()
          setVencimientos(vencimientosData.alertas || [])
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [token, user?.role])

  if (loading) {
    return <p className="dashboard-muted-copy">Cargando resumen...</p>
  }

  if (user?.role === 'supervisor') {
    return <SupervisorInicio onNavigate={onNavigate} token={token} user={user} />
  }

  if (user?.role === 'directivo') {
    return <DirectivoInicio onNavigate={onNavigate} token={token} user={user} />
  }

  if (user?.role === 'director_area') {
    return <DirectorAreaInicio onNavigate={onNavigate} user={user} />
  }

  if (user?.role === 'area_compras') {
    return <AreaComprasInicio onNavigate={onNavigate} user={user} />
  }

  if (error) {
    return <p style={{ color: '#b91c1c', margin: 0 }}>Error: {error}</p>
  }

  if (!stats) {
    return null
  }

  const mesActual = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  const sinStockList = stats.sin_stock_list || []

  return (
    <div className="dashboard-stack">
      <div className="dashboard-page-actions">
        <PrintButton targetRef={printRef} title="Resumen General - Dashboard" />
      </div>

      <div ref={printRef} className="dashboard-stack">
        <motion.section 
          className="dashboard-hero"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <div className="dashboard-hero-copy">
            <span className="dashboard-hero-chip">Panel administrativo</span>
            <h2>Bienvenido, {user?.nombre || 'Usuario'}</h2>
            <p>{ROLE_LABELS[user?.role] || user?.role || 'Sin rol'} con acceso al estado general del deposito.</p>
          </div>

          <div className="dashboard-hero-aside">
            <div className="dashboard-status-list">
              <div className="dashboard-status-row">
                <span className="dashboard-status-label">Periodo activo</span>
                <span className="dashboard-status-value">{mesActual}</span>
              </div>
              <div className="dashboard-status-row">
                <span className="dashboard-status-label">Productos sin stock</span>
                <span className="dashboard-status-value">{stats.productos.sin_stock}</span>
              </div>
              <div className="dashboard-status-row">
                <span className="dashboard-status-label">Stock bajo</span>
                <span className="dashboard-status-value">{stats.productos.stock_bajo}</span>
              </div>
            </div>
          </div>
        </motion.section>

        <div className="dashboard-section-grid">
          <section className="dashboard-section-card dashboard-section-card--span-8 dashboard-highlight">
            <div className="dashboard-section-head">
              <div>
                <h3>Resumen operativo</h3>
                <p>Accesos rapidos a las areas principales del panel.</p>
              </div>
            </div>

            <div className="dashboard-stats-grid">
              <StatCard label="Productos" value={stats.productos.total} icon={<BoxIcon />} onClick={() => onNavigate?.('productos')} />
              <StatCard label="Stock bajo" value={stats.productos.stock_bajo} icon={<AlertTriangleIcon />} accent={stats.productos.stock_bajo > 0 ? '#E03C31' : '#065f46'} onClick={() => setModalType('stock_bajo')} />
              <StatCard label="Sin stock" value={stats.productos.sin_stock} icon={<XCircleIcon />} accent={stats.productos.sin_stock > 0 ? '#b91c1c' : '#065f46'} onClick={() => setModalType('sin_stock')} />
              <StatCard label="Instituciones" value={stats.instituciones.total} icon={<BuildingIcon />} onClick={() => onNavigate?.('instituciones')} />
              <StatCard label="Proveedores" value={stats.proveedores.total} icon={<TruckIcon />} onClick={() => onNavigate?.('proveedores')} />
            </div>
          </section>

          <section className="dashboard-section-card dashboard-section-card--span-4">
            <div className="dashboard-section-head">
              <div>
                <h3>Alertas</h3>
                <p>Lectura rapida del inventario actual.</p>
              </div>
            </div>

            <div className="dashboard-status-list">
              <div className="dashboard-status-row">
                <span className="dashboard-status-label">Productos activos</span>
                <span className="dashboard-status-value">{stats.productos.total}</span>
              </div>
              <div className="dashboard-status-row">
                <span className="dashboard-status-label">Alertas de vencimiento</span>
                <span className="dashboard-status-value">{vencimientos.length}</span>
              </div>
              <div className="dashboard-status-row">
                <span className="dashboard-status-label">Ultimos movimientos</span>
                <span className="dashboard-status-value">{stats.ultimos_movimientos.length}</span>
              </div>
            </div>
          </section>
        </div>

        {vencimientos.length > 0 && (
          <section className="dashboard-section-card dashboard-table-card">
            <div className="dashboard-section-head">
              <div>
                <h3>Alertas de vencimiento</h3>
                <p>Productos que vencen dentro de los proximos 60 dias.</p>
              </div>
            </div>

            <div className="dashboard-vencimientos-grid">
              {vencimientos.map((item, index) => (
                <div key={`${item.producto}-${item.fecha_vencimiento}-${index}`} className="dashboard-vencimiento-card">
                  <div>
                    <strong>{item.producto}</strong>
                    <p>Deposito: {item.deposito}</p>
                    <span className="dashboard-vencimiento-date">
                      Vence el {new Date(item.fecha_vencimiento).toLocaleDateString('es-AR')} ({item.dias_para_vencer} dias)
                    </span>
                  </div>
                  <div className="dashboard-vencimiento-stock">
                    <span>{item.stock_actual_deposito}</span>
                    <small>Stock</small>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="dashboard-section-card">
          <div className="dashboard-section-head">
            <div>
              <h3>Movimientos del mes</h3>
              <p>Indicadores rapidos del periodo actual.</p>
            </div>
          </div>

          <div className="dashboard-mini-grid">
            <MiniCard label="Total" value={stats.movimientos_mes.total} color="var(--dark)" onClick={() => handleMovimientoClick('total', 'Todos los movimientos del mes')} />
            <MiniCard label="Ingresos" value={stats.movimientos_mes.ingresos} color="#065f46" onClick={() => handleMovimientoClick('ingreso', 'Ingresos del mes')} />
            <MiniCard label="Egresos" value={stats.movimientos_mes.egresos} color="#b91c1c" onClick={() => handleMovimientoClick('egreso', 'Egresos del mes')} />
            <MiniCard label="Ajustes" value={stats.movimientos_mes.ajustes} color="#92400e" onClick={() => handleMovimientoClick('ajuste', 'Ajustes del mes')} />
            <MiniCard label="Devoluciones" value={stats.movimientos_mes.devoluciones} color="#1e40af" onClick={() => handleMovimientoClick('devolucion', 'Devoluciones del mes')} />
          </div>
        </section>

        <DashboardCharts stats={stats} />

        {stats.stock_bajo.length > 0 && (
          <section className="dashboard-section-card dashboard-table-card">
            <div className="dashboard-section-head">
              <div>
                <h3>Productos con stock bajo</h3>
                <p>Seguimiento de items cercanos al minimo.</p>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoria</th>
                  <th>Stock actual</th>
                  <th>Minimo</th>
                </tr>
              </thead>
              <tbody>
                {stats.stock_bajo.map((producto) => (
                  <tr key={producto.id}>
                    <td style={{ fontWeight: 600 }}>{producto.nombre}</td>
                    <td>{producto.categoria || '-'}</td>
                    <td style={{ color: producto.stock_actual === 0 ? '#b91c1c' : '#92400e', fontWeight: 700 }}>
                      {producto.stock_actual}
                    </td>
                    <td>{producto.stock_minimo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {stats.ultimos_movimientos.length > 0 && (
          <section className="dashboard-section-card dashboard-table-card">
            <div className="dashboard-section-head">
              <div>
                <h3>Actividad reciente</h3>
                <p>Ultimos movimientos registrados en el sistema.</p>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Institucion</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {stats.ultimos_movimientos.map((movimiento) => {
                  const tipoStyle = TIPO_COLORS[movimiento.tipo] || {}

                  return (
                    <tr key={movimiento.id}>
                      <td>{new Date(movimiento.fecha).toLocaleDateString('es-AR')}</td>
                      <td>
                        <span className="badge" style={{ background: tipoStyle.bg, color: tipoStyle.color }}>
                          {movimiento.tipo}
                        </span>
                      </td>
                      <td>{movimiento.producto || '-'}</td>
                      <td style={{ fontWeight: 600 }}>{movimiento.cantidad}</td>
                      <td>{movimiento.institucion || '-'}</td>
                      <td>{movimiento.usuario || '-'}</td>
                      <td>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => printMovimiento(movimiento)}
                          style={{ width: 'auto', margin: 0, padding: '4px 8px', fontSize: '0.8rem' }}
                        >
                          Imprimir
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        )}

        {modalType && (
          <div
            className="dashboard-modal-overlay"
            onClick={(event) => {
              if (event.target === event.currentTarget) setModalType(null)
            }}
          >
            <div className="dashboard-modal-panel">
              <div className="dashboard-section-head">
                <div>
                  <h3>{modalType === 'stock_bajo' ? 'Productos con stock bajo' : 'Productos sin stock'}</h3>
                  <p>Detalle del inventario filtrado.</p>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Categoria</th>
                    <th>Stock actual</th>
                    <th>Minimo</th>
                  </tr>
                </thead>
                <tbody>
                  {(modalType === 'stock_bajo' ? stats.stock_bajo : sinStockList).length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                        No hay productos para mostrar
                      </td>
                    </tr>
                  ) : (
                    (modalType === 'stock_bajo' ? stats.stock_bajo : sinStockList).map((producto) => (
                      <tr key={producto.id}>
                        <td style={{ fontWeight: 600 }}>{producto.nombre}</td>
                        <td>{producto.categoria || '-'}</td>
                        <td style={{ color: producto.stock_actual === 0 ? '#b91c1c' : '#92400e', fontWeight: 700 }}>
                          {producto.stock_actual}
                        </td>
                        <td>{producto.stock_minimo}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" className="secondary" onClick={() => setModalType(null)}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {movimientosModalInfo && (
          <div
            className="dashboard-modal-overlay"
            onClick={(event) => {
              if (event.target === event.currentTarget) setMovimientosModalInfo(null)
            }}
          >
            <div className="dashboard-modal-panel">
              <div className="dashboard-section-head">
                <div>
                  <h3>{movimientosModalInfo.titulo}</h3>
                  <p>Detalle de los movimientos registrados.</p>
                </div>
              </div>

              {movimientosList === null ? (
                <p style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px' }}>Cargando movimientos...</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th>Producto</th>
                      <th>Cantidad</th>
                      <th>Usuario</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientosList.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                          No hay movimientos para mostrar en esta categoría
                        </td>
                      </tr>
                    ) : (
                      movimientosList.map((mov) => {
                        const tipoStyle = TIPO_COLORS[mov.tipo] || {}
                        return (
                          <tr key={mov.id}>
                            <td>{new Date(mov.fecha).toLocaleDateString('es-AR')}</td>
                            <td>
                              <span className="badge" style={{ background: tipoStyle.bg, color: tipoStyle.color }}>
                                {mov.tipo}
                              </span>
                            </td>
                            <td style={{ fontWeight: 600 }}>{mov.producto || '-'}</td>
                            <td style={{ textAlign: 'center' }}>{mov.cantidad}</td>
                            <td>{mov.usuario || '-'}</td>
                            <td>
                              <button
                                type="button"
                                className="secondary"
                                onClick={() => printMovimiento(mov)}
                                style={{ width: 'auto', margin: 0, padding: '4px 8px', fontSize: '0.8rem' }}
                              >
                                Imprimir
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" className="secondary" onClick={() => setMovimientosModalInfo(null)}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, accent, onClick }) {
  return (
    <button
      type="button"
      className={`dashboard-stat-card ${typeof onClick === 'function' ? 'dashboard-stat-card-clickable' : ''}`}
      onClick={onClick}
      style={accent ? { '--dashboard-stat-accent': accent } : undefined}
    >
      <span className="dashboard-stat-icon" aria-hidden="true">{icon}</span>
      {value !== undefined && value !== null && value !== '' && <span className="dashboard-stat-value">{value}</span>}
      <span className="dashboard-stat-label">{label}</span>
    </button>
  )
}

function MiniCard({ label, value, color, onClick }) {
  if (onClick) {
    return (
      <button type="button" className="dashboard-mini-card" onClick={onClick}>
        <div className="dashboard-mini-value" style={{ color }}>{value}</div>
        <div className="dashboard-mini-label">{label}</div>
      </button>
    )
  }
  return (
    <div className="dashboard-mini-card">
      <div className="dashboard-mini-value" style={{ color }}>{value}</div>
      <div className="dashboard-mini-label">{label}</div>
    </div>
  )
}

function SupervisorInicio({ onNavigate, token, user }) {
  const [instituciones, setInstituciones] = useState([])
  const [supervisorMeta, setSupervisorMeta] = useState({
    zona_label: '',
    zona_count: 0,
    nivel_educativo: user?.nivel_educativo || '',
  })

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch('/api/supervisor/instituciones', { token })
        if (res.ok) {
          const data = await res.json()
          setInstituciones(data.instituciones || [])
          setSupervisorMeta({
            zona_label: data?.meta?.zona_label || '',
            zona_count: Number(data?.meta?.zona_count) || 0,
            nivel_educativo: data?.meta?.nivel_educativo || user?.nivel_educativo || '',
          })
        }
      } catch (err) {
        console.error('Error cargando instituciones del supervisor:', err)
      }
    }

    load()
  }, [token, user?.nivel_educativo])

  const totalPendientes = instituciones.reduce((sum, item) => sum + (item.pedidos_pendientes || 0), 0)
  const totalTickets = instituciones.reduce((sum, item) => sum + (item.tickets_patrimonio || 0), 0)
  const zonaLabel = supervisorMeta.zona_label || 'Sin zona asignada'
  const nivelLabel = supervisorMeta.nivel_educativo || '-'
  const zonaTitle = supervisorMeta.zona_count > 1 ? 'Zonas' : 'Zona'

  return (
    <div className="dashboard-stack">
      <motion.section 
        className="dashboard-hero"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="dashboard-hero-copy">
          <span className="dashboard-hero-chip">Supervisor</span>
          <h2>Bienvenido, {user?.nombre || 'Usuario'}</h2>
          <p>Seguimiento de escuelas, pedidos pendientes y tickets de patrimonio.</p>
        </div>

        <div className="dashboard-hero-aside">
          <div className="dashboard-status-list">
            <div className="dashboard-status-row">
              <span className="dashboard-status-label">{zonaTitle}</span>
              <span className="dashboard-status-value">{zonaLabel}</span>
            </div>
            <div className="dashboard-status-row">
              <span className="dashboard-status-label">Nivel</span>
              <span className="dashboard-status-value">{nivelLabel}</span>
            </div>
            <div className="dashboard-status-row">
              <span className="dashboard-status-label">Escuelas asignadas</span>
              <span className="dashboard-status-value">{instituciones.length}</span>
            </div>
          </div>
        </div>
      </motion.section>

      <section className="dashboard-section-card">
        <div className="dashboard-stats-grid">
          <StatCard label="Escuelas" value={instituciones.length} icon={<BuildingIcon />} onClick={() => onNavigate?.('mis-escuelas')} />
          <StatCard label="Pedidos pendientes" value={totalPendientes} icon={<ClipboardIcon />} accent={totalPendientes > 0 ? '#E03C31' : '#065f46'} onClick={() => onNavigate?.('pedidos')} />
          <StatCard label="Tickets patrimonio" value={totalTickets} icon={<ActivityIcon />} accent={totalTickets > 0 ? '#2563eb' : '#065f46'} onClick={() => onNavigate?.('supervisor')} />
        </div>
      </section>

      <section className="dashboard-section-card dashboard-table-card">
        <div className="dashboard-section-head">
          <div>
            <h3>Mis escuelas</h3>
            <p>Vista rapida de instituciones asignadas.</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Escuela</th>
              <th>CUE</th>
              <th>Pedidos</th>
              <th>Patrimonio</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {instituciones.map((inst) => (
              <tr key={inst.id}>
                <td style={{ fontWeight: 600 }}>{inst.nombre}</td>
                <td>{inst.cue}</td>
                <td style={{ textAlign: 'center' }}>
                  {inst.pedidos_pendientes > 0 ? (
                    <span className="badge badge-estado-pendiente">{inst.pedidos_pendientes}</span>
                  ) : (
                    <span className="badge badge-estado-aprobado">0</span>
                  )}
                </td>
                <td style={{ textAlign: 'center' }}>
                  {inst.tickets_patrimonio > 0 ? (
                    <span className="badge" style={{ background: '#eff6ff', color: '#1e40af' }}>{inst.tickets_patrimonio}</span>
                  ) : (
                    <span className="badge badge-estado-aprobado">0</span>
                  )}
                </td>
                <td>
                  <div className="inline-actions">
                    <button type="button" onClick={() => onNavigate?.('pedidos')}>Pedidos</button>
                    <button type="button" onClick={() => onNavigate?.('supervisor')} style={{ background: '#2563eb' }}>Patrimonio</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function DirectivoInicio({ onNavigate, token, user }) {
  const [alertas, setAlertas] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch('/api/directivo/alertas', { token })
        if (res.ok) {
          const data = await res.json()
          setAlertas(data)
        } else {
          setError('No se pudieron cargar las alertas')
        }
      } catch (err) {
        console.error('Error cargando alertas:', err)
        setError('Error al cargar alertas')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [token])

  if (loading) {
    return <p className="dashboard-muted-copy">Cargando informacion...</p>
  }

  const institucion = alertas?.institucion || user?.institucion
  const pedidosAprobados = alertas?.alertas?.pedidosAprobados || {}
  const movimientosPendientes = alertas?.alertas?.movimientosPendientes || {}
  const ultimasTransacciones = alertas?.ultimasTransacciones || []
  const pendientesItems = movimientosPendientes.items || []
  const pendientesPorPedido = Array.from(
    pendientesItems.reduce((map, item) => {
      const key = item.id_pedido || item.id || 'sin-pedido'
      const current = map.get(key) || {
        id_pedido: item.id_pedido,
        tipo_pedido: item.tipo_pedido || 'anual',
        fecha: item.fecha,
        items: [],
        cantidad_total: 0,
      }
      current.items.push(item)
      current.cantidad_total += Number(item.cantidad || 0)
      map.set(key, current)
      return map
    }, new Map()).values()
  )
  const pendientesCantidad = pendientesPorPedido.length

  return (
    <div className="dashboard-stack">
      <motion.section 
        className="dashboard-hero"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="dashboard-hero-copy">
          <span className="dashboard-hero-chip">Directivo</span>
          <h2>{institucion?.nombre || 'Tu institucion'}</h2>
          <p>CUE: {institucion?.cue || '-'}.</p>
        </div>

        <div className="dashboard-hero-aside">
          <div className="dashboard-status-list">
            <div className="dashboard-status-row">
              <span className="dashboard-status-label">Pedidos aprobados</span>
              <span className="dashboard-status-value">{pedidosAprobados.cantidad || 0}</span>
            </div>
            <div className="dashboard-status-row">
              <span className="dashboard-status-label">Pendiente retirar</span>
              <span className="dashboard-status-value">{pendientesCantidad}</span>
            </div>
          </div>
        </div>
      </motion.section>

      <section className="dashboard-section-card">
        <div className="dashboard-stats-grid">
          <StatCard label="Pedidos aprobados" value={pedidosAprobados.cantidad || 0} icon={<ClipboardIcon />} accent={pedidosAprobados.cantidad > 0 ? '#FF8200' : '#065f46'} />
          <StatCard label="Pendiente retirar" value={pendientesCantidad} icon={<TruckIcon />} accent={pendientesCantidad > 0 ? '#E03C31' : '#065f46'} onClick={() => onNavigate?.('pedidos')} />
        </div>
      </section>

      {pedidosAprobados.items?.length > 0 && (
        <section className="dashboard-section-card dashboard-table-card">
          <div className="dashboard-section-head">
            <div>
              <h3>Pedidos aprobados para retirar</h3>
              <p>Solicitudes listas para coordinar la entrega.</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>ID Pedido</th>
                <th>Fecha</th>
                <th>Cantidad de items</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {pedidosAprobados.items.map((pedido) => (
                <tr key={pedido.id}>
                  <td style={{ fontWeight: 600 }}>#{pedido.id}</td>
                  <td>{new Date(pedido.created_at).toLocaleDateString('es-AR')}</td>
                  <td style={{ textAlign: 'center' }}>{pedido.cantidad_items}</td>
                  <td><span className="badge badge-estado-aprobado">Aprobado</span></td>
                </tr>
              ))}
            </tbody>
          </table>

          <button type="button" onClick={() => onNavigate?.('pedidos')}>
            Ver todos los pedidos
          </button>
        </section>
      )}

      {pendientesPorPedido.length > 0 && (
        <section className="dashboard-section-card dashboard-table-card">
          <div className="dashboard-section-head">
            <div>
              <h3>Productos pendientes de retirar</h3>
              <p>Saldo aprobado que todavia no fue marcado como entregado por deposito.</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Productos pendientes</th>
                <th>Total</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {pendientesPorPedido.map((pedido) => (
                <tr key={pedido.id_pedido || pedido.fecha}>
                  <td style={{ fontWeight: 600 }}>
                    #{pedido.id_pedido || '-'} {pedido.tipo_pedido === 'refuerzo' ? '(Refuerzo)' : '(Anual)'}
                  </td>
                  <td>
                    {pedido.items.map((item) => (
                      <div key={`${pedido.id_pedido}-${item.id_producto}`}>
                        {item.producto_nombre}: {item.cantidad} {item.unidad_medida || 'unidad'}
                      </div>
                    ))}
                  </td>
                  <td style={{ textAlign: 'center' }}>{pedido.cantidad_total}</td>
                  <td>{new Date(pedido.fecha).toLocaleDateString('es-AR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {ultimasTransacciones.length > 0 && (
        <section className="dashboard-section-card dashboard-table-card">
          <div className="dashboard-section-head">
            <div>
              <h3>Ultimos movimientos</h3>
              <p>Actividad reciente de la institucion.</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Usuario</th>
              </tr>
            </thead>
            <tbody>
              {ultimasTransacciones.map((transaccion) => {
                const tipoStyle = TIPO_COLORS[transaccion.tipo] || {}

                return (
                  <tr key={transaccion.id}>
                    <td>{new Date(transaccion.fecha).toLocaleDateString('es-AR')}</td>
                    <td>
                      <span className="badge" style={{ background: tipoStyle.bg, color: tipoStyle.color }}>
                        {transaccion.tipo}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{transaccion.producto_nombre}</td>
                    <td style={{ textAlign: 'center' }}>{transaccion.cantidad} {transaccion.unidad_medida || ''}</td>
                    <td>{transaccion.usuario_nombre || '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}

      {!pedidosAprobados.items?.length && !movimientosPendientes.items?.length && !ultimasTransacciones.length && (
        <section className="dashboard-empty-state">
          <p style={{ margin: '0 0 12px', fontWeight: 700 }}>Todo esta al dia</p>
          <p style={{ margin: '0 0 20px' }}>No hay pedidos pendientes de retirar ni movimientos recientes.</p>
          <button type="button" onClick={() => onNavigate?.('pedidos')} style={{ width: 'auto' }}>
            Ir a Pedidos
          </button>
        </section>
      )}

      {error && (
        <div className="msg show msg-error">
          {error}
        </div>
      )}
    </div>
  )
}

function DirectorAreaInicio({ onNavigate }) {
  const { user, token } = useAuth()
  const [instituciones, setInstituciones] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch('/api/instituciones', { token })
        if (res.ok) {
          const data = await res.json()
          let list = data.instituciones || []
          // Filtrar por nivel educativo del director
          if (user?.nivel_educativo) {
            list = list.filter(inst => inst.nivel === user.nivel_educativo)
          }
          setInstituciones(list)
        }
      } catch (err) {
        console.error('Error cargando instituciones:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token, user?.nivel_educativo])

  const escuelasSinRetiro = instituciones.filter(inst => inst.status === 'no_retiraron')

  if (loading) return <p className="dashboard-muted-copy">Cargando...</p>

  return (
    <div className="dashboard-stack">
      <section className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <span className="dashboard-hero-chip">Director de Área</span>
          <h2>Bienvenido, {user?.nombre || 'Usuario'}</h2>
          <p>Gestión de zonas, supervisores y solicitudes anuales.</p>
        </div>

        <div className="dashboard-hero-aside">
          <div className="dashboard-status-list">
            <div className="dashboard-status-row">
              <span className="dashboard-status-label">Jurisdicción</span>
              <span className="dashboard-status-value">{user?.jurisdiccion || 'San Juan'}</span>
            </div>
            <div className="dashboard-status-row">
              <span className="dashboard-status-label">Nivel</span>
              <span className="dashboard-status-value">{user?.nivel_educativo || '-'}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="dashboard-section-card">
        <div className="dashboard-stats-grid">
          <StatCard label="Escuelas Totales" value={instituciones.length} icon={<BuildingIcon />} onClick={() => onNavigate?.('instituciones')} />
          <StatCard label="Sin Retiro" value={escuelasSinRetiro.length} icon={<AlertTriangleIcon />} accent={escuelasSinRetiro.length > 0 ? '#E03C31' : '#065f46'} />
          <StatCard label="Zonas" value="📍" icon={<MapIcon />} onClick={() => onNavigate?.('zonas')} />
          <StatCard label="Solicitud Anual" value="📅" icon={<ClipboardIcon />} onClick={() => onNavigate?.('solicitud_anual')} />
          <StatCard label="Kits" value="📦" icon={<BoxIcon />} onClick={() => onNavigate?.('kits')} />
        </div>
      </section>

      {escuelasSinRetiro.length > 0 && (
        <section className="dashboard-section-card dashboard-table-card">
          <div className="dashboard-section-head">
            <div>
              <h3>Escuelas sin retiro</h3>
              <p>Instituciones que aún no han registrado retiros.</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Escuela</th>
                <th>CUE</th>
                <th>Departamento</th>
              </tr>
            </thead>
            <tbody>
              {escuelasSinRetiro.map((inst) => (
                <tr key={inst.id}>
                  <td style={{ fontWeight: 600 }}>{inst.nombre}</td>
                  <td>{inst.cue || '-'}</td>
                  <td>{inst.departamento || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}

function AreaComprasInicio({ onNavigate, user }) {
  const { token } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  const accesos = [
    {
      key: 'productos',
      label: 'Listado de productos en stock',
      icon: <BoxIcon />,
    },
    {
      key: 'compras-licitacion',
      label: 'Licitación anual',
      icon: <ClipboardIcon />,
    },
    {
      key: 'compras-listado-final',
      label: 'Listado final a licitar',
      icon: <ListIcon />,
    },
    {
      key: 'proveedores',
      label: 'Proveedores',
      icon: <TruckIcon />,
    },
  ]

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch('/api/dashboard/stats', { token })
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        } else {
          setStats({ stock_bajo: [] })
        }
      } catch {
        setStats({ stock_bajo: [] })
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [token])

  return (
    <div className="dashboard-stack">
      <section className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <span className="dashboard-hero-chip">Área de Compras</span>
          <h2>Bienvenido, {user?.nombre || 'Usuario'}</h2>
          <p>Accesos directos a stock, licitación y proveedores.</p>
        </div>

        <div className="dashboard-hero-aside">
          <div className="dashboard-status-list">
            <div className="dashboard-status-row">
              <span className="dashboard-status-label">Rol activo</span>
              <span className="dashboard-status-value">Área Compras</span>
            </div>
            <div className="dashboard-status-row">
              <span className="dashboard-status-label">Enfoque</span>
              <span className="dashboard-status-value">Stock y licitación</span>
            </div>
          </div>
        </div>
      </section>

      <section className="dashboard-section-card">
        <div className="dashboard-section-head">
          <div>
            <h3>Accesos rápidos</h3>
            <p>Accesos directos para compras y revisión de inventario.</p>
          </div>
        </div>

        <div className="dashboard-stats-grid">
          {accesos.map((acceso) => (
            <StatCard
              key={acceso.key}
              label={acceso.label}
              icon={acceso.icon}
              onClick={() => onNavigate?.(acceso.key)}
            />
          ))}
        </div>
      </section>

      <section className="dashboard-section-card dashboard-table-card">
        <div className="dashboard-section-head">
          <div>
            <h3>Productos con stock bajo</h3>
            <p>Lista priorizada para revisar reposición antes de licitar o comprar.</p>
          </div>
        </div>

        {loading ? (
          <div className="dashboard-empty-state" style={{ margin: 0 }}>
            <p style={{ margin: 0, fontWeight: 700 }}>Cargando productos con stock bajo...</p>
          </div>
        ) : (stats?.stock_bajo || []).length > 0 ? (
          <div style={{ display: 'grid', gap: 12 }}>
            {(stats?.stock_bajo || []).map((producto) => (
              <div key={producto.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.7fr 0.7fr 0.8fr', gap: 12, alignItems: 'center', padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 10, background: 'white' }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--dark)' }}>{producto.nombre}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>{producto.categoria || 'Sin categoría'}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 800, color: '#b91c1c' }}>{producto.stock_actual}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Stock actual</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 800, color: 'var(--dark)' }}>{producto.stock_minimo}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Mínimo</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <button type="button" onClick={() => onNavigate?.('productos')} style={{ width: 'auto', margin: 0 }}>
                    Ver producto
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="dashboard-empty-state" style={{ margin: 0 }}>
            <p style={{ margin: '0 0 12px', fontWeight: 700 }}>No hay productos con stock bajo</p>
            <p style={{ margin: 0 }}>El inventario no muestra alertas de reposición por ahora.</p>
          </div>
        )}
      </section>
    </div>
  )
}

function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22">
      <path d="M21 16V8a2 2 0 0 0-1-1.73L13 3l-7 3.27A2 2 0 0 0 5 8v8a2 2 0 0 0 1 1.73L11 21l7-3.27A2 2 0 0 0 21 16z" />
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22">
      <path d="M4 20.5V6.5A1.5 1.5 0 0 1 5.5 5H12v15.5" />
      <path d="M12 8h6.5A1.5 1.5 0 0 1 20 9.5v11" />
      <path d="M7.5 8.5h1M7.5 12h1M7.5 15.5h1M15.5 11.5h1M15.5 15h1" />
    </svg>
  )
}

function TruckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22">
      <path d="M1 3h13v13H1z" />
      <path d="M14 8h6v5h-6z" />
      <circle cx="6" cy="19" r="1.5" />
      <circle cx="18" cy="19" r="1.5" />
    </svg>
  )
}

function AlertTriangleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function XCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  )
}

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22">
      <path d="M9 4.5h6" />
      <rect x="6" y="3" width="12" height="18" rx="2.5" />
      <path d="M9 8.5h6M9 12.5h6M9 16.5h4" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22">
      <path d="M8 6h12" />
      <path d="M8 12h12" />
      <path d="M8 18h12" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="18" r="1" />
    </svg>
  )
}

function ActivityIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22">
      <path d="M3 12h4l2-6 4 12 2-6h4" />
    </svg>
  )
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  )
}

function DashboardCharts({ stats }) {
  if (!stats) return null;

  const stockNormal = stats.productos.total - stats.productos.stock_bajo - stats.productos.sin_stock;
  
  const productData = [
    { name: 'Stock Normal', value: stockNormal > 0 ? stockNormal : 0 },
    { name: 'Stock Bajo', value: stats.productos.stock_bajo || 0 },
    { name: 'Sin Stock', value: stats.productos.sin_stock || 0 }
  ].filter(d => d.value > 0);

  const COLORS = ['#065f46', '#E03C31', '#b91c1c'];

  const movData = [
    { name: 'Ingresos', cantidad: stats.movimientos_mes.ingresos || 0, fill: '#065f46' },
    { name: 'Egresos', cantidad: stats.movimientos_mes.egresos || 0, fill: '#b91c1c' },
    { name: 'Ajustes', cantidad: stats.movimientos_mes.ajustes || 0, fill: '#92400e' },
    { name: 'Devoluciones', cantidad: stats.movimientos_mes.devoluciones || 0, fill: '#1e40af' },
  ];

  return (
    <section className="dashboard-section-card">
      <div className="dashboard-section-head">
        <div>
          <h3>Gráficos Estadísticos</h3>
          <p>Visualización del estado del inventario y movimientos mensuales.</p>
        </div>
      </div>
      
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginTop: '16px' }}>
        {/* Gráfico de Estado de Stock */}
        <div className="chart-container">
          <h4>Distribución de Stock</h4>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={productData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {productData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value) => [value, 'Productos']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico de Movimientos del Mes */}
        <div className="chart-container">
          <h4>Movimientos del Mes</h4>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={movData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted)' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted)' }} />
                <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} formatter={(value) => [value, 'Cantidad']} />
                <Bar dataKey="cantidad" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  )
}
