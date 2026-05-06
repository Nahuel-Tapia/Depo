import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

export default function LicitacionesCerradas() {
  const { token } = useAuth()
  const [licitaciones, setLicitaciones] = useState([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: '' })

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
    <div className="card" style={{ padding: 24, minHeight: 'auto' }}>
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
              <th style={{ textAlign: 'right' }}>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {licitaciones.map(lic => (
              <tr key={lic.id}>
                <td style={{ fontWeight: 700 }}>{lic.anio}</td>
                <td>{new Date(lic.fecha_publicacion).toLocaleString('es-AR')}</td>
                <td>{lic.total_items} ítems</td>
                <td>
                  <span className={`badge badge-estado-${lic.estado}`}>
                    {ESTADO_LABEL[lic.estado] || lic.estado}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  {lic.estado === 'adjudicada' && (
                    <button className="primary" onClick={() => handleEnviarDeposito(lic.id)}>
                      🚀 Enviar a Depósito
                    </button>
                  )}
                  {lic.estado === 'en_deposito' && (
                    <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Esperando recepción...</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
