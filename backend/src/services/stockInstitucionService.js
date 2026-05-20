const { all, get, run, pool } = require("../db.pg");

async function ensureStockSchema() {
  // Centralized in schemaManager.js
}

async function getStockByUserId(userId) {
  await ensureStockSchema();
  const usuario = await get("SELECT id_institucion FROM usuario WHERE id_usuario = ?", [userId]);
  if (!usuario || !usuario.id_institucion) {
    throw { status: 400, message: "Sin institución" };
  }

  const stock = await all(`
    SELECT s.cantidad, p.nombre as producto_nombre, p.id_producto, p.unidad_medida
    FROM stock_institucion s
    JOIN producto p ON p.id_producto = s.id_producto
    WHERE s.id_institucion = ?
    ORDER BY p.nombre ASC
  `, [usuario.id_institucion]);

  return stock;
}

async function registrarConsumo(userId, productoId, cantidad, motivo) {
  await ensureStockSchema();
  const usuario = await get("SELECT id_institucion FROM usuario WHERE id_usuario = ?", [userId]);
  
  if (!usuario?.id_institucion) {
    throw { status: 400, message: "Sin institución" };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Descontar del stock
    const update = await client.query(`
      UPDATE stock_institucion 
      SET cantidad = cantidad - $1
      WHERE id_institucion = $2 AND id_producto = $3 AND cantidad >= $1
      RETURNING cantidad
    `, [cantidad, usuario.id_institucion, productoId]);

    if (update.rowCount === 0) {
      await client.query("ROLLBACK");
      throw { status: 400, message: "Stock insuficiente para registrar este consumo" };
    }

    // Registrar log
    await client.query(`
      INSERT INTO consumo_institucion (id_institucion, id_producto, id_usuario, cantidad, motivo)
      VALUES ($1, $2, $3, $4, $5)
    `, [usuario.id_institucion, productoId, userId, cantidad, motivo]);

    await client.query("COMMIT");
    return { ok: true };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function getNotificaciones(userId) {
  await ensureStockSchema();
  return await all(`
    SELECT * FROM notificacion 
    WHERE id_usuario = ? 
    ORDER BY created_at DESC 
    LIMIT 20
  `, [userId]);
}

async function leerNotificacion(id, userId) {
  await run("UPDATE notificacion SET leida = TRUE WHERE id_notificacion = ? AND id_usuario = ?", [id, userId]);
  return { ok: true };
}

module.exports = {
  getStockByUserId,
  registrarConsumo,
  getNotificaciones,
  leerNotificacion
};
