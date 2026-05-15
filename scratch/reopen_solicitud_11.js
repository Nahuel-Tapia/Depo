const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'depo_stock',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const before = await client.query(
      `SELECT id, estado, COALESCE(solicitar_envio, FALSE) AS solicitar_envio, COALESCE(departamento_envio, '') AS departamento_envio
       FROM solicitud_retiro
       WHERE id = 11`
    );

    if (before.rowCount === 0) {
      throw new Error('No existe la solicitud #11');
    }

    await client.query(
      `UPDATE solicitud_retiro
       SET estado = 'aceptada',
           solicitar_envio = TRUE,
           departamento_envio = 'CAPITAL',
           fecha_aceptacion = NOW(),
           id_usuario_acepta = COALESCE(id_usuario_acepta, 1)
       WHERE id = 11`
    );

    await client.query(
      `UPDATE solicitud_retiro_detalle
       SET cantidad_entregada = 0
       WHERE id_solicitud_retiro = 11`
    );

    await client.query('COMMIT');

    const after = await client.query(
      `SELECT sr.id, sr.estado, COALESCE(sr.solicitar_envio, FALSE) AS solicitar_envio, COALESCE(sr.departamento_envio, '') AS departamento_envio,
              srd.id_producto, srd.cantidad_solicitada, COALESCE(srd.cantidad_entregada, 0) AS cantidad_entregada
       FROM solicitud_retiro sr
       LEFT JOIN solicitud_retiro_detalle srd ON srd.id_solicitud_retiro = sr.id
       WHERE sr.id = 11
       ORDER BY srd.id_producto`
    );

    console.log(JSON.stringify({ updated: true, rows: after.rows }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error.message || error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
