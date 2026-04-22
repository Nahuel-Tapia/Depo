// ============================================================
// RUTA: /api/supervisor
// Endpoints para el dashboard del Supervisor.
// Filtra instituciones y pedidos por jurisdicción del usuario.
// ============================================================
const express = require("express");
const { all, get, run } = require("../db.pg");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

async function hasAsignacionesTable() {
  const row = await get(
    `SELECT to_regclass('public.supervisor_escuela_asignacion') AS regclass`
  );
  return Boolean(row?.regclass);
}

let schemaReady = false;
let schemaPromise = null;

async function ensureSupervisorSchema() {
  if (schemaReady) return;
  if (schemaPromise) {
    await schemaPromise;
    return;
  }

  schemaPromise = (async () => {
    await run(`
      ALTER TABLE institucion
      ADD COLUMN IF NOT EXISTS kit_id INT REFERENCES producto_kit(id)
    `);
    schemaReady = true;
  })();

  try {
    await schemaPromise;
  } finally {
    schemaPromise = null;
  }
}

// ── Instituciones de la jurisdicción del supervisor ──
router.get("/instituciones", async (req, res) => {
  try {
    await ensureSupervisorSchema();

    if (req.user?.role === "supervisor") {
      if (!(await hasAsignacionesTable())) {
        return res.json({ instituciones: [] });
      }

      const institucionesAsignadas = await all(
        `SELECT i.id_institucion AS id,
                i.nombre,
                i.cue,
                i.departamento,
                i.nivel_educativo AS nivel,
                COALESCE(i.tipo_escuela, 'normal') AS tipo_escuela,
                i.kit_id,
                k.nombre AS kit_nombre,
                i.ambito AS tipo,
                i.categoria
         FROM supervisor_escuela_asignacion sea
         JOIN institucion i ON i.id_institucion = sea.institucion_id
         LEFT JOIN producto_kit k ON k.id = i.kit_id
         WHERE sea.supervisor_id = ?
         ORDER BY i.nombre`,
        [req.user.sub]
      );

      return res.json({ instituciones: institucionesAsignadas });
    }

    const jurisdiccion = req.query.jurisdiccion || req.user.jurisdiccion;

    if (!jurisdiccion) {
      return res.status(400).json({ error: "Jurisdicción no especificada" });
    }

    // TODO: Ajustar el nombre de columna si en tu tabla 'institucion'
    // el campo de jurisdicción se llama diferente (ej: departamento, zona, etc.)
    const instituciones = await all(
      `SELECT id_institucion AS id, nombre, cue, tipo, jurisdiccion
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

router.patch("/instituciones/:id/tipo-kit", async (req, res) => {
  try {
    await ensureSupervisorSchema();

    if (req.user?.role !== "supervisor") {
      return res.status(403).json({ error: "Solo el supervisor puede asignar kit." });
    }

    if (!(await hasAsignacionesTable())) {
      return res.status(400).json({ error: "No hay escuelas asignadas para este supervisor." });
    }

    const institucionId = Number(req.params.id);
    const kitId = Number(req.body?.kit_id);

    if (!Number.isInteger(institucionId) || institucionId <= 0) {
      return res.status(400).json({ error: "Institución inválida." });
    }
    if (!Number.isInteger(kitId) || kitId <= 0) {
      return res.status(400).json({ error: "Kit inválido." });
    }

    const asignacion = await get(
      `SELECT 1
       FROM supervisor_escuela_asignacion
       WHERE supervisor_id = ? AND institucion_id = ?`,
      [req.user.sub, institucionId]
    );

    if (!asignacion) {
      return res.status(404).json({ error: "La escuela no está asignada a este supervisor." });
    }

    const kit = await get(
      `SELECT id, nombre
       FROM producto_kit
       WHERE id = ? AND activo = TRUE`,
      [kitId]
    );

    if (!kit) {
      return res.status(404).json({ error: "El kit seleccionado no existe o está inactivo." });
    }

    await get(
      `UPDATE institucion
       SET kit_id = $1,
           updated_at = NOW()
       WHERE id_institucion = $2
       RETURNING id_institucion`,
      [kitId, institucionId]
    );

    return res.json({ ok: true, kit_id: kitId, kit_nombre: kit.nombre });
  } catch (err) {
    console.error("Error al actualizar kit de la institución:", err);
    return res.status(500).json({ error: "No se pudo actualizar el kit." });
  }
});

// ── Pedidos pendientes de la jurisdicción ──
router.get("/pedidos-pendientes", async (req, res) => {
  try {
    if (req.user?.role === "supervisor") {
      if (!(await hasAsignacionesTable())) {
        return res.json({ pedidos: [] });
      }

      const pedidos = await all(
        `SELECT p.id_pedido AS id,
                COALESCE(p.kit_cantidad, SUM(dp.cantidad_solicitada)) AS cantidad,
                p.observaciones_generales AS notas,
                CASE WHEN p.estado::text = 'finalizado' THEN 'entregado' ELSE p.estado::text END AS estado,
                p.fecha_creacion AS fecha,
                COALESCE(
                  p.kit_nombre,
                  STRING_AGG(pr.nombre || ' x' || dp.cantidad_solicitada::text, ', ' ORDER BY pr.nombre)
                ) AS producto,
                i.nombre AS institucion,
                i.id_institucion AS institucion_id,
                0 AS matricula,
                u.nombre AS solicitante,
                COALESCE(
                  JSON_AGG(
                    JSON_BUILD_OBJECT('producto', pr.nombre, 'cantidad', dp.cantidad_solicitada)
                    ORDER BY pr.nombre
                  ) FILTER (WHERE pr.id_producto IS NOT NULL),
                  '[]'::json
                ) AS items
         FROM pedido p
         JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
         JOIN producto pr ON pr.id_producto = dp.id_producto
         JOIN usuario u ON u.id_usuario = p.id_usuario_solicitante
         JOIN institucion i ON i.id_institucion = p.id_institucion
         JOIN supervisor_escuela_asignacion sea ON sea.institucion_id = p.id_institucion
         WHERE sea.supervisor_id = ?
           AND p.estado = 'pendiente'
         GROUP BY p.id_pedido, p.kit_nombre, p.kit_cantidad, p.observaciones_generales, p.estado, p.fecha_creacion,
                  i.nombre, i.id_institucion, u.nombre
         ORDER BY p.fecha_creacion DESC`,
        [req.user.sub]
      );

      return res.json({ pedidos });
    }

    const jurisdiccion = req.query.jurisdiccion || req.user.jurisdiccion;

    if (!jurisdiccion) {
      return res.status(400).json({ error: "Jurisdicción no especificada" });
    }

    const pedidos = await all(
      `SELECT p.id_pedido AS id,
              COALESCE(p.kit_cantidad, SUM(dp.cantidad_solicitada)) AS cantidad,
              p.observaciones_generales AS notas,
              CASE WHEN p.estado::text = 'finalizado' THEN 'entregado' ELSE p.estado::text END AS estado,
              p.fecha_creacion AS fecha,
              COALESCE(
                p.kit_nombre,
                STRING_AGG(pr.nombre || ' x' || dp.cantidad_solicitada::text, ', ' ORDER BY pr.nombre)
              ) AS producto,
              i.nombre AS institucion,
              i.id_institucion AS institucion_id,
              COALESCE(i.matriculados, 0) AS matricula,
              u.nombre AS solicitante,
              COALESCE(
                JSON_AGG(
                  JSON_BUILD_OBJECT('producto', pr.nombre, 'cantidad', dp.cantidad_solicitada)
                  ORDER BY pr.nombre
                ) FILTER (WHERE pr.id_producto IS NOT NULL),
                '[]'::json
              ) AS items
       FROM pedido p
       JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
       JOIN producto pr ON pr.id_producto = dp.id_producto
       JOIN usuario u ON u.id_usuario = p.id_usuario_solicitante
       JOIN institucion i ON i.id_institucion = p.id_institucion
       WHERE p.estado = 'pendiente'
         AND LOWER(i.jurisdiccion) = LOWER(?)
       GROUP BY p.id_pedido, p.kit_nombre, p.kit_cantidad, p.observaciones_generales, p.estado, p.fecha_creacion,
                i.nombre, i.id_institucion, i.matriculados, u.nombre
       ORDER BY p.fecha_creacion DESC`,
      [jurisdiccion]
    );

    res.json({ pedidos });
  } catch (err) {
    console.error("Error al obtener pedidos pendientes del supervisor:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ── Solicitudes por jurisdicción (pendiente, aprobado, rechazado, cancelado) ──
router.get("/solicitudes", async (req, res) => {
  try {
    if (req.user?.role === "supervisor") {
      if (!(await hasAsignacionesTable())) {
        return res.json({ solicitudes: [] });
      }

      const solicitudes = await all(
        `SELECT p.id_pedido AS id,
                COALESCE(p.kit_cantidad, SUM(dp.cantidad_solicitada)) AS cantidad,
                p.observaciones_generales AS notas,
                CASE WHEN p.estado::text = 'finalizado' THEN 'entregado' ELSE p.estado::text END AS estado,
                p.fecha_creacion AS fecha,
                COALESCE(
                  p.kit_nombre,
                  STRING_AGG(pr.nombre || ' x' || dp.cantidad_solicitada::text, ', ' ORDER BY pr.nombre)
                ) AS producto,
                i.nombre AS institucion,
                i.id_institucion AS institucion_id,
                0 AS matricula,
                u.nombre AS solicitante,
                COALESCE(
                  JSON_AGG(
                    JSON_BUILD_OBJECT('producto', pr.nombre, 'cantidad', dp.cantidad_solicitada)
                    ORDER BY pr.nombre
                  ) FILTER (WHERE pr.id_producto IS NOT NULL),
                  '[]'::json
                ) AS items
         FROM pedido p
         JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
         JOIN producto pr ON pr.id_producto = dp.id_producto
         JOIN usuario u ON u.id_usuario = p.id_usuario_solicitante
         JOIN institucion i ON i.id_institucion = p.id_institucion
         JOIN supervisor_escuela_asignacion sea ON sea.institucion_id = p.id_institucion
         WHERE sea.supervisor_id = ?
           AND p.estado::text IN ('pendiente', 'aprobado', 'rechazado', 'entregado', 'finalizado')
         GROUP BY p.id_pedido, p.kit_nombre, p.kit_cantidad, p.observaciones_generales, p.estado, p.fecha_creacion,
                  i.nombre, i.id_institucion, u.nombre
         ORDER BY p.fecha_creacion DESC`,
        [req.user.sub]
      );

      return res.json({ solicitudes });
    }

    const jurisdiccion = req.query.jurisdiccion || req.user.jurisdiccion;

    if (!jurisdiccion) {
      return res.status(400).json({ error: "Jurisdicción no especificada" });
    }

    const solicitudes = await all(
      `SELECT p.id_pedido AS id,
              COALESCE(p.kit_cantidad, SUM(dp.cantidad_solicitada)) AS cantidad,
              p.observaciones_generales AS notas,
              CASE WHEN p.estado::text = 'finalizado' THEN 'entregado' ELSE p.estado::text END AS estado,
              p.fecha_creacion AS fecha,
              COALESCE(
                p.kit_nombre,
                STRING_AGG(pr.nombre || ' x' || dp.cantidad_solicitada::text, ', ' ORDER BY pr.nombre)
              ) AS producto,
              i.nombre AS institucion,
              i.id_institucion AS institucion_id,
              COALESCE(i.matriculados, 0) AS matricula,
              u.nombre AS solicitante,
              COALESCE(
                JSON_AGG(
                  JSON_BUILD_OBJECT('producto', pr.nombre, 'cantidad', dp.cantidad_solicitada)
                  ORDER BY pr.nombre
                ) FILTER (WHERE pr.id_producto IS NOT NULL),
                '[]'::json
              ) AS items
       FROM pedido p
       JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
       JOIN producto pr ON pr.id_producto = dp.id_producto
       JOIN usuario u ON u.id_usuario = p.id_usuario_solicitante
       JOIN institucion i ON i.id_institucion = p.id_institucion
       WHERE p.estado::text IN ('pendiente', 'aprobado', 'rechazado', 'cancelado', 'entregado', 'finalizado')
         AND LOWER(i.jurisdiccion) = LOWER(?)
       GROUP BY p.id_pedido, p.kit_nombre, p.kit_cantidad, p.observaciones_generales, p.estado, p.fecha_creacion,
                i.nombre, i.id_institucion, i.matriculados, u.nombre
       ORDER BY p.fecha_creacion DESC`,
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
      `SELECT ms.fecha_movimiento AS fecha, pr.nombre AS producto, ms.cantidad, ms.tipo
       FROM movimiento_stock ms
       JOIN producto pr ON pr.id_producto = ms.id_producto
       WHERE ms.id_institucion = ?
       ORDER BY ms.fecha_movimiento DESC
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
