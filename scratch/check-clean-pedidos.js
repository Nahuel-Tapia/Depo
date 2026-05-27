require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Pool } = require('pg');
const dbConfig = require('../backend/src/config/database');

const pool = new Pool(dbConfig);

async function main() {
  const res = await pool.query("SELECT id_pedido, estado, tipo, fecha_creacion FROM pedido WHERE id_institucion = 2150");
  console.log("Current pedidos for institution 2150:", res.rows);
  
  const pending = res.rows.filter(r => r.estado === 'pendiente' || r.estado === 'pendiente_director');
  if (pending.length > 0) {
    console.log("Found pending/active pedidos that could block test. Deleting detals and pedidos...");
    const ids = pending.map(p => p.id_pedido);
    
    // First let's check and clean up associated planilla details or deliveries
    await pool.query("DELETE FROM detalle_pedido WHERE id_pedido = ANY($1)", [ids]);
    await pool.query("DELETE FROM pedido WHERE id_pedido = ANY($1)", [ids]);
    console.log("Deleted pending pedidos:", ids);
  } else {
    console.log("No pending/blocking pedidos found. Ready for clean test.");
  }
  
  pool.end();
}

main().catch(console.error);
