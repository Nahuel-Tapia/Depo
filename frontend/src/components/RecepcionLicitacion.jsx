import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

const RECEPCION_ESTADO_LABEL = {
  en_deposito: 'En deposito',
  completada: 'Completada'
}

const RECEPCION_ESTADO_STYLE = {
  en_deposito: {
    background: '#fff7ed',
    color: '#c2410c',
    border: '1px solid #fdba74'
  },
  completada: {
    background: '#dcfce7',
    color: '#166534',
    border: '1px solid #86efac'
  }
}

export default function RecepcionLicitacion() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [recepciones, setRecepciones] = useState([])
  const [detalle, setDetalle] = useState(null)
  const [depositos, setDepositos] = useState([])
  const [selectedDeposito, setSelectedDeposito] = useState('')
  const [ingresos, setIngresos] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [remitos, setRemitos] = useState([])
  const [remitosLoading, setRemitosLoading] = useState(false)
  const [danioFiles, setDanioFiles] = useState({})
  const [detalleRemito, setDetalleRemito] = useState(null)
  const [showFotos, setShowFotos] = useState(false)
  const [viewingImageIndex, setViewingImageIndex] = useState(0)

  const loadRecepciones = async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/depositos/licitacion/recepciones', { token })
      if (res.ok) {
        const data = await res.json()
        setRecepciones(data.licitaciones || [])
      }
    } catch (err) { /* ignore */ }
    setLoading(false)
  }

  const loadDepositos = async () => {
    const res = await apiFetch('/api/depositos', { token })
    if (res.ok) {
      const data = await res.json()
      setDepositos(data.depositos || [])
      if (data.depositos?.length > 0) setSelectedDeposito(data.depositos[0].id)
    }
  }

  useEffect(() => {
    loadRecepciones()
    loadDepositos()
  }, [])

  const verDetalle = async (id) => {
    setLoading(true)
    setRemitos([])
    try {
      const [detalleRes, remitosRes] = await Promise.all([
        apiFetch(`/api/depositos/licitacion/recepciones/${id}`, { token }),
        apiFetch(`/api/depositos/licitacion/recepciones/${id}/remitos`, { token })
      ])
      if (detalleRes.ok) {
        const data = await detalleRes.json()
        setDetalle(data)
        setIngresos({})
        setDanioFiles({})
      }
      if (remitosRes.ok) {
        const data = await remitosRes.json()
        setRemitos(data.remitos || [])
      }
    } catch (err) { /* ignore */ }
    setLoading(false)
  }

  const handleQtyChange = (prodId, val) => {
    setIngresos(prev => ({ 
      ...prev, 
      [prodId]: { ...prev[prodId], cantidad: val } 
    }))
  }

  const handleDamagedQtyChange = (prodId, val) => {
    setIngresos(prev => ({
      ...prev,
      [prodId]: { ...prev[prodId], cantidad_danada: val }
    }))
  }

  const handleDamageObsChange = (prodId, val) => {
    setIngresos(prev => ({
      ...prev,
      [prodId]: { ...prev[prodId], obs_danio: val }
    }))
  }

  const handleDamageFilesChange = (prodId, files) => {
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB por archivo
    const validFiles = [];
    let oversized = false;

    for (const file of files || []) {
      if (file.size > MAX_FILE_SIZE) {
        oversized = true;
      } else {
        validFiles.push(file);
      }
    }

    if (oversized) {
      setMsg({ text: 'Algunas imágenes exceden 10MB. Solo se cargaron las imágenes válidas.', type: 'warning' });
    }

    setDanioFiles(prev => ({ ...prev, [prodId]: validFiles }))
  }

  const handleExpiryChange = (prodId, val) => {
    setIngresos(prev => ({ 
      ...prev, 
      [prodId]: { ...prev[prodId], fecha_vencimiento: val } 
    }))
  }

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const raw = typeof reader.result === 'string' ? reader.result : ''
      const b64 = raw.includes(',') ? raw.split(',')[1] : raw
      resolve(b64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const openDetalleRemito = (remito) => {
    setDetalleRemito(remito)
    setShowFotos(false)
    setViewingImageIndex(0)
  }

  const closeDetalleRemito = () => {
    setDetalleRemito(null)
    setShowFotos(false)
    setViewingImageIndex(0)
  }

  const nextImage = () => {
    if (detalleRemito && viewingImageIndex < detalleRemito.imagenes.length - 1) {
      setViewingImageIndex(viewingImageIndex + 1)
    }
  }

  const prevImage = () => {
    if (detalleRemito && viewingImageIndex > 0) {
      setViewingImageIndex(viewingImageIndex - 1)
    }
  }

  const handleConfirmarIngreso = async () => {
    if (!selectedDeposito) {
      alert('Seleccione un depósito de destino')
      return
    }

    const payloadIngresos = Object.entries(ingresos)
      .filter(([_, data]) => Number(data.cantidad) > 0 || Number(data.cantidad_danada) > 0)
      .map(([id, data]) => ({ 
        producto_id: Number(id), 
        cantidad: Number(data.cantidad),
        cantidad_danada: Number(data.cantidad_danada || 0),
        obs_danio: data.obs_danio || null,
        fecha_vencimiento: data.fecha_vencimiento || null
      }))

    if (payloadIngresos.length === 0) {
      alert('Cargue al menos una cantidad en buen estado o dañada')
      return
    }

    for (const item of payloadIngresos) {
      const det = detalle.items.find(it => Number(it.producto_id) === item.producto_id)
      const yaRecibido = detalle.recibidos?.find(
        r => r.producto?.trim().toLowerCase() === det?.producto?.trim().toLowerCase()
      )?.total_recibida || 0
      const pendiente = Math.max(0, Number(det?.cantidad_total || 0) - Number(yaRecibido))
      if (Number(item.cantidad) + Number(item.cantidad_danada) > pendiente) {
        alert(`La suma recibida + dañada supera el pendiente de ${det?.producto}`)
        return
      }
    }

    setSaving(true)
    try {
      const res = await apiFetch('/api/depositos/licitacion/registrar-ingreso', {
        token,
        method: 'POST',
        body: JSON.stringify({
          licitacion_id: detalle.id,
          id_deposito: Number(selectedDeposito),
          ingresos: payloadIngresos,
          observaciones: 'Ingreso desde Recepción de Licitación'
        })
      })

      if (res.ok) {
        const data = await res.json()

        // Subir imágenes de daños luego de crear remito
        if (data.remito_id) {
          for (const [prodId, files] of Object.entries(danioFiles)) {
            const cantDanada = Number(ingresos[prodId]?.cantidad_danada || 0)
            if (cantDanada <= 0 || !files?.length) continue
            for (const file of files) {
              try {
                const b64 = await fileToBase64(file)
                await apiFetch('/api/depositos/licitacion/danio/imagen', {
                  token,
                  method: 'POST',
                  body: JSON.stringify({
                    remito_id: data.remito_id,
                    producto_id: Number(prodId),
                    nombre: file.name,
                    mime_type: file.type,
                    datos: b64
                  })
                })
              } catch {
                // Si falla una imagen, no se revierte el remito.
              }
            }
          }
        }

        setMsg({ text: `Mercadería ingresada al stock correctamente — ${data.numero_remito}`, type: 'success' })
        setIngresos({})
        setDanioFiles({})
        // Recargar detalle y remitos
        setRemitosLoading(true)
        const [detalleRes, remitosRes] = await Promise.all([
          apiFetch(`/api/depositos/licitacion/recepciones/${detalle.id}`, { token }),
          apiFetch(`/api/depositos/licitacion/recepciones/${detalle.id}/remitos`, { token })
        ])
        if (detalleRes.ok) setDetalle(await detalleRes.json())
        if (remitosRes.ok) { const rd = await remitosRes.json(); setRemitos(rd.remitos || []) }
        setRemitosLoading(false)
        loadRecepciones()
      } else {
        const data = await res.json()
        setMsg({ text: data.error || 'Error al procesar ingreso', type: 'error' })
      }
    } catch (err) {
      setMsg({ text: 'Error de conexión', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const printRemito = (remito) => {
    const win = window.open('', '_blank', 'width=800,height=600')
    if (!win) return
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
    win.document.write(`<!DOCTYPE html><html><head><title>${remito.numero}</title>
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
        <div><strong>Licitación:</strong> ${detalle?.titulo_display || (`Licitación #${detalle?.id} — Año ${detalle?.anio}`)}</div>
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
    win.document.close()
    win.print()
  }

  const printRemitoGeneral = (data) => {
    const rowsHTML = data.items.map(it => {
      const dif = it.diferencia
      const difColor = dif === 0 ? '#166534' : (dif > 0 ? '#1d4ed8' : '#b91c1c')
      const difLabel = dif === 0 ? '✅ Completo' : (dif > 0 ? `+${dif} extra` : `${dif} faltante`)
      return `<tr>
        <td>${it.producto}</td><td>${it.proveedor_nombre}</td>
        <td style="text-align:center">${it.unidad_medida || '-'}</td>
        <td style="text-align:center">${it.cantidad_adjudicada}</td>
        <td style="text-align:center">${it.total_recibido}</td>
        <td style="text-align:center;color:${difColor};font-weight:700">${difLabel}</td>
      </tr>`}).join('')
    const remitosHTML = data.remitos.map(r =>
      `<tr><td>${r.numero}</td><td>${new Date(r.created_at).toLocaleString('es-AR')}</td><td>${r.deposito_nombre || '-'}</td><td>${r.usuario_nombre || '-'}</td></tr>`
    ).join('')
    return { rowsHTML, remitosHTML }
  }

  const handlePrintRemitoGeneral = async () => {
    navigate(`/print/remito-general/${detalle.id}`)
  }

  const handleCerrarYRemitoGeneral = async () => {
    if (!window.confirm('¿Cerrar esta licitación y generar el Remito General? Esta acción no se puede deshacer.')) return
    try {
      const res = await apiFetch(`/api/depositos/licitacion/cerrar/${detalle.id}`, { token, method: 'POST' })
      if (!res.ok) {
        const d = await res.json()
        setMsg({ text: d.error || 'No se pudo cerrar la licitación', type: 'error' })
        return
      }
      setDetalle(prev => ({ ...prev, estado: 'completada' }))
      navigate(`/print/remito-general/${detalle.id}`)
    } catch {
      setMsg({ text: 'Error de conexión', type: 'error' })
    }
  }

  const todoCompleto = detalle
    ? detalle.items.every(item => {
        const yaRecibido = detalle.recibidos?.find(
          r => r.producto?.trim().toLowerCase() === item.producto?.trim().toLowerCase()
        )?.total_recibida || 0
        return Number(yaRecibido) >= Number(item.cantidad_total)
      })
    : false

  return (
    <div className="card recepcion-card">
      <h2 style={{ marginTop: 0 }}>Recepción de Licitación</h2>
      <p style={{ color: 'var(--muted)', marginTop: 0 }}>
        Módulo de control de ingreso de mercadería al depósito central.
      </p>

      {msg.text && (
        <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`} style={{ marginBottom: 20 }}>
          {msg.text}
        </div>
      )}

      {!detalle ? (
        <>
          {loading ? (
            <div className="sv-empty-state">Buscando envíos pendientes...</div>
          ) : recepciones.length === 0 ? (
            <div className="sv-empty-state">No hay licitaciones pendientes de recepción.</div>
          ) : (
            <table>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th>ID</th>
                  <th>AÑO LICITACIÓN</th>
                  <th>TÍTULO / MOTIVO</th>
                  <th>PROVEEDOR(ES)</th>
                  <th>FECHA ENVÍO</th>
                  <th>ESTADO</th>
                  <th style={{ textAlign: 'right' }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {recepciones.map(r => (
                  <tr key={r.id} style={r.estado === 'completada' ? { background: '#f8fafc' } : undefined}>
                    <td>#{r.id}</td>
                    <td style={{ fontWeight: 700 }}>{r.anio}</td>
                    <td>{r.titulo_display || r.motivo || r.titulo || `Licitación Anual ${r.anio}`}</td>
                    <td>{r.proveedores || 'Sin proveedor asignado'}</td>
                    <td>{new Date(r.fecha_publicacion).toLocaleString()}</td>
                    <td>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '4px 10px',
                          borderRadius: 999,
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          ...(RECEPCION_ESTADO_STYLE[r.estado] || {
                            background: '#e2e8f0',
                            color: '#334155',
                            border: '1px solid #cbd5e1'
                          })
                        }}
                      >
                        {RECEPCION_ESTADO_LABEL[r.estado] || r.estado}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button onClick={() => verDetalle(r.id)}>📦 Recibir Mercadería</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      ) : (
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
            <button className="secondary" onClick={() => setDetalle(null)}>⬅ Volver al listado</button>
            <div style={{ textAlign: 'right' }}>
              <label style={{ display: 'block', fontSize: '0.85rem' }}>Depósito de destino:</label>
              <select 
                value={selectedDeposito} 
                onChange={e => setSelectedDeposito(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 8, minWidth: 220 }}
              >
                {depositos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
            </div>
          </div>

          <h3 style={{ borderBottom: '2px solid var(--primary)', paddingBottom: 10 }}>
            Carga de Ingreso — {detalle.titulo_display || `Licitación #${detalle.id} (${detalle.anio})`}
          </h3>

          <div className="recepcion-table-wrap">
          <table className="recepcion-table">
            <thead>
              <tr>
                <th>PRODUCTO</th>
                <th>PROVEEDOR</th>
                <th style={{ textAlign: 'center' }}>TOTAL ADJUDICADO</th>
                <th style={{ textAlign: 'center' }}>YA RECIBIDO</th>
                <th style={{ textAlign: 'center', width: 140 }}>CANT. A INGRESAR</th>
                <th style={{ textAlign: 'center', width: 140 }}>CANT. DAÑADA</th>
                <th style={{ width: 320 }}>OBSERVACIÓN / ADJUNTOS POR DAÑO</th>
                <th style={{ textAlign: 'center', width: 180 }}>FECHA VENCIMIENTO</th>
              </tr>
            </thead>
            <tbody>
              {detalle.items.map(item => {
                const yaRecibido = detalle.recibidos?.find(r => r.producto?.trim().toLowerCase() === item.producto?.trim().toLowerCase())?.total_recibida || 0
                const pendiente = Number(item.cantidad_total) - Number(yaRecibido)
                const currentIngreso = ingresos[item.producto_id] || {}
                
                return (
                  <tr key={item.producto_id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.producto}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{item.unidad_medida}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem' }}>{item.proveedor_nombre || 'Sin proveedor asignado'}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>{item.cantidad_total}</td>
                    <td style={{ textAlign: 'center', color: yaRecibido > 0 ? 'var(--primary)' : 'var(--muted)' }}>
                      {yaRecibido}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {pendiente <= 0 ? (
                        <span style={{ color: 'green', fontWeight: 700 }}>✅ Completo</span>
                      ) : (
                        <input 
                          type="number"
                          min="0"
                          max={pendiente}
                          placeholder={`Faltan ${pendiente}`}
                          value={currentIngreso.cantidad || ''}
                          onChange={e => handleQtyChange(item.producto_id, e.target.value)}
                          style={{ textAlign: 'center', fontWeight: 700, borderColor: currentIngreso.cantidad ? 'var(--primary)' : '#cbd5e1' }}
                        />
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {pendiente > 0 && (
                        <input
                          type="number"
                          min="0"
                          max={pendiente}
                          placeholder="0"
                          value={currentIngreso.cantidad_danada || ''}
                          onChange={e => handleDamagedQtyChange(item.producto_id, e.target.value)}
                          style={{ textAlign: 'center', fontWeight: 700, borderColor: currentIngreso.cantidad_danada ? 'var(--orange)' : '#cbd5e1' }}
                        />
                      )}
                    </td>
                    <td>
                      {Number(currentIngreso.cantidad_danada || 0) > 0 ? (
                        <div className="recepcion-danio-box">
                          <div className="recepcion-field-label">
                            Observación del daño
                          </div>
                          <textarea
                            rows={2}
                            placeholder="Describa el daño del producto"
                            value={currentIngreso.obs_danio || ''}
                            onChange={e => handleDamageObsChange(item.producto_id, e.target.value)}
                            className="recepcion-textarea"
                          />
                          <div className="recepcion-field-label">
                            Adjuntar imágenes
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={e => handleDamageFilesChange(item.producto_id, e.target.files)}
                            className="recepcion-file"
                          />
                          {(danioFiles[item.producto_id] || []).length > 0 && (
                            <div className="recepcion-files-list">
                              {(danioFiles[item.producto_id] || []).map((f, idx) => (
                                <div key={`${item.producto_id}-${idx}`}>• {f.name}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="recepcion-muted-hint">Se habilita al cargar cantidad dañada</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {pendiente > 0 && (
                        <input 
                          type="date"
                          value={currentIngreso.fecha_vencimiento || ''}
                          onChange={e => handleExpiryChange(item.producto_id, e.target.value)}
                          style={{ fontSize: '0.85rem', padding: '6px' }}
                        />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginTop: 8 }}>
            <div>
              {detalle.estado === 'completada' && (
                <button className="secondary" onClick={handlePrintRemitoGeneral} style={{ gap: 6 }}>
                  📄 Remito General
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 14 }}>
              <button className="secondary" onClick={() => setDetalle(null)} disabled={saving}>Cancelar</button>
              {detalle.estado === 'completada' ? null : todoCompleto ? (
                <button className="primary" onClick={handleCerrarYRemitoGeneral} disabled={saving}
                  style={{ background: '#16a34a', borderColor: '#16a34a' }}>
                  ✅ Cerrar Licitación y Generar Remito General
                </button>
              ) : (
                <button className="primary" onClick={handleConfirmarIngreso} disabled={saving}>
                  {saving ? 'Registrando...' : '🚀 Confirmar Ingreso a Stock'}
                </button>
              )}
            </div>
          </div>

          {/* Historial de remitos */}
          <div style={{ marginTop: 36 }}>
            <h3 style={{ borderBottom: '2px solid #e5e7eb', paddingBottom: 8, marginBottom: 16 }}>
              Historial de Remitos
            </h3>
            {remitosLoading ? (
              <p style={{ color: 'var(--muted)', textAlign: 'center' }}>Cargando remitos...</p>
            ) : remitos.length === 0 ? (
              <p style={{ color: 'var(--muted)', textAlign: 'center' }}>No hay remitos registrados para esta licitación.</p>
            ) : (
              <table>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th>N° REMITO</th>
                    <th>FECHA</th>
                    <th>DEPÓSITO</th>
                    <th>PROVEEDOR</th>
                    <th style={{ textAlign: 'center' }}>PRODUCTOS</th>
                    <th>REGISTRADO POR</th>
                    <th style={{ textAlign: 'center' }}>ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {remitos.map(r => {
                    const tieneImagenes = r.imagenes && r.imagenes.length > 0
                    const proveedores = [...new Set((r.items || []).map(it => it.proveedor_nombre).filter(Boolean))]
                    return (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{r.numero}</td>
                        <td>{new Date(r.created_at).toLocaleString('es-AR')}</td>
                        <td>{r.deposito_nombre || '-'}</td>
                        <td>{proveedores.length > 0 ? proveedores.join(', ') : '-'}</td>
                        <td style={{ textAlign: 'center' }}>{r.items?.length || 0}</td>
                        <td>{r.usuario_nombre || '-'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button className="secondary" onClick={() => openDetalleRemito(r)} style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
                            🔍 Ver detalle
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}
      
      {/* Modal detalle de remito */}
      {detalleRemito && (
        <div className="recepcion-modal-overlay" onClick={closeDetalleRemito}>
          <div className="recepcion-modal-content recepcion-modal-wide" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="recepcion-modal-header">
              <div>
                <h3 style={{ margin: 0 }}>Detalle — {detalleRemito.numero}</h3>
                {showFotos && (
                  <button
                    onClick={() => { setShowFotos(false); setViewingImageIndex(0) }}
                    style={{ background: 'none', border: 'none', color: 'var(--orange)', cursor: 'pointer', fontSize: '0.85rem', padding: 0, marginTop: 4 }}
                  >
                    ← Volver al detalle
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {!showFotos && (
                  <button className="secondary" onClick={() => printRemito(detalleRemito)} style={{ padding: '5px 12px', fontSize: '0.85rem' }}>
                    🖨️ Imprimir
                  </button>
                )}
                <button className="recepcion-modal-close" onClick={closeDetalleRemito}>✕</button>
              </div>
            </div>

            <div className="recepcion-image-viewer">
              {!showFotos ? (
                /* ── VISTA DETALLE ── */
                <>
                  {/* Info general */}
                  <div className="recepcion-detalle-info">
                    <div className="recepcion-info-item"><span className="recepcion-info-label">Fecha</span><span>{new Date(detalleRemito.created_at).toLocaleString('es-AR')}</span></div>
                    <div className="recepcion-info-item"><span className="recepcion-info-label">Depósito</span><span>{detalleRemito.deposito_nombre || '-'}</span></div>
                    <div className="recepcion-info-item"><span className="recepcion-info-label">Registrado por</span><span>{detalleRemito.usuario_nombre || '-'}</span></div>
                    {detalleRemito.observaciones && (
                      <div className="recepcion-info-item recepcion-info-full"><span className="recepcion-info-label">Observaciones</span><span>{detalleRemito.observaciones}</span></div>
                    )}
                  </div>

                  {/* Tabla de productos */}
                  <div style={{ overflowX: 'auto', marginTop: 4 }}>
                    <table style={{ width: '100%', fontSize: '0.9rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                          <th style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', fontSize: '0.78rem', borderBottom: '1px solid #e5e7eb' }}>Producto</th>
                          <th style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', fontSize: '0.78rem', borderBottom: '1px solid #e5e7eb' }}>Proveedor</th>
                          <th style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', fontSize: '0.78rem', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>Cant. recibida</th>
                          <th style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', fontSize: '0.78rem', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>Cant. dañada</th>
                          <th style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', fontSize: '0.78rem', borderBottom: '1px solid #e5e7eb' }}>Observación de daño</th>
                          <th style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', fontSize: '0.78rem', borderBottom: '1px solid #e5e7eb' }}>Vencimiento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detalleRemito.items || []).map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                            <td style={{ padding: '8px 10px' }}>
                              <div style={{ fontWeight: 500 }}>{item.producto_nombre}</div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{item.unidad_medida}</div>
                            </td>
                            <td style={{ padding: '8px 10px', fontSize: '0.85rem' }}>{item.proveedor_nombre || '-'}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>{item.cantidad_recibida}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              {Number(item.cantidad_danada) > 0 ? (
                                <span style={{ color: '#dc2626', fontWeight: 600 }}>{item.cantidad_danada}</span>
                              ) : '-'}
                            </td>
                            <td style={{ padding: '8px 10px', color: 'var(--muted)', fontSize: '0.85rem' }}>{item.obs_danio || '-'}</td>
                            <td style={{ padding: '8px 10px', fontSize: '0.85rem' }}>{item.fecha_vencimiento ? new Date(item.fecha_vencimiento).toLocaleDateString('es-AR') : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Botón ver fotos */}
                  {detalleRemito.imagenes && detalleRemito.imagenes.length > 0 && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
                      <button
                        className="secondary"
                        onClick={() => { setShowFotos(true); setViewingImageIndex(0) }}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem' }}
                      >
                        📷 Ver fotos de daño ({detalleRemito.imagenes.length})
                      </button>
                    </div>
                  )}
                </>
              ) : (
                /* ── GALERÍA DE FOTOS ── */
                <>
                  <div className="recepcion-image-container">
                    <img
                      src={`data:${detalleRemito.imagenes[viewingImageIndex].mime_type || 'image/jpeg'};base64,${detalleRemito.imagenes[viewingImageIndex].datos}`}
                      alt={`Imagen ${viewingImageIndex + 1}`}
                      style={{ maxWidth: '100%', maxHeight: '420px', objectFit: 'contain' }}
                    />
                  </div>

                  <div className="recepcion-image-nav">
                    <button className="recepcion-nav-btn" onClick={prevImage} disabled={viewingImageIndex === 0} style={{ opacity: viewingImageIndex === 0 ? 0.5 : 1 }}>← Anterior</button>
                    <span style={{ fontSize: '0.9rem', color: 'var(--muted)', minWidth: 100, textAlign: 'center' }}>
                      {viewingImageIndex + 1} de {detalleRemito.imagenes.length}
                    </span>
                    <button className="recepcion-nav-btn" onClick={nextImage} disabled={viewingImageIndex === detalleRemito.imagenes.length - 1} style={{ opacity: viewingImageIndex === detalleRemito.imagenes.length - 1 ? 0.5 : 1 }}>Siguiente →</button>
                  </div>

                  <div className="recepcion-image-meta">
                    <div className="recepcion-meta-item"><strong>Archivo:</strong> {detalleRemito.imagenes[viewingImageIndex].nombre || 'Sin nombre'}</div>
                    <div className="recepcion-meta-item"><strong>Fecha:</strong> {new Date(detalleRemito.imagenes[viewingImageIndex].created_at).toLocaleString('es-AR')}</div>
                  </div>

                  {detalleRemito.imagenes.length > 1 && (
                    <div className="recepcion-thumbnails">
                      {detalleRemito.imagenes.map((img, idx) => (
                        <button
                          key={idx}
                          className={`recepcion-thumb ${viewingImageIndex === idx ? 'recepcion-thumb-active' : ''}`}
                          onClick={() => setViewingImageIndex(idx)}
                        >
                          <img src={`data:${img.mime_type || 'image/jpeg'};base64,${img.datos}`} alt={`Thumb ${idx + 1}`} />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
