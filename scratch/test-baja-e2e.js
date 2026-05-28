const { pool } = require('../backend/src/db.pg');
const movimientoService = require('../backend/src/services/movimientoService');

async function testBajaFlow() {
  console.log('============================================================');
  console.log('🧪 INICIANDO TEST E2E: AUDIT TRAIL Y FLUJO DE BAJAS (SCRAP)');
  console.log('============================================================\n');

  let createdBajaId = null;
  let prodId = null;

  try {
    // 1. Obtener un producto
    const prodRes = await pool.query("SELECT id_producto, nombre FROM producto LIMIT 1");
    if (prodRes.rowCount === 0) {
      throw new Error("No hay productos.");
    }
    prodId = prodRes.rows[0].id_producto;
    const prodNombre = prodRes.rows[0].nombre;
    console.log(`📦 Producto de prueba: "${prodNombre}" (ID: ${prodId})`);

    // Asegurar stock de 50 en Depósito Central (ID: 1)
    await pool.query(`
      INSERT INTO stock_deposito (id_deposito, id_producto, cantidad)
      VALUES (1, $1, 50)
      ON CONFLICT (id_deposito, id_producto) DO UPDATE SET cantidad = 50
    `, [prodId]);
    console.log('✅ Stock de 50 configurado en Depósito Central (ID: 1)');

    // Asegurar depósito de desguace
    const scrapDepRes = await pool.query("SELECT id_deposito FROM deposito WHERE tipo_deposito = 'desguace' LIMIT 1");
    if (scrapDepRes.rowCount === 0) {
      throw new Error("No hay depósito de desguace.");
    }
    const scrapDepId = scrapDepRes.rows[0].id_deposito;
    console.log(`🗑️ Depósito de Scrap (Desguace) encontrado (ID: ${scrapDepId})`);

    // 2. Registrar solicitud de baja con foto obligatoria
    console.log('\n🚀 Registrando solicitud de baja por rotura...');
    const fakeUser = { sub: 14, role: 'operador' }; // operador
    const mockFile = { filename: 'test_evidence.jpg' };
    const reqBody = {
      producto_id: prodId,
      cantidad: 5,
      motivo: 'Vidrio roto durante descarga de prueba',
      id_deposito: 1
    };

    const registrarRes = await movimientoService.registrarBaja(fakeUser, reqBody, mockFile);
    createdBajaId = registrarRes.baja_id;
    console.log(`✅ Solicitud de baja creada con ID: ${createdBajaId} (Estado inicial: ${registrarRes.estado})`);

    // Verificar que se haya insertado en baja_status_history
    const histRes1 = await movimientoService.obtenerHistorialBaja(createdBajaId);
    console.log(`🔍 Historial inicial de baja: ${histRes1.length} registros`);
    histRes1.forEach(h => {
      console.log(`- [${h.estado_anterior} -> ${h.estado_nuevo}] Comentarios: "${h.comentarios}"`);
    });
    if (histRes1.length !== 1 || histRes1[0].estado_nuevo !== 'pendiente') {
      throw new Error("El historial inicial no es correcto");
    }

    // 3. Autorizar/Aprobar la baja
    console.log('\n🚀 Autorizando (aprobando) la solicitud de baja...');
    const fakeAdmin = { sub: 78, role: 'area_compras' }; // compras
    const autorizarRes = await movimientoService.autorizarBaja(createdBajaId, fakeAdmin, 'aprobar');
    console.log('✅ Autorización procesada con éxito:', autorizarRes);

    // Verificar stocks después de aprobar
    const stockCentralDespues = await pool.query("SELECT cantidad FROM stock_deposito WHERE id_deposito = 1 AND id_producto = $1", [prodId]);
    const stockScrapDespues = await pool.query("SELECT cantidad FROM stock_deposito WHERE id_deposito = $1 AND id_producto = $2", [scrapDepId, prodId]);

    console.log(`📊 Stock Central después: ${stockCentralDespues.rows[0]?.cantidad} (esperado: 45)`);
    console.log(`📊 Stock Scrap después: ${stockScrapDespues.rows[0]?.cantidad}`);

    if (Number(stockCentralDespues.rows[0].cantidad) !== 45) {
      throw new Error("El stock de origen no se decrementó correctamente");
    }

    // Verificar historial final
    const histRes2 = await movimientoService.obtenerHistorialBaja(createdBajaId);
    console.log(`🔍 Historial de baja posterior: ${histRes2.length} registros`);
    histRes2.forEach(h => {
      console.log(`- [${h.estado_anterior} -> ${h.estado_nuevo}] Comentarios: "${h.comentarios}"`);
    });
    if (histRes2.length !== 2 || histRes2[1].estado_nuevo !== 'aprobada') {
      throw new Error("El historial final no registra la transición a aprobada");
    }

    console.log('\n🎉 ¡TEST E2E DE AUDIT TRAIL Y BAJAS COMPLETADO CON ÉXITO!');

  } catch (err) {
    console.error('\n❌ ERROR EN EL TEST:', err.message);
    process.exitCode = 1;
  } finally {
    console.log('\n🧹 Limpiando base de datos...');
    try {
      if (createdBajaId) {
        await pool.query("DELETE FROM baja_status_history WHERE baja_id = $1", [createdBajaId]);
        await pool.query("DELETE FROM baja_movimientos WHERE id = $1", [createdBajaId]);
      }
      console.log('🗑️ Datos de prueba eliminados correctamente.');
    } catch (cleanErr) {
      console.error('⚠️ Error al limpiar base de datos:', cleanErr.message);
    }
    await pool.end();
  }
}

testBajaFlow();
