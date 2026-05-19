import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

export default function PrintRemitoGeneral() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { token } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await apiFetch(`/api/depositos/licitacion/remito-general/${id}`, { token })
        if (!res.ok) {
          const d = await res.json()
          if (!cancelled) setError(d.error || 'No se pudo cargar el remito general')
          return
        }
        const payload = await res.json()
        if (!cancelled) setData(payload)
      } catch {
        if (!cancelled) setError('Error de conexión')
      }
    })()
    return () => { cancelled = true }
  }, [id, token])

  useEffect(() => {
    if (!data || printing) return
    setPrinting(true)
    const timer = window.setTimeout(() => {
      window.print()
    }, 250)
    return () => window.clearTimeout(timer)
  }, [data, printing])

  if (error) {
    return (
      <div className="card" style={{ margin: 24 }}>
        <h2 style={{ marginTop: 0 }}>Remito General</h2>
        <p style={{ color: 'var(--danger)' }}>{error}</p>
        <button onClick={() => navigate(-1)}>Volver</button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="card" style={{ margin: 24 }}>
        <h2 style={{ marginTop: 0 }}>Remito General</h2>
        <p>Cargando remito general...</p>
      </div>
    )
  }

  const rowsHTML = data.items.map((it) => {
    const dif = it.diferencia
    const difColor = dif === 0 ? '#166534' : (dif > 0 ? '#1d4ed8' : '#b91c1c')
    const difLabel = dif === 0 ? 'Completo' : (dif > 0 ? `+${dif} extra` : `${dif} faltante`)
    return `<tr>
      <td>${it.producto}</td><td>${it.proveedor_nombre}</td>
      <td style="text-align:center">${it.unidad_medida || '-'}</td>
      <td style="text-align:center">${it.cantidad_adjudicada}</td>
      <td style="text-align:center">${it.total_recibido}</td>
      <td style="text-align:center;color:${difColor};font-weight:700">${difLabel}</td>
    </tr>`
  }).join('')

  const remitosHTML = data.remitos.map((r) => (
    `<tr><td>${r.numero}</td><td>${new Date(r.created_at).toLocaleString('es-AR')}</td><td>${r.deposito_nombre || '-'}</td><td>${r.usuario_nombre || '-'}</td></tr>`
  )).join('')

  return (
    <div style={{ padding: 24 }}>
      <div className="card" style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0 }}>Remito General</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)' }}>{data.titulo_display || `Licitación Anual ${data.anio}`}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="secondary" onClick={() => navigate(-1)}>Volver</button>
            <button onClick={() => window.print()}>Imprimir</button>
          </div>
        </div>

        <div className="print-remito-general" dangerouslySetInnerHTML={{ __html: `
          <div style="margin-top:20px;border-top:2px solid #ff8200;padding-top:16px">
            <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
              <thead><tr><th style="text-align:left">Producto</th><th>Proveedor</th><th style="text-align:center">Unidad</th><th style="text-align:center">Adjudicado</th><th style="text-align:center">Recibido</th><th style="text-align:center">Estado</th></tr></thead>
              <tbody>${rowsHTML}</tbody>
            </table>
            <h3>Remitos Parciales Incluidos</h3>
            <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
              <thead><tr><th style="text-align:left">N° Remito</th><th>Fecha</th><th>Depósito</th><th>Operador</th></tr></thead>
              <tbody>${remitosHTML}</tbody>
            </table>
          </div>
        ` }} />
      </div>
    </div>
  )
}