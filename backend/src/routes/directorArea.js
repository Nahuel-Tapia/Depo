const express = require("express");
const { all, run } = require("../db.pg");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");

const router = express.Router();

let tablesReady = false;
let tablesInitPromise = null;
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

    const supervisores = await all(
      `SELECT id_usuario AS id, nombre, apellido, email
       FROM usuario
       WHERE role = 'supervisor' AND activo = TRUE
       ORDER BY nombre, apellido`
    );

    const escuelas = await all(
      `SELECT id_institucion AS id, nombre, cue
       FROM institucion
       WHERE activo = TRUE
       ORDER BY nombre`
    );

    res.json({ supervisores, escuelas });
  } catch (err) {
    console.error("Error al cargar catálogo de Dirección de Área:", err);
    res.status(500).json({ error: "No se pudo cargar catálogo" });
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
       ORDER BY a.created_at DESC`
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

    const supervisorId = Number(req.body.supervisor_id);
    const institucionId = Number(req.body.institucion_id);

    if (!Number.isInteger(supervisorId) || !Number.isInteger(institucionId)) {
      return res.status(400).json({ error: "supervisor_id e institucion_id son obligatorios" });
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
    res.status(500).json({ error: "No se pudo crear asignación" });
  }
});

router.delete("/asignaciones/:id", async (req, res) => {
  try {
    await ensureTables();

    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "ID inválido" });

    await run("DELETE FROM supervisor_escuela_asignacion WHERE id = ?", [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error al eliminar asignación:", err);
    res.status(500).json({ error: "No se pudo eliminar asignación" });
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
       ORDER BY s.created_at DESC`
    );

    res.json({ informes });
  } catch (err) {
    console.error("Error al listar solicitudes de informe:", err);
    res.status(500).json({ error: "No se pudieron listar informes" });
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
