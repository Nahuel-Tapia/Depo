require('dotenv').config();
const { all } = require('../backend/src/db.pg');

async function inspectPedidos() {
  try {
    const pedidos = await all(`
      SELECT p.id_pedido, p.estado, p.tipo, p.aprobado_director_area, p.aprobado_por_supervisor_id, p.id_institucion, i.nombre as institucion_nombre
      FROM pedido p
      LEFT JOIN institucion i ON i.id_institucion = p.id_institucion
      ORDER BY p.id_pedido DESC
      LIMIT 20
    `);
    console.log('--- RECENT PEDIDOS IN DB ---');
    console.table(pedidos);

    const disponiblesRows = await all(`
      SELECT p.id_pedido, p.estado, p.tipo, p.aprobado_director_area, p.id_institucion
      FROM pedido p
      WHERE p.estado = 'aprobado'
    `);
    console.log('--- PEDIDOS WITH estado = APPROVED ---');
    console.table(disponiblesRows);
  } catch (err) {
    console.error('Error inspecting pedidos:', err);
  }
}

inspectPedidos();
