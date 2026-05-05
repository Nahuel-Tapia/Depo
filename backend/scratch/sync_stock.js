const { pool } = require('../src/db.pg');

async function syncStock() {
  try {
    console.log('Starting stock synchronization...');
    const result = await pool.query(`
      INSERT INTO stock_deposito (id_deposito, id_producto, cantidad) 
      SELECT (SELECT id_deposito FROM deposito WHERE tipo = 'central' LIMIT 1), id_producto, stock_actual 
      FROM producto 
      ON CONFLICT (id_deposito, id_producto) 
      DO UPDATE SET cantidad = EXCLUDED.cantidad
    `);
    console.log(`Sync complete. Rows affected: ${result.rowCount}`);
    process.exit(0);
  } catch (err) {
    console.error('Error during sync:', err);
    process.exit(1);
  }
}

syncStock();
