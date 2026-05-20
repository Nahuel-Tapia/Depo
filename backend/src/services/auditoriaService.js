const { all, get } = require("../db.pg");

async function listAuditoria({ usuario_id, entidad, accion, limit = 50, offset = 0 }) {
  let query = `
    SELECT 
      a.id, a.usuario_id, u.nombre as usuario_nombre, u.email,
      a.entidad, a.accion, a.id_registro, a.cambios,
      a.created_at
    FROM auditoria a
    LEFT JOIN usuario u ON a.usuario_id = u.id_usuario
    WHERE 1 = 1
  `;
  const params = [];

  if (usuario_id) {
    query += " AND a.usuario_id = ?";
    params.push(usuario_id);
  }

  if (entidad) {
    query += " AND a.entidad = ?";
    params.push(entidad);
  }

  if (accion) {
    query += " AND a.accion = ?";
    params.push(accion);
  }

  query += " ORDER BY a.created_at DESC LIMIT ? OFFSET ?";
  params.push(Number(limit), Number(offset));

  return await all(query, params);
}

async function getAuditoriaById(id) {
  const registro = await get(
    `SELECT 
      a.id, a.usuario_id, u.nombre as usuario_nombre, u.email,
      a.entidad, a.accion, a.id_registro, a.cambios,
      a.created_at
    FROM auditoria a
    LEFT JOIN usuario u ON a.usuario_id = u.id_usuario
    WHERE a.id = ?`,
    [id]
  );
  if (!registro) {
    throw { status: 404, message: "Registro de auditoría no encontrado" };
  }
  return registro;
}

async function listAuditoriaByUsuario(usuario_id, { limit = 50, offset = 0 }) {
  return await all(
    `SELECT 
      a.id, a.usuario_id, u.nombre as usuario_nombre, u.email,
      a.entidad, a.accion, a.id_registro, a.cambios,
      a.created_at
    FROM auditoria a
    LEFT JOIN usuario u ON a.usuario_id = u.id_usuario
    WHERE a.usuario_id = ?
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?`,
    [usuario_id, Number(limit), Number(offset)]
  );
}

async function getAuditoriaStatsResumen({ fecha_desde, fecha_hasta }) {
  let query = `
    SELECT 
      a.entidad,
      a.accion,
      COUNT(*) as total
    FROM auditoria a
    WHERE 1 = 1
  `;
  const params = [];

  if (fecha_desde) {
    query += " AND a.created_at >= ?";
    params.push(fecha_desde);
  }

  if (fecha_hasta) {
    query += " AND a.created_at <= ?";
    params.push(fecha_hasta);
  }

  query += " GROUP BY a.entidad, a.accion ORDER BY total DESC";

  return await all(query, params);
}

module.exports = {
  listAuditoria,
  getAuditoriaById,
  listAuditoriaByUsuario,
  getAuditoriaStatsResumen
};
