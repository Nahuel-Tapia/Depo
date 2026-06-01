const { pool } = require('../backend/src/db.pg');

async function main() {
  console.log('--- INSPECTION OF SOLICITUD 26 ---');
  const sol = await pool.query("SELECT * FROM solicitud_retiro WHERE id = 26");
  console.log('Solicitud 26:', sol.rows[0]);

  if (sol.rows.length > 0) {
    const pedidoId = sol.rows[0].id_pedido;
    console.log('pedidoId associated:', pedidoId);
    
    const pedido = await pool.query("SELECT * FROM pedido WHERE id_pedido = $1", [pedidoId]);
    console.log('Pedido:', pedido.rows[0]);

    const detPedido = await pool.query("SELECT * FROM detalle_pedido WHERE id_pedido = $1", [pedidoId]);
    console.log('Detalle Pedido:', detPedido.rows);

    const detSol = await pool.query("SELECT * FROM solicitud_retiro_detalle WHERE id_solicitud_retiro = 26");
    console.log('Detalle Solicitud:', detSol.rows);
  }
}

main().catch(console.error).finally(() => pool.end());
