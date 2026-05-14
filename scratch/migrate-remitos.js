process.chdir(__dirname + '/../backend');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool } = require('../backend/src/db.pg');

(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS remito_licitacion (
        id SERIAL PRIMARY KEY,
        numero VARCHAR(30) NOT NULL UNIQUE,
        licitacion_id INT NOT NULL,
        id_deposito INT,
        usuario_id INT,
        observaciones TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('remito_licitacion: OK');

    await pool.query(`ALTER TABLE recepcion_licitacion ADD COLUMN IF NOT EXISTS remito_id INT REFERENCES remito_licitacion(id)`);
    console.log('recepcion_licitacion.remito_id: OK');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
})();
