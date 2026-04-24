import { useAuth } from '../context/AuthContext'
import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../api'
import PrintButton from './PrintButton'

const ROLE_LABELS = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  director_area: 'Director de area',
  directivo: 'Directivo',
  operador: 'Operador',
  consulta: 'Consulta',
  control_ministerio: 'Control Ministerio',
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalType, setModalType] = useState(null)
  const printRef = useRef(null)

  useEffect(() => {
    if (user?.role === 'supervisor' || user?.role === 'directivo') {
      setLoading(false)
      return
    }

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
        <section className="dashboard-hero">
          <div className="dashboard-hero-copy">
            <span className="dashboard-hero-chip">Panel administrativo</span>
            <h2>Bienvenido, {user?.nombre || 'Usuario'}</h2>
            <p>{ROLE_LABELS[user?.role] || user?.role || 'Sin rol'} con acceso al resumen general del deposito.</p>
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
        </section>

        <div className="dashboard-section-grid">
          <section className="dashboard-section-card dashboard-section-card--span-8 dashboard-highlight">
            <div className="dashboard-section-head">
              <div>
                <h3>Resumen operativo</h3>
                <p>Accesos rapidos a las areas principales.</p>
              </div>
            </div>

            <div className="dashboard-stats-grid">
              <StatCard label="Productos" value={stats.productos.total} icon="PR" onClick={() => onNavigate?.('productos')} />
              <StatCard label="Stock bajo" value={stats.productos.stock_bajo} icon="SB" accent={stats.productos.stock_bajo > 0 ? '#E03C31' : '#065f46'} onClick={() => setModalType('stock_bajo')} />
              <StatCard label="Sin stock" value={stats.productos.sin_stock} icon="SS" accent={stats.productos.sin_stock > 0 ? '#b91c1c' : '#065f46'} onClick={() => setModalType('sin_stock')} />
              <StatCard label="Instituciones" value={stats.instituciones.total} icon="IN" onClick={() => onNavigate?.('instituciones')} />
              <StatCard label="Proveedores" value={stats.proveedores.total} icon="PV" onClick={() => onNavigate?.('proveedores')} />
            </div>
          </section>

          <section className="dashboard-section-card dashboard-section-card--span-4">
            <div className="dashboard-section-head">
              <div>
                <h3>Alertas</h3>
                <p>Estado actual del inventario.</p>
              </div>
            </div>

            <div className="dashboard-status-list">
              <div className="dashboard-status-row">
                <span className="dashboard-status-label">Productos activos</span>
                <span className="dashboard-status-value">{stats.productos.total}</span>
              </div>
              <div className="dashboard-status-row">
                <span className="dashboard-status-label">Con stock bajo</span>
                <span className="dashboard-status-value">{stats.productos.stock_bajo}</span>
              </div>
              <div className="dashboard-status-row">
                <span className="dashboard-status-label">Sin stock</span>
                <span className="dashboard-status-value">{stats.productos.sin_stock}</span>
              </div>
              <div className="dashboard-status-row">
                <span className="dashboard-status-label">Ultimos movimientos</span>
                <span className="dashboard-status-value">{stats.ultimos_movimientos.length}</span>
              </div>
            </div>
          </section>
        </div>

        <section className="dashboard-section-card">
          <div className="dashboard-section-head">
            <div>
              <h3>Movimientos del mes</h3>
              <p>Indicadores rapidos para el periodo actual.</p>
            </div>
          </div>

          <div className="dashboard-mini-grid">
            <MiniCard label="Total" value={stats.movimientos_mes.total} color="var(--dark)" />
            <MiniCard label="Ingresos" value={stats.movimientos_mes.ingresos} color="#065f46" />
            <MiniCard label="Egresos" value={stats.movimientos_mes.egresos} color="#b91c1c" />
            <MiniCard label="Ajustes" value={stats.movimientos_mes.ajustes} color="#92400e" />
            <MiniCard label="Devoluciones" value={stats.movimientos_mes.devoluciones} color="#1e40af" />
          </div>
        </section>

        {stats.stock_bajo.length > 0 && (
          <section className="dashboard-section-card dashboard-table-card">
            <div className="dashboard-section-head">
              <div>
                <h3>Productos con stock bajo</h3>
                <p>Productos que requieren seguimiento cercano.</p>
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
                  <p>Detalle completo del inventario filtrado.</p>
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
      <span className="dashboard-stat-value">{value}</span>
      <span className="dashboard-stat-label">{label}</span>
    </button>
  )
}

function MiniCard({ label, value, color }) {
  return (
    <div className="dashboard-mini-card">
      <div className="dashboard-mini-value" style={{ color }}>{value}</div>
      <div className="dashboard-mini-label">{label}</div>
    </div>
  )
}

function SupervisorInicio({ onNavigate, token, user }) {
  const [instituciones, setInstituciones] = useState([])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch(`/api/supervisor/instituciones?jurisdiccion=${encodeURIComponent(user?.jurisdiccion || '')}`, { token })
        if (res.ok) {
          const data = await res.json()
          setInstituciones(data.instituciones || [])
        }
      } catch (err) {
        console.error('Error cargando instituciones del supervisor:', err)
      }
    }

    load()
  }, [token, user?.jurisdiccion])

  const totalPendientes = instituciones.reduce((sum, item) => sum + (item.pedidos_pendientes || 0), 0)
  const totalTickets = instituciones.reduce((sum, item) => sum + (item.tickets_patrimonio || 0), 0)

  return (
    <div className="dashboard-stack">
      <section className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <span className="dashboard-hero-chip">Supervisor</span>
          <h2>Bienvenido, {user?.nombre || 'Usuario'}</h2>
          <p>Segui el estado de tus escuelas asignadas y el flujo de aprobaciones.</p>
        </div>

        <div className="dashboard-hero-aside">
          <div className="sv-jurisdiction-banner" style={{ margin: 0 }}>
            <span className="sv-jurisdiction-dot" />
            <span>Jurisdiccion: <strong>{user?.jurisdiccion || '-'}</strong></span>
            <span className="sv-jurisdiction-count">{instituciones.length} escuelas</span>
          </div>
        </div>
      </section>

      <section className="dashboard-section-card">
        <div className="dashboard-stats-grid">
          <StatCard label="Escuelas" value={instituciones.length} icon="ES" onClick={() => onNavigate?.('mis-escuelas')} />
          <StatCard label="Pendientes" value={totalPendientes} icon="PD" accent={totalPendientes > 0 ? '#E03C31' : '#065f46'} onClick={() => onNavigate?.('pedidos')} />
          <StatCard label="Patrimonio" value={totalTickets} icon="PT" accent={totalTickets > 0 ? '#1e40af' : '#065f46'} onClick={() => onNavigate?.('supervisor')} />
        </div>
      </section>

      <section className="dashboard-section-card dashboard-table-card">
        <div className="dashboard-section-head">
          <div>
            <h3>Mis escuelas</h3>
            <p>Vista rapida de los establecimientos a cargo.</p>
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

  return (
    <div className="dashboard-stack">
      <section className="dashboard-hero">
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
              <span className="dashboard-status-label">Pendientes de retirar</span>
              <span className="dashboard-status-value">{movimientosPendientes.cantidad || 0}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="dashboard-section-card">
        <div className="dashboard-stats-grid">
          <StatCard label="Pedidos aprobados" value={pedidosAprobados.cantidad || 0} icon="AP" accent={pedidosAprobados.cantidad > 0 ? '#FF8200' : '#065f46'} />
          <StatCard label="Pendientes de retirar" value={movimientosPendientes.cantidad || 0} icon="RT" accent={movimientosPendientes.cantidad > 0 ? '#E03C31' : '#065f46'} onClick={() => onNavigate?.('pedidos')} />
        </div>
      </section>

      {pedidosAprobados.items?.length > 0 && (
        <section className="dashboard-section-card dashboard-table-card">
          <div className="dashboard-section-head">
            <div>
              <h3>Pedidos aprobados para retirar</h3>
              <p>Solicitudes listas para coordinar entrega.</p>
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

      {movimientosPendientes.items?.length > 0 && (
        <section className="dashboard-section-card dashboard-table-card">
          <div className="dashboard-section-head">
            <div>
              <h3>Productos pendientes de retirar</h3>
              <p>Movimientos ya autorizados para tu institucion.</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Unidad</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {movimientosPendientes.items.map((mov) => (
                <tr key={mov.id}>
                  <td style={{ fontWeight: 600 }}>{mov.producto_nombre}</td>
                  <td style={{ textAlign: 'center' }}>{mov.cantidad}</td>
                  <td>{mov.unidad_medida || '-'}</td>
                  <td>{new Date(mov.fecha).toLocaleDateString('es-AR')}</td>
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
              <p>Actividad reciente asociada a la institucion.</p>
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
