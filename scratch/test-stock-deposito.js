require('dotenv').config();
const { all } = require('../backend/src/db.pg');

async function checkStockDeposito() {
  try {
    const rows = await all("SELECT id_producto, COALESCE(SUM(cantidad), 0)::numeric AS stock_actual FROM stock_deposito WHERE id_producto = ANY($1::int[]) GROUP BY id_producto", [[1, 2, 3]]);
    console.log('stock_deposito query success! Rows:', rows);
  } catch (err) {
    console.error('❌ ERROR ON stock_deposito:', err.message);
  }
}

checkStockDeposito();
