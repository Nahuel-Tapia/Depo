process.chdir(__dirname + '/../backend');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool } = require('../backend/src/db.pg');

(async () => {
  try {
    await pool.query(`ALTER TABLE recepcion_licitacion ADD COLUMN IF NOT EXISTS cantidad_danada NUMERIC(12,2) NOT NULL DEFAULT 0`);
    console.log('recepcion_licitacion.cantidad_danada: OK');

    await pool.query(`ALTER TABLE recepcion_licitacion ADD COLUMN IF NOT EXISTS obs_danio TEXT`);
    console.log('recepcion_licitacion.obs_danio: OK');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS recepcion_danio_imagen (
        id SERIAL PRIMARY KEY,
        remito_id INT NOT NULL REFERENCES remito_licitacion(id),
        producto_id INT,
        nombre VARCHAR(255),
        mime_type VARCHAR(80),
        datos TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('recepcion_danio_imagen: OK');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
})();
