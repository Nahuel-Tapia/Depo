process.chdir(__dirname + '/../backend');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool, get, all } = require('../backend/src/db.pg');

async function getSolicitudRetiro(id, client = null) {
  const executor = client
    ? (sql, params) => client.query(sql, params).then(r => r.rows)
    : all;
  const rows = await executor(`
    SELECT sr.id, sr.id_pedido, sr.id_institucion, i.nombre AS institucion_nombre, i.cue,
      sr.id_usuario_solicitante, us.nombre AS solicitante_nombre,
      sr.id_usuario_acepta, ua.nombre AS acepta_usuario_nombre,
      sr.fecha_retiro, sr.retira_tipo, sr.retira_nombre, sr.retira_dni,
      sr.estado, sr.id_usuario_entrega, ue.nombre AS entrega_usuario_nombre,
      sr.fecha_entrega, sr.observaciones, sr.created_at,
      srd.id_producto, pr.nombre AS producto_nombre, pr.unidad_medida, pr.stock_actual,
      srd.cantidad_solicitada, srd.cantidad_entregada, srd.id_movimiento
    FROM solicitud_retiro sr
    JOIN institucion i ON i.id_institucion = sr.id_institucion
    JOIN usuario us ON us.id_usuario = sr.id_usuario_solicitante
    LEFT JOIN usuario ue ON ue.id_usuario = sr.id_usuario_entrega
    LEFT JOIN usuario ua ON ua.id_usuario = sr.id_usuario_acepta
    JOIN solicitud_retiro_detalle srd ON srd.id_solicitud_retiro = sr.id
    JOIN producto pr ON pr.id_producto = srd.id_producto
    WHERE sr.id = $1
    ORDER BY pr.nombre ASC
  `, [id]);
  if (!rows.length) return null;
  const first = rows[0];
  return {
    id: Number(first.id), id_pedido: Number(first.id_pedido),
    id_institucion: Number(first.id_institucion), institucion_nombre: first.institucion_nombre,
    retira_tipo: first.retira_tipo, retira_nombre: first.retira_nombre, retira_dni: first.retira_dni,
    estado: first.estado, observaciones: first.observaciones,
    items: rows.map(row => ({
      producto_id: Number(row.id_producto),
      cantidad_solicitada: Number(row.cantidad_solicitada || 0),
      cantidad_entregada: Number(row.cantidad_entregada || 0),
    }))
  };
}

