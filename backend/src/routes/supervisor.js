// ============================================================
// RUTA: /api/supervisor
// Endpoints para el dashboard del Supervisor.
// Resuelve las escuelas asignadas desde zonas y mantiene
// compatibilidad con la tabla legacy supervisor_escuela_asignacion.
// ============================================================
const express = require("express");
const { all, get, run } = require("../db.pg");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

async function hasTable(tableName) {
  const row = await get(`SELECT to_regclass($1) AS regclass`, [tableName]);
  return Boolean(row?.regclass);
}

async function hasAsignacionesTable() {
  return hasTable("public.supervisor_escuela_asignacion");
}

async function hasZoneAssignmentTables() {
  const rows = await all(
    `SELECT to_regclass(name) AS regclass
     FROM unnest($1::text[]) AS name`,
    [["public.zona", "public.zona_institucion", "public.zona_supervisor"]]
  );

  return rows.length === 3 && rows.every((row) => Boolean(row?.regclass));
}

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
    joins: joins.join("\n")
  };
}

function normalizeText(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function uniqueTexts(values = []) {
  return [...new Set(values.map(normalizeText).filter(Boolean))];
}

function getZoneDisplayLabel(zone) {
  const zoneName = normalizeText(zone?.name || zone?.zona_nombre);
  if (zoneName) return zoneName;

  const zoneId = Number.parseInt(zone?.id ?? zone?.zona_id, 10);
  return Number.isInteger(zoneId) && zoneId > 0 ? `Zona ${zoneId}` : null;
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
    await run(`
      ALTER TABLE pedido
      ADD COLUMN IF NOT EXISTS motivo_supervisor TEXT
    `);
    await run(`
      ALTER TABLE pedido
      ADD COLUMN IF NOT EXISTS respuesta_supervisor_tipo VARCHAR(30)
    `);
    schemaReady = true;
  })();

  try {
    await schemaPromise;
  } finally {
    schemaPromise = null;
  }
}

async function getSupervisorZoneContext(supervisorId) {
  if (!(await hasZoneAssignmentTables())) {
    return { zonas: [], departamentos: [], jurisdiccion: null };
  }

  const departamentoSql = await getDepartamentoSql();
  const zoneRows = await all(
    `SELECT z.id,
            z.name,
            ${departamentoSql.expression} AS departamento
     FROM zona_supervisor zs
     JOIN zona z ON z.id = zs.zona_id
     LEFT JOIN zona_institucion zi ON zi.zona_id = z.id
     LEFT JOIN institucion i ON i.id_institucion = zi.institucion_id
     LEFT JOIN edificio e ON i.id_edificio = e.id_edificio
     ${departamentoSql.joins}
     WHERE zs.supervisor_id = $1
       AND z.activo = TRUE
     ORDER BY z.created_at DESC, z.id DESC`,
    [supervisorId]
  );

  const zonesById = new Map();
  for (const row of zoneRows) {
    const zoneId = Number(row.id);
    if (!zonesById.has(zoneId)) {
      zonesById.set(zoneId, {
        id: zoneId,
        name: row.name,
        departamentos: new Set()
      });
    }

    const departamento = normalizeText(row.departamento);
    if (departamento) {
      zonesById.get(zoneId).departamentos.add(departamento);
    }
  }

  const zonas = [...zonesById.values()].map((zona) => {
    const departamentos = [...zona.departamentos].sort((a, b) => a.localeCompare(b, "es"));
    return {
      id: zona.id,
      name: zona.name,
      departamento: departamentos[0] || null,
      departamentos
    };
  });

  const departamentos = uniqueTexts(zonas.flatMap((zona) => zona.departamentos || []))
    .sort((a, b) => a.localeCompare(b, "es"));

  return {
    zonas,
    departamentos,
    jurisdiccion: departamentos.join(", ") || null
  };
}

async function getSupervisorInstitucionesFromZones(supervisorId) {
  if (!(await hasZoneAssignmentTables())) return [];

  const nivelColumn = await getInstitucionNivelColumn();
  const levelSelect = nivelColumn ? `i.${nivelColumn} AS nivel` : "NULL::text AS nivel";
  const departamentoSql = await getDepartamentoSql();

  return all(
    `SELECT DISTINCT ON (i.id_institucion)
            i.id_institucion AS id,
            i.nombre,
            i.cue,
            ${departamentoSql.expression} AS departamento,
            ${levelSelect},
            COALESCE(i.tipo_escuela, 'normal') AS tipo_escuela,
            i.kit_id,
            k.nombre AS kit_nombre,
            i.ambito AS tipo,
            i.categoria,
            z.id AS zona_id,
            z.name AS zona_nombre
     FROM zona_supervisor zs
     JOIN zona z ON z.id = zs.zona_id
     JOIN zona_institucion zi ON zi.zona_id = z.id
     JOIN institucion i ON i.id_institucion = zi.institucion_id
     LEFT JOIN edificio e ON i.id_edificio = e.id_edificio
     ${departamentoSql.joins}
     LEFT JOIN producto_kit k ON k.id = i.kit_id
     WHERE zs.supervisor_id = $1
       AND z.activo = TRUE
     ORDER BY i.id_institucion, z.created_at DESC, z.id DESC, i.nombre`,
    [supervisorId]
  );
}

