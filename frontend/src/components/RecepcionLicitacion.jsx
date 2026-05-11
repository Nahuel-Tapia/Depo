import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

export default function RecepcionLicitacion() {
  const { token } = useAuth()
  const [recepciones, setRecepciones] = useState([])
  const [detalle, setDetalle] = useState(null)
  const [depositos, setDepositos] = useState([])
  const [selectedDeposito, setSelectedDeposito] = useState('')
  const [ingresos, setIngresos] = useState({}) // {producto_id: cantidad}
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: '' })

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
    try {
      const res = await apiFetch(`/api/depositos/licitacion/recepciones/${id}`, { token })
      if (res.ok) {
        const data = await res.json()
        setDetalle(data)
        // Resetear ingresos
        setIngresos({})
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

  const handleExpiryChange = (prodId, val) => {
    setIngresos(prev => ({ 
      ...prev, 
      [prodId]: { ...prev[prodId], fecha_vencimiento: val } 
    }))
  }

  const handleConfirmarIngreso = async () => {
    if (!selectedDeposito) {
      alert('Seleccione un depósito de destino')
      return
    }

    const payloadIngresos = Object.entries(ingresos)
      .filter(([_, data]) => Number(data.cantidad) > 0)
      .map(([id, data]) => ({ 
        producto_id: Number(id), 
        cantidad: Number(data.cantidad),
        fecha_vencimiento: data.fecha_vencimiento || null
      }))

    if (payloadIngresos.length === 0) {
      alert('Cargue al menos una cantidad para ingresar')
      return
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
        setMsg({ text: 'Mercadería ingresada al stock correctamente', type: 'success' })
        setDetalle(null)
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

  return (
    <div className="card" style={{ padding: 24, minHeight: 'auto' }}>
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
                  <th>FECHA ENVÍO</th>
                  <th style={{ textAlign: 'right' }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {recepciones.map(r => (
                  <tr key={r.id}>
                    <td>#{r.id}</td>
                    <td style={{ fontWeight: 700 }}>{r.anio}</td>
                    <td>{new Date(r.fecha_publicacion).toLocaleString()}</td>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <button className="secondary" onClick={() => setDetalle(null)}>⬅ Volver al listado</button>
            <div style={{ textAlign: 'right' }}>
              <label style={{ display: 'block', fontSize: '0.85rem' }}>Depósito de destino:</label>
              <select 
                value={selectedDeposito} 
                onChange={e => setSelectedDeposito(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 8 }}
              >
                {depositos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
            </div>
          </div>

          <h3 style={{ borderBottom: '2px solid var(--primary)', paddingBottom: 10 }}>
            Carga de Ingreso — Licitación #{detalle.id} ({detalle.anio})
          </h3>

          <table style={{ marginBottom: 24 }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th>PRODUCTO</th>
                <th style={{ textAlign: 'center' }}>TOTAL ADJUDICADO</th>
                <th style={{ textAlign: 'center' }}>YA RECIBIDO</th>
                <th style={{ textAlign: 'center', width: 140 }}>CANT. A INGRESAR</th>
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 14 }}>
            <button className="secondary" onClick={() => setDetalle(null)} disabled={saving}>Cancelar</button>
            <button className="primary" onClick={handleConfirmarIngreso} disabled={saving}>
              {saving ? 'Registrando...' : '🚀 Confirmar Ingreso a Stock'}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
