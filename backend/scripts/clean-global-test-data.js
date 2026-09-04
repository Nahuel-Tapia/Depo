const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });
const { Pool } = require("pg");
const dbConfig = require("../src/config/database");

const pool = new Pool(dbConfig);

async function tableExists(client, tableName) {
  const res = await client.query(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1",
    [tableName]
  );
  return res.rows.length > 0;
}

async function columnExists(client, tableName, columnName) {
  const res = await client.query(
    "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2",
    [tableName, columnName]
  );
  return res.rows.length > 0;
}

async function safeDelete(client, table, condition, params) {
  if (await tableExists(client, table)) {
    return client.query(`DELETE FROM ${table} WHERE ${condition}`, params);
  }
}

async function safeNullify(client, table, column, conditionColumn, params) {
  if (await tableExists(client, table) && await columnExists(client, table, column) && await columnExists(client, table, conditionColumn)) {
    return client.query(`UPDATE ${table} SET ${column} = NULL WHERE ${conditionColumn} = ANY($1::int[])`, params);
  }
}

async function cleanGlobalTestData() {
  const client = await pool.connect();
  console.log("===============================================================");
  console.log("🧹 INICIANDO LIMPIEZA AUTOMÁTICA DE DATOS DE PRUEBA GLOBALES");
  console.log("===============================================================");

  try {
    await client.query("BEGIN");

    // 1. Identificar registros de prueba
    console.log("1️⃣ Identificando registros de prueba...");
    const testUsersRes = await client.query(`
      SELECT id_usuario FROM usuario
      WHERE email LIKE '%@test.local'
        AND email NOT IN ('admin@depo.local')
    `);
    const testUserIds = testUsersRes.rows.map(r => r.id_usuario);
    console.log(`   - Usuarios detectados: ${testUserIds.length}`);

    const testInstRes = await client.query(`
      SELECT id_institucion, id_edificio FROM institucion
      WHERE cue LIKE '7001%' OR cue LIKE '7002%' OR cue LIKE '7003%' OR cue LIKE '7004%'
         OR nombre LIKE 'Escuela Inicial N°%'
         OR nombre LIKE 'Escuela Primari% N°%'
         OR nombre LIKE 'Escuela Secundari% N°%'
         OR nombre LIKE 'Escuela Especial N°%'
    `);
    const testInstIds = testInstRes.rows.map(r => r.id_institucion);
    const testEdifIds = testInstRes.rows.map(r => r.id_edificio).filter(Boolean);
    console.log(`   - Instituciones detectadas: ${testInstIds.length}`);

    const testKitsRes = await client.query(`
      SELECT id FROM producto_kit
      WHERE nombre LIKE 'Kit %'
        AND (
          tipo_escuela IN ('inicial', 'primario', 'secundario', 'especial')
          OR nombre LIKE 'Kit Automatizado Test%'
        )
    `);
    const testKitIds = testKitsRes.rows.map(r => r.id);
    console.log(`   - Kits de prueba detectados: ${testKitIds.length}`);

    const testZonesRes = await client.query(`
      SELECT id FROM zona
      WHERE name LIKE 'Zona Inicial%'
         OR name LIKE 'Zona Primaria%'
         OR name LIKE 'Zona Secundaria%'
         OR name LIKE 'Zona Especial%'
         OR name LIKE 'Zona Global Test%'
         OR nivel_educativo IN ('inicial', 'primario', 'secundario', 'especial')
    `);
    const testZoneIds = testZonesRes.rows.map(r => r.id);
    console.log(`   - Zonas detectadas: ${testZoneIds.length}`);

    // 2. Borrar detalle_pedido y pedidos
    console.log("\n2️⃣ Eliminando pedidos y detalles de prueba...");
    await safeDelete(
      client,
      "detalle_pedido",
      `id_pedido IN (
        SELECT id_pedido FROM pedido
        WHERE id_usuario_solicitante = ANY($1::int[])
           OR id_institucion = ANY($2::int[])
           OR observaciones_generales LIKE 'Pedido de prueba%'
           OR observaciones_generales LIKE 'Pedido para prueba%'
      )`,
      [testUserIds, testInstIds]
    );

    const delPedidos = await client.query(`
      DELETE FROM pedido
      WHERE id_usuario_solicitante = ANY($1::int[])
         OR id_institucion = ANY($2::int[])
         OR observaciones_generales LIKE 'Pedido de prueba%'
         OR observaciones_generales LIKE 'Pedido para prueba%'
    `, [testUserIds, testInstIds]);
    console.log(`   🗑️ Pedidos eliminados: ${delPedidos.rowCount}`);

    // 3. Borrar asignaciones de supervisores y zonas
    console.log("\n3️⃣ Eliminando asignaciones escolares y zonas...");
    if (testZoneIds.length > 0) {
      await safeDelete(client, "zona_institucion", `zona_id = ANY($1::int[])`, [testZoneIds]);
      await safeDelete(client, "zona_supervisor", `zona_id = ANY($1::int[])`, [testZoneIds]);
      const delZonas = await client.query(`DELETE FROM zona WHERE id = ANY($1::int[])`, [testZoneIds]);
      console.log(`   🗑️ Zonas eliminadas: ${delZonas.rowCount}`);
    }

    if (testUserIds.length > 0 || testInstIds.length > 0) {
      await safeDelete(
        client,
        "supervisor_escuela_asignacion",
        `supervisor_id = ANY($1::int[]) OR institucion_id = ANY($2::int[]) OR director_area_id = ANY($1::int[])`,
        [testUserIds, testInstIds]
      );
      console.log(`   🗑️ Asignaciones supervisor-escuela eliminadas.`);
    }

    // 4. Borrar kits de prueba y sus detalles
    console.log("\n4️⃣ Eliminando kits de prueba...");
    if (testKitIds.length > 0) {
      await safeDelete(client, "producto_kit_detalle", `kit_id = ANY($1::int[])`, [testKitIds]);
      const delKits = await client.query(`DELETE FROM producto_kit WHERE id = ANY($1::int[])`, [testKitIds]);
      console.log(`   🗑️ Kits eliminados: ${delKits.rowCount}`);
    }

    // 5. Desvincular y borrar usuarios de prueba
    console.log("\n5️⃣ Eliminando usuarios directivos, supervisores y directores de área...");
    if (testUserIds.length > 0) {
      await client.query(`UPDATE usuario SET director_area_id = NULL, id_institucion = NULL WHERE id_usuario = ANY($1::int[])`, [testUserIds]);
      
      // Nullify foreign keys en auditoria y tablas relacionadas
      await safeNullify(client, "auditoria", "usuario_id", "usuario_id", [testUserIds]);
      await safeNullify(client, "auditoria", "id_usuario", "id_usuario", [testUserIds]);
      await safeNullify(client, "entrega_anual", "id_usuario", "id_usuario", [testUserIds]);
      // Reasignar o eliminar en baja_movimientos y baja_status_history
      const adminRes = await client.query("SELECT id_usuario FROM usuario WHERE email = 'admin@depo.local' LIMIT 1");
      const adminId = adminRes.rows[0]?.id_usuario;
      if (adminId) {
        await client.query("UPDATE baja_movimientos SET id_usuario = $1 WHERE id_usuario = ANY($2::int[])", [adminId, testUserIds]);
        await safeNullify(client, "baja_status_history", "usuario_id", "usuario_id", [testUserIds]);
      } else {
        await safeDelete(client, "baja_status_history", "usuario_id = ANY($1::int[])", [testUserIds]);
        await safeDelete(client, "baja_movimientos", "id_usuario = ANY($1::int[])", [testUserIds]);
      }
      await safeNullify(client, "producto_kit", "created_by", "created_by", [testUserIds]);

      await safeDelete(client, "solicitud_informe_supervisor", `supervisor_id = ANY($1::int[]) OR director_area_id = ANY($1::int[])`, [testUserIds]);
      await safeDelete(client, "aprobacion_seguimiento", `id_usuario_firma = ANY($1::int[])`, [testUserIds]);
      await safeDelete(client, "planilla_pedido_anual_detalle", `planilla_id IN (SELECT id FROM planilla_pedido_anual WHERE director_area_id = ANY($1::int[]))`, [testUserIds]);
      await safeDelete(client, "planilla_pedido_anual", `director_area_id = ANY($1::int[]) OR aceptada_por = ANY($1::int[])`, [testUserIds]);
      await safeDelete(client, "usuario_rol", `id_usuario = ANY($1::int[])`, [testUserIds]);
      await safeDelete(client, "comentario_pedido", `id_usuario = ANY($1::int[])`, [testUserIds]);
      await safeDelete(client, "movimiento_stock", `id_usuario = ANY($1::int[])`, [testUserIds]);

      const delUsers = await client.query(`DELETE FROM usuario WHERE id_usuario = ANY($1::int[])`, [testUserIds]);
      console.log(`   🗑️ Usuarios eliminados: ${delUsers.rowCount}`);
    }

    // 6. Borrar instituciones y edificios de prueba
    console.log("\n6️⃣ Eliminando instituciones y edificios de prueba...");
    if (testInstIds.length > 0) {
      await client.query(`UPDATE usuario SET id_institucion = NULL WHERE id_institucion = ANY($1::int[])`, [testInstIds]);
      await safeDelete(client, "entrega_anual", `id_institucion = ANY($1::int[])`, [testInstIds]);
      await safeDelete(client, "patrimonio_ticket", `institucion_id = ANY($1::int[])`, [testInstIds]);
      await safeDelete(client, "movimiento_stock", `id_institucion = ANY($1::int[])`, [testInstIds]);
      
      const delInst = await client.query(`DELETE FROM institucion WHERE id_institucion = ANY($1::int[])`, [testInstIds]);
      console.log(`   🗑️ Instituciones eliminadas: ${delInst.rowCount}`);
    }

    if (testEdifIds.length > 0) {
      await client.query(`UPDATE institucion SET id_edificio = NULL WHERE id_edificio = ANY($1::int[])`, [testEdifIds]);
      const delEdif = await client.query(`DELETE FROM edificio WHERE id_edificio = ANY($1::int[])`, [testEdifIds]);
      console.log(`   🗑️ Edificios eliminados: ${delEdif.rowCount}`);
    }

    await client.query("COMMIT");
    console.log("\n===============================================================");
    console.log("✨ LIMPIEZA AUTOMÁTICA COMPLETADA CON ÉXITO");
    console.log("===============================================================");

    // Conteo actual en la BD
    const uRes = await client.query("SELECT COUNT(*) FROM usuario");
    const pRes = await client.query("SELECT COUNT(*) FROM pedido");
    const kRes = await client.query("SELECT COUNT(*) FROM producto_kit");
    const zRes = await client.query("SELECT COUNT(*) FROM zona");
    const iRes = await client.query("SELECT COUNT(*) FROM institucion");

    console.log(`📊 ESTADO ACTUAL DE LA BASE DE DATOS TRAS LIMPIEZA:`);
    console.log(`   - Usuarios activos:  ${uRes.rows[0].count}`);
    console.log(`   - Pedidos:           ${pRes.rows[0].count}`);
    console.log(`   - Kits:              ${kRes.rows[0].count}`);
    console.log(`   - Zonas:             ${zRes.rows[0].count}`);
    console.log(`   - Instituciones:     ${iRes.rows[0].count}`);
    console.log("===============================================================\n");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error al limpiar datos de prueba:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

cleanGlobalTestData().catch((err) => {
  console.error("Fallo fatal:", err);
  process.exit(1);
});
