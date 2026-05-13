process.chdir(__dirname + '/../backend');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool } = require('../backend/src/db.pg');

(async () => {
  try {
    // Check enum values for tipo column
    const enumRes = await pool.query(`
      SELECT e.enumlabel AS val
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname ILIKE '%tipo%'
      ORDER BY e.enumsortorder
    `);
    console.log('ENUM values for tipo-like types:', enumRes.rows.map(r => r.val));

    // Check actual column type
    const colRes = await pool.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'movimiento_stock'
      ORDER BY ordinal_position
    `);
    console.log('movimiento_stock cols:', colRes.rows.map(r => `${r.column_name}(${r.udt_name})`).join(', '));

    // Check if id_deposito_destino exists
    const destCol = colRes.rows.find(r => r.column_name === 'id_deposito_destino');
    console.log('id_deposito_destino exists:', !!destCol);

  } catch (e) {
    console.error(e.message);
  } finally {
    await pool.end();
  }
})();
