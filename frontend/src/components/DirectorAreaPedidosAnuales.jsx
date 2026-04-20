import React from 'react'

export default function DirectorAreaPedidosAnuales({
  solicitudes,
  updatingId,
  handleDecisionSolicitud,
  handleEntregarSolicitud,
  planillas,
  planillaDetalle,
  planillaObs,
  setPlanillaObs,
  creandoPlanilla,
  handleCrearPlanilla,
  handleVerDetalle,
  handleEnviarPlanilla,
  handleEliminarPlanilla
}) {
  const anioActual = new Date().getFullYear()
  const planillaActivaAnio = planillas.find(p => p.anio === anioActual && p.estado !== 'procesada')
  const solicitudesAnualesPorDecidir = solicitudes.filter(
    s => (s.tipo || 'anual') === 'anual' && s.estado === 'aprobado' && s.aprobado_director_area == null
  )
  const solicitudesAnualesAceptadas = solicitudes.filter(
    s => (s.tipo || 'anual') === 'anual' && s.estado === 'aprobado' && s.aprobado_director_area === true
  )

  return (
    <>
      <h3 style={{ marginTop: 32 }}>Planilla de Pedido Anual {anioActual}</h3>
      <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
        Consolidá solicitudes anuales aceptadas por Dirección de Área en una planilla y enviala al Área de Compras.
      </p>
      <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: '0.85rem' }}>
        Pendientes de decisión: <strong>{solicitudesAnualesPorDecidir.length}</strong> · Aceptadas para planilla: <strong>{solicitudesAnualesAceptadas.length}</strong>
      </p>
      {/* ...resto del render de planilla y tabla de solicitudes... */}
    </>
  )
}
