// ============================================================
// RUTA: /api/compras
// Gestión de planillas de pedido anual entre Dirección de Área
// y Área de Compras.
// ============================================================
const express = require("express");
const { all, get, run, pool } = require("../db.pg");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");

const router = express.Router();
router.use(authenticate);

let tablesReady = false;

async function ensureTables() {
  if (tablesReady) return;

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS planilla_pedido_anual (
        id SERIAL PRIMARY KEY,
        director_area_id INT NOT NULL REFERENCES usuario(id_usuario),
        anio INT NOT NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'borrador',
        observaciones TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        enviada_at TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS planilla_pedido_anual_detalle (
        id SERIAL PRIMARY KEY,
        planilla_id INT NOT NULL REFERENCES planilla_pedido_anual(id) ON DELETE CASCADE,
        id_pedido INT NOT NULL REFERENCES pedido(id_pedido),
        id_institucion INT NOT NULL REFERENCES institucion(id_institucion),
        id_producto INT NOT NULL REFERENCES producto(id_producto),
        cantidad INT NOT NULL,
        notas TEXT
      )
    `);

    tablesReady = true;
  } finally {
    client.release();
  }
}

// ── Listar planillas (director_area ve las suyas; area_compras ve las enviadas) ──
router.get("/planillas", authorizePermissions(PERMISSIONS.PLANILLA_VIEW), async (req, res) => {
  try {
    await ensureTables();

    let rows;
    if (req.user.role === "area_compras") {
      rows = await all(
        `SELECT p.id, p.anio, p.estado, p.observaciones, p.created_at, p.enviada_at,
                u.nombre AS director_nombre, u.apellido AS director_apellido
         FROM planilla_pedido_anual p
         JOIN usuario u ON u.id_usuario = p.director_area_id
         WHERE p.estado IN ('enviada', 'procesada')
         ORDER BY p.created_at DESC`
      );
    } else {
      rows = await all(
        `SELECT p.id, p.anio, p.estado, p.observaciones, p.created_at, p.enviada_at,
                u.nombre AS director_nombre, u.apellido AS director_apellido
         FROM planilla_pedido_anual p
         JOIN usuario u ON u.id_usuario = p.director_area_id
         WHERE p.director_area_id = $1
         ORDER BY p.created_at DESC`,
        [req.user.sub]
      );
    }

    res.json({ planillas: rows });
  } catch (err) {
    console.error("Error al listar planillas:", err);
    res.status(500).json({ error: "No se pudieron listar planillas" });
  }
});

// ── Detalle de una planilla ──
router.get("/planillas/:id", authorizePermissions(PERMISSIONS.PLANILLA_VIEW), async (req, res) => {
  try {
    await ensureTables();

    const id = Number(req.params.id);
    const planilla = await get(
      `SELECT p.id, p.anio, p.estado, p.observaciones, p.created_at, p.enviada_at,
              u.nombre AS director_nombre, u.apellido AS director_apellido
       FROM planilla_pedido_anual p
       JOIN usuario u ON u.id_usuario = p.director_area_id
       WHERE p.id = $1`,
      [id]
    );

    if (!planilla) return res.status(404).json({ error: "Planilla no encontrada" });

    // area_compras solo puede ver enviadas/procesadas
    if (req.user.role === "area_compras" && !["enviada", "procesada"].includes(planilla.estado)) {
      return res.status(403).json({ error: "No tenés acceso a esta planilla" });
    }

    const detalles = await all(
      `SELECT d.id, d.cantidad, d.notas,
              i.nombre AS institucion, i.cue,
              pr.nombre AS producto, pr.unidad_medida,
              ped.id_pedido AS pedido_id
       FROM planilla_pedido_anual_detalle d
       JOIN institucion i ON i.id_institucion = d.id_institucion
       JOIN producto pr ON pr.id_producto = d.id_producto
       JOIN pedido ped ON ped.id_pedido = d.id_pedido
       WHERE d.planilla_id = $1
       ORDER BY i.nombre, pr.nombre`,
      [id]
    );

    res.json({ planilla, detalles });
  } catch (err) {
    console.error("Error al obtener planilla:", err);
    res.status(500).json({ error: "No se pudo obtener planilla" });
  }
});

// ── Crear planilla a partir de las solicitudes anuales aprobadas ──
router.post("/planillas", authorizePermissions(PERMISSIONS.PLANILLA_MANAGE), async (req, res) => {
  try {
    await ensureTables();

    const { observaciones } = req.body;
    const anio = new Date().getFullYear();

    // Verificar que no exista ya una planilla activa para este año
    const existente = await get(
      `SELECT id FROM planilla_pedido_anual
       WHERE director_area_id = $1 AND anio = $2 AND estado != 'procesada'`,
      [req.user.sub, anio]
    );
    if (existente) {
      return res.status(409).json({
        error: `Ya existe una planilla para ${anio}. Primero enviala o eliminá la anterior.`
      });
    }

    // Obtener todas las solicitudes anuales aprobadas de las instituciones asignadas
    const solicitudes = await all(
      `SELECT
         p.id_pedido,
         p.id_institucion,
         dp.id_producto,
         dp.cantidad_solicitada AS cantidad,
         p.observaciones_generales AS notas
       FROM supervisor_escuela_asignacion sea
       JOIN pedido p ON p.id_institucion = sea.institucion_id
       JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
       WHERE sea.director_area_id = $1
         AND COALESCE(p.tipo, 'anual') = 'anual'
         AND p.estado = 'aprobado'
         AND p.aprobado_director_area IS TRUE
         AND EXTRACT(YEAR FROM p.fecha_creacion) = $2`,
      [req.user.sub, anio]
    );

    if (solicitudes.length === 0) {
      return res.status(400).json({
        error: "No hay solicitudes anuales aceptadas por Dirección de Área para incluir en la planilla."
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const planillaRes = await client.query(
        `INSERT INTO planilla_pedido_anual (director_area_id, anio, estado, observaciones)
         VALUES ($1, $2, 'borrador', $3)
         RETURNING id`,
        [req.user.sub, anio, observaciones || null]
      );
      const planillaId = planillaRes.rows[0].id;

      for (const s of solicitudes) {
        await client.query(
          `INSERT INTO planilla_pedido_anual_detalle
             (planilla_id, id_pedido, id_institucion, id_producto, cantidad, notas)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [planillaId, s.id_pedido, s.id_institucion, s.id_producto, s.cantidad, s.notas]
        );
      }

      await client.query("COMMIT");
      res.status(201).json({ id: planillaId, estado: "borrador", items: solicitudes.length });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Error al crear planilla:", err);
    res.status(500).json({ error: "No se pudo crear la planilla" });
  }
});

