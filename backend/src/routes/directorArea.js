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
  try {
    const row = await get(
      `SELECT nivel_educativo
       FROM usuario
       WHERE id_usuario = ?`,
      [userId]
    );
    const nivel = row?.nivel_educativo;
    console.log(" getDirectorAreaNivel raw:", nivel);
    return nivel ? nivel.trim() : null;
  } catch (e) {
    console.error("Error getting nivel:", e);
    return null;
  }
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
        director_area_id INT NOT NULL REFERENCES usuario(id_usuario),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await run(`
      CREATE TABLE IF NOT EXISTS zona (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        nivel_educativo VARCHAR(120) NOT NULL,
        departamento VARCHAR(120),
        director_area_id INT NOT NULL REFERENCES usuario(id_usuario),
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await run(`
      CREATE TABLE IF NOT EXISTS zona_institucion (
        zona_id INT NOT NULL REFERENCES zona(id) ON DELETE CASCADE,
        institucion_id INT NOT NULL REFERENCES institucion(id_institucion) ON DELETE CASCADE,
        PRIMARY KEY (zona_id, institucion_id)
      )
    `);
    await run(`
      CREATE TABLE IF NOT EXISTS zona_supervisor (
        zona_id INT NOT NULL REFERENCES zona(id) ON DELETE CASCADE,
        supervisor_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (zona_id, supervisor_id)
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

    const nivelColumn = await getInstitucionNivelColumn();
    
    // Use nivel from JWT token directly
    let directorNivel = req.user.nivel_educativo || null;
    console.log("catalogo - nivel from JWT:", directorNivel);
    
    // If not in token, try to get from DB
    if (!directorNivel) {
      directorNivel = await getDirectorAreaNivel(req.user.sub);
    }

    if (!nivelColumn) {
      return res.status(500).json({ error: "No se encontro la columna de nivel educativo en instituciones" });
    }
    // If still no nivel, just return empty
    if (!directorNivel) {
      return res.status(200).json({ 
        supervisaores: [], 
        escuelas: [], 
        nivel_educativo: null 
      });
    }

    const supervisores = await all(
      `SELECT id_usuario AS id, nombre, apellido, email, nivel_educativo, director_area_id, jurisdiccion
       FROM usuario
       WHERE role = 'supervisor'
         AND activo = TRUE
         AND LOWER(COALESCE(nivel_educativo, '')) = LOWER($2)
         AND director_area_id = $1
       ORDER BY nombre, apellido`,
      [req.user.sub, directorNivel]
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
    console.error("Error al cargar asignaciones:", err);
    res.status(500).json({ error: "No se pudieron cargar las asignaciones" });
  }
});

router.delete("/asignacion/:id", async (req, res) => {
  try {
    await ensureTables();
    const { id } = req.params;

    await run("DELETE FROM supervisor_escuela_asignacion WHERE id = $1 AND director_area_id = $2", [id, req.user.sub]);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error al eliminar asignacion:", err);
    res.status(500).json({ error: "No se pudo eliminar la asignacion" });
  }
});

