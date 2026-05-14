const { all } = require('./backend/src/db.pg');
async function check() {
  try {
    const cols = await all("SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'movimiento_stock'");
    console.log(JSON.stringify(cols, null, 2));
  } catch (e) {
    console.error(e);
  }
  process.exit();
}
check();
