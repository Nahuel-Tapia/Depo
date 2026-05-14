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

  return (
    <div style={{ background: '#f9fafb', borderRadius: 8, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ color: '#2a4d8f', marginBottom: 8, marginTop: 0 }}>Resumen Solicitud Anual {anioActual}</h2>
          <p style={{ color: 'var(--muted)', margin: 0 }}>
            Vista consolidada de todos los pedidos aprobados para el ciclo lectivo actual.
          </p>
        </div>

        <div style={{ textAlign: 'right' }}>
          {isSent ? (
            <div className="fade-in">
              <div style={{ 
                background: '#f0fdf4', 
                color: '#166534', 
                padding: '10px 20px', 
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        
        {/* SECCION A */}
        <section className="card" style={{ padding: 16 }}>
          <h3>Seccion A: Lista Consolidada de Productos</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Suma acumulada de productos aprobados para todas las escuelas.</p>
          <table style={{ width: '100%', marginTop: 12 }}>
            <thead>
              <tr style={{ background: '#f1f5fa' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px' }}>PRODUCTO</th>
                <th style={{ textAlign: 'center', padding: '8px 12px' }}>CANTIDAD TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {consolidado.length === 0 && (
                <tr>
                  <td colSpan={2} style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>
                    No hay productos aprobados todavia.
                  </td>
                </tr>
              )}
              {consolidado.map((p, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px 12px' }}>{p.producto}</td>
                  <td style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 'bold' }}>{p.cantidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* SECCION B */}
        <section className="card" style={{ padding: 16 }}>
          <h3>Seccion B: Detalle por Escuela</h3>
          <div style={{ marginBottom: 16 }}>
            <input 
              type="text" 
              placeholder="Filtrar por nombre de escuela..." 
              value={filtroEscuela}
              onChange={(e) => setFiltroEscuela(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {detallePorEscuela.length === 0 && (
              <p style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>No se encontraron escuelas aprobadas.</p>
            )}
            {detallePorEscuela.map((s) => (
              <div key={s.id} style={{ marginBottom: 16, padding: 12, border: '1px solid #e0e0e0', borderRadius: 6, background: '#fff' }}>
                <div style={{ fontWeight: 'bold', color: '#2a4d8f', borderBottom: '1px solid #f0f0f0', marginBottom: 8, paddingBottom: 4 }}>
                  {s.escuela_nombre || s.institucion || `Escuela #${s.id}`}
                </div>
                <table style={{ width: '100%', fontSize: '0.9rem' }}>
                  <tbody>
                    {(s.items || []).map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ color: '#555' }}>{item.producto}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>x{item.cantidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>

      </div>

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
