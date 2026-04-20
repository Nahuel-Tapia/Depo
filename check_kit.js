const { Pool } = require("pg");
const config = require("./backend/src/config/database");
const pool = new Pool(config);
async function run() {
  try {
    const userRes = await pool.query("SELECT u.id, u.email, i.tipo_institucion_id as tipo_id FROM usuario u JOIN institucion i ON u.institucion_id = i.id WHERE u.email = 'dir1@gmail.com'");
    const user = userRes.rows[0];
    console.log("USER:", JSON.stringify(user));
    
    // Get products in kit
    const kitRes = await pool.query("SELECT producto_id FROM kit_producto_anual WHERE tipo_institucion_id = $1", [user.tipo_id]);
    const kitIds = kitRes.rows.map(r => r.producto_id);
    console.log("KIT_IDS:", JSON.stringify(kitIds));
    
    // Get one product NOT in kit
    const notInKitRes = await pool.query("SELECT id FROM producto WHERE id != ALL($1::int[]) LIMIT 1", [kitIds]);
    console.log("NOT_IN_KIT:", JSON.stringify(notInKitRes.rows[0]));
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();