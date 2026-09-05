require('dotenv').config();
const { all } = require('../backend/src/db.pg');
const entregaService = require('../backend/src/services/entregaService');

async function debugPedidos() {
  try {
    console.log('=== ALL PEDIDOS IN DATABASE ===');
    const allPedidos = await all(`
      SELECT p.id_pedido, p.id_usuario_solicitante, p.id_institucion, p.estado, p.tipo, p.aprobado_director_area, p.aprobado_por_supervisor_id, i.nombre as institucion_nombre
      FROM pedido p
      LEFT JOIN institucion i ON i.id_institucion = p.id_institucion
      ORDER BY p.id_pedido DESC
    `);
    console.table(allPedidos);

    console.log('=== USERS WITH ROL DIRECTIVO ===');
    const directivos = await all(`
      SELECT id_usuario, nombre, email, role, id_institucion
      FROM usuario
      WHERE role = 'directivo'
    `);
    console.table(directivos);

    for (const d of directivos) {
      if (d.id_institucion) {
        console.log(`\n--- Testing getProductosDisponiblesRetiro for directivo user ${d.id_usuario} (${d.nombre}, inst ${d.id_institucion}) ---`);
        try {
          const res = await entregaService.getProductosDisponiblesRetiro(d.id_usuario);
          console.log('Result count:', res.length);
          console.log('Result:', JSON.stringify(res, null, 2));
        } catch (err) {
          console.error('Error for user:', err);
        }
      }
    }
  } catch (err) {
    console.error('Error in debug script:', err);
  }
}

debugPedidos();
