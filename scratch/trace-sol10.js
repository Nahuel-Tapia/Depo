process.chdir(__dirname + '/../backend');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool, get, all } = require('../backend/src/db.pg');

(async () => {
  const solicitudId = 10;
  const client = await pool.connect();
  try {
    // Step 1: check solicitud
    const sol = await client.query(`
      SELECT sr.*, i.nombre AS inst_nombre
      FROM solicitud_retiro sr
      JOIN institucion i ON i.id_institucion = sr.id_institucion
      WHERE sr.id = $1
    `, [solicitudId]);
    console.log('Solicitud:', sol.rows[0]);

    const id_pedido = sol.rows[0].id_pedido;

    // Step 2: check pedido
    const ped = await client.query(`SELECT id_pedido, estado, aprobado_director_area, tipo FROM pedido WHERE id_pedido=$1`, [id_pedido]);
    console.log('Pedido:', ped.rows[0]);

    // Step 3: check detalle solicitud
    const det = await client.query(`
      SELECT srd.*, p.nombre, p.stock_actual
      FROM solicitud_retiro_detalle srd
      JOIN producto p ON p.id_producto = srd.id_producto
      WHERE srd.id_solicitud_retiro = $1
    `, [solicitudId]);
    console.log('Detalles:', det.rows);

    // Step 4: check detalle_pedido
    for (const row of det.rows) {
      const dp = await client.query(`SELECT * FROM detalle_pedido WHERE id_pedido=$1 AND id_producto=$2`, [id_pedido, row.id_producto]);
      console.log('detalle_pedido for producto', row.id_producto, ':', dp.rows);
    }

    // Step 5: check movimiento_stock columns
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'movimiento_stock'
      ORDER BY ordinal_position
    `);
    console.log('movimiento_stock columns:', cols.rows.map(r => r.column_name + ' ' + r.data_type + (r.is_nullable==='NO'?' NOT NULL':'')));

    // Step 6: check pedido_entrega columns
    const cols2 = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'pedido_entrega'
      ORDER BY ordinal_position
    `);
    console.log('pedido_entrega columns:', cols2.rows.map(r => r.column_name + ' ' + r.data_type + (r.is_nullable==='NO'?' NOT NULL':'')));

    // Step 7: check kit saldo query for each item
    for (const row of det.rows) {
      const kit = await client.query(`SELECT id_kit FROM kit_producto WHERE id_producto = $1 LIMIT 1`, [row.id_producto]);
      console.log('kit_producto for', row.id_producto, ':', kit.rows);
    }

  } catch (e) {
    console.error('FAILED:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
})();
