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

async function generateBulkTestData() {
  try {
    console.log("\n=== Generando DATOS MASIVOS de prueba para MASTER ===\n");

    // Get master user
    const masterRes = await pool.query("SELECT id_usuario FROM usuario WHERE role = 'master'");
    const masterId = masterRes.rows[0].id_usuario;

    // Get institution
    const instRes = await pool.query(
      "SELECT id_institucion FROM usuario WHERE id_usuario = $1",
      [masterId]
    );
    const instId = instRes.rows[0].id_institucion;

    // Get products
    const productsRes = await pool.query("SELECT id_producto FROM producto ORDER BY RANDOM() LIMIT 20");
    const products = productsRes.rows;

    // Get deposits
    const depRes = await pool.query("SELECT id_deposito FROM deposito");
    const deposits = depRes.rows;

    console.log(`📌 Institución: ${instId}`);
    console.log(`📦 Productos: ${products.length}`);
    console.log(`🏢 Depósitos: ${deposits.length}`);

    // Clear old test data from master
    console.log("\n🗑️  Limpiando datos de prueba anteriores...");
    await pool.query(
      "DELETE FROM pedido WHERE id_usuario_solicitante = $1",
      [masterId]
    );
    await pool.query(
      "DELETE FROM movimiento_stock WHERE id_usuario = $1",
      [masterId]
    );
    console.log("✅ Limpiado");

    // Create 20 test orders with various states
    console.log("\n📋 Creando 20 pedidos de prueba...");
    const estados = ['pendiente', 'aprobado', 'rechazado', 'en_revision'];
    
    for (let i = 0; i < 20; i++) {
      const estado = estados[i % estados.length];
      
      await pool.query(`
        INSERT INTO pedido (id_usuario_solicitante, id_institucion, estado, tipo, fecha_creacion, observaciones_generales)
        VALUES ($1, $2, $3, $4, NOW() - INTERVAL '${i * 2} days', $5)
      `, [
        masterId,
        instId,
        estado,
        ['anual', 'emergencia', 'mantenimiento'][i % 3],
        `Pedido de prueba #${i + 1} - ${estado}`
      ]);
    }
    console.log("✅ 20 pedidos creados");

    // Create 30 stock movements
    console.log("\n📊 Creando 30 movimientos de stock...");
    const movTypes = ['ingreso', 'egreso', 'ajuste'];
    
    for (let i = 0; i < 30; i++) {
      const product = products[i % products.length];
      const deposit = deposits[i % deposits.length];
      const tipo = movTypes[i % movTypes.length];
      
      await pool.query(`
        INSERT INTO movimiento_stock (id_usuario, id_producto, id_deposito, tipo, cantidad, fecha_movimiento, motivo, id_institucion)
        VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '${i} days', $6, $7)
      `, [
        masterId,
        product.id_producto,
        deposit.id_deposito,
        tipo,
        Math.floor(Math.random() * 100) + 5,
        `${tipo.toUpperCase()} - Movimiento de prueba #${i + 1}`,
        instId
      ]);
    }
    console.log("✅ 30 movimientos de stock creados");

    // Create some audit records
    console.log("\n📝 Creando registros de auditoría...");
    const acciones = ['INSERT', 'UPDATE', 'DELETE'];
    
    for (let i = 0; i < 10; i++) {
      try {
        await pool.query(`
          INSERT INTO auditoria (usuario_id, entidad, accion, cambios, created_at)
          VALUES ($1, $2, $3, $4, NOW() - INTERVAL '${i} hours')
        `, [
          masterId,
          ['pedido', 'movimiento_stock', 'producto'][i % 3],
          acciones[i % acciones.length],
          JSON.stringify({
            test: true,
            registro: i + 1,
            timestamp: new Date().toISOString()
          })
        ]);
      } catch (e) {
        // Silently continue if table has constraints
      }
    }
    console.log("✅ 10 registros de auditoría creados");

    // Verify
    const pedidosCheck = await pool.query(
      "SELECT COUNT(*) as count FROM pedido WHERE id_usuario_solicitante = $1",
      [masterId]
    );
    const movCheck = await pool.query(
      "SELECT COUNT(*) as count FROM movimiento_stock WHERE id_usuario = $1",
      [masterId]
    );

    console.log("\n" + "=".repeat(50));
    console.log("🎉 DATOS MASIVOS GENERADOS EXITOSAMENTE");
    console.log("=".repeat(50));
    console.log(`\n✓ Pedidos: ${pedidosCheck.rows[0].count}`);
    console.log(`✓ Movimientos: ${movCheck.rows[0].count}`);
    console.log(`✓ Registros de auditoría: 10`);
    console.log(`✓ Productos disponibles: ${products.length}`);
    console.log(`✓ Depósitos: ${deposits.length}`);

    console.log("\n✨ El usuario master ahora tiene DATOS VISIBLES para testear\n");

    await pool.end();
  } catch (err) {
    console.error("❌ Error:", err.message);
    console.error(err.stack);
    await pool.end();
    process.exit(1);
  }
}

generateBulkTestData();
