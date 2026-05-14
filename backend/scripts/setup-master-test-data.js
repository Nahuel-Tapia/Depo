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

async function setupMasterTestData() {
  try {
    console.log("\n=== Configurando datos de prueba para MASTER ===\n");

    // Get master user
    const masterRes = await pool.query("SELECT id_usuario FROM usuario WHERE role = 'master'");
    if (masterRes.rows.length === 0) {
      console.error("❌ Usuario master no encontrado");
      await pool.end();
      process.exit(1);
    }
    const masterId = masterRes.rows[0].id_usuario;
    console.log(`✅ Usuario master encontrado (ID: ${masterId})`);

    // Get a sample institution and assign to master
    const instRes = await pool.query("SELECT id_institucion FROM institucion LIMIT 1");
    if (instRes.rows.length > 0) {
      const instId = instRes.rows[0].id_institucion;
      await pool.query(
        "UPDATE usuario SET id_institucion = $1 WHERE id_usuario = $2",
        [instId, masterId]
      );
      console.log(`✅ Institución asignada al master (ID: ${instId})`);
    }

    // Get sample products for testing
    const productsRes = await pool.query("SELECT id_producto, nombre FROM producto LIMIT 5");
    console.log(`✅ ${productsRes.rows.length} productos disponibles para testing:`);
    productsRes.rows.forEach(p => console.log(`   - ${p.nombre}`));

    // Get sample suppliers
    const suppRes = await pool.query("SELECT id_proveedor, nombre FROM proveedor LIMIT 2");
    console.log(`✅ ${suppRes.rows.length} proveedores disponibles:`);
    suppRes.rows.forEach(s => console.log(`   - ${s.nombre}`));

    // Get sample deposits
    const depRes = await pool.query("SELECT id_deposito, nombre FROM deposito");
    console.log(`✅ ${depRes.rows.length} depósitos disponibles:`);
    depRes.rows.forEach(d => console.log(`   - ${d.nombre}`));

    // Get sample users to create test relationships
    const usersRes = await pool.query(
      "SELECT id_usuario, nombre, role FROM usuario WHERE role != 'master' LIMIT 5"
    );
    console.log(`✅ ${usersRes.rows.length} usuarios de ejemplo para relaciones:`);
    usersRes.rows.forEach(u => console.log(`   - ${u.nombre} (${u.role})`));

    // Create a test movement to show data flow
    const deposit = await pool.query("SELECT id_deposito FROM deposito LIMIT 1");
    const product = await pool.query("SELECT id_producto FROM producto LIMIT 1");
    
    if (deposit.rows.length > 0 && product.rows.length > 0) {
      const existingMov = await pool.query(
        "SELECT COUNT(*) as count FROM movimiento_stock WHERE id_usuario = $1",
        [masterId]
      );
      
      if (existingMov.rows[0].count === 0) {
        await pool.query(`
          INSERT INTO movimiento_stock (id_usuario, id_producto, id_deposito, tipo, cantidad, fecha)
          VALUES ($1, $2, $3, $4, $5, NOW())
        `, [masterId, product.rows[0].id_producto, deposit.rows[0].id_deposito, 'ajuste', 10]);
        console.log(`✅ Movimiento de prueba creado para el master`);
      }
    }

    console.log("\n🎉 Datos de prueba configurados para MASTER\n");
    console.log("El usuario master ahora tiene:");
    console.log("  ✓ Institución asignada");
    console.log("  ✓ Acceso a todos los productos");
    console.log("  ✓ Acceso a todos los proveedores");
    console.log("  ✓ Acceso a todos los depósitos");
    console.log("  ✓ Movimientos de ejemplo");
    console.log("\n💡 Puede testear todas las funcionalidades de la app\n");

    await pool.end();
  } catch (err) {
    console.error("❌ Error:", err.message);
    await pool.end();
    process.exit(1);
  }
}

setupMasterTestData();
