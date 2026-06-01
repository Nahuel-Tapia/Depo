const entregaService = require('../backend/src/services/entregaService');

async function main() {
  console.log('--- INSPECTING DEPT DETAIL API RESULT ---');
  try {
    const result = await entregaService.getDetalleSolicitudesEnvioDepartamento('CAPITAL', 2026);
    console.log('Result resumen:', result.resumen);
    console.log('Solicitudes length:', result.solicitudes.length);
    if (result.solicitudes.length > 0) {
      const sol = result.solicitudes[0];
      console.log('Solicitud 26 keys:', Object.keys(sol));
      console.log('productos_pedido_anual length:', sol.productos_pedido_anual ? sol.productos_pedido_anual.length : 'undefined');
      console.log('productos_pedido_anual sample:', sol.productos_pedido_anual);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

main().finally(() => require('../backend/src/db.pg').pool.end());