router.post("/asignar", async (req, res) => {
  try {
    await ensureTables();

    const { supervisorId, institucionId } = req.body;

    if (!supervisorId || !institucionId) {
      return res.status(400).json({ error: "Faltan datos requeridos" });
    }

    const nivelColumn = await getInstitucionNivelColumn();
    const directorNivel = await getDirectorAreaNivel(req.user.sub);

    if (!directorNivel) {
      return res.status(400).json({ error: "El Director de Area no tiene un nivel educativo configurado" });
    }

    const supervisor = await get(
      `SELECT id_usuario, nivel_educativo
       FROM usuario
       WHERE id_usuario = $1 AND role = 'supervisor' AND activo = TRUE`,
      [supervisorId]
    );
    if (!supervisor) {
      return res.status(400).json({ error: "Supervisor no valido" });
    }
    if ((supervisor.nivel_educativo || "").toLowerCase() !== directorNivel.toLowerCase()) {
      return res.status(400).json({ error: "El supervisor debe ser del mismo nivel educativo" });
    }

    const institucion = await get(
      `SELECT id_institucion, ${nivelColumn} AS nivel
       FROM institucion
       WHERE id_institucion = $1 AND activo = TRUE`,
      [institucionId]
    );
    if (!institucion) {
      return res.status(400).json({ error: "Institucion no valida" });
    }
    if ((institucion.nivel || "").toLowerCase() !== directorNivel.toLowerCase()) {
      return res.status(400).json({ error: "La institucion debe ser del mismo nivel educativo" });
    }

    await run(
      `INSERT INTO supervisor_escuela_asignacion (supervisor_id, institucion_id, director_area_id)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [supervisorId, institucionId, req.user.sub]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("Error al asignar:", err);
    res.status(500).json({ error: "No se pudo realizar la asignacion" });
  }
});

router.delete("/desasignar", async (req, res) => {
  try {
    await ensureTables();

    const { supervisorId, institucionId } = req.body;

    if (!supervisorId || !institucionId) {
      return res.status(400).json({ error: "Faltan datos requeridos" });
    }

    await run(
      "DELETE FROM supervisor_escuela_asignacion WHERE supervisor_id = $1 AND institucion_id = $2 AND director_area_id = $3",
      [supervisorId, institucionId, req.user.sub]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("Error al desasignar:", err);
    res.status(500).json({ error: "No se pudo eliminar la asignacion" });
  }
});

router.get("/supervisores", async (req, res) => {
  try {
    const nivelColumn = await getInstitucionNivelColumn();
    const directorNivel = await getDirectorAreaNivel(req.user.sub);

    if (!directorNivel) {
      return res.status(400).json({ error: "El Director de Area no tiene un nivel educativo configurado" });
    }

    const supervisores = await all(
      `SELECT id_usuario AS id, nombre, apellido, email, nivel_educativo, jurisdiccion
       FROM usuario
       WHERE role = 'supervisor'
         AND activo = TRUE
         AND LOWER(COALESCE(nivel_educativo, '')) = LOWER($1)
         AND director_area_id = $2
       ORDER BY nombre, apellido`,
      [directorNivel, req.user.sub]
    );

    res.json({ supervisores });
  } catch (err) {
    console.error("Error al cargar supervisores:", err);
    res.status(500).json({ error: "No se pudieron cargar los supervisores" });
  }
});

router.post("/supervisores", async (req, res) => {
  try {
    const { nombre, apellido, email, dni, password } = req.body;
    const nivelColumn = await getInstitucionNivelColumn();
    const directorNivel = await getDirectorAreaNivel(req.user.sub);

    if (!nombre || !apellido || !email || !dni || !password) {
      return res.status(400).json({ error: "Faltan datos requeridos" });
    }
    if (!directorNivel) {
      return res.status(400).json({ error: "El Director de Area no tiene un nivel educativo configurado" });
    }

    const bcrypt = require("bcryptjs");
    const hash = await bcrypt.hash(password, 10);

    const result = await run(
      `INSERT INTO usuario (nombre, apellido, email, dni, password, role, activo, nivel_educativo, director_area_id, jurisdiccion)
       VALUES ($1, $2, $3, $4, $5, 'supervisor', TRUE, $6, $7, $8)
       RETURNING id_usuario`,
      [nombre, apellido, email, dni, hash, directorNivel, req.user.sub, req.user.jurisdiccion || null]
    );

    res.status(201).json({ id: result.lastID, nombre, apellido, email, role: "supervisor" });
  } catch (err) {
    console.error("Error al crear supervisor:", err);
    // Map common DB constraint errors to user-friendly 400
    const msg = (err?.message || '').toLowerCase();
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return res.status(400).json({ error: "Ya existe un supervisor con esos datos" });
    }
    res.status(500).json({ error: "No se pudo crear el supervisor" });
  }
});

router.get("/edificios", async (req, res) => {
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

    const edificios = await all(
      `SELECT DISTINCT e.id_edificio, e.departamento, e.direccion, e.calle, e.numero_puerta
       FROM institucion i
       JOIN edificio e ON i.id_edificio = e.id_edificio
       WHERE i.activo = TRUE
         AND LOWER(COALESCE(i.${nivelColumn}, '')) = LOWER($1)
         AND e.departamento IS NOT NULL
         AND e.departamento <> ''
       ORDER BY e.departamento, e.direccion`,
      [directorNivel]
    );

    res.json({ edificios, nivel_educativo: directorNivel });
  } catch (err) {
    console.error("Error al cargar edificios:", err);
    res.status(500).json({ error: "No se pudieron cargar los edificios" });
  }
});

router.get("/edificio/:edificioId/escuelas", async (req, res) => {
  try {
    await ensureTables();

    const { edificioId } = req.params;
    const nivelColumn = await getInstitucionNivelColumn();
    const directorNivel = await getDirectorAreaNivel(req.user.sub);

    if (!nivelColumn) {
      return res.status(500).json({ error: "No se encontro la columna de nivel educativo" });
    }
    if (!directorNivel) {
      return res.status(400).json({ error: "El Director de Area no tiene un nivel educativo configurado" });
    }

    const instituciones = await all(
      `SELECT i.id_institucion AS id, i.nombre, i.cue
       FROM institucion i
       WHERE i.id_edificio = $1
         AND i.activo = TRUE
         AND LOWER(COALESCE(i.${nivelColumn}, '')) = LOWER($2)
       ORDER BY i.nombre`,
      [parseInt(edificioId, 10), directorNivel]
    );

    res.json({ instituciones });
  } catch (err) {
    console.error("Error al cargar instituciones del edificio:", err);
    res.status(500).json({ error: "No se pudieron cargar las instituciones" });
  }
});

router.get("/zonas-edificio", async (req, res) => {
  try {
    await ensureTables();
    
    // Get nivel from user object in request (populated by auth middleware)
    const user = req.user || {};
    const nivelFromJWT = user.nivel_educativo || user.nivel || null;
    console.log("DEBUG user:", user);
    console.log("DEBUG nivel from JWT:", nivelFromJWT);

    // If no nivel, return test data
    if (!nivelFromJWT) {
      console.log("No nivel found, returning test data");
      return res.json({ 
        departamentos: ['Uruguay', 'Rivadavia', 'Cuyo'],
        nivel_educativo: 'Primario',  
        instituciones: [
          { id: 1, nombre: 'Escuela Juan Pablo', cue: '123456789', departamento: 'Uruguay' },
          { id: 2, nombre: 'Escuela Maria Rosa', cue: '987654321', departamento: 'Uruguay' }
        ],
        zonas: [],
        warning: "Sin nivel configurado - datos de prueba"
      });
    }
    
    // If we have nivel, query for real data
    console.log("Will query with nivel:", nivelFromJWT);

    // Try to get nivel column, fallback
    let nivelColumn = 'nivel_educativo';
    try {
      nivelColumn = await getInstitucionNivelColumn();
    } catch (e) {
      console.log("Using default nivelColumn:", nivelColumn);
    }

    // Get departamentos
    const deptosResult = await all(`
      SELECT DISTINCT e.departamento
      FROM institucion i
      JOIN edificio e ON i.id_edificio = e.id_edificio
      WHERE i.activo = TRUE
        AND COALESCE(i.${nivelColumn}, '') != ''
        AND e.departamento IS NOT NULL
        AND e.departamento <> ''
      ORDER BY e.departamento
    `, []);

    const deptos = deptosResult.map(d => d.departamento).filter(Boolean);

    // Get instituciones with nivel from token
    const institucionesResult = await all(`
      SELECT i.id_institucion AS id, i.nombre, i.cue, e.departamento, i.nivel_educativo AS nivel_educativo
      FROM institucion i
      JOIN edificio e ON i.id_edificio = e.id_edificio
      WHERE i.activo = TRUE
        AND LOWER(COALESCE(i.${nivelColumn}, '')) = LOWER($1)
        AND e.departamento IS NOT NULL
      ORDER BY e.departamento, i.nombre
    `, [nivelFromJWT]);

    res.json({
      departamentos: deptos,
      nivel_educativo: nivelFromJWT,
      instituciones: institucionesResult.map(i => ({
        id: i.id,
        nombre: i.nombre,
        cue: i.cue,
        departamento: i.departamento,
        nivel_educativo: i.nivel_educativo
      })),
      zonas: []
});
  } catch (err) {
    console.error("Error in zonas-edificio:", err);
    res.status(500).json({ error: err.message });
  }
});

// Fallback endpoints for informes and solicitudes (real data can be added later)
router.get("/informes", async (req, res) => {
  try {
    await ensureTables();
    // For now return an empty list; backend can be extended to fetch real data
    res.json({ informes: [] });
  } catch (err) {
    console.error("Error al cargar informes:", err);
    res.status(500).json({ error: "No se pudieron cargar los informes" });
  }
});

router.get("/solicitudes", async (req, res) => {
  try {
    await ensureTables();
    // For now return an empty list; backend can be extended to fetch real data
    res.json({ solicitudes: [] });
  } catch (err) {
    console.error("Error al cargar solicitudes:", err);
    res.status(500).json({ error: "No se pudieron cargar las solicitudes" });
  }
});

// Endpoint for zonas
router.post("/zonas", async (req, res) => {
  try {
    const { name, departamento, nivel_educativo, institucionIds } = req.body;
    console.log("POST /zonas body:", { name, departamento, nivel_educativo, institucionIds });
    
    // Use nivel from JWT
    let directorNivel = req.user.nivel_educativo || null;
    if (!directorNivel) {
      directorNivel = await getDirectorAreaNivel(req.user.sub);
    }

    if (!directorNivel) {
      return res.status(400).json({ error: "El Director de Area no tiene nivel educativo configurado" });
    }
    if (!name || !nivel_educativo) {
      return res.status(400).json({ error: "Faltan datos requeridos" });
    }
    if ((nivel_educativo || '').toLowerCase() !== (directorNivel || '').toLowerCase()) {
      return res.status(400).json({ error: "El nivel no coincide con el suyo" });
    }

    // Validate provided institution ids against department and level
    if (institucionIds && institucionIds.length > 0) {
      for (const instId of institucionIds) {
        const inst = await get(
          `SELECT i.id_institucion AS id, i.nombre, i.nivel_educativo, i.departamento, e.departamento AS dept
           FROM institucion i JOIN edificio e ON i.id_edificio = e.id_edificio
           WHERE i.id_institucion = ? AND i.activo = TRUE`,
          [instId]
        );
        console.log("Validating institution for zone:", instId, inst);
        if (!inst) {
          return res.status(400).json({ error: `Institucion no valida: ${instId}` });
        }
        if ((inst.nivel_educativo || '').toLowerCase() !== (nivel_educativo || directorNivel || '').toLowerCase()) {
          return res.status(400).json({ error: `La institucion ${instId} debe ser del mismo nivel educativo` });
        }
        const deptToCheck = departamento || name;
        if (inst.departamento && deptToCheck && inst.departamento !== deptToCheck) {
          return res.status(400).json({ error: `La institucion ${instId} no pertenece al departamento seleccionado` });
        }
      }
    }

    const result = await run(`
      INSERT INTO zona (name, nivel_educativo, departamento, director_area_id, activo, created_at)
      VALUES (?, ?, ?, ?, TRUE, NOW())
      RETURNING id
    `, [name, nivel_educativo, (departamento || name), req.user.sub]);
    console.log("[DBG] POST /zonas INSERT result:", result);

    let zonaId = (result && (result.lastID != null) ? result.lastID : (result && result.rows && result.rows[0] && (result.rows[0].id || result.rows[0].id_zona || result.rows[0].zona_id || result.rows[0].zonaId)) || null);
    if (!zonaId && result && result.rows && result.rows.length > 0) {
      const r = result.rows[0];
      zonaId = r.id || r.id_zona || r.zona_id || r.zonaId || null;
    }
    if (!zonaId) {
      console.error("No se pudo obtener el id de la zona creada. Result:", result);
    }

    if (institucionIds && institucionIds.length > 0) {
      for (const instId of institucionIds) {
        await run(`
          INSERT INTO zona_institucion (zona_id, institucion_id)
          VALUES (?, ?)
          ON CONFLICT DO NOTHING
        `, [zonaId, instId]);
      }
    }

    res.json({ id: zonaId, name, departamento: (departamento || name), nivel_educativo });
  } catch (err) {
    console.error("Error al crear zona:", err);
    res.status(500).json({ error: err?.message || "Error al crear zona", stack: err?.stack || null });
  }
});

router.post("/zonas/:zonaId/supervisores", async (req, res) => {
  try {
    const { zonaId } = req.params;
    const { supervisorIds } = req.body;

    const zona = await get(`
      SELECT id, director_area_id
      FROM zona
      WHERE id = ? AND director_area_id = ?
    `, [parseInt(zonaId, 10), req.user.sub]);

    if (!zona) {
      return res.status(404).json({ error: "Zona no encontrada o no autorizada" });
    }

    if (!supervisorIds || supervisorIds.length === 0) {
      return res.status(400).json({ error: "Faltan supervisorIds" });
    }

    for (const supId of supervisorIds) {
      await run(`
        INSERT INTO zona_supervisor (zona_id, supervisor_id, created_at)
        VALUES (?, ?, NOW())
        ON CONFLICT DO NOTHING
      `, [parseInt(zonaId, 10), supId]);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Error al asignar supervisores:", err);
    res.status(500).json({ error: "Error al asignar supervisores" });
  }
});

module.exports = router;
