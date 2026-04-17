// ============================================================
// RUTA: /api/supervisor
// Endpoints para el dashboard del Supervisor.
// Filtra instituciones y pedidos por jurisdicción del usuario.
// ============================================================
const express = require("express");
const { all, get } = require("../db.pg");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

// ── Instituciones de la jurisdicción del supervisor ──
router.get("/instituciones", async (req, res) => {
  try {
    const jurisdiccion = req.query.jurisdiccion || req.user.jurisdiccion;

    if (!jurisdiccion) {
      return res.status(400).json({ error: "Jurisdicción no especificada" });
    }

    // TODO: Ajustar el nombre de columna si en tu tabla 'institucion'
    // el campo de jurisdicción se llama diferente (ej: departamento, zona, etc.)
    const instituciones = await all(
      `SELECT id, nombre, cue, tipo, jurisdiccion
       FROM institucion
       WHERE LOWER(jurisdiccion) = LOWER(?)
       ORDER BY nombre`,
      [jurisdiccion]
    );

    res.json({ instituciones });
  } catch (err) {
    console.error("Error al obtener instituciones del supervisor:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ── Pedidos pendientes de la jurisdicción ──
router.get("/pedidos-pendientes", async (req, res) => {
  try {
    const jurisdiccion = req.query.jurisdiccion || req.user.jurisdiccion;

    if (!jurisdiccion) {
      return res.status(400).json({ error: "Jurisdicción no especificada" });
    }

    const pedidos = await all(
      `SELECT p.id, p.cantidad, p.notas, p.estado, p.created_at AS fecha,
              pr.nombre AS producto,
              i.nombre AS institucion, i.id AS institucion_id,
              COALESCE(i.matriculados, 0) AS matricula,
              u.nombre AS solicitante
       FROM pedido p
       JOIN producto pr ON pr.id = p.producto_id
       JOIN usuario u ON u.id = p.usuario_id
       JOIN institucion i ON i.id = u.institucion_id
       WHERE p.estado = 'pendiente'
         AND LOWER(i.jurisdiccion) = LOWER(?)
       ORDER BY p.created_at DESC`,
      [jurisdiccion]
    );

    res.json({ pedidos });
  } catch (err) {
    console.error("Error al obtener pedidos pendientes del supervisor:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ── Solicitudes por jurisdicción (pendiente, aprobado, rechazado) ──
router.get("/solicitudes", async (req, res) => {
  try {
    const jurisdiccion = req.query.jurisdiccion || req.user.jurisdiccion;

    if (!jurisdiccion) {
      return res.status(400).json({ error: "Jurisdicción no especificada" });
    }

    const solicitudes = await all(
      `SELECT p.id, p.cantidad, p.notas, p.estado, p.created_at AS fecha,
              pr.nombre AS producto,
              i.nombre AS institucion, i.id AS institucion_id,
              COALESCE(i.matriculados, 0) AS matricula,
              u.nombre AS solicitante
       FROM pedido p
       JOIN producto pr ON pr.id = p.producto_id
       JOIN usuario u ON u.id = p.usuario_id
       JOIN institucion i ON i.id = u.institucion_id
       WHERE p.estado IN ('pendiente', 'aprobado', 'rechazado')
         AND LOWER(i.jurisdiccion) = LOWER(?)
       ORDER BY p.created_at DESC`,
      [jurisdiccion]
    );

    res.json({ solicitudes });
  } catch (err) {
    console.error("Error al obtener solicitudes del supervisor:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ── Historial de retiros de una institución (resumen) ──
router.get("/instituciones/:id/historial", async (req, res) => {
  try {
    const { id } = req.params;

    const eventos = await all(
      `SELECT ms.fecha, pr.nombre AS producto, ms.cantidad, ms.tipo
       FROM movimiento_stock ms
       JOIN producto pr ON pr.id = ms.producto_id
       WHERE ms.institucion_id = ?
       ORDER BY ms.fecha DESC
       LIMIT 50`,
      [id]
    );

    res.json({ eventos });
  } catch (err) {
    console.error("Error al obtener historial de institución:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;