// ── Enviar planilla a Área de Compras ──
router.patch("/planillas/:id/enviar", authorizePermissions(PERMISSIONS.PLANILLA_ENVIAR), async (req, res) => {
  try {
    await ensureTables();

    const id = Number(req.params.id);
    const planilla = await get(
      "SELECT id, estado, director_area_id FROM planilla_pedido_anual WHERE id = $1",
      [id]
    );

    if (!planilla) return res.status(404).json({ error: "Planilla no encontrada" });
    if (planilla.director_area_id !== req.user.sub) {
      return res.status(403).json({ error: "No tenés acceso a esta planilla" });
    }
    if (planilla.estado !== "borrador") {
      return res.status(400).json({ error: "Solo se pueden enviar planillas en estado borrador" });
    }

    await run(
      `UPDATE planilla_pedido_anual
       SET estado = 'enviada', enviada_at = NOW()
       WHERE id = $1`,
      [id]
    );

    res.json({ ok: true, estado: "enviada" });
  } catch (err) {
    console.error("Error al enviar planilla:", err);
    res.status(500).json({ error: "No se pudo enviar la planilla" });
  }
});

// ── Área de Compras: marcar planilla como procesada ──
router.patch("/planillas/:id/procesar", authorizePermissions(PERMISSIONS.PLANILLA_MANAGE), async (req, res) => {
  try {
    await ensureTables();

    if (req.user.role !== "area_compras" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Solo el Área de Compras puede procesar planillas" });
    }

    const id = Number(req.params.id);
    const planilla = await get(
      "SELECT id, estado FROM planilla_pedido_anual WHERE id = $1",
      [id]
    );

    if (!planilla) return res.status(404).json({ error: "Planilla no encontrada" });
    if (planilla.estado !== "enviada") {
      return res.status(400).json({ error: "Solo se pueden procesar planillas en estado enviada" });
    }

    await run(
      "UPDATE planilla_pedido_anual SET estado = 'procesada' WHERE id = $1",
      [id]
    );

    res.json({ ok: true, estado: "procesada" });
  } catch (err) {
    console.error("Error al procesar planilla:", err);
    res.status(500).json({ error: "No se pudo procesar la planilla" });
  }
});

// ── Eliminar planilla en borrador ──
router.delete("/planillas/:id", authorizePermissions(PERMISSIONS.PLANILLA_MANAGE), async (req, res) => {
  try {
    await ensureTables();

    const id = Number(req.params.id);
    const planilla = await get(
      "SELECT id, estado, director_area_id FROM planilla_pedido_anual WHERE id = $1",
      [id]
    );

    if (!planilla) return res.status(404).json({ error: "Planilla no encontrada" });
    if (planilla.director_area_id !== req.user.sub) {
      return res.status(403).json({ error: "No tenés acceso a esta planilla" });
    }
    if (planilla.estado !== "borrador") {
      return res.status(400).json({ error: "Solo se pueden eliminar planillas en estado borrador" });
    }

    await run("DELETE FROM planilla_pedido_anual WHERE id = $1", [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error al eliminar planilla:", err);
    res.status(500).json({ error: "No se pudo eliminar la planilla" });
  }
});

module.exports = router;
