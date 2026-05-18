import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

function RemitosModal({ lic, token, onClose }) {
  const [remitos, setRemitos] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    apiFetch(`/api/depositos/licitacion/recepciones/${lic.id}/remitos`, { token })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setRemitos(d.remitos || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [lic.id, token])

  const totalRecibido = remitos.reduce((acc, r) =>
    acc + r.items.reduce((a, i) => a + Number(i.cantidad_recibida || 0), 0), 0)

  const printRemito = (remito) => {
    const itemsDanados = remito.items.filter(it => Number(it.cantidad_danada) > 0)
    const rowsHTML = remito.items.map(it => `
      <tr>
        <td>${it.producto_nombre}</td>
        <td>${it.proveedor_nombre || '-'}</td>
        <td style="text-align:center">${it.unidad_medida || '-'}</td>
        <td style="text-align:center">${it.cantidad_recibida}</td>
        <td style="text-align:center;color:${Number(it.cantidad_danada) > 0 ? '#b91c1c' : '#111827'}">${it.cantidad_danada || 0}</td>
        <td style="text-align:center">${it.fecha_vencimiento ? new Date(it.fecha_vencimiento).toLocaleDateString('es-AR') : '-'}</td>
      </tr>`).join('')
    const daniosHTML = itemsDanados.map(it =>
      `<tr><td>${it.producto_nombre}</td><td style="text-align:center">${it.cantidad_danada}</td><td>${it.obs_danio || '-'}</td></tr>`
    ).join('')
    const w = window.open('', '_blank', 'width=800,height=600')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><title>${remito.numero}</title>
      <style>*{box-sizing:border-box;font-family:Arial,sans-serif}body{margin:24px;color:#111827;font-size:13px}
      .header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #FF8200;padding-bottom:10px;margin-bottom:16px}
      .header-left{display:flex;align-items:center;gap:12px}.header-left img{height:40px}
      table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #d1d5db;padding:8px 10px;text-align:left}th{background:#f3f4f6}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;font-size:13px}
      .meta div{padding:6px 10px;background:#f8fafc;border-radius:6px}
      .sigs{display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-top:54px}
      .sig{border-top:1px solid #111827;padding-top:8px;text-align:center;font-size:12px}</style></head><body>
      <div class="header">
        <div class="header-left"><img src="/faviconmin.png" alt="Logo"/>
          <div><div style="font-weight:bold;font-size:1.1rem">San Juan Gobierno</div>
          <div style="color:#666">Ministerio de Educación</div></div></div>
        <div style="text-align:right"><div style="font-weight:bold;font-size:1.2rem">${remito.numero}</div>
          <div style="color:#666">Remito de Ingreso</div></div></div>
      <div class="meta">
        <div><strong>Licitación:</strong> ${`Licitación #${lic.id} — Año ${lic.anio}`}</div>
        <div><strong>Fecha:</strong> ${new Date(remito.created_at).toLocaleString('es-AR')}</div>
        <div><strong>Depósito:</strong> ${remito.deposito_nombre || '-'}</div>
        <div><strong>Registrado por:</strong> ${remito.usuario_nombre || '-'}</div>
        ${remito.observaciones ? `<div style="grid-column:1/-1"><strong>Observaciones:</strong> ${remito.observaciones}</div>` : ''}
      </div>
      <table><thead><tr><th>Producto</th><th>Proveedor</th><th style="text-align:center">Unidad</th><th style="text-align:center">Cant. Recibida</th><th style="text-align:center">Cant. Dañada</th><th style="text-align:center">Vencimiento</th></tr></thead>
      <tbody>${rowsHTML}</tbody></table>
      ${itemsDanados.length > 0 ? `<h3 style="margin-top:20px">Mercadería Dañada / En Mal Estado</h3>
      <table><thead><tr><th>Producto</th><th style="text-align:center">Cant. Dañada</th><th>Observación</th></tr></thead><tbody>${daniosHTML}</tbody></table>
      <div style="margin-top:6px;font-size:12px;color:#6b7280">Adjuntos fotográficos: ${remito.imagenes?.length || 0}</div>` : ''}
      <div class="sigs"><div class="sig">Firma del Operador</div><div class="sig">Firma y Sello de Autorización</div></div>
    </body></html>`)
    w.document.close()
    w.print()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '32px 16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 780,
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)', padding: 28, position: 'relative' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0 }}>📦 Remitos — Licitación {lic.anio}</h3>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '0.85rem' }}>
              {remitos.length} remito{remitos.length !== 1 ? 's' : ''} generado{remitos.length !== 1 ? 's' : ''} · Total recibido: <strong>{totalRecibido.toLocaleString('es-AR')} uds.</strong>
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 6,
              padding: '3px 9px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', color: '#374151' }}>✕</button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>Cargando remitos...</div>
        ) : remitos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>Todavía no se generaron remitos para esta licitación.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {remitos.map(remito => {
              const isOpen = expanded === remito.id
              const subtotal = remito.items.reduce((a, i) => a + Number(i.cantidad_recibida || 0), 0)
              const hasDanio = remito.items.some(i => Number(i.cantidad_danada) > 0)
              return (
                <div key={remito.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                  {/* Remito header row */}
                  <div style={{ display: 'flex', alignItems: 'stretch', background: '#f8fafc' }}>
                    <button
                      onClick={() => setExpanded(isOpen ? null : remito.id)}
                      style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        border: 'none', padding: '12px 16px', cursor: 'pointer', textAlign: 'left', gap: 12,
                        background: 'transparent' }}
                    >
                      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--orange)' }}>{remito.numero}</span>
                        <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                          {new Date(remito.created_at).toLocaleString('es-AR')}
                        </span>
                        {remito.deposito_nombre && (
                          <span style={{ fontSize: '0.82rem', background: '#eff6ff', color: '#1d4ed8',
                            borderRadius: 4, padding: '2px 7px', fontWeight: 600 }}>
                            🏭 {remito.deposito_nombre}
                          </span>
                        )}
                        {hasDanio && (
                          <span style={{ fontSize: '0.78rem', background: '#fef2f2', color: '#b91c1c',
                            borderRadius: 4, padding: '2px 7px', fontWeight: 600 }}>⚠ Daños registrados</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                        <span style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>
                          {subtotal.toLocaleString('es-AR')} uds.
                        </span>
                        <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{isOpen ? '▲' : '▼'}</span>
                      </div>
                    </button>
                    <button
                      onClick={() => printRemito(remito)}
                      title="Imprimir este remito"
                      style={{
                        width: 'auto',
                        minWidth: 'auto',
                        height: 26,
                        flex: '0 0 auto',
                        alignSelf: 'center',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid #e2e8f0',
                        borderRadius: 6,
                        background: '#ffffff',
                        padding: '0 8px',
                        margin: '0 8px',
                        cursor: 'pointer',
                        color: '#475569',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Imprimir
                    </button>
                  </div>

                  {/* Remito items */}
                  {isOpen && (
                    <div style={{ padding: '0 16px 16px' }}>
                      {remito.observaciones && (
                        <p style={{ margin: '10px 0 8px', fontSize: '0.85rem', color: 'var(--muted)',
                          fontStyle: 'italic' }}>Obs.: {remito.observaciones}</p>
                      )}
                      <table style={{ marginBottom: 0, fontSize: '0.87rem' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            <th>PRODUCTO</th>
                            <th style={{ textAlign: 'center' }}>RECIBIDO</th>
                            <th style={{ textAlign: 'center' }}>DAÑADO</th>
                            <th>PROVEEDOR</th>
                            <th>VENCIMIENTO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {remito.items.map(item => (
                            <tr key={item.id}>
                              <td style={{ fontWeight: 600 }}>{item.producto_nombre}</td>
                              <td style={{ textAlign: 'center', fontWeight: 700, color: '#166534' }}>
                                {Number(item.cantidad_recibida).toLocaleString('es-AR')} {item.unidad_medida}
                              </td>
                              <td style={{ textAlign: 'center', color: Number(item.cantidad_danada) > 0 ? '#b91c1c' : 'var(--muted)', fontWeight: Number(item.cantidad_danada) > 0 ? 700 : 400 }}>
                                {Number(item.cantidad_danada) > 0
                                  ? `${Number(item.cantidad_danada).toLocaleString('es-AR')} ⚠`
                                  : '—'}
                              </td>
                              <td style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{item.proveedor_nombre || '—'}</td>
                              <td style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
                                {item.fecha_vencimiento ? new Date(item.fecha_vencimiento).toLocaleDateString('es-AR') : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {remito.imagenes?.length > 0 && (
                        <p style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--muted)' }}>
                          📸 {remito.imagenes.length} imagen{remito.imagenes.length !== 1 ? 'es' : ''} de daño adjunta{remito.imagenes.length !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function ProgressBar({ total, recibido }) {
  const pct = total > 0 ? Math.min(100, Math.round((recibido / total) * 100)) : 0
  const done = pct >= 100
  const color = done ? '#16a34a' : '#f97316'
  return (
    <div style={{ minWidth: 180 }}>
      <div style={{
        background: '#e5e7eb',
        borderRadius: 6,
        height: 10,
        overflow: 'hidden',
        marginBottom: 4
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: 6,
          transition: 'width 0.4s ease'
        }} />
      </div>
      <div style={{ fontSize: '0.78rem', color: done ? '#15803d' : '#9a3412', fontWeight: 600 }}>
        {Number(recibido).toLocaleString('es-AR')} / {Number(total).toLocaleString('es-AR')} uds. ({pct}%)
      </div>
    </div>
  )
}

export default function LicitacionesCerradas() {
  const { token } = useAuth()
  const [licitaciones, setLicitaciones] = useState([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [selectedLic, setSelectedLic] = useState(null)

  const loadLicitaciones = async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/compras/licitacion/anual/cerradas', { token })
      if (res.ok) {
        const data = await res.json()
        setLicitaciones(data.licitaciones || [])
      }
    } catch (err) {
      setMsg({ text: 'Error al cargar licitaciones', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLicitaciones()
  }, [])

  const handleEnviarDeposito = async (id) => {
    if (!window.confirm('¿Enviar esta licitación al Operador de Depósito?')) return
    
    try {
      const res = await apiFetch('/api/compras/licitacion/anual/enviar-deposito', {
        token,
        method: 'POST',
        body: JSON.stringify({ id })
      })
      if (res.ok) {
        setMsg({ text: 'Licitación enviada a depósito correctamente', type: 'success' })
        loadLicitaciones()
      }
    } catch (err) {
      setMsg({ text: 'Error al enviar', type: 'error' })
    }
  }

  const ESTADO_LABEL = {
    adjudicada: '✅ Adjudicada',
    en_deposito: '🚛 En Depósito',
    completada: '📦 Completada'
  }

  return (
    <>
    {selectedLic && <RemitosModal lic={selectedLic} token={token} onClose={() => setSelectedLic(null)} />}
    <div className="card" style={{ padding: 24, minHeight: 'auto', width: '100%' }}>
      <h2 style={{ marginTop: 0 }}>Gestión de Entregas</h2>
      <p style={{ color: 'var(--muted)', marginTop: 0 }}>
        Historial de licitaciones cerradas y coordinación de logística con depósito.
      </p>

      {msg.text && (
        <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`} style={{ marginBottom: 20 }}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <div className="sv-empty-state">Cargando historial...</div>
      ) : licitaciones.length === 0 ? (
        <div className="sv-empty-state">No hay licitaciones cerradas disponibles.</div>
      ) : (
        <table>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th>AÑO</th>
              <th>FECHA ADJUDICACIÓN</th>
              <th>CANT. PRODUCTOS</th>
              <th>ESTADO ACTUAL</th>
              <th>PROGRESO DE RECEPCIÓN</th>
              <th style={{ textAlign: 'right' }}>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {licitaciones.map(lic => {
              const showProgress = lic.estado === 'en_deposito' || lic.estado === 'completada'
              return (
                <tr key={lic.id}>
                  <td style={{ fontWeight: 700 }}>{lic.anio}</td>
                  <td>{new Date(lic.fecha_publicacion).toLocaleString('es-AR')}</td>
                  <td>{lic.total_items} ítems</td>
                  <td>
                    <span className={`badge badge-estado-${lic.estado}`}>
                      {ESTADO_LABEL[lic.estado] || lic.estado}
                    </span>
                  </td>
                  <td>
                    {showProgress
                      ? <ProgressBar total={lic.total_adjudicado} recibido={lic.total_recibido} />
                      : <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>—</span>
                    }
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      {(lic.estado === 'en_deposito' || lic.estado === 'completada') && (
                        <button
                          className="secondary"
                          onClick={() => setSelectedLic(lic)}
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          📋 Ver remitos
                        </button>
                      )}
                      {lic.estado === 'adjudicada' && (
                        <button className="primary" onClick={() => handleEnviarDeposito(lic.id)}>
                          🚀 Enviar a Depósito
                        </button>
                      )}
                      {lic.estado === 'en_deposito' && (
                        <span style={{ color: 'var(--muted)', fontSize: '0.85rem', alignSelf: 'center' }}>Esperando recepción...</span>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
    </>
  )
}
