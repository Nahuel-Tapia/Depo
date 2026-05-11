const { pool, get, all, run } = require('../backend/src/db.pg');

(async () => {
  try {
    const userId = 21;
    const institucionId = 1163;
    const pedidoId = 1;

    // Simulate getRetiroAvailabilityRows
    const params = [];
    let institucionSql = '';
    if (institucionId) {
      params.push(institucionId);
      institucionSql = `AND p.id_institucion = $${params.length}`;
    }

    const rows = await all(`
      SELECT
        p.id_pedido AS id_pedido,
        p.id_institucion,
        i.nombre AS institucion_nombre,
        i.cue,
        u.nombre AS solicitante_nombre,
        p.fecha_creacion,
        dp.id_producto,
        pr.nombre AS producto_nombre,
        pr.unidad_medida,
        COALESCE(pr.stock_actual, 0) AS stock_actual,
        dp.cantidad_solicitada,
        COALESCE(ent.total_entregado, 0) AS cantidad_entregada,
        COALESCE(res.total_reservado, 0) AS cantidad_reservada
      FROM pedido p
      JOIN institucion i ON i.id_institucion = p.id_institucion
      JOIN usuario u ON u.id_usuario = p.id_usuario_solicitante
      JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
      JOIN producto pr ON pr.id_producto = dp.id_producto
      LEFT JOIN (
        SELECT id_pedido, id_producto, SUM(cantidad_entregada) AS total_entregado
        FROM pedido_entrega
        GROUP BY id_pedido, id_producto
      ) ent ON ent.id_pedido = p.id_pedido AND ent.id_producto = dp.id_producto
      LEFT JOIN (
        SELECT sr.id_pedido, srd.id_producto, SUM(srd.cantidad_solicitada) AS total_reservado
        FROM solicitud_retiro sr
        JOIN solicitud_retiro_detalle srd ON srd.id_solicitud_retiro = sr.id
        WHERE sr.estado IN ('pendiente', 'aceptada')
        GROUP BY sr.id_pedido, srd.id_producto
      ) res ON res.id_pedido = p.id_pedido AND res.id_producto = dp.id_producto
      WHERE p.estado = 'aprobado'
        AND p.aprobado_director_area = TRUE
        AND COALESCE(p.tipo, 'anual') = 'anual'
        ${institucionSql}
      ORDER BY p.fecha_creacion DESC, pr.nombre ASC
    `, params);

    console.log('getRetiroAvailabilityRows result count:', rows.length);
    if (rows.length > 0) console.log('Sample row:', rows[0]);

    // Simulate the INSERT
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const insertRes = await client.query(`
        INSERT INTO solicitud_retiro
          (id_pedido, id_institucion, id_usuario_solicitante, fecha_retiro, retira_tipo, retira_nombre, retira_dni, observaciones)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [pedidoId, institucionId, userId, '2026-05-20', 'directivo', null, null, null]);
      const solicitudId = insertRes.rows[0].id;
      console.log('Insert solicitud_retiro OK, id:', solicitudId);

      // Insert a detail
      if (rows.length > 0) {
        await client.query(`
          INSERT INTO solicitud_retiro_detalle (id_solicitud_retiro, id_producto, cantidad_solicitada)
          VALUES ($1, $2, $3)
        `, [solicitudId, rows[0].id_producto, 1]);
        console.log('Insert solicitud_retiro_detalle OK');
      }

      await client.query('ROLLBACK'); // Don't actually commit test data
      console.log('Rolled back test insert');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Client error:', e.message);
    } finally {
      client.release();
    }

  } catch (e) {
    console.error('ERROR:', e.message);
    console.error(e.stack);
  } finally {
    await pool.end();
  }
})();
