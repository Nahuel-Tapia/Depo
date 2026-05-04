const { pool } = require('../backend/src/db.pg');
(async () => {
  try {
    await pool.query('ALTER TABLE movimiento_stock ADD COLUMN IF NOT EXISTS id_deposito INTEGER REFERENCES deposito(id_deposito)');
    console.log('Column id_deposito added to movimiento_stock');
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
})();
