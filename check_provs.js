const { all } = require('./backend/src/db.pg');
async function check() {
  try {
    const provs = await all('SELECT id_proveedor as id, nombre FROM proveedor');
    console.log(JSON.stringify(provs, null, 2));
  } catch (e) {
    console.error(e);
  }
  process.exit();
}
check();
