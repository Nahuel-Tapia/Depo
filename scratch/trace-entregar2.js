process.chdir(__dirname + '/../backend');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool, get, all } = require('../backend/src/db.pg');

function parsePositiveInt(v) { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; }

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
    cue: first.cue || null, id_usuario_solicitante: Number(first.id_usuario_solicitante),
    solicitante_nombre: first.solicitante_nombre, fecha_retiro: first.fecha_retiro,
    retira_tipo: first.retira_tipo, retira_nombre: first.retira_nombre, retira_dni: first.retira_dni,
    estado: first.estado, id_usuario_acepta: first.id_usuario_acepta ? Number(first.id_usuario_acepta) : null,
    acepta_usuario_nombre: first.acepta_usuario_nombre || null,
    id_usuario_entrega: first.id_usuario_entrega ? Number(first.id_usuario_entrega) : null,
    entrega_usuario_nombre: first.entrega_usuario_nombre || null,
    fecha_entrega: first.fecha_entrega, observaciones: first.observaciones, created_at: first.created_at,
    items: rows.map(row => ({
      producto_id: Number(row.id_producto), producto_nombre: row.producto_nombre,
      unidad_medida: row.unidad_medida || 'unidad', stock_actual: Number(row.stock_actual || 0),
      cantidad_solicitada: Number(row.cantidad_solicitada || 0),
      cantidad_entregada: Number(row.cantidad_entregada || 0),
      id_movimiento: row.id_movimiento ? Number(row.id_movimiento) : null
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
    console.log('solicitud:', solicitud?.estado, 'items:', solicitud?.items?.length);

    const pedidoRes = await client.query(`
      SELECT id_pedido, id_institucion FROM pedido
      WHERE id_pedido = $1 AND estado = 'aprobado' AND aprobado_director_area = TRUE AND COALESCE(tipo,'anual') = 'anual'
    `, [solicitud.id_pedido]);
    console.log('pedido found:', pedidoRes.rowCount);

    const cargoRetira = solicitud.retira_tipo === 'otro'
      ? `Otro: ${solicitud.retira_nombre} - DNI ${solicitud.retira_dni}` : 'Directivo';

    for (const item of solicitud.items) {
      console.log('Processing item:', item);

      const productoRes = await client.query(
        'SELECT id_producto, nombre, COALESCE(stock_actual,0) AS stock_actual FROM producto WHERE id_producto = $1 FOR UPDATE',
        [item.producto_id]
      );
      console.log('producto:', productoRes.rows[0]);

      const detalleRes = await client.query(
        'SELECT cantidad_solicitada FROM detalle_pedido WHERE id_pedido = $1 AND id_producto = $2',
        [solicitud.id_pedido, item.producto_id]
      );
      console.log('detalle_pedido found:', detalleRes.rowCount, detalleRes.rows[0]);

      const entregadoRes = await client.query(
        'SELECT COALESCE(SUM(cantidad_entregada),0) AS total FROM pedido_entrega WHERE id_pedido = $1 AND id_producto = $2',
        [solicitud.id_pedido, item.producto_id]
      );
      console.log('entregado previo:', entregadoRes.rows[0]);

      const cantidadPedido = Number(detalleRes.rows[0]?.cantidad_solicitada || 0);
      const entregadoTotal = Number(entregadoRes.rows[0]?.total || 0);
      const cantidad = Number(item.cantidad_solicitada || 0);
      const stockActual = Number(productoRes.rows[0]?.stock_actual || 0);
      console.log('cantidadPedido:', cantidadPedido, 'entregadoTotal:', entregadoTotal, 'cantidad:', cantidad, 'stockActual:', stockActual);

      if (entregadoTotal + cantidad > cantidadPedido) { console.error('Supera saldo kit'); break; }
      if (stockActual < cantidad) { console.error('Stock insuficiente'); break; }

      console.log('About to INSERT movimiento_stock...');
      const movResult = await client.query(`
        INSERT INTO movimiento_stock
          (id_producto, tipo, cantidad, estado_producto, cargo_retira, id_institucion, id_usuario, motivo, fecha_movimiento)
        VALUES ($1, 'egreso', $2, 'nuevo', $3, $4, $5, $6, NOW())
        RETURNING id_movimiento
      `, [item.producto_id, cantidad, cargoRetira, solicitud.id_institucion, userId, `Test entrega solicitud #${solicitudId}`]);
      console.log('movimiento_stock inserted:', movResult.rows[0]);
    }

    await client.query('ROLLBACK');
    console.log('Rolled back (test only)');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('STEP FAILED:', e.message);
    console.error(e.stack);
  } finally {
    client.release();
    await pool.end();
  }
})();
