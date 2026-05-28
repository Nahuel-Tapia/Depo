const db = require('./src/db.pg.js');
async function run() {
  try {
    await db.pool.query(`
      CREATE TABLE IF NOT EXISTS baja_status_history (
        id SERIAL PRIMARY KEY,
        baja_id INTEGER REFERENCES baja_movimientos(id) ON DELETE CASCADE,
        estado_anterior VARCHAR(50),
        estado_nuevo VARCHAR(50) NOT NULL,
        usuario_id INTEGER,
        comentarios TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table created');
  } catch(e) {
    console.error(e);
  } finally {
    db.closeDb();
  }
}
run();
