const express = require("express");
const { all, get, run } = require("../db.pg");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");

const router = express.Router();

let tablesReady = false;
let tablesInitPromise = null;

async function getInstitucionNivelColumn() {
  const row = await get(`
    SELECT CASE
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'institucion' AND column_name = 'nivel_educativo'
      ) THEN 'nivel_educativo'
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'institucion' AND column_name = 'nivel'
      ) THEN 'nivel'
      ELSE NULL
    END AS col
  `);
  return row?.col || null;
}

async function getDirectorAreaNivel(userId) {
  const row = await get(
    `SELECT NULLIF(BTRIM(nivel_educativo), '') AS nivel_educativo
     FROM usuario
     WHERE id_usuario = ?`,
    [userId]
  );
  return row?.nivel_educativo || null;
}

async function ensureTables() {
  if (tablesReady) return;
  if (tablesInitPromise) {
    await tablesInitPromise;
    return;
  }

  tablesInitPromise = (async () => {
    await run(`
      CREATE TABLE IF NOT EXISTS supervisor_escuela_asignacion (
        id SERIAL PRIMARY KEY,
        supervisor_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
        institucion_id INT NOT NULL REFERENCES institucion(id_institucion) ON DELETE CASCADE,
        director_area_id INT REFERENCES usuario(id_usuario),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (supervisor_id, institucion_id)
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS solicitud_informe_supervisor (
        id SERIAL PRIMARY KEY,
        supervisor_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
        director_area_id INT REFERENCES usuario(id_usuario),
        asunto VARCHAR(180) NOT NULL,
        detalle TEXT,
        fecha_limite DATE,
        estado VARCHAR(20) DEFAULT 'pendiente',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await run(`
      ALTER TABLE pedido
      ADD COLUMN IF NOT EXISTS aprobado_director_area BOOLEAN
    `);

    await run(`
      ALTER TABLE usuario
      ADD COLUMN IF NOT EXISTS nivel_educativo VARCHAR(120)
    `);

    tablesReady = true;
  })();

  try {
    await tablesInitPromise;
  } finally {
    tablesInitPromise = null;
  }
}

router.use(authenticate);
router.use(authorizePermissions(PERMISSIONS.SUPERVISION_MANAGE));

router.get("/catalogo", async (req, res) => {
  try {
    await ensureTables();

    const nivelColumn = await getInstitucionNivelColumn();
    const directorNivel = await getDirectorAreaNivel(req.user.sub);

    if (!nivelColumn) {
      return res.status(500).json({ error: "No se encontro la columna de nivel educativo en instituciones" });
    }
    if (!directorNivel) {
      return res.status(400).json({ error: "El Director de Area no tiene un nivel educativo configurado" });
    }

    const supervisores = await all(
      `SELECT id_usuario AS id, nombre, apellido, email
       FROM usuario
       WHERE role = 'supervisor' AND activo = TRUE
       ORDER BY nombre, apellido`
    );

    const escuelas = await all(
      `SELECT id_institucion AS id, nombre, cue, ${nivelColumn} AS nivel
       FROM institucion
       WHERE activo = TRUE
         AND LOWER(COALESCE(${nivelColumn}, '')) = LOWER($1)
       ORDER BY nombre`,
      [directorNivel]
    );

    res.json({ supervisores, escuelas, nivel_educativo: directorNivel });
  } catch (err) {
    console.error("Error al cargar catalogo de Direccion de Area:", err);
    res.status(500).json({ error: "No se pudo cargar catalogo" });
  }
});

router.get("/asignaciones", async (req, res) => {
  try {
    await ensureTables();

    const asignaciones = await all(
      `SELECT a.id,
              a.created_at,
              u.id_usuario AS supervisor_id,
              u.nombre AS supervisor_nombre,
              u.apellido AS supervisor_apellido,
              i.id_institucion AS institucion_id,
              i.nombre AS institucion_nombre,
              i.cue
       FROM supervisor_escuela_asignacion a
       JOIN usuario u ON u.id_usuario = a.supervisor_id
       JOIN institucion i ON i.id_institucion = a.institucion_id
       WHERE a.director_area_id = $1
       ORDER BY a.created_at DESC`,
      [req.user.sub]
    );

    res.json({ asignaciones });
  } catch (err) {
    console.error("Error al listar asignaciones de supervisor:", err);
    res.status(500).json({ error: "No se pudieron listar asignaciones" });
  }
});

router.post("/asignaciones", async (req, res) => {
  try {
    await ensureTables();

    const nivelColumn = await getInstitucionNivelColumn();
    const directorNivel = await getDirectorAreaNivel(req.user.sub);
    const supervisorId = Number(req.body.supervisor_id);
    const institucionId = Number(req.body.institucion_id);

    if (!Number.isInteger(supervisorId) || !Number.isInteger(institucionId)) {
      return res.status(400).json({ error: "supervisor_id e institucion_id son obligatorios" });
    }
    if (!nivelColumn) {
      return res.status(500).json({ error: "No se encontro la columna de nivel educativo en instituciones" });
    }
    if (!directorNivel) {
      return res.status(400).json({ error: "El Director de Area no tiene un nivel educativo configurado" });
    }

    const institucion = await get(
      `SELECT id_institucion
       FROM institucion
       WHERE id_institucion = $1
         AND LOWER(COALESCE(${nivelColumn}, '')) = LOWER($2)`,
      [institucionId, directorNivel]
    );

    if (!institucion) {
      return res.status(400).json({ error: "La escuela no pertenece al nivel educativo del Director de Area" });
    }

    await run(
      `INSERT INTO supervisor_escuela_asignacion (supervisor_id, institucion_id, director_area_id)
       VALUES (?, ?, ?)
       ON CONFLICT (supervisor_id, institucion_id)
       DO UPDATE SET director_area_id = EXCLUDED.director_area_id`,
      [supervisorId, institucionId, req.user.sub]
    );

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("Error al asignar escuela a supervisor:", err);
    res.status(500).json({ error: "No se pudo crear asignacion" });
  }
});

router.delete("/asignaciones/:id", async (req, res) => {
  try {
    await ensureTables();

    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "ID invalido" });

    await run("DELETE FROM supervisor_escuela_asignacion WHERE id = ? AND director_area_id = ?", [id, req.user.sub]);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error al eliminar asignacion:", err);
    res.status(500).json({ error: "No se pudo eliminar asignacion" });
  }
});

router.get("/informes", async (req, res) => {
  try {
    await ensureTables();

    const informes = await all(
      `SELECT s.id,
              s.asunto,
              s.detalle,
              s.estado,
              s.fecha_limite,
              s.created_at,
              u.id_usuario AS supervisor_id,
              u.nombre AS supervisor_nombre,
              u.apellido AS supervisor_apellido
       FROM solicitud_informe_supervisor s
       JOIN usuario u ON u.id_usuario = s.supervisor_id
       WHERE s.director_area_id = $1
       ORDER BY s.created_at DESC`,
      [req.user.sub]
    );

    res.json({ informes });
  } catch (err) {
    console.error("Error al listar solicitudes de informe:", err);
    res.status(500).json({ error: "No se pudieron listar informes" });
  }
});

router.get("/solicitudes", async (req, res) => {
  try {
    await ensureTables();

    const nivelColumn = await getInstitucionNivelColumn();
    const directorNivel = await getDirectorAreaNivel(req.user.sub);

    if (!nivelColumn) {
      return res.status(500).json({ error: "No se encontro la columna de nivel educativo en instituciones" });
    }
    if (!directorNivel) {
      return res.status(400).json({ error: "El Director de Area no tiene un nivel educativo configurado" });
    }

    const solicitudes = await all(
      `SELECT
         p.id_pedido AS id,
         p.estado::text AS estado,
         COALESCE(p.tipo, 'anual') AS tipo,
         p.aprobado_director_area,
         p.observaciones_generales AS notas,
         p.fecha_creacion AS fecha,
         STRING_AGG(pr.nombre || ' x' || dp.cantidad_solicitada::text, ', ' ORDER BY pr.nombre) AS producto,
         SUM(dp.cantidad_solicitada) AS cantidad,
         u.nombre AS solicitante,
         i.id_institucion AS institucion_id,
         i.nombre AS institucion,
         i.nombre AS escuela_nombre,
         sup.nombre AS supervisor_nombre,
         sup.apellido AS supervisor_apellido,
         COALESCE(
           JSON_AGG(
             JSON_BUILD_OBJECT(
               'producto', pr.nombre,
               'cantidad', dp.cantidad_solicitada
             )
             ORDER BY pr.nombre
           ) FILTER (WHERE pr.id_producto IS NOT NULL),
           '[]'::json
         ) AS items
       FROM institucion i
       JOIN pedido p ON p.id_institucion = i.id_institucion
       JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
       JOIN producto pr ON pr.id_producto = dp.id_producto
       JOIN usuario u ON u.id_usuario = p.id_usuario_solicitante
       LEFT JOIN usuario sup ON sup.id_usuario = p.aprobado_por_supervisor_id
       WHERE LOWER(COALESCE(i.${nivelColumn}, '')) = LOWER($1)
         AND p.estado::text IN ('pendiente', 'aprobado', 'rechazado', 'entregado', 'finalizado')
       GROUP BY p.id_pedido, p.estado, p.tipo, p.aprobado_director_area, p.observaciones_generales,
                p.fecha_creacion, p.kit_nombre, p.kit_cantidad, u.nombre, i.id_institucion, i.nombre,
                sup.nombre, sup.apellido
       ORDER BY p.fecha_creacion DESC`,
      [directorNivel]
    );

    res.json({ solicitudes });
  } catch (err) {
    console.error("Error al listar solicitudes del director de area:", err);
    res.status(500).json({ error: "No se pudieron listar solicitudes" });
  }
});

router.patch("/solicitudes/:id/decision", async (req, res) => {
  try {
    await ensureTables();

    const nivelColumn = await getInstitucionNivelColumn();
    const directorNivel = await getDirectorAreaNivel(req.user.sub);
    const id = Number(req.params.id);
    const decision = String(req.body.decision || "").trim().toLowerCase();

    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "ID invalido" });
    }
    if (!["aceptar", "denegar"].includes(decision)) {
      return res.status(400).json({ error: "Decision invalida" });
    }
    if (!nivelColumn) {
      return res.status(500).json({ error: "No se encontro la columna de nivel educativo en instituciones" });
    }
    if (!directorNivel) {
      return res.status(400).json({ error: "El Director de Area no tiene un nivel educativo configurado" });
    }

    const pedido = await all(
      `SELECT p.id_pedido, p.estado::text AS estado, COALESCE(p.tipo, 'anual') AS tipo
       FROM pedido p
       JOIN institucion i ON i.id_institucion = p.id_institucion
       WHERE p.id_pedido = $1
         AND LOWER(COALESCE(i.${nivelColumn}, '')) = LOWER($2)`,
      [id, directorNivel]
    );

    if (!pedido.length) {
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }

    const row = pedido[0];
    if (row.tipo !== "anual") {
      return res.status(400).json({ error: "Solo se pueden decidir solicitudes anuales" });
    }
    if (row.estado !== "aprobado") {
      return res.status(400).json({ error: "La solicitud debe estar aprobada por supervisor" });
    }

    if (decision === "aceptar") {
      await run(
        `UPDATE pedido
         SET aprobado_director_area = TRUE
         WHERE id_pedido = $1`,
        [id]
      );
      return res.json({ ok: true, aprobado_director_area: true });
    }

    await run(
      `UPDATE pedido
       SET estado = 'rechazado', aprobado_director_area = FALSE
       WHERE id_pedido = $1`,
      [id]
    );

    return res.json({ ok: true, aprobado_director_area: false, estado: "rechazado" });
  } catch (err) {
    console.error("Error al decidir solicitud del director de area:", err);
    res.status(500).json({ error: "No se pudo registrar la decision" });
  }
});

router.post("/informes", async (req, res) => {
  try {
    await ensureTables();

    const supervisorId = Number(req.body.supervisor_id);
    const asunto = String(req.body.asunto || "").trim();
    const detalle = String(req.body.detalle || "").trim();
    const fechaLimite = req.body.fecha_limite || null;

    if (!Number.isInteger(supervisorId) || !asunto) {
      return res.status(400).json({ error: "supervisor_id y asunto son obligatorios" });
    }

    await run(
      `INSERT INTO solicitud_informe_supervisor (supervisor_id, director_area_id, asunto, detalle, fecha_limite)
       VALUES (?, ?, ?, ?, ?)`,
      [supervisorId, req.user.sub, asunto, detalle || null, fechaLimite]
    );

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("Error al solicitar informe:", err);
    res.status(500).json({ error: "No se pudo registrar solicitud" });
  }
});

module.exports = router;
