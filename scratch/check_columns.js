const { pool } = require('../backend/src/db.pg');
(async () => {
  try {
    const res = await pool.query("SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name = 'movimiento_stock'");
    console.table(res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
})();
