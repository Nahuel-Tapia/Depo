const { all } = require('./backend/src/db.pg');
async function check() {
  try {
    const deps = await all('SELECT id_deposito, nombre FROM deposito');
    console.log(JSON.stringify(deps, null, 2));
  } catch (e) {
    console.error(e);
  }
  process.exit();
}
check();