(async () => {
  const client = await pool.connect();
  try {
    const solicitudId = 8;
    const userId = 47;

    await client.query('BEGIN');
    const solicitud = await getSolicitudRetiro(solicitudId, client);
    console.log('Step 1: getSolicitudRetiro OK, estado:', solicitud.estado);

    const pedidoRes = await client.query(`SELECT id_pedido FROM pedido WHERE id_pedido=$1 AND estado='aprobado' AND aprobado_director_area=TRUE AND COALESCE(tipo,'anual')='anual'`, [solicitud.id_pedido]);
    console.log('Step 2: pedido found:', pedidoRes.rowCount);

    const cargoRetira = 'Directivo';
    for (const item of solicitud.items) {
      console.log('Step 3: Processing', item);
      const p = (await client.query('SELECT id_producto, nombre, COALESCE(stock_actual,0) AS stock_actual FROM producto WHERE id_producto=$1 FOR UPDATE', [item.producto_id])).rows[0];
      const det = (await client.query('SELECT cantidad_solicitada FROM detalle_pedido WHERE id_pedido=$1 AND id_producto=$2', [solicitud.id_pedido, item.producto_id])).rows[0];
      const ent = (await client.query('SELECT COALESCE(SUM(cantidad_entregada),0) AS total FROM pedido_entrega WHERE id_pedido=$1 AND id_producto=$2', [solicitud.id_pedido, item.producto_id])).rows[0];
      console.log('  stock_actual:', p.stock_actual, 'cant_pedido:', det.cantidad_solicitada, 'entregado:', ent.total, 'solicita:', item.cantidad_solicitada);

      const movRes = await client.query(`
        INSERT INTO movimiento_stock (id_producto, tipo, cantidad, estado_producto, cargo_retira, id_institucion, id_usuario, motivo, fecha_movimiento)
        VALUES ($1,'egreso',$2,'nuevo',$3,$4,$5,$6,NOW()) RETURNING id_movimiento
      `, [item.producto_id, item.cantidad_solicitada, cargoRetira, solicitud.id_institucion, userId, `Test`]);
      const idMov = movRes.rows[0].id_movimiento;
      console.log('  Step 3a: movimiento OK id:', idMov);

      await client.query('UPDATE producto SET stock_actual=COALESCE(stock_actual,0)-$1 WHERE id_producto=$2', [item.cantidad_solicitada, item.producto_id]);
      console.log('  Step 3b: producto stock UPDATE OK');

      await client.query(`
        INSERT INTO pedido_entrega (id_pedido,id_movimiento,id_producto,cantidad_entregada,id_usuario,observaciones,id_solicitud_retiro)
        VALUES($1,$2,$3,$4,$5,$6,$7)
      `, [solicitud.id_pedido, idMov, item.producto_id, item.cantidad_solicitada, userId, null, solicitud.id]);
      console.log('  Step 3c: pedido_entrega INSERT OK');

      await client.query(`UPDATE solicitud_retiro_detalle SET cantidad_entregada=$1,id_movimiento=$2 WHERE id_solicitud_retiro=$3 AND id_producto=$4`, [item.cantidad_solicitada, idMov, solicitud.id, item.producto_id]);
      console.log('  Step 3d: solicitud_retiro_detalle UPDATE OK');
    }

    // Check pedido completeness
    const itemsTotales = (await client.query('SELECT id_producto, cantidad_solicitada FROM detalle_pedido WHERE id_pedido=$1', [solicitud.id_pedido])).rows;
    let pedidoCompleto = true;
    for (const it of itemsTotales) {
      const tot = (await client.query('SELECT COALESCE(SUM(cantidad_entregada),0) AS total FROM pedido_entrega WHERE id_pedido=$1 AND id_producto=$2', [solicitud.id_pedido, it.id_producto])).rows[0];
      if (Number(tot.total) < Number(it.cantidad_solicitada)) { pedidoCompleto = false; break; }
    }
    console.log('Step 4: pedidoCompleto:', pedidoCompleto);

    if (pedidoCompleto) {
      await client.query("UPDATE pedido SET estado='finalizado' WHERE id_pedido=$1", [solicitud.id_pedido]);
      console.log('  pedido finalizado');
    }

    await client.query(`UPDATE solicitud_retiro SET estado='entregado',id_usuario_entrega=$1,fecha_entrega=NOW() WHERE id=$2`, [userId, solicitud.id]);
    console.log('Step 5: solicitud_retiro UPDATE OK');

    await client.query('COMMIT');
    console.log('Step 6: COMMIT OK');

    const comprobante = await getSolicitudRetiro(solicitud.id);
    console.log('Step 7: getSolicitudRetiro after commit:', comprobante ? 'OK estado=' + comprobante.estado : 'NULL');

    // Cleanup
    console.log('--- Cleaning up ---');
    const c2 = await pool.connect();
    await c2.query('BEGIN');
    await c2.query("UPDATE solicitud_retiro SET estado='aceptada',id_usuario_entrega=NULL,fecha_entrega=NULL WHERE id=$1", [solicitudId]);
    await c2.query('UPDATE solicitud_retiro_detalle SET cantidad_entregada=NULL, id_movimiento=NULL WHERE id_solicitud_retiro=$1', [solicitudId]);
    // Restore stock
    await c2.query('UPDATE producto SET stock_actual=stock_actual+$1 WHERE id_producto=$2', [2, 2]);
    // Delete the test pedido_entrega
    await c2.query('DELETE FROM pedido_entrega WHERE id_solicitud_retiro=$1', [solicitudId]);
    // Restore pedido to approved if it was finalized
    if (pedidoCompleto) await c2.query("UPDATE pedido SET estado='aprobado' WHERE id_pedido=$1", [solicitud.id_pedido]);
    // Delete the test movimiento (need to first remove the trigger effect)
    await c2.query("SET depo.skip_stock_sync='on'");
    await c2.query('DELETE FROM movimiento_stock WHERE id_movimiento > 20 AND motivo = $1', ['Test']);
    await c2.query('COMMIT');
    c2.release();
    console.log('Cleanup done');

  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('STEP FAILED:', e.message);
    console.error(e.stack);
  } finally {
    client.release();
    await pool.end();
  }
})();
