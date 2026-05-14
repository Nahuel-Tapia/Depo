const { ensureRbacSchemaAndSeed } = require('./src/services/rbac');
const { pool } = require('./src/db.pg');

async function sync() {
  try {
    console.log('Sincronizando permisos...');
    await ensureRbacSchemaAndSeed();
    console.log('Permisos sincronizados correctamente.');
  } catch (err) {
    console.error('Error sincronizando permisos:', err);
  } finally {
    await pool.end();
    process.exit();
  }
}

sync();
