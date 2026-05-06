const { pool } = require('../backend/src/db.pg');
(async () => {
  try {
    // Check movimiento_stock for id_deposito column
    const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'movimiento_stock'");
    console.log('movimiento_stock columns:', cols.rows.map(r => r.column_name));

    // Check enum values for tipo
    const enums = await pool.query("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname LIKE '%movimiento%' OR pg_type.typname LIKE '%tipo%'");
    console.log('enum values:', enums.rows.map(r => r.enumlabel));

    // Check stock_deposito
    const sd = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_deposito'");
    console.log('stock_deposito columns:', sd.rows.map(r => r.column_name));

    // Try a test insert to see the exact error
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        "INSERT INTO movimiento_stock (id_producto, cantidad, tipo, motivo, id_usuario, id_deposito, fecha_vencimiento) VALUES ($1, $2, 'ingreso', $3, $4, $5, $6)",
        [1, 1, 'Test', 1, 1, null]
      );
      await client.query('ROLLBACK'); // Don't actually save
      console.log('Test insert OK');
    } catch (e) {
      await client.query('ROLLBACK');
      console.log('Test insert FAILED:', e.message);
    } finally {
      client.release();
    }
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
})();
