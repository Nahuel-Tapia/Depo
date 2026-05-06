const { pool } = require('../backend/src/db.pg');
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS deposito (
        id_deposito SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        ubicacion TEXT,
        tipo TEXT,
        activo BOOLEAN DEFAULT TRUE,
        deposito_padre_id INTEGER REFERENCES deposito(id_deposito)
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stock_deposito (
        id_deposito INTEGER REFERENCES deposito(id_deposito),
        id_producto INTEGER REFERENCES producto(id_producto),
        cantidad NUMERIC DEFAULT 0,
        PRIMARY KEY (id_deposito, id_producto)
      )
    `);

    const res = await pool.query('SELECT COUNT(*) FROM deposito');
    if (parseInt(res.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO deposito (nombre, tipo, activo) 
        VALUES 
          ('Depósito Central', 'central', true),
          ('Depósito Centro Cívico', 'centro_civico', true),
          ('Cápsula de Seguridad', 'capsula', true)
      `);
      console.log('Default deposits created');
    }
    console.log('Database tables for deposits initialized');
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
})();
