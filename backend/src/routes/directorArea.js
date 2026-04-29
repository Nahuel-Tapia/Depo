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

const columnExistsCache = new Map();

async function columnExists(tableName, columnName) {
  const cacheKey = `${tableName}.${columnName}`;
  if (columnExistsCache.has(cacheKey)) {
    return columnExistsCache.get(cacheKey);
  }

  const row = await get(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND column_name = $2
     ) AS column_exists`,
    [tableName, columnName]
  );
  const exists = Boolean(row?.column_exists);
  columnExistsCache.set(cacheKey, exists);
  return exists;
}

async function getDepartamentoSql() {
  const [
    institucionDepartamento,
    edificioDepartamento,
    edificioDireccionId,
    direccionDepartamento
  ] = await Promise.all([
    columnExists("institucion", "departamento"),
    columnExists("edificio", "departamento"),
    columnExists("edificio", "id_direccion"),
    columnExists("direccion", "departamento")
  ]);

  const sources = [];
  const joins = [];

  if (institucionDepartamento) {
    sources.push("NULLIF(TRIM(i.departamento), '')");
  }
  if (edificioDireccionId && direccionDepartamento) {
    joins.push("LEFT JOIN direccion d ON e.id_direccion = d.id_direccion");
    sources.push("NULLIF(TRIM(d.departamento), '')");
  }
  if (edificioDepartamento) {
    sources.push("NULLIF(TRIM(e.departamento), '')");
  }

  return {
    expression: sources.length > 0 ? `COALESCE(${sources.join(", ")})` : "NULL::text",
    joins: joins.join("\n"),
    hasDepartamento: sources.length > 0
  };
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
    return nivel ? nivel.trim() : null;
  } catch (e) {
    console.error("Error al obtener el nivel del Director de Area:", e);
    return null;
  }
}

function normalizeText(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeLevel(value) {
  return normalizeText(value)?.toLowerCase() || null;
}

function toPositiveIntArray(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => Number.parseInt(value, 10)).filter((value) => Number.isInteger(value) && value > 0))];
}

async function getDirectorAreaLevelFromRequest(req) {
  const tokenLevel = normalizeText(req?.user?.nivel_educativo || req?.user?.nivel);
  if (tokenLevel) return tokenLevel;
  return getDirectorAreaNivel(req?.user?.sub);
}

async function getZoneInstituciones(zonaId, nivelColumn) {
  return all(
    `SELECT i.id_institucion AS id,
            i.nombre,
            i.cue,
            i.${nivelColumn} AS nivel_educativo
     FROM zona_institucion zi
     JOIN institucion i ON i.id_institucion = zi.institucion_id
     WHERE zi.zona_id = $1
     ORDER BY i.nombre ASC`,
    [zonaId]
  );
}

async function getZoneSupervisores(zonaId) {
  return all(
    `SELECT u.id_usuario AS id,
            u.nombre,
            u.apellido,
            u.email,
            u.nivel_educativo
     FROM zona_supervisor zs
     JOIN usuario u ON u.id_usuario = zs.supervisor_id
     WHERE zs.zona_id = $1
       AND u.activo = TRUE
     ORDER BY u.nombre, u.apellido`,
    [zonaId]
  );
}

async function getDirectorAreaZones(directorAreaId, nivelColumn) {
  const rows = await all(
    `SELECT z.id,
            z.name,
            z.departamento,
            z.nivel_educativo,
            z.created_at
     FROM zona z
     WHERE z.director_area_id = $1
       AND z.activo = TRUE
     ORDER BY z.created_at DESC, z.id DESC`,
    [directorAreaId]
  );

  const zones = [];
  for (const row of rows) {
    const instituciones = await getZoneInstituciones(row.id, nivelColumn);
    const supervisores = await getZoneSupervisores(row.id);

    zones.push({
      id: row.id,
      name: row.name,
      departamento: row.departamento,
      nivel_educativo: row.nivel_educativo,
      created_at: row.created_at,
      instituciones,
      instituciones_count: instituciones.length,
      supervisores,
      supervisor: supervisores[0] || null
    });
  }

  return zones;
}

async function getDirectorAreaZoneById(directorAreaId, zonaId, nivelColumn) {
  const zones = await getDirectorAreaZones(directorAreaId, nivelColumn);
  return zones.find((zone) => Number(zone.id) === Number(zonaId)) || null;
}

async function validateZonePayload({ req, name, departamento, nivel_educativo, institucionIds, currentZoneId = null }) {
  const nivelColumn = await getInstitucionNivelColumn();
  const directorNivel = await getDirectorAreaLevelFromRequest(req);
  const zoneName = normalizeText(name);
  const departamentoFinal = normalizeText(departamento || name);
  const requestedLevel = normalizeText(nivel_educativo);
  const institutionIds = toPositiveIntArray(institucionIds);

  if (!nivelColumn) {
    return { error: "No se encontro la columna de nivel educativo en instituciones", status: 500 };
  }
  if (!directorNivel) {
    return { error: "El Director de Area no tiene nivel educativo configurado", status: 400 };
  }
  if (!zoneName || !departamentoFinal || !requestedLevel) {
    return { error: "Faltan datos requeridos", status: 400 };
  }
  if (normalizeLevel(zoneName) === normalizeLevel(departamentoFinal)) {
    return { error: "El nombre de la zona debe ser distinto del departamento", status: 400 };
  }
  if (normalizeLevel(requestedLevel) !== normalizeLevel(directorNivel)) {
    return { error: "El nivel no coincide con el suyo", status: 400 };
  }
  if (institutionIds.length === 0) {
    return { error: "Debe seleccionar al menos una institucion", status: 400 };
  }

  const departamentoSql = await getDepartamentoSql();
  const instituciones = await all(
    `SELECT i.id_institucion AS id,
            i.nombre,
            i.${nivelColumn} AS nivel_educativo,
            ${departamentoSql.expression} AS departamento
     FROM institucion i
     JOIN edificio e ON i.id_edificio = e.id_edificio
     ${departamentoSql.joins}
     WHERE i.id_institucion = ANY($1::int[])
       AND i.activo = TRUE`,
    [institutionIds]
  );

  if (instituciones.length !== institutionIds.length) {
    return { error: "Una o mas instituciones seleccionadas no son validas", status: 400 };
  }

  const conflictingAssignments = await all(
    `SELECT zi.institucion_id AS id,
            z.id AS zona_id,
            z.name AS zona_name
     FROM zona_institucion zi
     JOIN zona z ON z.id = zi.zona_id
     WHERE zi.institucion_id = ANY($1::int[])
       AND z.activo = TRUE
       AND z.director_area_id = $2
       AND ($3::int IS NULL OR z.id <> $3)`,
    [institutionIds, req.user.sub, currentZoneId]
  );

  if (conflictingAssignments.length > 0) {
    const conflictingZoneNames = [...new Set(conflictingAssignments.map((row) => row.zona_name || `Zona ${row.zona_id}`))];
    return {
      error: `Hay instituciones que ya pertenecen a otra zona: ${conflictingZoneNames.join(", ")}`,
      status: 400
    };
  }

  for (const institucion of instituciones) {
    if (normalizeLevel(institucion.nivel_educativo) !== normalizeLevel(directorNivel)) {
      return { error: `La institucion ${institucion.id} debe ser del mismo nivel educativo`, status: 400 };
    }
    if (normalizeLevel(institucion.departamento) !== normalizeLevel(departamentoFinal)) {
      return { error: `La institucion ${institucion.id} no pertenece al departamento seleccionado`, status: 400 };
    }
  }

  return {
    nivelColumn,
    directorNivel,
    zoneName,
    departamentoFinal,
    requestedLevel,
    institutionIds
  };
}

async function replaceZoneInstitutions(zonaId, institutionIds) {
  await run("DELETE FROM zona_institucion WHERE zona_id = ?", [zonaId]);

  const uniqueInstitutionIds = toPositiveIntArray(institutionIds);
  if (uniqueInstitutionIds.length === 0) return;

  const valuesSql = uniqueInstitutionIds.map((_, index) => `($1, $${index + 2})`).join(", ");
  await run(
    `INSERT INTO zona_institucion (zona_id, institucion_id)
     VALUES ${valuesSql}
     ON CONFLICT DO NOTHING
     RETURNING zona_id AS id`,
    [zonaId, ...uniqueInstitutionIds]
  );
}

async function replaceZoneSupervisors(zonaId, supervisorIds) {
  await run("DELETE FROM zona_supervisor WHERE zona_id = ?", [zonaId]);

  const uniqueSupervisorIds = toPositiveIntArray(supervisorIds);
  if (uniqueSupervisorIds.length === 0) return;

  const valuesSql = uniqueSupervisorIds.map((_, index) => `($1, $${index + 2}, NOW())`).join(", ");
  await run(
    `INSERT INTO zona_supervisor (zona_id, supervisor_id, created_at)
     VALUES ${valuesSql}
     ON CONFLICT DO NOTHING
     RETURNING zona_id AS id`,
    [zonaId, ...uniqueSupervisorIds]
  );
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
    const directorNivel = await getDirectorAreaLevelFromRequest(req);

    if (!nivelColumn) {
      return res.status(500).json({ error: "No se encontro la columna de nivel educativo en instituciones" });
    }

    if (!directorNivel) {
      return res.status(200).json({
        supervisores: [],
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
    const directorNivel = await getDirectorAreaLevelFromRequest(req);

    if (!nivelColumn) {
      return res.status(500).json({ error: "No se encontro la columna de nivel educativo en instituciones" });
    }

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
    const directorNivel = await getDirectorAreaLevelFromRequest(req);

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
    const directorNivel = await getDirectorAreaLevelFromRequest(req);

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

    const departamentoSql = await getDepartamentoSql();
    if (!departamentoSql.hasDepartamento) {
      return res.json({ edificios: [], nivel_educativo: directorNivel });
    }

    const edificios = await all(
      `SELECT DISTINCT
              e.id_edificio,
              ${departamentoSql.expression} AS departamento,
              e.direccion,
              e.calle,
              e.numero_puerta
       FROM institucion i
       JOIN edificio e ON i.id_edificio = e.id_edificio
       ${departamentoSql.joins}
       WHERE i.activo = TRUE
         AND LOWER(COALESCE(i.${nivelColumn}, '')) = LOWER($1)
         AND ${departamentoSql.expression} IS NOT NULL
       ORDER BY departamento, e.direccion`,
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
    const nivelColumn = await getInstitucionNivelColumn();
    const directorNivel = await getDirectorAreaLevelFromRequest(req);

    if (!nivelColumn) {
      return res.status(500).json({ error: "No se encontro la columna de nivel educativo en instituciones" });
    }

    if (!directorNivel) {
      return res.json({
        departamentos: [],
        nivel_educativo: null,
        instituciones: [],
        zonas: [],
        warning: "El Director de Area no tiene nivel educativo configurado"
      });
    }
    const departamentoSql = await getDepartamentoSql();
    if (!departamentoSql.hasDepartamento) {
      const zonas = await getDirectorAreaZones(req.user.sub, nivelColumn);
      return res.json({
        departamentos: [],
        nivel_educativo: directorNivel,
        instituciones: [],
        zonas
      });
    }

    const institucionesResult = await all(`
      SELECT
        i.id_institucion AS id,
        i.nombre,
        i.cue,
        ${departamentoSql.expression} AS departamento,
        i.${nivelColumn} AS nivel_educativo
      FROM institucion i
      JOIN edificio e ON i.id_edificio = e.id_edificio
      ${departamentoSql.joins}
      WHERE i.activo = TRUE
        AND LOWER(COALESCE(i.${nivelColumn}, '')) = LOWER($1)
        AND ${departamentoSql.expression} IS NOT NULL
      ORDER BY departamento, i.nombre
    `, [directorNivel]);

    const zonas = await getDirectorAreaZones(req.user.sub, nivelColumn);

    const deptos = Array.from(
      new Set(
        institucionesResult
          .map((row) => String(row.departamento || '').trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, 'es'));

    res.json({
      departamentos: deptos,
      nivel_educativo: directorNivel,
      instituciones: institucionesResult.map((i) => ({
        id: i.id,
        nombre: i.nombre,
        cue: i.cue,
        departamento: i.departamento,
        nivel_educativo: i.nivel_educativo
      })),
      zonas
    });
  } catch (err) {
    console.error("Error al cargar zonas por edificio:", err);
    res.status(500).json({ error: "No se pudieron cargar las zonas" });
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
    await ensureTables();

    const validation = await validateZonePayload({ req, ...req.body });
    if (validation.error) {
      return res.status(validation.status).json({ error: validation.error });
    }

    const { nivelColumn, zoneName, departamentoFinal, requestedLevel, institutionIds } = validation;
    const result = await run(
      `INSERT INTO zona (name, nivel_educativo, departamento, director_area_id, activo, created_at)
       VALUES (?, ?, ?, ?, TRUE, NOW())
       RETURNING id`,
      [zoneName, requestedLevel, departamentoFinal, req.user.sub]
    );

    const zonaId = result.lastID || result.rows?.[0]?.id || null;
    if (!zonaId) {
      return res.status(500).json({ error: "No se pudo obtener el id de la zona creada" });
    }

    await replaceZoneInstitutions(zonaId, institutionIds);
    const zone = await getDirectorAreaZoneById(req.user.sub, zonaId, nivelColumn);

    return res.status(201).json({ id: zonaId, zone });
  } catch (err) {
    console.error("Error al crear zona:", err);
    return res.status(500).json({ error: "Error al crear zona" });
  }
});

router.patch("/zonas/:zonaId", async (req, res) => {
  try {
    await ensureTables();

    const parsedZoneId = Number.parseInt(req.params.zonaId, 10);
    const zona = await get(
      `SELECT id
       FROM zona
       WHERE id = ? AND director_area_id = ?`,
      [parsedZoneId, req.user.sub]
    );

    if (!zona) {
      return res.status(404).json({ error: "Zona no encontrada o no autorizada" });
    }

    const validation = await validateZonePayload({ req, ...req.body, currentZoneId: parsedZoneId });
    if (validation.error) {
      return res.status(validation.status).json({ error: validation.error });
    }

    const { nivelColumn, zoneName, departamentoFinal, requestedLevel, institutionIds } = validation;

    await run(
      `UPDATE zona
       SET name = ?, departamento = ?, nivel_educativo = ?
       WHERE id = ? AND director_area_id = ?`,
      [zoneName, departamentoFinal, requestedLevel, parsedZoneId, req.user.sub]
    );

    await replaceZoneInstitutions(parsedZoneId, institutionIds);
    const zone = await getDirectorAreaZoneById(req.user.sub, parsedZoneId, nivelColumn);

    return res.json({ ok: true, zone });
  } catch (err) {
    console.error("Error al editar zona:", err);
    return res.status(500).json({ error: "Error al editar zona" });
  }
});

router.delete("/zonas/:zonaId", async (req, res) => {
  try {
    await ensureTables();

    const parsedZoneId = Number.parseInt(req.params.zonaId, 10);
    const zona = await get(
      `SELECT id
       FROM zona
       WHERE id = ? AND director_area_id = ?`,
      [parsedZoneId, req.user.sub]
    );

    if (!zona) {
      return res.status(404).json({ error: "Zona no encontrada o no autorizada" });
    }

    await run("DELETE FROM zona WHERE id = ? AND director_area_id = ?", [parsedZoneId, req.user.sub]);
    return res.json({ ok: true, id: parsedZoneId });
  } catch (err) {
    console.error("Error al eliminar zona:", err);
    return res.status(500).json({ error: "Error al eliminar zona" });
  }
});

router.post("/zonas/:zonaId/supervisores", async (req, res) => {
  try {
    await ensureTables();

    const { supervisorId, supervisorIds } = req.body;
    const parsedZoneId = Number.parseInt(req.params.zonaId, 10);
    const uniqueSupervisorIds = toPositiveIntArray(supervisorId ? [supervisorId] : supervisorIds);

    const zona = await get(
      `SELECT id, director_area_id, nivel_educativo
       FROM zona
       WHERE id = ? AND director_area_id = ?`,
      [parsedZoneId, req.user.sub]
    );

    if (!zona) {
      return res.status(404).json({ error: "Zona no encontrada o no autorizada" });
    }

    if (uniqueSupervisorIds.length === 0) {
      return res.status(400).json({ error: "Faltan supervisorIds" });
    }

    const supervisores = await all(
      `SELECT id_usuario AS id, role, activo, nivel_educativo, director_area_id
       FROM usuario
       WHERE id_usuario = ANY($1::int[])`,
      [uniqueSupervisorIds]
    );

    if (supervisores.length !== uniqueSupervisorIds.length) {
      return res.status(400).json({ error: "Uno o mas supervisores no son validos" });
    }

    for (const supervisor of supervisores) {
      if (
        supervisor.role !== "supervisor" ||
        supervisor.activo !== true ||
        supervisor.director_area_id !== req.user.sub ||
        normalizeLevel(supervisor.nivel_educativo) !== normalizeLevel(zona.nivel_educativo)
      ) {
        return res.status(400).json({ error: "Solo puedes asignar supervisores activos de tu nivel y direccion de area" });
      }
    }

    await replaceZoneSupervisors(parsedZoneId, uniqueSupervisorIds);
    const zone = await getDirectorAreaZoneById(req.user.sub, parsedZoneId, await getInstitucionNivelColumn());

    return res.json({ ok: true, zone });
  } catch (err) {
    console.error("Error al asignar supervisores:", err);
    return res.status(500).json({ error: "Error al asignar supervisores" });
  }
});

module.exports = router;
