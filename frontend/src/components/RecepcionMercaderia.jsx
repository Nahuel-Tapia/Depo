import { useEffect, useState, Fragment } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

function itemKey(loteId, productoId) {
  return `${loteId}:${productoId}`
}

function filesToBase64(files = []) {
  return Promise.all(
    Array.from(files).map((file) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const raw = String(reader.result || '')
          const base64 = raw.includes(',') ? raw.split(',')[1] : raw
          resolve({
            nombre: file.name,
            mime_type: file.type || 'image/jpeg',
            datos: base64,
          })
        }
        reader.onerror = () => reject(new Error('No se pudo leer archivo'))
        reader.readAsDataURL(file)
      })
    )
  )
}

export default function RecepcionMercaderia() {
  const { token, user } = useAuth()
  const [distLoading, setDistLoading] = useState(true)
  const [lotesPendientes, setLotesPendientes] = useState([])
  const [recepcionForm, setRecepcionForm] = useState({})
  const [distMsg, setDistMsg] = useState({ text: '', type: '' })
  const [institucion, setInstitucion] = useState(null)

  // Historial de Recepciones
  const [historialLotes, setHistorialLotes] = useState([])
  const [historialLoading, setHistorialLoading] = useState(false)
  const [filterDesde, setFilterDesde] = useState('')
  const [filterHasta, setFilterHasta] = useState('')
  const [expandedHistorialLoteId, setExpandedHistorialLoteId] = useState(null)

  // Modal de Fotos
  const [fotoModalOpen, setFotoModalOpen] = useState(false)
  const [fotoModalSrc, setFotoModalSrc] = useState('')
  const [fotoModalTitle, setFotoModalTitle] = useState('')

  const loadInstitucion = async () => {
    try {
      const res = await apiFetch('/api/directivo/alertas', { token })
      if (res.ok) {
        const data = await res.json()
        setInstitucion(data.institucion || null)
      }
    } catch {
      // Ignorar errores al cargar institución, no bloquea funcionalidad
    }
  }

  const loadDistribuciones = async () => {
    setDistLoading(true)
    try {
      const res = await apiFetch('/api/directivo/distribuciones/pendientes', { token })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setDistMsg({ text: data.error || 'No se pudieron cargar distribuciones pendientes', type: 'error' })
        setLotesPendientes([])
      } else {
        const data = await res.json()
        const lotes = data.lotes || []
        setLotesPendientes(lotes)

        const nextForm = {}
        for (const lote of lotes) {
          for (const item of lote.items || []) {
            const key = itemKey(lote.lote_id, item.id_producto)
            nextForm[key] = {
              cantidad_recibida: String(item.cantidad_recibida || 0),
              cantidad_danada: String(item.cantidad_danada || 0),
              detalle_danio: item.detalle_danio || '',
              coincide_esperado: item.coincide_esperado !== false,
              observaciones_directivo: item.observaciones_directivo || '',
              reclamo_directivo: item.reclamo_directivo || '',
              imagenes: item.imagenes || [],
            }
          }
        }
        setRecepcionForm(nextForm)
      }
    } catch {
      setDistMsg({ text: 'Error de conexión al cargar distribuciones', type: 'error' })
      setLotesPendientes([])
    } finally {
      setDistLoading(false)
    }
  }

  const loadHistorial = async (opts = {}) => {
    if (!token) return
    setHistorialLoading(true)
    try {
      const desde = opts.desde !== undefined ? opts.desde : filterDesde
      const hasta = opts.hasta !== undefined ? opts.hasta : filterHasta

      const q = new URLSearchParams()
      if (desde) q.append('desde', desde)
      if (hasta) q.append('hasta', hasta)

      const qs = q.toString() ? `?${q.toString()}` : ''
      const res = await apiFetch(`/api/directivo/distribuciones/historial${qs}`, { token })
      if (res.ok) {
        const data = await res.json()
        setHistorialLotes(data.lotes || [])
      } else {
        setHistorialLotes([])
      }
    } catch (err) {
      console.error('Error cargando historial de recepciones:', err)
      setHistorialLotes([])
    } finally {
      setHistorialLoading(false)
    }
  }

  const handleFilterApply = () => {
    loadHistorial()
  }

  const handleFilterClear = () => {
    setFilterDesde('')
    setFilterHasta('')
    loadHistorial({ desde: '', hasta: '' })
  }

  const handleOpenFotoModal = (img) => {
    setFotoModalSrc(`data:${img.mime_type || 'image/jpeg'};base64,${img.datos}`)
    setFotoModalTitle(img.nombre || 'Evidencia de Recepción')
    setFotoModalOpen(true)
  }

  useEffect(() => {
    loadDistribuciones()
    loadInstitucion()
    loadHistorial()
  }, [token])

  const handleFormChange = (loteId, productoId, field, value) => {
    const key = itemKey(loteId, productoId)
    setRecepcionForm((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [field]: value,
      },
    }))
  }

  const printRemito = (lote, payloadItems) => {
    const win = window.open('', '_blank', 'width=800,height=600')
    if (!win) return

    const rowsHTML = payloadItems.map(it => `
      <tr>
        <td><strong>${it.producto_nombre}</strong></td>
        <td style="text-align:center">${it.unidad_medida || '-'}</td>
        <td style="text-align:center">${it.cantidad_planificada}</td>
        <td style="text-align:center">${it.cantidad_recibida}</td>
        <td style="text-align:center;color:${it.cantidad_danada > 0 ? '#b91c1c' : '#111827'}">${it.cantidad_danada || 0}</td>
        <td style="text-align:center">${it.coincide_esperado ? 'Sí' : 'No'}</td>
        <td>${it.observaciones_directivo || '-'}</td>
        <td>${it.reclamo_directivo || it.detalle_danio || '-'}</td>
      </tr>
    `).join('')

    const itemsDanados = payloadItems.filter(it => it.cantidad_danada > 0)
    const daniosHTML = itemsDanados.map(it => `
      <tr>
        <td><strong>${it.producto_nombre}</strong></td>
        <td style="text-align:center">${it.cantidad_danada}</td>
        <td>${it.detalle_danio || it.reclamo_directivo || 'Sin detalles'}</td>
      </tr>
    `).join('')

    const logoHtml = `<img src="/faviconmin.png" alt="Logo" style="height: 40px;" />`

    win.document.write(`<!DOCTYPE html><html><head><title>Remito de Recepción Lote #${lote.lote_id}</title>
      <style>*{box-sizing:border-box;font-family:Arial,sans-serif}body{margin:24px;color:#111827;font-size:13px}
      .header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #FF8200;padding-bottom:10px;margin-bottom:16px}
      .header-left{display:flex;align-items:center;gap:12px}
      table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #d1d5db;padding:8px 10px;text-align:left}th{background:#f3f4f6}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;font-size:13px}
      .meta div{padding:6px 10px;background:#f8fafc;border-radius:6px}
      .sigs{display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-top:54px}
      .sig{border-top:1px solid #111827;padding-top:8px;text-align:center;font-size:12px}</style></head><body>
      <div class="header">
        <div class="header-left">${logoHtml}
          <div><div style="font-weight:bold;font-size:1.1rem">San Juan Gobierno</div>
          <div style="color:#666">Ministerio de Educación</div></div></div>
        <div style="text-align:right"><div style="font-weight:bold;font-size:1.2rem">Lote #${lote.lote_id}</div>
          <div style="color:#666">Remito de Recepción de Mercadería</div></div></div>
      <div class="meta">
        <div><strong>Institución:</strong> ${institucion ? `${institucion.nombre} (CUE: ${institucion.cue})` : 'Institución Directivo'}</div>
        <div><strong>Zona:</strong> ${lote.zona_nombre || '-'}</div>
        <div><strong>Fecha Recepción:</strong> ${lote.recibido_at ? new Date(lote.recibido_at).toLocaleString('es-AR') : new Date().toLocaleString('es-AR')}</div>
        <div><strong>Depósito Origen:</strong> ${lote.deposito_nombre || '-'}</div>
        <div style="grid-column: 1 / -1"><strong>Registrado por:</strong> ${user?.nombre || 'Directivo'}</div>
      </div>
      <table><thead><tr><th>Producto</th><th style="text-align:center">Unidad</th><th style="text-align:center">Planificado</th><th style="text-align:center">Recibido</th><th style="text-align:center">Dañado</th><th style="text-align:center">Coincide</th><th>Observaciones</th><th>Reclamo / Daño</th></tr></thead>
      <tbody>${rowsHTML}</tbody></table>
      ${itemsDanados.length > 0 ? `
        <h3 style="margin-top:20px; color:#b91c1c;">Detalle de Mercadería Dañada</h3>
        <table><thead><tr><th>Producto</th><th style="text-align:center">Cant. Dañada</th><th>Detalle/Reclamo</th></tr></thead><tbody>${daniosHTML}</tbody></table>
      ` : ''}
      <div class="sigs"><div class="sig">Firma del Directivo / Responsable</div><div class="sig">Firma de Transporte / Distribuidor</div></div>
    </body></html>`)
    win.document.close()
    win.print()
  }

  const handleConfirmarRecepcionLote = async (lote) => {
    const payloadItems = (lote.items || []).map((item) => {
      const key = itemKey(lote.lote_id, item.id_producto)
      const formRow = recepcionForm[key] || {}
      return {
        id_producto: Number(item.id_producto),
        producto_nombre: item.producto_nombre,
        unidad_medida: item.unidad_medida,
        cantidad_planificada: item.cantidad_planificada,
        cantidad_recibida: Number(formRow.cantidad_recibida || 0),
        cantidad_danada: Number(formRow.cantidad_danada || 0),
        detalle_danio: formRow.detalle_danio || '',
        coincide_esperado: formRow.coincide_esperado !== false,
        observaciones_directivo: formRow.observaciones_directivo || '',
        reclamo_directivo: formRow.reclamo_directivo || '',
        imagenes: Array.isArray(formRow.imagenes) ? formRow.imagenes : [],
      }
    })

    const invalidItem = payloadItems.find((it, idx) => {
      const planificada = Number(lote.items[idx]?.cantidad_planificada || 0)
      return Number(it.cantidad_recibida) + Number(it.cantidad_danada || 0) > planificada
    })
    if (invalidItem) {
      setDistMsg({ text: 'Hay ítems donde recibido + dañado supera la cantidad planificada', type: 'error' })
      return
    }

    const missingFieldsItem = payloadItems.find((it) => {
      const isReceiving = it.cantidad_recibida > 0 || it.cantidad_danada > 0
      return isReceiving && (!it.observaciones_directivo.trim() || it.imagenes.length === 0)
    })
    if (missingFieldsItem) {
      const prodName = lote.items.find(x => Number(x.id_producto) === Number(missingFieldsItem.id_producto))?.producto_nombre || 'producto'
      setDistMsg({
        text: `Es obligatorio ingresar Observaciones y adjuntar al menos una foto (Evidencia) para el producto: "${prodName}".`,
        type: 'error'
      })
      return
    }

    try {
      const res = await apiFetch(`/api/directivo/distribuciones/${lote.lote_id}/confirmar-recepcion`, {
        token,
        method: 'POST',
        body: JSON.stringify({ items: payloadItems }),
      })

      if (res.ok) {
        const data = await res.json()
        setDistMsg({ text: `Recepción actualizada para lote #${lote.lote_id}. Estado: ${data.estado}`, type: 'success' })
        
        // Disparar la impresión del remito con los datos recibidos
        printRemito(lote, payloadItems)

        loadDistribuciones()
        loadHistorial()
      } else {
        const data = await res.json().catch(() => ({}))
        setDistMsg({ text: data.error || 'No se pudo confirmar recepción', type: 'error' })
      }
    } catch {
      setDistMsg({ text: 'Error de conexión al confirmar recepción', type: 'error' })
    }
  }

  const handleImageChange = async (loteId, productoId, fileList) => {
    const files = Array.from(fileList || [])
    if (files.length === 0) return

    try {
      const converted = await filesToBase64(files)
      handleFormChange(loteId, productoId, 'imagenes', converted)
    } catch {
      setDistMsg({ text: 'No se pudieron procesar las imágenes de daño', type: 'error' })
    }
  }

  return (
    <div>
      <h3 style={{ marginBottom: 6 }}>Recepción de Mercadería (Ajeno a mi Stock)</h3>
      <p style={{ color: 'var(--muted)', marginTop: 0 }}>
        Confirmá recepción total o parcial de envíos distribuidos, informá productos dañados y adjuntá evidencia.
        <br />
        <strong style={{ color: '#dc2626', fontSize: '0.85rem' }}>
          * Al recibir mercadería (recibido o dañado &gt; 0), es obligatorio ingresar Observaciones y adjuntar al menos una foto (Evidencia).
        </strong>
      </p>

      {distMsg.text && (
        <div className={`msg show ${distMsg.type === 'success' ? 'msg-success' : 'msg-error'}`} style={{ marginBottom: 14 }}>
          {distMsg.text}
        </div>
      )}

      {distLoading ? (
        <div className="sv-empty-state">Buscando distribuciones pendientes...</div>
      ) : lotesPendientes.length === 0 ? (
        <div className="sv-empty-state">No hay distribuciones pendientes para validar.</div>
      ) : (
        lotesPendientes.map((lote) => (
          <div key={lote.lote_id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 700 }}>Lote #{lote.lote_id} — {lote.zona_nombre}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                  Depósito: {lote.deposito_nombre} | Año: {lote.anio} | Fecha: {new Date(lote.created_at).toLocaleString('es-AR')}
                </div>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Estado actual: {lote.lote_estado}</div>
            </div>

            <table>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th>Producto</th>
                  <th style={{ textAlign: 'center' }}>Planificado</th>
                  <th style={{ textAlign: 'center' }}>Recibido Ahora</th>
                  <th style={{ textAlign: 'center' }}>Dañado</th>
                  <th style={{ textAlign: 'center' }}>Coincide</th>
                  <th>Detalle daño</th>
                  <th>Observaciones <span style={{ color: '#dc2626' }}>*</span></th>
                  <th>Reclamo</th>
                  <th>Evidencia (Fotos) <span style={{ color: '#dc2626' }}>*</span></th>
                </tr>
              </thead>
              <tbody>
                {(lote.items || []).map((item) => {
                  const key = itemKey(lote.lote_id, item.id_producto)
                  const row = recepcionForm[key] || {}
                  const imagenes = Array.isArray(row.imagenes) ? row.imagenes : []
                  return (
                    <tr key={`${lote.lote_id}-${item.id_producto}`}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.producto_nombre}</div>
                        <div style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{item.unidad_medida || '-'}</div>
                      </td>
                      <td style={{ textAlign: 'center' }}>{item.cantidad_planificada}</td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="number"
                          min="0"
                          max={item.cantidad_planificada}
                          value={row.cantidad_recibida || ''}
                          onChange={(e) => handleFormChange(lote.lote_id, item.id_producto, 'cantidad_recibida', e.target.value)}
                          style={{ width: 120, textAlign: 'center' }}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="number"
                          min="0"
                          max={item.cantidad_planificada}
                          value={row.cantidad_danada || ''}
                          onChange={(e) => handleFormChange(lote.lote_id, item.id_producto, 'cantidad_danada', e.target.value)}
                          style={{ width: 90, textAlign: 'center' }}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={row.coincide_esperado !== false}
                          onChange={(e) => handleFormChange(lote.lote_id, item.id_producto, 'coincide_esperado', e.target.checked)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={row.detalle_danio || ''}
                          onChange={(e) => handleFormChange(lote.lote_id, item.id_producto, 'detalle_danio', e.target.value)}
                          placeholder="Detalle de daño"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={row.observaciones_directivo || ''}
                          onChange={(e) => handleFormChange(lote.lote_id, item.id_producto, 'observaciones_directivo', e.target.value)}
                          placeholder="Observación"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={row.reclamo_directivo || ''}
                          onChange={(e) => handleFormChange(lote.lote_id, item.id_producto, 'reclamo_directivo', e.target.value)}
                          placeholder="Detalle de reclamo"
                        />
                      </td>
                      <td>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => handleImageChange(lote.lote_id, item.id_producto, e.target.files)}
                        />
                        {imagenes.length > 0 && (
                          <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {imagenes.slice(0, 3).map((img, idx) => (
                              <img
                                key={`${key}-img-${idx}`}
                                alt={img.nombre || `img-${idx}`}
                                src={`data:${img.mime_type || 'image/jpeg'};base64,${img.datos}`}
                                style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4, border: '1px solid #e2e8f0', cursor: 'pointer' }}
                                onClick={() => handleOpenFotoModal(img)}
                              />
                            ))}
                            {imagenes.length > 3 && <span style={{ fontSize: '0.75rem', color: '#64748b' }}>+{imagenes.length - 3}</span>}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="primary" onClick={() => handleConfirmarRecepcionLote(lote)}>
                Confirmar Recepción del Lote
              </button>
            </div>
          </div>
        ))
      )}

      {/* Division line */}
      <hr style={{ margin: '36px 0 28px 0', border: 'none', borderTop: '1px solid var(--border)' }} />

      {/* Historial Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0 }}>Historial de Recepciones</h3>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '0.85rem' }}>
            Listado de envíos confirmados y recibidos anteriormente
          </p>
        </div>
      </div>

      {/* Filtros Historial */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 12,
        padding: 16,
        background: '#f8fafc',
        borderRadius: 10,
        marginBottom: 20,
        border: '1px solid var(--border)'
      }}>
        <div>
          <label style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600, letterSpacing: 0.3 }}>Desde</label>
          <input type="date" value={filterDesde} onChange={e => setFilterDesde(e.target.value)} style={{ margin: 0 }} />
        </div>
        <div>
          <label style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600, letterSpacing: 0.3 }}>Hasta</label>
          <input type="date" value={filterHasta} onChange={e => setFilterHasta(e.target.value)} style={{ margin: 0 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <button type="button" onClick={handleFilterApply} style={{ margin: 0, padding: '10px 16px', width: 'auto' }}>Filtrar</button>
          <button type="button" className="secondary" onClick={handleFilterClear} style={{ margin: 0, padding: '10px 16px', width: 'auto' }}>Limpiar</button>
        </div>
      </div>

      {/* Historial Table / State */}
      {historialLoading ? (
        <div className="sv-empty-state">Buscando historial de recepciones...</div>
      ) : historialLotes.length === 0 ? (
        <div className="sv-empty-state">No se encontraron recepciones en el historial.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ width: 100 }}>Lote #</th>
                <th>Zona</th>
                <th>Depósito Origen</th>
                <th>Fecha Recepción</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right', width: 280 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {historialLotes.map((lote) => {
                const isExpanded = expandedHistorialLoteId === lote.lote_id
                const formattedDate = lote.recibido_at
                  ? new Date(lote.recibido_at).toLocaleString('es-AR')
                  : '-'

                let badgeStyle = {
                  background: '#f1f5f9',
                  color: '#475569',
                }
                let estadoLabel = lote.lote_estado || 'recibido'
                if (lote.lote_estado === 'recibido_total') {
                  badgeStyle = { background: '#ecfdf5', color: '#065f46' }
                  estadoLabel = 'Recibido Total'
                } else if (lote.lote_estado === 'con_reclamos') {
                  badgeStyle = { background: '#fef2f2', color: '#b91c1c' }
                  estadoLabel = 'Con Reclamos'
                } else if (lote.lote_estado === 'parcialmente_recibido') {
                  badgeStyle = { background: '#fef3c7', color: '#d97706' }
                  estadoLabel = 'Parcial'
                }

                return (
                  <Fragment key={`hist-lote-${lote.lote_id}`}>
                    <tr>
                      <td style={{ fontWeight: 600 }}>#{lote.lote_id}</td>
                      <td>{lote.zona_nombre || '-'}</td>
                      <td>{lote.deposito_nombre || '-'}</td>
                      <td>{formattedDate}</td>
                      <td>
                        <span className="badge" style={{ ...badgeStyle, fontWeight: 600, padding: '4px 8px', borderRadius: 6, fontSize: '0.8rem' }}>
                          {estadoLabel}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end', width: '100%' }}>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => setExpandedHistorialLoteId(isExpanded ? null : lote.lote_id)}
                            style={{ margin: 0, padding: '6px 12px', fontSize: '0.85rem', width: 'auto', minHeight: 0 }}
                          >
                            {isExpanded ? 'Ocultar Detalle' : 'Ver Detalle'}
                          </button>
                          <button
                            type="button"
                            onClick={() => printRemito(lote, lote.items)}
                            style={{ margin: 0, padding: '6px 12px', fontSize: '0.85rem', width: 'auto', minHeight: 0 }}
                          >
                            🖨️ Reimprimir Remito
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan="6" style={{ background: '#f8fafc', padding: '16px 20px' }}>
                          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', padding: 14 }}>
                            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: 'var(--dark)' }}>
                              Detalle de Productos Recibidos
                            </h4>
                            <table style={{ margin: 0, background: '#fff' }}>
                              <thead>
                                <tr style={{ background: '#f1f5f9' }}>
                                  <th>Producto</th>
                                  <th style={{ textAlign: 'center', width: 100 }}>Planificado</th>
                                  <th style={{ textAlign: 'center', width: 100 }}>Recibido</th>
                                  <th style={{ textAlign: 'center', width: 100 }}>Dañado</th>
                                  <th style={{ textAlign: 'center', width: 90 }}>Coincide</th>
                                  <th>Observaciones / Detalle daño / Reclamo</th>
                                  <th>Evidencia (Fotos)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(lote.items || []).map((item) => {
                                  const itemImages = Array.isArray(item.imagenes) ? item.imagenes : []
                                  return (
                                    <tr key={`hist-item-${lote.lote_id}-${item.id_producto}`}>
                                      <td>
                                        <div style={{ fontWeight: 600 }}>{item.producto_nombre}</div>
                                        <div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{item.unidad_medida || '-'}</div>
                                      </td>
                                      <td style={{ textAlign: 'center' }}>{item.cantidad_planificada}</td>
                                      <td style={{ textAlign: 'center', fontWeight: 600, color: '#065f46' }}>{item.cantidad_recibida}</td>
                                      <td style={{ textAlign: 'center', fontWeight: 600, color: item.cantidad_danada > 0 ? '#b91c1c' : 'inherit' }}>
                                        {item.cantidad_danada}
                                      </td>
                                      <td style={{ textAlign: 'center' }}>{item.coincide_esperado ? 'Sí' : 'No'}</td>
                                      <td>
                                        {item.observaciones_directivo && (
                                          <div style={{ fontSize: '0.85rem', marginBottom: 4 }}>
                                            <strong>Obs:</strong> {item.observaciones_directivo}
                                          </div>
                                        )}
                                        {item.detalle_danio && (
                                          <div style={{ fontSize: '0.85rem', color: '#b91c1c', marginBottom: 4 }}>
                                            <strong>Daño:</strong> {item.detalle_danio}
                                          </div>
                                        )}
                                        {item.reclamo_directivo && (
                                          <div style={{ fontSize: '0.85rem', color: '#b91c1c' }}>
                                            <strong>Reclamo:</strong> {item.reclamo_directivo}
                                          </div>
                                        )}
                                        {!item.observaciones_directivo && !item.detalle_danio && !item.reclamo_directivo && '-'}
                                      </td>
                                      <td>
                                        {itemImages.length > 0 ? (
                                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            {itemImages.map((img, idx) => (
                                              <div key={`hist-img-${img.id}-${idx}`} style={{ position: 'relative' }}>
                                                <img
                                                  alt={img.nombre || `evidencia-${idx}`}
                                                  src={`data:${img.mime_type || 'image/jpeg'};base64,${img.datos}`}
                                                  style={{
                                                    width: 40,
                                                    height: 40,
                                                    objectFit: 'cover',
                                                    borderRadius: 4,
                                                    border: '1px solid #e2e8f0',
                                                    cursor: 'pointer'
                                                  }}
                                                  onClick={() => handleOpenFotoModal(img)}
                                                />
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Sin fotos</span>
                                        )}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de foto */}
      {fotoModalOpen && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1100, padding: 16, cursor: 'pointer'
          }}
          onClick={() => setFotoModalOpen(false)}
        >
          <div style={{
            position: 'relative', maxWidth: '90vw', maxHeight: '85vh',
            background: '#fff', borderRadius: 12, padding: 8,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }} onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setFotoModalOpen(false)}
              style={{
                position: 'absolute', top: -10, right: -10,
                background: '#1d252d', color: '#fff', border: 'none',
                borderRadius: '50%', width: 32, height: 32, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.1rem', fontWeight: 700, margin: 0, padding: 0, minHeight: 0
              }}
            >×</button>
            <div style={{ textAlign: 'center', padding: '4px 8px 8px 8px', fontWeight: 600, color: 'var(--dark)', fontSize: '0.9rem' }}>
              {fotoModalTitle}
            </div>
            <img
              src={fotoModalSrc}
              alt="Foto de evidencia ampliada"
              style={{ maxWidth: '85vw', maxHeight: '70vh', borderRadius: 8, objectFit: 'contain', display: 'block' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
