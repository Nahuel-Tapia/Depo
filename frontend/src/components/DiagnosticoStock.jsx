import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../api'

export default function DiagnosticoStock() {
  const { token, hasPermission } = useAuth()
  const [diagnostico, setDiagnostico] = useState(null)
  const [loading, setLoading] = useState(false)
  const [reconciliando, setReconciliando] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: '' })

  const canReconcile = hasPermission('stock.movement.create') // or whichever permission makes sense
  const canView = hasPermission('stock.view')

  const ejecutarDiagnostico = async () => {
    setLoading(true)
    setMsg({ text: '', type: '' })
    setDiagnostico(null)
    try {
      const res = await apiFetch('/api/depositos/diagnostico-stock', { token })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setMsg({ text: data.error || 'Error al ejecutar el diagnóstico', type: 'error' })
        return
      }
      const data = await res.json()
      setDiagnostico(data)
      setMsg({ 
        text: data.productos_inconsistentes === 0 
          ? '✅ Stock consistente. No se encontraron diferencias.' 
          : `⚠️ Se encontraron ${data.productos_inconsistentes} productos con inconsistencias de stock.`, 
        type: data.productos_inconsistentes === 0 ? 'success' : 'error' 
      })
    } catch {
      setMsg({ text: 'Error de red al conectar con el servidor', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const ejecutarReconciliacion = async () => {
    if (!window.confirm('⚠️ ATENCIÓN: Esta acción reescribirá el stock global (stock_actual) para que coincida exactamente con la suma del stock por depósitos. Se generarán registros de auditoría por cada corrección. ¿Estás seguro de continuar?')) {
      return
    }

    setReconciliando(true)
    setMsg({ text: '', type: '' })
    try {
      const res = await apiFetch('/api/depositos/reconciliar-stock', { 
        method: 'POST',
        token 
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setMsg({ text: data.error || 'Error al reconciliar el stock', type: 'error' })
        return
      }
      const data = await res.json()
      setMsg({ text: `✅ Reconciliación completa. Se corrigieron ${data.corregidos} productos.`, type: 'success' })
      
      // Volver a ejecutar diagnóstico para mostrar que todo está bien
      await ejecutarDiagnostico()
    } catch {
      setMsg({ text: 'Error de red al conectar con el servidor', type: 'error' })
    } finally {
      setReconciliando(false)
    }
  }

  useEffect(() => {
    if (canView) {
      ejecutarDiagnostico()
    }
  }, [canView])

  if (!canView) return null

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0 }}>Diagnóstico de Stock</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>
            Audita y corrige discrepancias entre el stock global y la suma del stock en los depósitos.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="secondary"
            onClick={ejecutarDiagnostico}
            disabled={loading || reconciliando}
            style={{ width: 'auto', margin: 0 }}
          >
            {loading ? 'Consultando...' : '🔍 Ejecutar Diagnóstico'}
          </button>
          {canReconcile && diagnostico && diagnostico.productos_inconsistentes > 0 && (
            <button
              type="button"
              onClick={ejecutarReconciliacion}
              disabled={reconciliando || loading}
              style={{ width: 'auto', margin: 0, background: '#b91c1c' }}
            >
              {reconciliando ? 'Corrigiendo...' : '🛠️ Reparar Inconsistencias'}
            </button>
          )}
        </div>
      </div>

      {msg.text && (
        <div style={{
          padding: '14px 18px',
          borderRadius: 8,
          marginBottom: 20,
          background: msg.type === 'error' ? '#fef2f2' : '#ecfdf5',
          color: msg.type === 'error' ? '#b91c1c' : '#065f46',
          fontWeight: 500,
          border: `1px solid ${msg.type === 'error' ? '#fecaca' : '#bbf7d0'}`
        }}>
          {msg.text}
        </div>
      )}

      {diagnostico && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div style={{ padding: 16, borderRadius: 10, background: '#f8fafc', border: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Total Productos</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, marginTop: 4 }}>{diagnostico.total_productos}</div>
          </div>
          <div style={{ padding: 16, borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#065f46', fontWeight: 600 }}>Consistentes</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#065f46', marginTop: 4 }}>{diagnostico.productos_consistentes}</div>
          </div>
          <div style={{ padding: 16, borderRadius: 10, background: diagnostico.productos_inconsistentes > 0 ? '#fef2f2' : '#f8fafc', border: `1px solid ${diagnostico.productos_inconsistentes > 0 ? '#fecaca' : 'var(--border)'}`, textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: diagnostico.productos_inconsistentes > 0 ? '#b91c1c' : 'var(--muted)', fontWeight: 600 }}>Inconsistentes</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: diagnostico.productos_inconsistentes > 0 ? '#b91c1c' : 'var(--dark)', marginTop: 4 }}>{diagnostico.productos_inconsistentes}</div>
          </div>
        </div>
      )}

      {diagnostico && diagnostico.inconsistencias?.length > 0 && (
        <div>
          <h3 style={{ marginBottom: 12, fontSize: '1.1rem' }}>Detalle de Inconsistencias</h3>
          <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
            <table style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Producto</th>
                  <th style={{ textAlign: 'right' }}>Stock Global (BD)</th>
                  <th style={{ textAlign: 'right' }}>Suma en Depósitos</th>
                  <th style={{ textAlign: 'right' }}>Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {diagnostico.inconsistencias.map(item => (
                  <tr key={item.id}>
                    <td style={{ color: 'var(--muted)' }}>#{item.id}</td>
                    <td style={{ fontWeight: 500 }}>{item.nombre} <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>({item.unidad_medida})</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.stock_global}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#065f46' }}>{item.stock_depositos}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="badge" style={{ background: '#fef2f2', color: '#b91c1c', fontWeight: 700 }}>
                        {item.diferencia > 0 ? `+${item.diferencia}` : item.diferencia}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12, padding: 12, background: '#f8fafc', borderRadius: 8, fontSize: '0.9rem', color: 'var(--muted)' }}>
            <strong>Nota:</strong> Al ejecutar la reconciliación, el "Stock Global (BD)" será reemplazado por la "Suma en Depósitos" para corregir la diferencia.
          </div>
        </div>
      )}
    </div>
  )
}
