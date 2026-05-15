const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'depo_stock',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function getDepartamento(client, institucionId) {
  const row = await client.query(
    `SELECT COALESCE(
        NULLIF(TRIM(sr.departamento_envio), ''),
        NULLIF(TRIM(i.departamento), ''),
        'SIN_DEPARTAMENTO'
      ) AS departamento
     FROM institucion i
     LEFT JOIN LATERAL (
       SELECT departamento_envio
       FROM solicitud_retiro
       WHERE id_institucion = i.id_institucion
       ORDER BY id DESC
       LIMIT 1
     ) sr ON TRUE
     WHERE i.id_institucion = $1`,
    [institucionId]
  );
  return String(row.rows[0]?.departamento || 'SIN_DEPARTAMENTO').trim();
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const candidateRes = await client.query(
      `WITH entregado AS (
         SELECT id_pedido, id_producto, SUM(cantidad_entregada) AS total_entregado
         FROM pedido_entrega
         GROUP BY id_pedido, id_producto
       ), pendientes AS (
         SELECT
           p.id_pedido,
           p.id_institucion,
           dp.id_producto,
           GREATEST(dp.cantidad_solicitada - COALESCE(e.total_entregado, 0), 0) AS pendiente
         FROM pedido p
         JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
         LEFT JOIN entregado e ON e.id_pedido = dp.id_pedido AND e.id_producto = dp.id_producto
         WHERE p.estado = 'aprobado'
       )
       SELECT id_pedido, id_institucion, id_producto, pendiente
       FROM pendientes
       WHERE pendiente > 0
       ORDER BY pendiente DESC, id_pedido DESC
       LIMIT 1`
    );

    if (!candidateRes.rowCount) {
      throw new Error('No hay pedidos aprobados con pendiente para crear una solicitud de ejemplo');
    }

    const candidate = candidateRes.rows[0];
    const pedidoId = Number(candidate.id_pedido);
    const institucionId = Number(candidate.id_institucion);
    const productoId = Number(candidate.id_producto);
    const pendiente = Number(candidate.pendiente);
    const cantidad = Math.max(1, Math.min(2, pendiente));

    const usuarioRes = await client.query(
      `SELECT id_usuario
       FROM usuario
       WHERE role = 'directivo'
         AND id_institucion = $1
         AND COALESCE(activo, TRUE) = TRUE
       ORDER BY id_usuario
       LIMIT 1`,
      [institucionId]
    );

    let usuarioId = Number(usuarioRes.rows[0]?.id_usuario || 0);
    if (!usuarioId) {
      const fallback = await client.query('SELECT id_usuario FROM usuario ORDER BY id_usuario LIMIT 1');
      usuarioId = Number(fallback.rows[0]?.id_usuario || 1);
    }

    const departamento = await getDepartamento(client, institucionId);

    const solicitudRes = await client.query(
      `INSERT INTO solicitud_retiro
         (id_pedido, id_institucion, id_usuario_solicitante, fecha_retiro, retira_tipo, observaciones, solicitar_envio, departamento_envio, estado, created_at)
       VALUES ($1, $2, $3, CURRENT_DATE + INTERVAL '2 day', 'directivo', $4, TRUE, $5, 'pendiente', NOW())
       RETURNING id, fecha_retiro`,
      [
        pedidoId,
        institucionId,
        usuarioId,
        'Solicitud de ejemplo creada para prueba de flujo por departamento',
        departamento,
      ]
    );

    const solicitudId = Number(solicitudRes.rows[0].id);

    await client.query(
      `INSERT INTO solicitud_retiro_detalle
         (id_solicitud_retiro, id_producto, cantidad_solicitada, cantidad_entregada)
       VALUES ($1, $2, $3, 0)`,
      [solicitudId, productoId, cantidad]
    );

    await client.query('COMMIT');

    console.log(
      JSON.stringify(
        {
          ok: true,
          solicitud_id: solicitudId,
          pedido_id: pedidoId,
          institucion_id: institucionId,
          producto_id: productoId,
          cantidad_solicitada: cantidad,
          pendiente_original: pendiente,
          departamento_envio: departamento,
          usuario_solicitante_id: usuarioId,
        },
        null,
        2
      )
    );
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message || err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
