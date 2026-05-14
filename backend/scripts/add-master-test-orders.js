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

async function createComprehensiveTestData() {
  try {
    console.log("\n=== Creando datos completos de prueba para MASTER ===\n");

    // Get master user
    const masterRes = await pool.query("SELECT id_usuario FROM usuario WHERE role = 'master'");
    const masterId = masterRes.rows[0].id_usuario;

    // Get test institution
    const instRes = await pool.query(
      "SELECT id_institucion FROM usuario WHERE id_usuario = $1",
      [masterId]
    );
    const instId = instRes.rows[0].id_institucion;
    console.log(`📌 Institución de prueba: ${instId}`);

    // Get test products
    const productsRes = await pool.query(
      "SELECT id_producto FROM producto LIMIT 10"
    );
    const products = productsRes.rows;
    console.log(`📦 Productos disponibles: ${products.length}`);

    // Get test supplier
    const suppRes = await pool.query("SELECT id_proveedor FROM proveedor LIMIT 1");
    const suppId = suppRes.rows[0].id_proveedor;
    console.log(`🚚 Proveedor de prueba: ${suppId}`);

    // Get test deposits
    const depRes = await pool.query("SELECT id_deposito FROM deposito");
    const deposits = depRes.rows;
    console.log(`🏢 Depósitos disponibles: ${deposits.length}`);

    let createdCount = 0;

    // Create sample orders (using correct column names)
    console.log("\n📋 Creando pedidos de prueba...");
    for (let i = 0; i < 3; i++) {
      const product = products[i % products.length];
      
      try {
        const orderRes = await pool.query(`
          INSERT INTO pedido (id_usuario_solicitante, id_institucion, estado, tipo, fecha_creacion)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT DO NOTHING
          RETURNING id_pedido
        `, [masterId, instId, 'aprobado', 'anual']);
        
        if (orderRes.rows.length > 0) {
          createdCount++;
        }
      } catch (e) {
        // Silently skip conflicts
      }
    }
    console.log(`  ✅ ${createdCount} pedidos creados`);

    // Create sample stock movements
    console.log("\n📊 Creando movimientos de stock...");
    let movCount = 0;
    for (let i = 0; i < 5; i++) {
      const product = products[i % products.length];
      const deposit = deposits[i % deposits.length];
      
      try {
        await pool.query(`
          INSERT INTO movimiento_stock (id_usuario, id_producto, id_deposito, tipo, cantidad, fecha_movimiento, motivo)
          VALUES ($1, $2, $3, $4, $5, NOW(), $6)
          ON CONFLICT DO NOTHING
        `, [
          masterId,
          product.id_producto,
          deposit.id_deposito,
          ['ingreso', 'egreso', 'ajuste'][i % 3],
          5 + (i * 2),
          `Movimiento de prueba #${i + 1}`
        ]);
        movCount++;
      } catch (e) {
        // Silently skip
      }
    }
    console.log(`  ✅ ${movCount} movimientos de stock creados`);

    // Create audit log entries
    console.log("\n📝 Creando registros de auditoría...");
    let auditCount = 0;
    for (let i = 0; i < 3; i++) {
      try {
        await pool.query(`
          INSERT INTO auditoria (usuario_id, entidad, accion, cambios, created_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT DO NOTHING
        `, [
          masterId,
          ['pedido', 'movimiento_stock', 'producto'][i % 3],
          ['INSERT', 'UPDATE', 'DELETE'][i % 3],
          JSON.stringify({ test: true, prueba: `#${i + 1}` })
        ]);
        auditCount++;
      } catch (e) {
        // Table might not exist or have constraints, continue
      }
    }
    console.log(`  ✅ ${auditCount} registros de auditoría creados`);

    // Get summary
    const pedidosCheck = await pool.query(
      "SELECT COUNT(*) as count FROM pedido WHERE id_usuario_solicitante = $1",
      [masterId]
    );
    const movCheck = await pool.query(
      "SELECT COUNT(*) as count FROM movimiento_stock WHERE id_usuario = $1",
      [masterId]
    );

    console.log("\n🎉 Resumen de datos de prueba para MASTER:");
    console.log(`  ✓ Pedidos: ${pedidosCheck.rows[0].count}`);
    console.log(`  ✓ Movimientos: ${movCheck.rows[0].count}`);
    console.log(`  ✓ Institución asignada`);
    console.log(`  ✓ Acceso a ${products.length} productos`);
    console.log(`  ✓ Acceso a ${deposits.length} depósitos`);
    console.log(`  ✓ Acceso a proveedores`);

    console.log("\n✨ Datos de prueba cargados exitosamente");
    console.log("El usuario master (master@gmail.com / 111111) puede testear todas las funcionalidades.\n");

    await pool.end();
  } catch (err) {
    console.error("❌ Error:", err.message);
    await pool.end();
    process.exit(1);
  }
}

createComprehensiveTestData();
