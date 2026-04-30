import React, { useMemo, useState } from 'react'

export default function DirectorAreaResumenAnual({ solicitudes }) {
  const [filtroEscuela, setFiltroEscuela] = useState('')
  
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

  return (
    <div style={{ background: '#f9fafb', borderRadius: 8, padding: 20 }}>
      <h2 style={{ color: '#2a4d8f', marginBottom: 8 }}>Resumen Solicitud Anual</h2>
      <p style={{ color: 'var(--muted)', marginBottom: 24 }}>
        Vista consolidada de todos los pedidos aprobados por la Direccion de Area para el ciclo lectivo actual.
      </p>

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
    </div>
  )
}
