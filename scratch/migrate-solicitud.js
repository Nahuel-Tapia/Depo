process.chdir(__dirname + '/../backend');
require('dotenv').config();
const { pool, all, run } = require('../backend/src/db.pg');

(async () => {
  const rows = await all("SELECT column_name FROM information_schema.columns WHERE table_name = 'solicitud_retiro' ORDER BY ordinal_position");
  console.log('solicitud_retiro columns:', rows.map(r => r.column_name));

  // Apply the migrations
  await run('ALTER TABLE solicitud_retiro ADD COLUMN IF NOT EXISTS id_usuario_acepta INT REFERENCES usuario(id_usuario)');
  await run('ALTER TABLE solicitud_retiro ADD COLUMN IF NOT EXISTS fecha_aceptacion TIMESTAMP');
  await run('ALTER TABLE solicitud_retiro ADD COLUMN IF NOT EXISTS id_usuario_entrega INT REFERENCES usuario(id_usuario)');
  await run('ALTER TABLE solicitud_retiro ADD COLUMN IF NOT EXISTS fecha_entrega TIMESTAMP');
  await run('ALTER TABLE solicitud_retiro ADD COLUMN IF NOT EXISTS observaciones TEXT');
  console.log('Migrations applied');

  const rows2 = await all("SELECT column_name FROM information_schema.columns WHERE table_name = 'solicitud_retiro' ORDER BY ordinal_position");
  console.log('solicitud_retiro columns after:', rows2.map(r => r.column_name));

  await pool.end();
})().catch(e => { console.error(e.message); process.exit(1); });