async function getSupervisorLegacyInstituciones(supervisorId) {
  if (!(await hasAsignacionesTable())) return [];

  const nivelColumn = await getInstitucionNivelColumn();
  const levelSelect = nivelColumn ? `i.${nivelColumn} AS nivel` : "NULL::text AS nivel";
  const departamentoSql = await getDepartamentoSql();

  return all(
    `SELECT DISTINCT
            i.id_institucion AS id,
            i.nombre,
            i.cue,
            ${departamentoSql.expression} AS departamento,
            ${levelSelect},
            COALESCE(i.tipo_escuela, 'normal') AS tipo_escuela,
            i.kit_id,
            k.nombre AS kit_nombre,
            i.ambito AS tipo,
            i.categoria
     FROM supervisor_escuela_asignacion sea
     JOIN institucion i ON i.id_institucion = sea.institucion_id
     LEFT JOIN edificio e ON i.id_edificio = e.id_edificio
     ${departamentoSql.joins}
     LEFT JOIN producto_kit k ON k.id = i.kit_id
     WHERE sea.supervisor_id = $1
     ORDER BY i.nombre`,
    [supervisorId]
  );
}

function buildSupervisorMeta({ zoneContext, instituciones, fallbackJurisdiction = null, supervisorLevel = null }) {
  const departamentos = zoneContext.departamentos.length > 0
    ? zoneContext.departamentos
    : uniqueTexts(instituciones.map((institucion) => institucion.departamento));

  const zoneNames = uniqueTexts([
    ...zoneContext.zonas.map((zona) => getZoneDisplayLabel(zona)),
    ...instituciones.map((institucion) => getZoneDisplayLabel(institucion))
  ]);
  const jurisdiccion = departamentos.join(", ") || normalizeText(fallbackJurisdiction);
  const inferredLevel = normalizeText(supervisorLevel) || uniqueTexts(instituciones.map((institucion) => institucion.nivel))[0] || null;

  return {
    jurisdiccion: jurisdiccion || null,
    jurisdicciones: departamentos,
    departamento_label: jurisdiccion || null,
    departamentos,
    zonas: zoneContext.zonas,
    zona_label: zoneNames.join(", ") || null,
    zona_count: zoneContext.zonas.length,
    nivel_educativo: inferredLevel,
    totalEscuelas: instituciones.length
  };
}

async function getSupervisorAssignmentSnapshot(supervisorId, { fallbackJurisdiction = null, supervisorLevel = null } = {}) {
  const zoneContext = await getSupervisorZoneContext(supervisorId);
  const zoneInstituciones = await getSupervisorInstitucionesFromZones(supervisorId);

  if (zoneInstituciones.length > 0 || zoneContext.zonas.length > 0) {
    return {
      instituciones: zoneInstituciones,
      meta: buildSupervisorMeta({ zoneContext, instituciones: zoneInstituciones, fallbackJurisdiction, supervisorLevel }),
      source: "zona"
    };
  }

  const legacyInstituciones = await getSupervisorLegacyInstituciones(supervisorId);
  return {
    instituciones: legacyInstituciones,
    meta: buildSupervisorMeta({ zoneContext, instituciones: legacyInstituciones, fallbackJurisdiction, supervisorLevel }),
    source: "legacy"
  };
}

async function getSupervisorAssignedInstitutionIds(supervisorId, fallbackJurisdiction = null, supervisorLevel = null) {
  const snapshot = await getSupervisorAssignmentSnapshot(supervisorId, { fallbackJurisdiction, supervisorLevel });
  return [...new Set(
    snapshot.instituciones
      .map((institucion) => Number.parseInt(institucion.id, 10))
      .filter((institucionId) => Number.isInteger(institucionId) && institucionId > 0)
  )];
}

async function supervisorHasAssignedInstitution(supervisorId, institucionId) {
  const parsedInstitucionId = Number.parseInt(institucionId, 10);
  if (!Number.isInteger(parsedInstitucionId) || parsedInstitucionId <= 0) {
    return false;
  }

  if (await hasZoneAssignmentTables()) {
    const zoneAssignment = await get(
      `SELECT 1
       FROM zona_supervisor zs
       JOIN zona z ON z.id = zs.zona_id
       JOIN zona_institucion zi ON zi.zona_id = z.id
       WHERE zs.supervisor_id = $1
         AND zi.institucion_id = $2
         AND z.activo = TRUE
       LIMIT 1`,
      [supervisorId, parsedInstitucionId]
    );

    if (zoneAssignment) {
      return true;
    }
  }

  if (!(await hasAsignacionesTable())) {
    return false;
  }

  const legacyAssignment = await get(
    `SELECT 1
     FROM supervisor_escuela_asignacion
     WHERE supervisor_id = $1
       AND institucion_id = $2
     LIMIT 1`,
    [supervisorId, parsedInstitucionId]
  );

  return Boolean(legacyAssignment);
}

