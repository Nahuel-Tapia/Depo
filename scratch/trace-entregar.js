process.chdir(__dirname + '/../backend');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool, get, all } = require('../backend/src/db.pg');

(async () => {
  try {
    // Check movimiento_stock columns
    const cols = await all("SELECT column_name FROM information_schema.columns WHERE table_name = 'movimiento_stock' ORDER BY ordinal_position");
    console.log('movimiento_stock columns:', cols.map(r => r.column_name));

    // Check solicitud 8
    const sol = await get('SELECT * FROM solicitud_retiro WHERE id = $1', [8]);
    console.log('solicitud 8:', sol);

    if (sol) {
      const items = await all('SELECT * FROM solicitud_retiro_detalle WHERE id_solicitud_retiro = $1', [8]);
      console.log('items:', items);

      const pedido = await get('SELECT id_pedido, estado, aprobado_director_area, tipo FROM pedido WHERE id_pedido = $1', [sol.id_pedido]);
      console.log('pedido:', pedido);

      if (items[0]) {
        const prod = await get('SELECT id_producto, nombre, stock_actual FROM producto WHERE id_producto = $1', [items[0].id_producto]);
        console.log('producto:', prod);
      }
    }

    // Try the movimiento_stock insert to check for column errors
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query(`
        INSERT INTO movimiento_stock
          (id_producto, tipo, cantidad, estado_producto, cargo_retira, id_institucion, id_usuario, motivo, fecha_movimiento)
        VALUES ($1, 'egreso', $2, 'nuevo', $3, $4, $5, $6, NOW())
        RETURNING id_movimiento
      `, [3, 1, 'Directivo', 1163, 3, 'Test entrega']);
      console.log('movimiento_stock insert OK, id:', r.rows[0].id_movimiento);
      await client.query('ROLLBACK');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('movimiento_stock insert ERROR:', e.message);
    } finally {
      client.release();
    }

  } catch (e) {
    console.error('ERROR:', e.message, e.stack);
  } finally {
    await pool.end();
  }
})();
