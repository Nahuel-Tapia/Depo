// Test getSolicitudRetiro after a real insert (with rollback)
process.chdir(__dirname + '/../backend');
require('dotenv').config();

const { pool, all } = require('../backend/src/db.pg');

async function getSolicitudRetiro(id, client = null) {
  const executor = client
    ? (sql, params) => client.query(sql, params).then((result) => result.rows)
    : all;

  const rows = await executor(`
    SELECT
      sr.id,
      sr.id_pedido,
      sr.id_institucion,
      i.nombre AS institucion_nombre,
      i.cue,
      sr.id_usuario_solicitante,
      us.nombre AS solicitante_nombre,
      sr.id_usuario_acepta,
      ua.nombre AS acepta_usuario_nombre,
      sr.fecha_retiro,
      sr.retira_tipo,
      sr.retira_nombre,
      sr.retira_dni,
      sr.estado,
      sr.id_usuario_entrega,
      ue.nombre AS entrega_usuario_nombre,
      sr.fecha_entrega,
      sr.observaciones,
      sr.created_at,
      srd.id_producto,
      pr.nombre AS producto_nombre,
      pr.unidad_medida,
      pr.stock_actual,
      srd.cantidad_solicitada,
      srd.cantidad_entregada,
      srd.id_movimiento
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
  return { id: Number(rows[0].id), items: rows.length };
}

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const r1 = await client.query(`
      INSERT INTO solicitud_retiro
        (id_pedido, id_institucion, id_usuario_solicitante, fecha_retiro, retira_tipo, retira_nombre, retira_dni, observaciones)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [3, 1163, 21, '2026-05-20', 'directivo', null, null, null]);
    const sid = r1.rows[0].id;
    console.log('Inserted sid=', sid);

    await client.query(`
      INSERT INTO solicitud_retiro_detalle (id_solicitud_retiro, id_producto, cantidad_solicitada)
      VALUES ($1, $2, $3)
    `, [sid, 3, 1]);
    console.log('Inserted detail');

    await client.query('COMMIT');
    console.log('Committed');

    // Now test getSolicitudRetiro
    try {
      const sol = await getSolicitudRetiro(sid);
      console.log('getSolicitudRetiro result:', sol);
    } catch (e) {
      console.error('getSolicitudRetiro FAILED:', e.message);
      console.error(e.stack);
    }

    // Cleanup
    await client.query('BEGIN');
    await client.query('DELETE FROM solicitud_retiro_detalle WHERE id_solicitud_retiro = $1', [sid]);
    await client.query('DELETE FROM solicitud_retiro WHERE id = $1', [sid]);
    await client.query('COMMIT');
    console.log('Cleaned up');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('ERROR:', e.message);
    console.error(e.stack);
  } finally {
    client.release();
    await pool.end();
  }
})();