// ── Instituciones asignadas al supervisor ──
router.get("/instituciones", async (req, res) => {
  try {
    await ensureSupervisorSchema();

    if (req.user?.role === "supervisor") {
      const snapshot = await getSupervisorAssignmentSnapshot(req.user.sub, {
        fallbackJurisdiction: req.user.jurisdiccion,
        supervisorLevel: req.user.nivel_educativo
      });
      if (snapshot.meta?.jurisdiccion !== normalizeText(req.user.jurisdiccion)) {
        await run(
          `UPDATE usuario
           SET jurisdiccion = ?
           WHERE id_usuario = ?`,
          [snapshot.meta?.jurisdiccion || null, req.user.sub]
        );
      }
      return res.json({ instituciones: snapshot.instituciones, meta: snapshot.meta });
    }

    const jurisdiccion = req.query.jurisdiccion || req.user.jurisdiccion;

    if (!jurisdiccion) {
      return res.status(400).json({ error: "Jurisdicción no especificada" });
    }

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

    const institucionId = Number(req.params.id);
    const kitId = Number(req.body?.kit_id);

    if (!Number.isInteger(institucionId) || institucionId <= 0) {
      return res.status(400).json({ error: "Institución inválida." });
    }
    if (!Number.isInteger(kitId) || kitId <= 0) {
      return res.status(400).json({ error: "Kit inválido." });
    }

    if (!(await supervisorHasAssignedInstitution(req.user.sub, institucionId))) {
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

// ── Pedidos pendientes de las escuelas del supervisor ──
router.get("/pedidos-pendientes", async (req, res) => {
  try {
    await ensureSupervisorSchema();

    if (req.user?.role === "supervisor") {
      const institutionIds = await getSupervisorAssignedInstitutionIds(
        req.user.sub,
        req.user.jurisdiccion,
        req.user.nivel_educativo
      );
      if (institutionIds.length === 0) {
        return res.json({ pedidos: [] });
      }

      const pedidos = await all(
        `SELECT p.id_pedido AS id,
                COALESCE(p.kit_cantidad, SUM(dp.cantidad_solicitada)) AS cantidad,
                p.observaciones_generales AS notas,
                p.motivo_supervisor,
                p.respuesta_supervisor_tipo,
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
         WHERE p.id_institucion = ANY($1::int[])
           AND p.estado = 'pendiente'
           AND COALESCE(p.respuesta_supervisor_tipo, '') <> 'aclaracion'
         GROUP BY p.id_pedido, p.kit_nombre, p.kit_cantidad, p.observaciones_generales, p.motivo_supervisor,
                  p.respuesta_supervisor_tipo, p.estado, p.fecha_creacion, i.nombre, i.id_institucion, u.nombre
         ORDER BY p.fecha_creacion DESC`,
        [institutionIds]
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
              p.motivo_supervisor,
              p.respuesta_supervisor_tipo,
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
         AND COALESCE(p.respuesta_supervisor_tipo, '') <> 'aclaracion'
         AND LOWER(i.jurisdiccion) = LOWER(?)
       GROUP BY p.id_pedido, p.kit_nombre, p.kit_cantidad, p.observaciones_generales, p.motivo_supervisor,
                p.respuesta_supervisor_tipo, p.estado, p.fecha_creacion, i.nombre, i.id_institucion,
                i.matriculados, u.nombre
       ORDER BY p.fecha_creacion DESC`,
      [jurisdiccion]
    );

    res.json({ pedidos });
  } catch (err) {
    console.error("Error al obtener pedidos pendientes del supervisor:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ── Solicitudes de las escuelas del supervisor ──
router.get("/solicitudes", async (req, res) => {
  try {
    await ensureSupervisorSchema();

    if (req.user?.role === "supervisor") {
      const institutionIds = await getSupervisorAssignedInstitutionIds(
        req.user.sub,
        req.user.jurisdiccion,
        req.user.nivel_educativo
      );
      if (institutionIds.length === 0) {
        return res.json({ solicitudes: [] });
      }

      const solicitudes = await all(
        `SELECT p.id_pedido AS id,
                COALESCE(p.kit_cantidad, SUM(dp.cantidad_solicitada)) AS cantidad,
                p.observaciones_generales AS notas,
                p.motivo_supervisor,
                p.respuesta_supervisor_tipo,
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
         WHERE p.id_institucion = ANY($1::int[])
           AND p.estado::text IN ('pendiente', 'aprobado', 'rechazado', 'cancelado', 'entregado', 'finalizado')
         GROUP BY p.id_pedido, p.kit_nombre, p.kit_cantidad, p.observaciones_generales, p.motivo_supervisor,
                  p.respuesta_supervisor_tipo, p.estado, p.fecha_creacion, i.nombre, i.id_institucion, u.nombre
         ORDER BY p.fecha_creacion DESC`,
        [institutionIds]
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
              p.motivo_supervisor,
              p.respuesta_supervisor_tipo,
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
       GROUP BY p.id_pedido, p.kit_nombre, p.kit_cantidad, p.observaciones_generales, p.motivo_supervisor,
                p.respuesta_supervisor_tipo, p.estado, p.fecha_creacion, i.nombre, i.id_institucion,
                i.matriculados, u.nombre
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
