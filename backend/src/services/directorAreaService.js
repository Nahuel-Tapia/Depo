const { all, get, run } = require("../db.pg");
const { columnExists } = require("../utils/schemaCache");

async function getInstitucionNivelColumn() {
  const row = await get(`
    SELECT CASE
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'institucion' AND column_name = 'direccion_area'
      ) THEN 'direccion_area'
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

async function getDirectorAreaLevel(user, directorAreaActingId) {
  const tokenLevel = normalizeText(user?.nivel_educativo || user?.nivel);
  if (tokenLevel) return tokenLevel;
  const acting = Number(directorAreaActingId);
  if (Number.isFinite(acting) && acting > 0) {
    return getDirectorAreaNivel(acting);
  }
  return getDirectorAreaNivel(user?.sub);
}

async function getZoneInstituciones(zonaId, nivelColumn) {
  const departamentoSql = await getDepartamentoSql();

  return all(
    `SELECT i.id_institucion AS id,
            i.nombre,
            i.cue,
            i.${nivelColumn} AS nivel_educativo,
            ${departamentoSql.expression} AS departamento
     FROM zona_institucion zi
     JOIN institucion i ON i.id_institucion = zi.institucion_id
     JOIN edificio e ON i.id_edificio = e.id_edificio
     ${departamentoSql.joins}
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

async function validateZonePayload({ user, directorAreaActingId, name, departamento, nivel_educativo, institucionIds, currentZoneId = null }) {
  const nivelColumn = await getInstitucionNivelColumn();
  const directorNivel = await getDirectorAreaLevel(user, directorAreaActingId);
  const zoneName = normalizeText(name);
  const departamentoFinal = normalizeText(departamento);
  const requestedLevel = normalizeText(nivel_educativo);
  const institutionIds = toPositiveIntArray(institucionIds);

  if (!nivelColumn) {
    throw { status: 500, message: "No se encontro la columna de nivel educativo en instituciones" };
  }
  if (!directorNivel) {
    throw { status: 400, message: "El Director de Area no tiene nivel educativo configurado" };
  }
  if (!zoneName || !requestedLevel) {
    throw { status: 400, message: "Faltan datos requeridos" };
  }
  if (normalizeLevel(requestedLevel) !== normalizeLevel(directorNivel)) {
    throw { status: 400, message: "El nivel no coincide con el suyo" };
  }
  if (institutionIds.length === 0) {
    throw { status: 400, message: "Debe seleccionar al menos una institucion" };
  }

  const instituciones = await all(
    `SELECT i.id_institucion AS id,
            i.nombre,
            i.${nivelColumn} AS nivel_educativo
     FROM institucion i
     WHERE i.id_institucion = ANY($1::int[])
       AND i.activo = TRUE`,
    [institutionIds]
  );

  if (instituciones.length !== institutionIds.length) {
    throw { status: 400, message: "Una o mas instituciones seleccionadas no son validas" };
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
    [institutionIds, directorAreaActingId, currentZoneId]
  );

  if (conflictingAssignments.length > 0) {
    const conflictingZoneNames = [...new Set(conflictingAssignments.map((row) => row.zona_name || `Zona ${row.zona_id}`))];
    throw {
      status: 400,
      message: `Hay instituciones que ya pertenecen a otra zona: ${conflictingZoneNames.join(", ")}`
    };
  }

  for (const institucion of instituciones) {
    if (normalizeLevel(institucion.nivel_educativo) !== normalizeLevel(directorNivel)) {
      throw { status: 400, message: `La institucion ${institucion.id} debe ser del mismo nivel educativo` };
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

async function syncSupervisorAssignmentsForDirector(directorAreaId) {
  await run("DELETE FROM supervisor_escuela_asignacion WHERE director_area_id = ?", [directorAreaId]);

  await run(
    `INSERT INTO supervisor_escuela_asignacion (supervisor_id, institucion_id, director_area_id, created_at)
     SELECT DISTINCT
            zs.supervisor_id,
            zi.institucion_id,
            z.director_area_id,
            NOW()
     FROM zona z
     JOIN zona_supervisor zs ON zs.zona_id = z.id
     JOIN zona_institucion zi ON zi.zona_id = z.id
     WHERE z.director_area_id = ?
       AND z.activo = TRUE`,
    [directorAreaId]
  );

  const supervisors = await all(
    `SELECT id_usuario AS id
     FROM usuario
     WHERE role = 'supervisor'
       AND director_area_id = ?`,
    [directorAreaId]
  );

  if (supervisors.length === 0) return;

  const departamentoSql = await getDepartamentoSql();
  const zoneAssignments = await all(
    `SELECT zs.supervisor_id,
            ${departamentoSql.expression} AS departamento
     FROM zona z
     JOIN zona_supervisor zs ON zs.zona_id = z.id
     JOIN zona_institucion zi ON zi.zona_id = z.id
     JOIN institucion i ON i.id_institucion = zi.institucion_id
     JOIN edificio e ON i.id_edificio = e.id_edificio
     ${departamentoSql.joins}
     WHERE z.director_area_id = ?
       AND z.activo = TRUE`,
    [directorAreaId]
  );

  const jurisdictionBySupervisor = new Map();
  for (const assignment of zoneAssignments) {
    const supervisorId = Number(assignment.supervisor_id);
    const departamento = normalizeText(assignment.departamento);
    if (!supervisorId || !departamento) continue;

    if (!jurisdictionBySupervisor.has(supervisorId)) {
      jurisdictionBySupervisor.set(supervisorId, new Set());
    }
    jurisdictionBySupervisor.get(supervisorId).add(departamento);
  }

  for (const supervisor of supervisors) {
    // Sync complete
  }
}

async function ensureTables() {
  // Centralized in schemaManager.js
}

async function getCatalogo(user, directorAreaActingId) {
  await ensureTables();
  const nivelColumn = await getInstitucionNivelColumn();
  const directorNivel = await getDirectorAreaLevel(user, directorAreaActingId);

  if (!nivelColumn) {
    throw { status: 500, message: "No se encontro la columna de nivel educativo en instituciones" };
  }

  if (!directorNivel) {
    return {
      supervisores: [],
      escuelas: [],
      nivel_educativo: null
    };
  }

  const supervisores = await all(
    `SELECT id_usuario AS id, nombre, apellido, email, nivel_educativo, director_area_id
     FROM usuario
     WHERE role = 'supervisor'
       AND activo = TRUE
       AND LOWER(COALESCE(nivel_educativo, '')) = LOWER($2)
       AND director_area_id = $1
     ORDER BY nombre, apellido`,
    [directorAreaActingId, directorNivel]
  );

  const escuelas = await all(
    `SELECT id_institucion AS id, nombre, cue, ${nivelColumn} AS nivel
     FROM institucion
     WHERE activo = TRUE
       AND LOWER(COALESCE(${nivelColumn}, '')) = LOWER($1)
     ORDER BY nombre`,
    [directorNivel]
  );

  return { supervisores, escuelas, nivel_educativo: directorNivel };
}

async function getAsignaciones(directorAreaActingId) {
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
    [directorAreaActingId]
  );

  return { asignaciones };
}

async function deleteAsignacion(id, directorAreaActingId) {
  await ensureTables();
  await run("DELETE FROM supervisor_escuela_asignacion WHERE id = $1 AND director_area_id = $2", [id, directorAreaActingId]);
  return { ok: true };
}

async function asignar(user, directorAreaActingId, supervisorId, institucionId) {
  await ensureTables();

  if (!supervisorId || !institucionId) {
    throw { status: 400, message: "Faltan datos requeridos" };
  }

  const nivelColumn = await getInstitucionNivelColumn();
  const directorNivel = await getDirectorAreaLevel(user, directorAreaActingId);

  if (!nivelColumn) {
    throw { status: 500, message: "No se encontro la columna de nivel educativo en instituciones" };
  }

  if (!directorNivel) {
    throw { status: 400, message: "El Director de Area no tiene un nivel educativo configurado" };
  }

  const supervisor = await get(
    `SELECT id_usuario, nivel_educativo
     FROM usuario
     WHERE id_usuario = $1 AND role = 'supervisor' AND activo = TRUE`,
    [supervisorId]
  );
  if (!supervisor) {
    throw { status: 400, message: "Supervisor no valido" };
  }
  if ((supervisor.nivel_educativo || "").toLowerCase() !== directorNivel.toLowerCase()) {
    throw { status: 400, message: "El supervisor debe ser del mismo nivel educativo" };
  }

  const institucion = await get(
    `SELECT id_institucion, ${nivelColumn} AS nivel
     FROM institucion
     WHERE id_institucion = $1 AND activo = TRUE`,
    [institucionId]
  );
  if (!institucion) {
    throw { status: 400, message: "Institucion no valida" };
  }
  if ((institucion.nivel || "").toLowerCase() !== directorNivel.toLowerCase()) {
    throw { status: 400, message: "La institucion debe ser del mismo nivel educativo" };
  }

  await run(
    `INSERT INTO supervisor_escuela_asignacion (supervisor_id, institucion_id, director_area_id)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [supervisorId, institucionId, directorAreaActingId]
  );

  return { ok: true };
}

async function desasignar(supervisorId, institucionId, directorAreaActingId) {
  await ensureTables();

  if (!supervisorId || !institucionId) {
    throw { status: 400, message: "Faltan datos requeridos" };
  }

  await run(
    "DELETE FROM supervisor_escuela_asignacion WHERE supervisor_id = $1 AND institucion_id = $2 AND director_area_id = $3",
    [supervisorId, institucionId, directorAreaActingId]
  );

  return { ok: true };
}

async function getSupervisores(user, directorAreaActingId) {
  const directorNivel = await getDirectorAreaLevel(user, directorAreaActingId);

  if (!directorNivel) {
    throw { status: 400, message: "El Director de Area no tiene un nivel educativo configurado" };
  }

  const supervisores = await all(
    `SELECT id_usuario AS id, nombre, apellido, email, nivel_educativo
     FROM usuario
     WHERE role = 'supervisor'
       AND activo = TRUE
       AND LOWER(COALESCE(nivel_educativo, '')) = LOWER($1)
       AND director_area_id = $2
     ORDER BY nombre, apellido`,
    [directorNivel, directorAreaActingId]
  );

  return { supervisores };
}

async function createSupervisor({ user, directorAreaActingId }, { nombre, apellido, email, dni, password }) {
  const directorNivel = await getDirectorAreaLevel(user, directorAreaActingId);

  if (!nombre || !apellido || !email || !dni || !password) {
    throw { status: 400, message: "Faltan datos requeridos" };
  }
  if (!directorNivel) {
    throw { status: 400, message: "El Director de Area no tiene un nivel educativo configurado" };
  }

  const bcrypt = require("bcryptjs");
  const hash = await bcrypt.hash(password, 10);

  try {
    const result = await run(
      `INSERT INTO usuario (nombre, apellido, email, dni, password, role, activo, nivel_educativo, director_area_id)
       VALUES ($1, $2, $3, $4, $5, 'supervisor', TRUE, $6, $7)
       RETURNING id_usuario`,
      [nombre, apellido, email, dni, hash, directorNivel, directorAreaActingId]
    );

    return { id: result.lastID, nombre, apellido, email, role: "supervisor" };
  } catch (err) {
    console.error("Error al crear supervisor en el servicio:", err);
    const msg = (err?.message || '').toLowerCase();
    if (msg.includes('unique') || msg.includes('duplicate')) {
      throw { status: 400, message: "Ya existe un supervisor con esos datos" };
    }
    throw err;
  }
}

async function getEdificios(directorAreaActingId) {
  await ensureTables();

  const nivelColumn = await getInstitucionNivelColumn();
  const directorNivel = await getDirectorAreaNivel(directorAreaActingId);

  if (!nivelColumn) {
    throw { status: 500, message: "No se encontro la columna de nivel educativo en instituciones" };
  }
  if (!directorNivel) {
    throw { status: 400, message: "El Director de Area no tiene un nivel educativo configurado" };
  }

  const departamentoSql = await getDepartamentoSql();
  if (!departamentoSql.hasDepartamento) {
    return { edificios: [], nivel_educativo: directorNivel };
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

  return { edificios, nivel_educativo: directorNivel };
}

async function getInstitucionesDelEdificio(directorAreaActingId, edificioId) {
  await ensureTables();

  const nivelColumn = await getInstitucionNivelColumn();
  const directorNivel = await getDirectorAreaNivel(directorAreaActingId);

  if (!nivelColumn) {
    throw { status: 500, message: "No se encontro la columna de nivel educativo" };
  }
  if (!directorNivel) {
    throw { status: 400, message: "El Director de Area no tiene un nivel educativo configurado" };
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

  return { instituciones };
}

async function getZonasEdificio(user, directorAreaActingId) {
  await ensureTables();
  const nivelColumn = await getInstitucionNivelColumn();
  const directorNivel = await getDirectorAreaLevel(user, directorAreaActingId);

  if (!nivelColumn) {
    throw { status: 500, message: "No se encontro la columna de nivel educativo en instituciones" };
  }

  if (!directorNivel) {
    return {
      departamentos: [],
      nivel_educativo: null,
      instituciones: [],
      zonas: [],
      warning: "El Director de Area no tiene nivel educativo configurado"
    };
  }
  const departamentoSql = await getDepartamentoSql();
  if (!departamentoSql.hasDepartamento) {
    const zonas = await getDirectorAreaZones(directorAreaActingId, nivelColumn);
    return {
      departamentos: [],
      nivel_educativo: directorNivel,
      instituciones: [],
      zonas
    };
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

  const zonas = await getDirectorAreaZones(directorAreaActingId, nivelColumn);

  const deptos = Array.from(
    new Set(
      institucionesResult
        .map((row) => String(row.departamento || '').trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, 'es'));

  return {
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
  };
}

async function getInformes() {
  await ensureTables();
  return { informes: [] };
}

async function getSolicitudes(directorAreaActingId) {
  await ensureTables();
  const solicitudes = await all(`
    SELECT p.id_pedido AS id,
           p.fecha_creacion AS fecha,
           p.estado,
           p.observaciones_generales AS notas,
           i.nombre AS institucion,
           i.id_institucion AS institucion_id,
           u.nombre AS solicitante,
           COALESCE(
             p.kit_nombre,
             STRING_AGG(pr.nombre || ' x' || dp.cantidad_solicitada::text, ', ' ORDER BY pr.nombre)
           ) AS producto,
           COALESCE(
             JSON_AGG(
               JSON_BUILD_OBJECT('producto', pr.nombre, 'cantidad', dp.cantidad_solicitada)
               ORDER BY pr.nombre
             ) FILTER (WHERE pr.id_producto IS NOT NULL),
             '[]'::json
           ) AS items
    FROM pedido p
    JOIN institucion i ON i.id_institucion = p.id_institucion
    JOIN zona_institucion zi ON zi.institucion_id = i.id_institucion
    JOIN zona z ON z.id = zi.zona_id
    LEFT JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
    LEFT JOIN producto pr ON pr.id_producto = dp.id_producto
    LEFT JOIN usuario u ON u.id_usuario = p.id_usuario_solicitante
    WHERE z.director_area_id = ? AND z.activo = TRUE
    GROUP BY p.id_pedido, i.nombre, i.id_institucion, u.nombre
    ORDER BY p.fecha_creacion DESC
  `, [directorAreaActingId]);

  return { solicitudes };
}

async function createZona(user, directorAreaActingId, body) {
  await ensureTables();

  const validation = await validateZonePayload({ user, directorAreaActingId, ...body });
  const { nivelColumn, zoneName, departamentoFinal, requestedLevel, institutionIds } = validation;

  const result = await run(
    `INSERT INTO zona (name, nivel_educativo, departamento, director_area_id, activo, created_at)
     VALUES (?, ?, ?, ?, TRUE, NOW())
     RETURNING id`,
    [zoneName, requestedLevel, departamentoFinal, directorAreaActingId]
  );

  const zonaId = result.lastID || result.rows?.[0]?.id || null;
  if (!zonaId) {
    throw { status: 500, message: "No se pudo obtener el id de la zona creada" };
  }

  await replaceZoneInstitutions(zonaId, institutionIds);
  const zone = await getDirectorAreaZoneById(directorAreaActingId, zonaId, nivelColumn);

  return { id: zonaId, zone };
}

async function updateZona(user, directorAreaActingId, zonaId, body) {
  await ensureTables();

  const parsedZoneId = Number.parseInt(zonaId, 10);
  const zona = await get(
    `SELECT id
     FROM zona
     WHERE id = ? AND director_area_id = ?`,
    [parsedZoneId, directorAreaActingId]
  );

  if (!zona) {
    throw { status: 404, message: "Zona no encontrada o no autorizada" };
  }

  const validation = await validateZonePayload({ user, directorAreaActingId, ...body, currentZoneId: parsedZoneId });
  const { nivelColumn, zoneName, departamentoFinal, requestedLevel, institutionIds } = validation;

  await run(
    `UPDATE zona
     SET name = ?, departamento = ?, nivel_educativo = ?
     WHERE id = ? AND director_area_id = ?`,
    [zoneName, departamentoFinal, requestedLevel, parsedZoneId, directorAreaActingId]
  );

  await replaceZoneInstitutions(parsedZoneId, institutionIds);
  await syncSupervisorAssignmentsForDirector(directorAreaActingId);
  const zone = await getDirectorAreaZoneById(directorAreaActingId, parsedZoneId, nivelColumn);

  return { ok: true, zone };
}

async function deleteZona(directorAreaActingId, zonaId) {
  await ensureTables();

  const parsedZoneId = Number.parseInt(zonaId, 10);
  const zona = await get(
    `SELECT id
     FROM zona
     WHERE id = ? AND director_area_id = ?`,
    [parsedZoneId, directorAreaActingId]
  );

  if (!zona) {
    throw { status: 404, message: "Zona no encontrada o no autorizada" };
  }

  await run("DELETE FROM zona WHERE id = ? AND director_area_id = ?", [parsedZoneId, directorAreaActingId]);
  await syncSupervisorAssignmentsForDirector(directorAreaActingId);
  return { ok: true, id: parsedZoneId };
}

async function assignSupervisoresZona(directorAreaActingId, zonaId, body) {
  await ensureTables();

  const { supervisorId, supervisorIds } = body;
  const parsedZoneId = Number.parseInt(zonaId, 10);
  const uniqueSupervisorIds = toPositiveIntArray(supervisorId ? [supervisorId] : supervisorIds);

  const zona = await get(
    `SELECT id, director_area_id, nivel_educativo
     FROM zona
     WHERE id = ? AND director_area_id = ?`,
    [parsedZoneId, directorAreaActingId]
  );

  if (!zona) {
    throw { status: 404, message: "Zona no encontrada o no autorizada" };
  }

  if (uniqueSupervisorIds.length === 0) {
    throw { status: 400, message: "Faltan supervisorIds" };
  }

  const supervisores = await all(
    `SELECT id_usuario AS id, role, activo, nivel_educativo, director_area_id
     FROM usuario
     WHERE id_usuario = ANY($1::int[])`,
    [uniqueSupervisorIds]
  );

  if (supervisores.length !== uniqueSupervisorIds.length) {
    throw { status: 400, message: "Uno o mas supervisores no son validos" };
  }

  for (const supervisor of supervisores) {
    if (
      supervisor.role !== "supervisor" ||
      supervisor.activo !== true ||
      supervisor.director_area_id !== directorAreaActingId ||
      normalizeLevel(supervisor.nivel_educativo) !== normalizeLevel(zona.nivel_educativo)
    ) {
      throw { status: 400, message: "Solo puedes asignar supervisores activos de tu nivel y direccion de area" };
    }
  }

  await replaceZoneSupervisors(parsedZoneId, uniqueSupervisorIds);
  await syncSupervisorAssignmentsForDirector(directorAreaActingId);
  const zone = await getDirectorAreaZoneById(directorAreaActingId, parsedZoneId, await getInstitucionNivelColumn());

  return { ok: true, zone };
}

async function getDirectorAreaUser(id) {
  return get(
    `SELECT id_usuario
     FROM usuario
     WHERE id_usuario = ? AND role = 'director_area' AND (activo IS NULL OR activo = TRUE)`,
    [id]
  );
}

async function getFirstDirectorAreaUser() {
  return get(
    `SELECT id_usuario
     FROM usuario
     WHERE role = 'director_area' AND (activo IS NULL OR activo = TRUE)
     ORDER BY id_usuario ASC
     LIMIT 1`
  );
}

module.exports = {
  getCatalogo,
  getAsignaciones,
  deleteAsignacion,
  asignar,
  desasignar,
  getSupervisores,
  createSupervisor,
  getEdificios,
  getInstitucionesDelEdificio,
  getZonasEdificio,
  getInformes,
  getSolicitudes,
  createZona,
  updateZona,
  deleteZona,
  assignSupervisoresZona,
  getDirectorAreaUser,
  getFirstDirectorAreaUser
};

