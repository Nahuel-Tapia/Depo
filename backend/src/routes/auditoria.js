const express = require("express");
const { all, get } = require("../db.pg");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");

const router = express.Router();

router.use(authenticate);

// Listar auditoría
router.get("/", authorizePermissions(PERMISSIONS.AUDITORIA_VIEW), async (req, res) => {
  try {
    const { usuario_id, entidad, accion, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT 
        a.id, a.usuario_id, u.nombre as usuario_nombre, u.email,
        a.entidad, a.accion, a.id_registro, a.cambios,
        a.created_at
      FROM auditoria a
      JOIN users u ON a.usuario_id = u.id
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
    params.push(limit, offset);

    const registros = await all(query, params);
    return res.json({ registros });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo listar auditoría" });
  }
});

// Obtener un registro de auditoría
router.get("/:id", authorizePermissions(PERMISSIONS.AUDITORIA_VIEW), async (req, res) => {
  try {
    const { id } = req.params;
    const registro = await get(
      `SELECT 
        a.id, a.usuario_id, u.nombre as usuario_nombre, u.email,
        a.entidad, a.accion, a.id_registro, a.cambios,
        a.created_at
      FROM auditoria a
      JOIN users u ON a.usuario_id = u.id
      WHERE a.id = ?`,
      [id]
    );
    if (!registro) {
      return res.status(404).json({ error: "Registro de auditoría no encontrado" });
    }
    return res.json({ registro });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo obtener el registro" });
  }
});

// Auditoría por usuario
router.get("/usuario/:usuario_id", authorizePermissions(PERMISSIONS.AUDITORIA_VIEW), async (req, res) => {
  try {
    const { usuario_id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const registros = await all(
      `SELECT 
        a.id, a.usuario_id, u.nombre as usuario_nombre, u.email,
        a.entidad, a.accion, a.id_registro, a.cambios,
        a.created_at
      FROM auditoria a
      JOIN users u ON a.usuario_id = u.id
      WHERE a.usuario_id = ?
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?`,
      [usuario_id, limit, offset]
    );

    return res.json({ registros });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo listar auditoría por usuario" });
  }
});

// Resumen de auditoría
router.get("/stats/resumen", authorizePermissions(PERMISSIONS.AUDITORIA_VIEW), async (req, res) => {
  try {
    const { fecha_desde, fecha_hasta } = req.query;

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

    const resumen = await all(query, params);
    return res.json({ resumen });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo obtener el resumen" });
  }
});

module.exports = router;
