process.chdir(__dirname + '/../backend');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool, get, all } = require('../backend/src/db.pg');

(async () => {
  try {
    // Check for triggers on movimiento_stock
    const triggers = await all(`
      SELECT trigger_name, event_manipulation, action_timing, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'movimiento_stock'
    `);
    console.log('Triggers on movimiento_stock:', triggers);

    // Also check stock_deposito
    const triggers2 = await all(`
      SELECT trigger_name, event_manipulation, action_timing
      FROM information_schema.triggers
      WHERE event_object_table IN ('producto', 'pedido_entrega', 'solicitud_retiro')
    `);
    console.log('Other relevant triggers:', triggers2);

    // Check if stock_deposito has a NOT NULL constraint that might cause issues
    const stockDepCols = await all(`
      SELECT column_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'stock_deposito'
    `);
    console.log('stock_deposito columns:', stockDepCols);

  } catch (e) {
    console.error(e.message);
  } finally {
    await pool.end();
  }
})();
