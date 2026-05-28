const { pool } = require('../backend/src/db.pg');
const entregaService = require('../backend/src/services/entregaService');

async function testSedeFlow() {
  console.log('============================================================');
  console.log('🧪 INICIANDO TEST E2E: METODOLOGÍA DE ESCUELA SEDE');
  console.log('============================================================\n');

  let pedidoId = null;
  let solicitudId = null;
  let createdDepSedeId = null;
  let createdLoteId = null;

  try {
    // 1. Obtener datos de escuelas
    const sarmientoRes = await pool.query("SELECT id_institucion, nombre, departamento FROM institucion WHERE cue = '700000101'");
    if (sarmientoRes.rowCount === 0) {
      throw new Error("No se encontró la escuela Sarmiento.");
    }
    const sarmiento = sarmientoRes.rows[0];
    console.log(`🏫 Escuela Periférica: ${sarmiento.nombre} (ID: ${sarmiento.id_institucion}, Depto: ${sarmiento.departamento})`);

    const burbujasRes = await pool.query("SELECT id_institucion, nombre, departamento FROM institucion WHERE cue = '700000102'");
    if (burbujasRes.rowCount === 0) {
      throw new Error("No se encontró el jardín Burbujas.");
    }
    const burbujas = burbujasRes.rows[0];
    console.log(`🏫 Escuela Sede (Cabecera): ${burbujas.nombre} (ID: ${burbujas.id_institucion}, Depto: ${burbujas.departamento})`);

    // 2. Obtener producto y asegurar que hay stock en Depósito Central (ID: 1)
    const prodRes = await pool.query("SELECT id_producto, nombre FROM producto LIMIT 1");
    if (prodRes.rowCount === 0) {
      throw new Error("No hay productos.");
    }
    const producto = prodRes.rows[0];
    console.log(`📦 Producto a distribuir: "${producto.nombre}" (ID: ${producto.id_producto})`);

    // Asegurar stock de 100 unidades en Depósito Central (ID 1)
    await pool.query(`
      INSERT INTO stock_deposito (id_deposito, id_producto, cantidad)
      VALUES (1, $1, 100)
      ON CONFLICT (id_deposito, id_producto) DO UPDATE SET cantidad = 100
    `, [producto.id_producto]);
    console.log('✅ Stock de 100 unidades configurado en el Depósito Central (ID: 1)');

    // Limpiar cualquier depósito Sede previo para Burbujas
    const prevDeps = await pool.query("SELECT id_deposito FROM deposito WHERE id_institucion = $1 AND tipo_deposito = 'ESCUELA_SEDE'", [burbujas.id_institucion]);
    for (const row of prevDeps.rows) {
      await pool.query("DELETE FROM movimiento_stock WHERE id_deposito = $1", [row.id_deposito]);
      await pool.query("DELETE FROM stock_deposito WHERE id_deposito = $1", [row.id_deposito]);
      await pool.query("DELETE FROM distribucion_lote_item WHERE lote_id IN (SELECT id FROM distribucion_lote WHERE id_deposito = $1)", [row.id_deposito]);
      await pool.query("DELETE FROM distribucion_lote WHERE id_deposito = $1", [row.id_deposito]);
      await pool.query("DELETE FROM deposito WHERE id_deposito = $1", [row.id_deposito]);
    }
    console.log('✅ Limpiado cualquier depósito virtual de Sede anterior para Burbujas');

    // 3. Crear pedido anual aprobado para la escuela Sarmiento
    const pedRes = await pool.query(`
      INSERT INTO pedido (id_institucion, id_usuario_solicitante, estado, tipo, aprobado_director_area, fecha_creacion)
      VALUES ($1, 14, 'aprobado', 'anual', true, NOW())
      RETURNING id_pedido
    `, [sarmiento.id_institucion]);
    pedidoId = pedRes.rows[0].id_pedido;
    console.log(`📝 Pedido anual creado y aprobado para Sarmiento: #${pedidoId}`);

    // Crear detalle de pedido
    await pool.query(`
      INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad_solicitada)
      VALUES ($1, $2, 10)
    `, [pedidoId, producto.id_producto]);

    // 4. Crear solicitud_retiro para Sarmiento marcada para envío a su departamento
    const solRes = await pool.query(`
      INSERT INTO solicitud_retiro (id_pedido, id_institucion, id_usuario_solicitante, fecha_retiro, retira_tipo, estado, solicitar_envio, departamento_envio, created_at)
      VALUES ($1, $2, 14, CURRENT_DATE + 5, 'directivo', 'pendiente', true, $3, NOW())
      RETURNING id
    `, [pedidoId, sarmiento.id_institucion, sarmiento.departamento.toUpperCase()]);
    solicitudId = solRes.rows[0].id;
    console.log(`📋 Solicitud de retiro creada en estado 'pendiente': #${solicitudId}`);

    // Crear detalle de solicitud
    await pool.query(`
      INSERT INTO solicitud_retiro_detalle (id_solicitud_retiro, id_producto, cantidad_solicitada, cantidad_entregada)
      VALUES ($1, $2, 5, 0)
    `, [solicitudId, producto.id_producto]);

    // Consultar stock antes
    const stockCentralAntes = await pool.query("SELECT cantidad FROM stock_deposito WHERE id_deposito = 1 AND id_producto = $1", [producto.id_producto]);
    console.log(`📊 Stock en Depósito Central antes del egreso: ${stockCentralAntes.rows[0].cantidad}`);

    // 5. Ejecutar la distribución agrupada por Sede (registrarEgresoMultipleEnvio)
    console.log('\n🚀 Ejecutando egreso múltiple con metodología Escuela Sede...');
    const bodyPayload = {
      departamento: sarmiento.departamento.toUpperCase(),
      anio: 2026,
      id_deposito: 1,
      observaciones: 'Distribución E2E de prueba a Sede',
      tipo_envio: 'escuela_sede',
      id_institucion_sede: burbujas.id_institucion,
      entregas: [
        {
          id_solicitud: solicitudId,
          items: [
            { id_producto: producto.id_producto, cantidad: 5 }
          ]
        }
      ]
    };

    // Usamos el ID de operador 76 (operador@depo.local)
    const egresoRes = await entregaService.registrarEgresoMultipleEnvio(76, bodyPayload);
    createdLoteId = egresoRes.lote_id;
    console.log('✅ Egreso registrado correctamente. Lote ID:', egresoRes.lote_id);

    // 6. Verificar cambios en la base de datos
    // a. La solicitud de retiro debe estar en estado 'en_sede'
    const solDespuesRes = await pool.query("SELECT estado FROM solicitud_retiro WHERE id = $1", [solicitudId]);
    console.log(`🔍 Estado de la Solicitud #${solicitudId}: "${solDespuesRes.rows[0].estado}" (esperado: 'en_sede')`);
    if (solDespuesRes.rows[0].estado !== 'en_sede') {
      throw new Error("El estado de la solicitud no es 'en_sede'!");
    }

    // b. Se debe haber creado el depósito virtual para la sede y asignado al lote
    const loteRes = await pool.query("SELECT id_deposito FROM distribucion_lote WHERE id = $1", [egresoRes.lote_id]);
    const loteDepId = loteRes.rows[0].id_deposito;
    createdDepSedeId = loteDepId;
    console.log(`🔍 ID Depósito en Lote de Distribución: ${loteDepId}`);

    const depSedeRes = await pool.query("SELECT * FROM deposito WHERE id_deposito = $1", [loteDepId]);
    if (depSedeRes.rowCount === 0) {
      throw new Error("No se encontró el depósito asociado al lote!");
    }
    const depSede = depSedeRes.rows[0];
    console.log(`🔍 Depósito Sede Encontrado: "${depSede.nombre}" | Tipo Depósito: "${depSede.tipo_deposito}" | Inst Sede ID: ${depSede.id_institucion}`);
    if (depSede.tipo_deposito !== 'ESCUELA_SEDE' || depSede.id_institucion !== burbujas.id_institucion) {
      throw new Error("El depósito del lote no corresponde al sub-depósito virtual de la Sede!");
    }

    // c. El stock del depósito central debe haber bajado a 95
    const stockCentralDespues = await pool.query("SELECT cantidad FROM stock_deposito WHERE id_deposito = 1 AND id_producto = $1", [producto.id_producto]);
    console.log(`📊 Stock en Depósito Central después: ${stockCentralDespues.rows[0].cantidad} (esperado: 95)`);
    if (Number(stockCentralDespues.rows[0].cantidad) !== 95) {
      throw new Error("El stock central no se restó correctamente!");
    }

    // d. El stock del depósito sede debe ser 5
    const stockSedeDespues = await pool.query("SELECT cantidad FROM stock_deposito WHERE id_deposito = $1 AND id_producto = $2", [loteDepId, producto.id_producto]);
    console.log(`📊 Stock en Depósito Sede después: ${stockSedeDespues.rows[0]?.cantidad} (esperado: 5)`);
    if (Number(stockSedeDespues.rows[0]?.cantidad) !== 5) {
      throw new Error("El stock de la Sede no aumentó correctamente!");
    }

    // 7. Simular la entrega final desde la Sede (entregarDesdeSede)
    console.log('\n🚀 Ejecutando entrega final desde la Sede a la escuela periférica...');
    const entregaSedeRes = await entregaService.entregarDesdeSede(76, solicitudId);
    console.log('✅ Entrega desde Sede registrada:', entregaSedeRes);

    // 8. Verificar estado final y stocks
    // a. La solicitud de retiro debe estar en estado 'entregado'
    const solFinalRes = await pool.query("SELECT estado, fecha_entrega, id_usuario_entrega FROM solicitud_retiro WHERE id = $1", [solicitudId]);
    console.log(`🔍 Estado de la Solicitud #${solicitudId} al final: "${solFinalRes.rows[0].estado}" (esperado: 'entregado')`);
    if (solFinalRes.rows[0].estado !== 'entregado') {
      throw new Error("El estado final de la solicitud no es 'entregado'!");
    }

    // b. El stock del depósito sede debe haber bajado a 0
    const stockSedeFinal = await pool.query("SELECT cantidad FROM stock_deposito WHERE id_deposito = $1 AND id_producto = $2", [loteDepId, producto.id_producto]);
    console.log(`📊 Stock en Depósito Sede al final: ${stockSedeFinal.rows[0]?.cantidad} (esperado: 0)`);
    if (Number(stockSedeFinal.rows[0]?.cantidad) !== 0) {
      throw new Error("El stock de la Sede no se restó al entregar!");
    }

    // c. Debe existir el movimiento de stock de egreso para la institución periférica
    const movRes = await pool.query(`
      SELECT * FROM movimiento_stock 
      WHERE id_deposito = $1 AND id_producto = $2 AND id_institucion = $3 AND tipo = 'egreso'
    `, [loteDepId, producto.id_producto, sarmiento.id_institucion]);
    console.log(`🔍 Movimientos de egreso registrados desde Sede: ${movRes.rowCount} (esperado: >= 1)`);
    if (movRes.rowCount === 0) {
      throw new Error("No se registró el movimiento de egreso de stock desde el sub-depósito de la Sede!");
    }
    console.log(`🔍 Motivo del egreso: "${movRes.rows[0].motivo}"`);

    console.log('\n🎉 ¡TEST E2E DE METODOLOGÍA ESCUELA SEDE COMPLETADO CON ÉXITO!');

  } catch (err) {
    console.error('\n❌ ERROR EN EL TEST:', err.message);
    process.exitCode = 1;
  } finally {
    console.log('\n🧹 Limpiando base de datos...');
    try {
      if (solicitudId) {
        await pool.query("DELETE FROM solicitud_retiro_detalle WHERE id_solicitud_retiro = $1", [solicitudId]);
        await pool.query("DELETE FROM solicitud_retiro WHERE id = $1", [solicitudId]);
      }
      if (pedidoId) {
        await pool.query("DELETE FROM detalle_pedido WHERE id_pedido = $1", [pedidoId]);
        await pool.query("DELETE FROM pedido WHERE id_pedido = $1", [pedidoId]);
      }
      if (createdLoteId) {
        await pool.query("DELETE FROM distribucion_lote_item WHERE lote_id = $1", [createdLoteId]);
        await pool.query("DELETE FROM distribucion_lote WHERE id = $1", [createdLoteId]);
      }
      if (createdDepSedeId) {
        await pool.query("DELETE FROM movimiento_stock WHERE id_deposito = $1", [createdDepSedeId]);
        await pool.query("DELETE FROM stock_deposito WHERE id_deposito = $1", [createdDepSedeId]);
        await pool.query("DELETE FROM deposito WHERE id_deposito = $1", [createdDepSedeId]);
      }
      console.log('🗑️ Datos de prueba eliminados correctamente.');
    } catch (cleanErr) {
      console.error('⚠️ Error al limpiar base de datos:', cleanErr.message);
    }
    await pool.end();
  }
}

testSedeFlow();
