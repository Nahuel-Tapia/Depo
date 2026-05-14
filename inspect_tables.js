const { Pool } = require("pg");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || 5432, 10),
  database: process.env.DB_NAME || "depo_stock",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres"
});

async function inspectTables() {
  try {
    // Check pedido structure
    const pedidoRes = await pool.query(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'pedido' ORDER BY ordinal_position
    `);
    console.log("📋 Estructura de tabla PEDIDO:");
    pedidoRes.rows.forEach(row => console.log(`  - ${row.column_name}: ${row.data_type}`));

    // Check movimiento_stock structure
    const movRes = await pool.query(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'movimiento_stock' ORDER BY ordinal_position
    `);
    console.log("\n📊 Estructura de tabla MOVIMIENTO_STOCK:");
    movRes.rows.forEach(row => console.log(`  - ${row.column_name}: ${row.data_type}`));

    // Check auditoria structure if exists
    try {
      const auditRes = await pool.query(`
        SELECT column_name, data_type FROM information_schema.columns 
        WHERE table_name = 'auditoria' ORDER BY ordinal_position
      `);
      console.log("\n📝 Estructura de tabla AUDITORIA:");
      auditRes.rows.forEach(row => console.log(`  - ${row.column_name}: ${row.data_type}`));
    } catch (e) {
      console.log("\n⚠️  Tabla AUDITORIA no existe o no es accesible");
    }

    // Get sample pedido data
    const sampleRes = await pool.query("SELECT * FROM pedido LIMIT 1");
    console.log("\n📌 Ejemplo de PEDIDO:");
    if (sampleRes.rows.length > 0) {
      console.log(JSON.stringify(sampleRes.rows[0], null, 2));
    }

    await pool.end();
  } catch (err) {
    console.error("❌ Error:", err.message);
    await pool.end();
    process.exit(1);
  }
}

inspectTables();
