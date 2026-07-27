const { Pool } = require('pg');
const pool = new Pool(require('../backend/src/config/database'));
async function main() {
  const r = await pool.query("SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'fn_producto_defaults_compat'");
  console.log(r.rows[0]?.pg_get_functiondef);
  await pool.end();
}
main().catch(console.error);
