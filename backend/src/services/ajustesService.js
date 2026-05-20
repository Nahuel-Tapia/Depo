const { all, get, run, pool } = require("../db.pg");

async function listAjustes({ producto_id, limit = 50, offset = 0 }) {
  let query = `
    SELECT 
      a.id, a.producto_id, p.codigo, p.nombre,
      a.cantidad_anterior, a.cantidad_nueva,
      a.motivo,
      u.nombre as usuario_nombre, u.email,
      a.created_at
    FROM ajustes a
    LEFT JOIN producto p ON a.producto_id = p.id_producto
    LEFT JOIN usuario u ON a.usuario_id = u.id_usuario
    WHERE 1 = 1
  `;
  const params = [];

  if (producto_id) {
    query += " AND a.producto_id = ?";
    params.push(producto_id);
  }

  query += " ORDER BY a.created_at DESC LIMIT ? OFFSET ?";
  params.push(Number(limit), Number(offset));

  return await all(query, params);
}

async function getAjusteById(id) {
  const ajuste = await get(
    `SELECT 
      a.id, a.producto_id, p.codigo, p.nombre,
      a.cantidad_anterior, a.cantidad_nueva,
      a.motivo,
      u.nombre as usuario_nombre, u.email,
      a.created_at
    FROM ajustes a
    LEFT JOIN producto p ON a.producto_id = p.id_producto
    LEFT JOIN usuario u ON a.usuario_id = u.id_usuario
    WHERE a.id = ?`,
    [id]
  );
  if (!ajuste) {
    throw { status: 404, message: "Ajuste no encontrado" };
  }
  return ajuste;
}

async function createAjuste(userId, { producto_id, cantidad_nueva, motivo }) {
  const cantidadNuevaNum = Number.parseInt(cantidad_nueva, 10);

  if (!producto_id || cantidad_nueva === undefined || !motivo) {
    throw { status: 400, message: "Faltan campos obligatorios" };
  }

  if (!Number.isInteger(cantidadNuevaNum) || cantidadNuevaNum < 0) {
    throw { status: 400, message: "La cantidad nueva debe ser un numero entero mayor o igual a 0" };
  }

  // Obtener producto
  const producto = await get("SELECT * FROM producto WHERE id_producto = ?", [producto_id]);
  if (!producto) {
    throw { status: 404, message: "Producto no encontrado" };
  }

  const cantidad_anterior = producto.stock_actual;

  // Registrar ajuste
  const result = await run(
    "INSERT INTO ajustes (producto_id, cantidad_anterior, cantidad_nueva, motivo, usuario_id) VALUES (?, ?, ?, ?, ?)",
    [producto_id, cantidad_anterior, cantidadNuevaNum, motivo, userId]
  );

  // Actualizar stock del producto
  await run("UPDATE producto SET stock_actual = ?, updated_at = CURRENT_TIMESTAMP WHERE id_producto = ?", [cantidadNuevaNum, producto_id]);

  // Sincronizar stock_deposito (depósito central id=1)
  const diferencia = cantidadNuevaNum - cantidad_anterior;
  if (diferencia !== 0) {
    await pool.query(
      `INSERT INTO stock_deposito (id_deposito, id_producto, cantidad)
       VALUES (1, $1, GREATEST(0, $2))
       ON CONFLICT (id_deposito, id_producto)
       DO UPDATE SET cantidad = GREATEST(0, stock_deposito.cantidad + $2)`,
      [producto_id, diferencia]
    );
  }

  // Auditoría
  await run(
    "INSERT INTO auditoria (usuario_id, entidad, accion, id_registro, cambios) VALUES (?, ?, ?, ?, ?)",
    [
      userId,
      "ajustes",
      "CREATE",
      result.lastID,
      JSON.stringify({
        producto_id,
        cantidad_anterior,
        cantidad_nueva: cantidadNuevaNum,
        diferencia,
        motivo
      })
    ]
  );

  return { id: result.lastID };
}

module.exports = {
  listAjustes,
  getAjusteById,
  createAjuste
};
