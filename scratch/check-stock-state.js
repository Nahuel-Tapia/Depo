process.chdir(__dirname + '/../backend');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool, get } = require('../backend/src/db.pg');

(async () => {
  try {
    const p = await get("SELECT id_producto, nombre, stock_actual FROM producto WHERE id_producto=2");
    console.log('Producto 2 stock_actual:', p);

    // Also check what the movimiento_stock entries look like
    const { rows } = await pool.query("SELECT id_movimiento, tipo, cantidad, fecha_movimiento, motivo FROM movimiento_stock WHERE id_producto=2 ORDER BY id_movimiento DESC LIMIT 5");
    console.log('Last 5 movimientos for producto 2:', rows);

  } catch (e) {
    console.error(e.message);
  } finally {
    await pool.end();
  }
})();
