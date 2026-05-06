import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

export default function DistribucionEscuelas() {
  const { token } = useAuth()
  const [pendientes, setPendientes] = useState([])
  const [detalle, setDetalle] = useState(null)
  const [depositos, setDepositos] = useState([])
  const [selectedDeposito, setSelectedDeposito] = useState('')
  const [entregas, setEntregas] = useState({}) // {producto_id: cantidad}
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: '' })

  const loadPendientes = async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/depositos/distribucion/pendientes', { token })
      if (res.ok) {
        const data = await res.json()
        setPendientes(data.pendientes || [])
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
    loadPendientes()
    loadDepositos()
  }, [])

  const verDetalle = async (escuela) => {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/depositos/distribucion/pendientes/${escuela.id}`, { token })
      if (res.ok) {
        const data = await res.json()
        setDetalle({ ...escuela, items: data.items })
        setEntregas({})
      }
    } catch (err) { /* ignore */ }
    setLoading(false)
  }

  const handleQtyChange = (prodId, val) => {
    setEntregas(prev => ({ ...prev, [prodId]: val }))
  }

  const handleConfirmarSalida = async () => {
    if (!selectedDeposito) {
      alert('Seleccione un depósito de origen')
      return
    }

    const payloadEntregas = Object.entries(entregas)
      .filter(([_, qty]) => Number(qty) > 0)
      .map(([id, qty]) => ({ producto_id: Number(id), cantidad: Number(qty) }))

    if (payloadEntregas.length === 0) {
      alert('Cargue al menos una cantidad para entregar')
      return
    }

    setSaving(true)
    try {
      const res = await apiFetch('/api/depositos/distribucion/registrar-salida', {
        token,
        method: 'POST',
        body: JSON.stringify({
          id_institucion: detalle.id,
          anio: new Date().getFullYear(),
          id_deposito: Number(selectedDeposito),
          entregas: payloadEntregas,
          observaciones: 'Distribución de Licitación Anual'
        })
      })

      if (res.ok) {
        setMsg({ text: 'Distribución registrada y remito virtual generado', type: 'success' })
        setDetalle(null)
        loadPendientes()
      } else {
        const data = await res.json()
        setMsg({ text: data.error || 'Error al procesar salida', type: 'error' })
      }
    } catch (err) {
      setMsg({ text: 'Error de conexión', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card" style={{ padding: 24, minHeight: 'auto' }}>
      <h2 style={{ marginTop: 0 }}>Distribución a Escuelas</h2>
      <p style={{ color: 'var(--muted)', marginTop: 0 }}>
        Módulo para registrar la salida de mercadería hacia las instituciones (Licitación Anual).
      </p>

      {msg.text && (
        <div className={`msg show ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`} style={{ marginBottom: 20 }}>
          {msg.text}
        </div>
      )}

      {!detalle ? (
        <>
          {loading ? (
            <div className="sv-empty-state">Buscando escuelas con pendientes...</div>
          ) : pendientes.length === 0 ? (
            <div className="sv-empty-state">No hay escuelas con ítems pendientes de distribución.</div>
          ) : (
            <table>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th>CUE</th>
                  <th>INSTITUCIÓN</th>
                  <th style={{ textAlign: 'center' }}>PRODUCTOS PENDIENTES</th>
                  <th style={{ textAlign: 'right' }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {pendientes.map(p => (
                  <tr key={p.id}>
                    <td>{p.cue}</td>
                    <td style={{ fontWeight: 600 }}>{p.nombre}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                        {p.productos_pendientes} de {p.total_productos}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button onClick={() => verDetalle(p)}>🚚 Armar Distribución</button>
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
              <label style={{ display: 'block', fontSize: '0.85rem' }}>Depósito de origen:</label>
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
            Orden de Salida: {detalle.nombre} ({detalle.cue})
          </h3>

          <table style={{ marginBottom: 24 }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th>PRODUCTO</th>
                <th style={{ textAlign: 'center' }}>CANT. ANUAL APROBADA</th>
                <th style={{ textAlign: 'center' }}>YA ENTREGADO</th>
                <th style={{ textAlign: 'center', width: 140 }}>A ENTREGAR AHORA</th>
              </tr>
            </thead>
            <tbody>
              {detalle.items.map(item => {
                const pendiente = Number(item.cantidad_adjudicada) - Number(item.cantidad_entregada)
                
                return (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.producto}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{item.unidad_medida}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>{item.cantidad_adjudicada}</td>
                    <td style={{ textAlign: 'center', color: item.cantidad_entregada > 0 ? 'var(--primary)' : 'var(--muted)' }}>
                      {item.cantidad_entregada}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {pendiente <= 0 ? (
                        <span style={{ color: 'green', fontWeight: 700 }}>✅ Todo Entregado</span>
                      ) : (
                        <input 
                          type="number"
                          min="0"
                          max={pendiente}
                          placeholder={`Faltan ${pendiente}`}
                          value={entregas[item.id] || ''}
                          onChange={e => handleQtyChange(item.id, e.target.value)}
                          style={{ textAlign: 'center', fontWeight: 700, borderColor: entregas[item.id] ? 'var(--primary)' : '#cbd5e1' }}
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
            <button className="primary" onClick={handleConfirmarSalida} disabled={saving}>
              {saving ? 'Registrando...' : '🚚 Confirmar Salida de Depósito'}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
