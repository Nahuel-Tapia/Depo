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

async function inspectData() {
  try {
    console.log("\n=== Inspección de Datos en BD ===\n");

    // Check institutions
    const instRes = await pool.query("SELECT COUNT(*) as count FROM institucion");
    console.log(`📦 Instituciones: ${instRes.rows[0].count}`);

    // Check products
    const prodRes = await pool.query("SELECT COUNT(*) as count FROM producto");
    console.log(`📦 Productos: ${prodRes.rows[0].count}`);

    // Check users
    const userRes = await pool.query("SELECT COUNT(*) as count FROM usuario WHERE role != 'master'");
    console.log(`👥 Usuarios (sin master): ${userRes.rows[0].count}`);

    // Check suppliers
    const suppRes = await pool.query("SELECT COUNT(*) as count FROM proveedor");
    console.log(`🚚 Proveedores: ${suppRes.rows[0].count}`);

    // Check depositos
    const depRes = await pool.query("SELECT COUNT(*) as count FROM deposito");
    console.log(`🏢 Depósitos: ${depRes.rows[0].count}`);

    // Check orders
    const pedRes = await pool.query("SELECT COUNT(*) as count FROM pedido");
    console.log(`📋 Pedidos: ${pedRes.rows[0].count}`);

    // Check movements
    const movRes = await pool.query("SELECT COUNT(*) as count FROM movimiento_stock");
    console.log(`📊 Movimientos de Stock: ${movRes.rows[0].count}`);

    // Check categories
    const catRes = await pool.query("SELECT COUNT(*) as count FROM categoria");
    console.log(`📑 Categorías: ${catRes.rows[0].count}`);

    // Get sample institutions
    console.log("\n📚 Instituciones de Ejemplo:");
    const sampleInst = await pool.query("SELECT id_institucion, nombre, cue, nivel_educativo FROM institucion LIMIT 3");
    sampleInst.rows.forEach(inst => {
      console.log(`  - ${inst.nombre} (CUE: ${inst.cue}, Nivel: ${inst.nivel_educativo})`);
    });

    // Get sample products
    console.log("\n🎁 Productos de Ejemplo:");
    const sampleProd = await pool.query("SELECT id_producto, nombre, unidad_medida, stock_actual FROM producto LIMIT 3");
    sampleProd.rows.forEach(prod => {
      console.log(`  - ${prod.nombre} (${prod.unidad_medida}) - Stock: ${prod.stock_actual}`);
    });

    // Get sample suppliers
    console.log("\n🚛 Proveedores de Ejemplo:");
    const sampleSupp = await pool.query("SELECT id_proveedor, nombre FROM proveedor LIMIT 3");
    sampleSupp.rows.forEach(supp => {
      console.log(`  - ${supp.nombre}`);
    });

    // Get depositos
    console.log("\n🏭 Depósitos:");
    const depRes2 = await pool.query("SELECT id_deposito, nombre FROM deposito LIMIT 5");
    depRes2.rows.forEach(dep => {
      console.log(`  - ${dep.nombre}`);
    });

    await pool.end();
  } catch (err) {
    console.error("❌ Error:", err.message);
    await pool.end();
    process.exit(1);
  }
}

inspectData();
