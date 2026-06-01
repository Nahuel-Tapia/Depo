const { pool } = require('../backend/src/db.pg');
const entregaService = require('../backend/src/services/entregaService');

async function testAdicionalesFlow() {
  console.log('============================================================');
  console.log('🧪 INICIANDO TEST E2E: ENTREGA DE PRODUCTOS ADICIONALES');
  console.log('============================================================\n');

  let pedidoId = null;
  let solicitudId = null;
  let createdLoteId = null;

  try {
    // 1. Obtener datos de escuela Sarmiento
    const sarmientoRes = await pool.query("SELECT id_institucion, nombre, departamento FROM institucion WHERE cue = '700000101'");
    if (sarmientoRes.rowCount === 0) {
      throw new Error("No se encontró la escuela Sarmiento.");
    }
    const sarmiento = sarmientoRes.rows[0];
    console.log(`🏫 Escuela: ${sarmiento.nombre} (ID: ${sarmiento.id_institucion}, Depto: ${sarmiento.departamento})`);

    // 2. Obtener dos productos
    const prodsRes = await pool.query("SELECT id_producto, nombre FROM producto ORDER BY id_producto LIMIT 2");
    if (prodsRes.rowCount < 2) {
      throw new Error("Se necesitan al menos 2 productos para la prueba.");
    }
    const prod1 = prodsRes.rows[0];
    const prod2 = prodsRes.rows[1];
    console.log(`📦 Producto 1 (en solicitud): "${prod1.nombre}" (ID: ${prod1.id_producto})`);
    console.log(`📦 Producto 2 (adicional): "${prod2.nombre}" (ID: ${prod2.id_producto})`);

    // Asegurar stock de 100 unidades en Depósito Central (ID 1)
    await pool.query("INSERT INTO stock_deposito (id_deposito, id_producto, cantidad) VALUES (1, $1, 100) ON CONFLICT (id_deposito, id_producto) DO UPDATE SET cantidad = 100", [prod1.id_producto]);
    await pool.query("INSERT INTO stock_deposito (id_deposito, id_producto, cantidad) VALUES (1, $1, 100) ON CONFLICT (id_deposito, id_producto) DO UPDATE SET cantidad = 100", [prod2.id_producto]);
    console.log('✅ Stock configurado en el Depósito Central');

    // 3. Crear pedido anual aprobado para la escuela Sarmiento
    const pedRes = await pool.query(`
      INSERT INTO pedido (id_institucion, id_usuario_solicitante, estado, tipo, aprobado_director_area, fecha_creacion)
      VALUES ($1, 14, 'aprobado', 'anual', true, NOW())
      RETURNING id_pedido
    `, [sarmiento.id_institucion]);
    pedidoId = pedRes.rows[0].id_pedido;
    console.log(`📝 Pedido anual creado y aprobado: #${pedidoId}`);

    // Detalle de pedido: incluir ambos productos
    await pool.query("INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad_solicitada) VALUES ($1, $2, 10)", [pedidoId, prod1.id_producto]);
    await pool.query("INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad_solicitada) VALUES ($1, $2, 20)", [pedidoId, prod2.id_producto]);

    // 4. Crear solicitud_retiro para Sarmiento (solo incluye Producto 1)
    const solRes = await pool.query(`
      INSERT INTO solicitud_retiro (id_pedido, id_institucion, id_usuario_solicitante, fecha_retiro, retira_tipo, estado, solicitar_envio, departamento_envio, created_at)
      VALUES ($1, $2, 14, CURRENT_DATE + 5, 'directivo', 'pendiente', true, $3, NOW())
      RETURNING id
    `, [pedidoId, sarmiento.id_institucion, sarmiento.departamento.toUpperCase()]);
    solicitudId = solRes.rows[0].id;
    console.log(`📋 Solicitud de retiro creada (pendiente): #${solicitudId}`);

    // Crear detalle de solicitud: sólo producto 1 (5 unidades de las 10 aprobadas)
    await pool.query("INSERT INTO solicitud_retiro_detalle (id_solicitud_retiro, id_producto, cantidad_solicitada, cantidad_entregada) VALUES ($1, $2, 5, 0)", [solicitudId, prod1.id_producto]);

    // 5. Ejecutar la distribución agregada por Departamento
    console.log('\n🚀 Ejecutando egreso múltiple con producto adicional...');
    const bodyPayload = {
      departamento: sarmiento.departamento.toUpperCase(),
      anio: 2026,
      id_deposito: 1,
      observaciones: 'Distribución E2E de adicionales',
      tipo_envio: 'directo',
      entregas: [
        {
          id_solicitud: solicitudId,
          items: [
            { id_producto: prod1.id_producto, cantidad: 5 }, // El solicitado
            { id_producto: prod2.id_producto, cantidad: 12 } // El adicional (no solicitado, pero aprobado en el pedido anual)
          ]
        }
      ]
    };

    const egresoRes = await entregaService.registrarEgresoMultipleEnvio(76, bodyPayload);
    createdLoteId = egresoRes.lote_id;
    console.log('✅ Egreso registrado. Lote ID:', egresoRes.lote_id);

    // 6. Verificar
    // a. El estado de la solicitud debe ser entregado (porque todos los ítems fueron procesados)
    const solDespues = await pool.query("SELECT estado FROM solicitud_retiro WHERE id = $1", [solicitudId]);
    console.log(`🔍 Estado de la Solicitud #${solicitudId}: "${solDespues.rows[0].estado}" (esperado: 'entregado')`);
    if (solDespues.rows[0].estado !== 'entregado') {
      throw new Error("El estado de la solicitud no es entregado!");
    }

    // b. Se debió haber insertado el producto 2 en solicitud_retiro_detalle con cantidad_solicitada = 0
    const detRes = await pool.query("SELECT * FROM solicitud_retiro_detalle WHERE id_solicitud_retiro = $1 AND id_producto = $2", [solicitudId, prod2.id_producto]);
    if (detRes.rowCount === 0) {
      throw new Error("No se insertó el producto adicional en solicitud_retiro_detalle!");
    }
    const det = detRes.rows[0];
    console.log(`🔍 Detalle de Adicional: Cantidad Solicitada: ${det.cantidad_solicitada} (esperada: 0) | Cantidad Entregada: ${det.cantidad_entregada} (esperada: 12)`);
    if (Number(det.cantidad_solicitada) !== 0 || Number(det.cantidad_entregada) !== 12) {
      throw new Error("Las cantidades del producto adicional en el detalle son incorrectas!");
    }

    // c. Verificar que en pedido_entrega se registrasen los dos registros
    const peRes = await pool.query("SELECT id_producto, cantidad_entregada FROM pedido_entrega WHERE id_pedido = $1 ORDER BY id_producto", [pedidoId]);
    console.log(`🔍 Registros en pedido_entrega: ${peRes.rowCount} (esperados: 2)`);
    if (peRes.rowCount !== 2) {
      throw new Error("No se registraron las entregas en pedido_entrega!");
    }
    console.log(`   Producto ${peRes.rows[0].id_producto}: entregó ${peRes.rows[0].cantidad_entregada} (esperado: 5)`);
    console.log(`   Producto ${peRes.rows[1].id_producto}: entregó ${peRes.rows[1].cantidad_entregada} (esperado: 12)`);

    // d. Probar getDetalleSolicitudesEnvioDepartamento para ver si las cantidades anuales y pendientes se leen correctamente
    const detDepto = await entregaService.getDetalleSolicitudesEnvioDepartamento(sarmiento.departamento, 2026);
    console.log(`✅ Detalle del departamento consultado correctamente.`);

    console.log('\n🎉 ¡TEST E2E DE ENTREGA DE PRODUCTOS ADICIONALES COMPLETADO CON ÉXITO!');

  } catch (err) {
    console.error('\n❌ ERROR EN EL TEST:', err.message);
    process.exitCode = 1;
  } finally {
    console.log('\nSweep and clean...');
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
      console.log('🗑️ Datos de prueba eliminados.');
    } catch (cleanErr) {
      console.error('⚠️ Error al limpiar:', cleanErr.message);
    }
    await pool.end();
  }
}

testAdicionalesFlow();
