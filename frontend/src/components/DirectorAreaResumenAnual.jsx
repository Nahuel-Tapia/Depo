import React, { useMemo, useState, useEffect } from 'react'
import { apiFetch } from '../api'
import { useAuth } from '../context/AuthContext'

export default function DirectorAreaResumenAnual({ solicitudes, submissionStatus, onSent }) {
  const { token, withMasterDirector } = useAuth()
  const [filtroEscuela, setFiltroEscuela] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendientes, setPendientes] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [error, setError] = useState(null)
  const [selectedSolicitud, setSelectedSolicitud] = useState(null)
  
  const anioActual = new Date().getFullYear()

  const loadPendientes = async () => {
    try {
      const pendRes = await apiFetch(withMasterDirector(`/api/compras/licitacion/anual/escuelas-pendientes?anio=${anioActual}`), { token })
      if (pendRes.ok) {
        const data = await pendRes.json()
        setPendientes(data.pendientes || [])
      }
    } catch (err) {}
  }

  useEffect(() => {
    loadPendientes()
  }, [token, withMasterDirector])
  
  // Solo solicitudes anuales que ya fueron aprobadas por el director
  const solicitudesAprobadas = useMemo(() => {
    return solicitudes.filter(
      (s) => (s.tipo || 'anual') === 'anual' && s.estado === 'aprobado' && s.aprobado_director_area === true
    )
  }, [solicitudes])

  // SECCION A: Consolidado de productos
  const consolidado = useMemo(() => {
    const productosMap = new Map()

    solicitudesAprobadas.forEach((solicitud) => {
      ;(solicitud.items || []).forEach((item) => {
        const nombre = String(item.producto || '').trim() || 'Producto sin nombre'
        const cantidad = Number(item.cantidad || 0)
        const acumulado = productosMap.get(nombre) || { producto: nombre, cantidad: 0 }

        acumulado.cantidad += cantidad
        productosMap.set(nombre, acumulado)
      })
    })

    return Array.from(productosMap.values()).sort((a, b) =>
      a.producto.localeCompare(b.producto, 'es', { sensitivity: 'base' })
    )
  }, [solicitudesAprobadas])

  // SECCION B: Detalle por escuela
  const detallePorEscuela = useMemo(() => {
    let filtradas = solicitudesAprobadas
    if (filtroEscuela.trim()) {
      const f = filtroEscuela.toLowerCase()
      filtradas = filtradas.filter(s => 
        (s.escuela_nombre || s.institucion || '').toLowerCase().includes(f)
      )
    }
    return filtradas
  }, [solicitudesAprobadas, filtroEscuela])

  const handleSendClick = () => {
    if (pendientes.length > 0) {
      setShowModal(true)
    } else {
      confirmSend()
    }
  }

  const confirmSend = async () => {
    setLoading(true)
    setError(null)
    setShowModal(false)
    try {
      const res = await apiFetch(withMasterDirector('/api/compras/licitacion/anual/enviar-final'), {
        token,
        method: 'POST'
      })
      if (res.ok) {
        if (onSent) onSent()
      } else {
        const data = await res.json()
        setError(data.error || 'No se pudo realizar el envío')
      }
    } catch (err) {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const isSent = submissionStatus?.sent
  const sentAt = submissionStatus?.planilla?.enviada_at
  const isDevuelta = submissionStatus?.planilla?.estado === 'devuelta'
  const motivoDevolucion = submissionStatus?.planilla?.motivo_devolucion

  return (
    <div style={{ background: '#f8fafc', borderRadius: 12, padding: '24px 32px' }}>
      {isDevuelta && (
        <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 8, padding: '12px 16px', marginBottom: 24, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1.3rem' }}>↩</span>
          <div>
            <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 2 }}>Tu licitación fue devuelta por el área de Compras</div>
            {motivoDevolucion && <div style={{ fontSize: '0.85rem', color: '#78350f' }}>Motivo: {motivoDevolucion}</div>}
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 4 }}>Podés corregir y volver a enviar.</div>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, borderBottom: '1px solid #e2e8f0', paddingBottom: 20 }}>
        <div>
          <h2 style={{ color: '#1e3a8a', marginBottom: 8, marginTop: 0, fontSize: '1.8rem', fontWeight: 800 }}>Resumen Solicitud Anual {anioActual}</h2>
          <p style={{ color: 'var(--muted)', margin: 0, fontSize: '0.95rem' }}>
            Vista consolidada de todos los pedidos aprobados para el ciclo lectivo actual.
          </p>
        </div>

        <div style={{ textAlign: 'right' }}>
          {isSent ? (
            <div className="fade-in">
              <div style={{ 
                background: '#f0fdf4', 
                color: '#166534', 
                padding: '12px 24px', 
                borderRadius: 8, 
                border: '1px solid #bbf7d0',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 4
              }}>
                <span style={{ fontSize: '1.2rem' }}>✅</span> Enviado a Compras
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                Fecha: {new Date(sentAt).toLocaleString('es-AR')}
              </div>
            </div>
          ) : (
            <button 
              className="primary" 
              onClick={handleSendClick} 
              disabled={loading || solicitudesAprobadas.length === 0}
              style={{ padding: '12px 24px', fontSize: '1rem', fontWeight: 700 }}
            >
              {loading ? 'Enviando...' : '🚀 Enviar a Compras'}
            </button>
          )}
          {error && <div style={{ color: 'var(--red)', fontSize: '0.85rem', marginTop: 8 }}>{error}</div>}
          {!isSent && solicitudesAprobadas.length === 0 && (
            <div style={{ fontSize: '0.8rem', color: 'var(--red)', marginTop: 4 }}>
              Debés aprobar al menos una solicitud antes de enviar.
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        
        {/* LISTA CONSOLIDADA */}
        <section style={{ 
          background: '#ffffff', 
          padding: 24, 
          borderRadius: 12, 
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.025)',
          border: '1px solid #f1f5f9'
        }}>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '1.25rem', color: '#1e3a8a', fontWeight: 700 }}>Lista Consolidada de Productos</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0 0 16px 0' }}>Suma acumulada de productos aprobados para todas las escuelas.</p>
          
          <div className="table-wrapper" style={{ margin: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ textAlign: 'left', padding: '12px 16px', color: '#475569', fontWeight: 600 }}>PRODUCTO</th>
                  <th style={{ textAlign: 'center', padding: '12px 16px', color: '#475569', fontWeight: 600 }}>CANTIDAD TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {consolidado.length === 0 ? (
                  <tr>
                    <td colSpan={2} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                      No hay productos aprobados todavía.
                    </td>
                  </tr>
                ) : (
                  consolidado.map((p, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', color: '#334155' }}>{p.producto}</td>
                      <td style={{ textAlign: 'center', padding: '12px 16px', fontWeight: 700, color: '#1e3a8a' }}>{p.cantidad}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* DETALLE POR ESCUELA */}
        <section style={{ 
          background: '#ffffff', 
          padding: 24, 
          borderRadius: 12, 
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.025)',
          border: '1px solid #f1f5f9'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '1.25rem', color: '#1e3a8a', fontWeight: 700 }}>Detalle por Escuela</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: 0 }}>Historial de escuelas con pedidos anuales aprobados.</p>
            </div>
            <div>
              <input 
                type="text" 
                placeholder="Filtrar por nombre de escuela..." 
                value={filtroEscuela}
                onChange={(e) => setFiltroEscuela(e.target.value)}
                style={{ width: '280px', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
              />
            </div>
          </div>
          
          <div className="table-wrapper" style={{ margin: 0, maxHeight: '500px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 }}>
                  <th style={{ textAlign: 'left', padding: '12px 16px', color: '#475569', fontWeight: 600 }}>ESCUELA</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', color: '#475569', fontWeight: 600 }}>SUPERVISOR</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', color: '#475569', fontWeight: 600 }}>FECHA APROB. SUPERVISOR</th>
                  <th style={{ textAlign: 'center', padding: '12px 16px', color: '#475569', fontWeight: 600 }}>ITEMS TOTALES</th>
                  <th style={{ textAlign: 'center', padding: '12px 16px', color: '#475569', fontWeight: 600 }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {detallePorEscuela.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                      No se encontraron escuelas aprobadas.
                    </td>
                  </tr>
                ) : (
                  detallePorEscuela.map((s) => {
                    const totalCantidad = (s.items || []).reduce((sum, item) => sum + Number(item.cantidad || 0), 0)
                    const fechaAprobSup = s.fecha_aprobacion_supervisor 
                      ? new Date(s.fecha_aprobacion_supervisor).toLocaleDateString('es-AR') 
                      : '-'
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 500, color: '#334155' }}>
                          {s.escuela_nombre || s.institucion || `Escuela #${s.id}`}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#475569' }}>
                          {s.supervisor_nombre || 'N/A'}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#475569' }}>
                          {fechaAprobSup}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#334155' }}>
                          {totalCantidad}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <button 
                            className="secondary"
                            onClick={() => setSelectedSolicitud(s)}
                            style={{ 
                              padding: '6px 14px', 
                              fontSize: '0.85rem', 
                              borderRadius: 6, 
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6
                            }}
                          >
                            Ver detalle
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

      </div>

      {/* MODAL VER DETALLE */}
      {selectedSolicitud && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: 20
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 16,
            width: '100%',
            maxWidth: '650px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            padding: 32,
            position: 'relative',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <button 
              onClick={() => setSelectedSolicitud(null)}
              style={{
                position: 'absolute',
                top: 20,
                right: 20,
                background: 'transparent',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: 'var(--muted)',
                lineHeight: 1
              }}
            >
              &times;
            </button>
            
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.4rem', color: '#1e3a8a', fontWeight: 800 }}>
              Detalle de Pedido Anual
            </h3>
            <h4 style={{ margin: '0 0 24px 0', fontSize: '1.1rem', color: '#475569', fontWeight: 500 }}>
              {selectedSolicitud.escuela_nombre || selectedSolicitud.institucion || `Escuela #${selectedSolicitud.id}`}
            </h4>
            
            {/* Info Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 16,
              background: '#f8fafc',
              padding: 16,
              borderRadius: 12,
              marginBottom: 24,
              fontSize: '0.9rem',
              border: '1px solid #e2e8f0'
            }}>
              <div>
                <span style={{ color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Supervisor Aprobador</span>
                <strong style={{ color: '#334155' }}>{selectedSolicitud.supervisor_nombre || 'N/A'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Fecha Aprob. Supervisor</span>
                <strong style={{ color: '#334155' }}>
                  {selectedSolicitud.fecha_aprobacion_supervisor ? new Date(selectedSolicitud.fecha_aprobacion_supervisor).toLocaleDateString('es-AR') : 'N/A'}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Director de Área</span>
                <strong style={{ color: '#334155' }}>{selectedSolicitud.director_nombre || 'N/A'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Fecha Aprob. Director</span>
                <strong style={{ color: '#334155' }}>
                  {selectedSolicitud.fecha_aprobacion_director ? new Date(selectedSolicitud.fecha_aprobacion_director).toLocaleDateString('es-AR') : 'N/A'}
                </strong>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Observaciones Generales</span>
                <p style={{ margin: 0, color: '#334155', fontStyle: selectedSolicitud.notes || selectedSolicitud.notas ? 'normal' : 'italic' }}>
                  {selectedSolicitud.notes || selectedSolicitud.notas || 'Sin observaciones'}
                </p>
              </div>
            </div>

            <h4 style={{ margin: '0 0 12px 0', fontSize: '1.05rem', color: '#1e293b', fontWeight: 700 }}>Productos Solicitados</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 28 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '10px 0', color: '#475569', fontWeight: 600, fontSize: '0.85rem' }}>PRODUCTO</th>
                  <th style={{ padding: '10px 0', textAlign: 'right', color: '#475569', fontWeight: 600, fontSize: '0.85rem' }}>CANTIDAD</th>
                </tr>
              </thead>
              <tbody>
                {(selectedSolicitud.items || []).map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 0', color: '#334155' }}>{item.producto}</td>
                    <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 600, color: '#1e293b' }}>x{item.cantidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                className="secondary" 
                onClick={() => setSelectedSolicitud(null)}
                style={{ padding: '10px 20px', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ADVERTENCIA ENVÍO */}
      {showModal && (
        <div className="sv-modal-overlay">
          <div className="sv-modal">
            <h2 className="sv-modal-title">⚠️ Atención</h2>
            <div className="sv-modal-body">
              <p>Las siguientes instituciones aún no han enviado su solicitud anual:</p>
              <ul className="sv-list-items">
                {pendientes.map(p => (
                  <li key={p.id}>{p.nombre} {p.cue ? `(CUE: ${p.cue})` : ''}</li>
                ))}
              </ul>
              <p style={{ marginTop: 16, fontWeight: 500 }}>
                Si enviás ahora, estas instituciones <strong>no quedarán incluidas</strong> en la licitación anual.
              </p>
              <p>¿Querés enviar de todos modos?</p>
            </div>
            <div className="sv-modal-footer">
              <button className="secondary" onClick={() => setShowModal(false)} disabled={loading}>
                Cancelar
              </button>
              <button className="primary" onClick={confirmSend} disabled={loading} style={{ background: '#E03C31' }}>
                {loading ? 'Enviando...' : 'Enviar de todos modos'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
