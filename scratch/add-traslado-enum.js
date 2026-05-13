process.chdir(__dirname + '/../backend');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool } = require('../backend/src/db.pg');

(async () => {
  try {
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'tipo_movimiento' AND e.enumlabel = 'traslado'
        ) THEN
          ALTER TYPE tipo_movimiento ADD VALUE 'traslado';
        END IF;
      END
      $$
    `);
    console.log('ENUM tipo_movimiento: traslado agregado OK');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
})();
