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
  const row = await get(
    `SELECT to_regclass('public.supervisor_escuela_asignacion') AS regclass`
  );
  return Boolean(row?.regclass);
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

async function tableExists(tableName) {
  const row = await get("SELECT to_regclass($1) AS regclass", [`public.${tableName}`]);
  return Boolean(row?.regclass);
}

async function getInstitucionNivelExpr(alias = "i") {
  if (await columnExists("institucion", "nivel_educativo")) return `${alias}.nivel_educativo`;
  if (await columnExists("institucion", "nivel")) return `${alias}.nivel`;
  return "NULL::text";
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

  joins.push("LEFT JOIN edificio e ON i.id_edificio = e.id_edificio");
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

async function getSupervisorAssignedInstitutionIds(supervisorId, jurisdiccion, nivelEducativo) {
  const parsedId = Number.parseInt(supervisorId, 10);
  if (!Number.isInteger(parsedId) || parsedId <= 0) return [];

  const hasZonesTables =
    (await tableExists("zona_supervisor")) && (await tableExists("zona_institucion")) && (await tableExists("zona"));

  if (hasZonesTables) {
    const nivelExpr = await getInstitucionNivelExpr("i");
    const departamentoSql = await getDepartamentoSql();
    const filterNivel = nivelEducativo ? ` AND LOWER(COALESCE(${nivelExpr}, '')) = LOWER($2)` : "";
    const params = [parsedId];
    if (nivelEducativo) params.push(nivelEducativo);

    const rows = await all(
      `SELECT DISTINCT zi.institucion_id AS id
       FROM zona_supervisor zs
       JOIN zona z ON z.id = zs.zona_id
       JOIN zona_institucion zi ON zi.zona_id = z.id
       JOIN institucion i ON i.id_institucion = zi.institucion_id
       ${departamentoSql.joins}
       WHERE zs.supervisor_id = $1
         AND z.activo = TRUE
         AND i.activo = TRUE${filterNivel}`,
      params
    );

    let ids = rows.map((r) => r.id).filter((v) => Number.isInteger(v) && v > 0);

    if (jurisdiccion && departamentoSql.hasDepartamento) {
      const allowed = await all(
        `SELECT DISTINCT i.id_institucion AS id
         FROM institucion i
         ${departamentoSql.joins}
         WHERE i.id_institucion = ANY($1::int[])
           AND LOWER(${departamentoSql.expression}) = LOWER($2)`,
        [ids, jurisdiccion]
      );
      ids = allowed.map((r) => r.id).filter((v) => Number.isInteger(v) && v > 0);
    }

    return [...new Set(ids)];
  }

  if (await hasAsignacionesTable()) {
    const rows = await all(
      `SELECT DISTINCT institucion_id AS id
       FROM supervisor_escuela_asignacion
       WHERE supervisor_id = $1`,
      [parsedId]
    );
    return [...new Set(rows.map((r) => r.id).filter((v) => Number.isInteger(v) && v > 0))];
  }

  return [];
}

async function supervisorHasAssignedInstitution(supervisorId, institucionId) {
  const ids = await getSupervisorAssignedInstitutionIds(supervisorId);
  const parsedInst = Number.parseInt(institucionId, 10);
  return ids.includes(parsedInst);
}

async function getInstitucionSelectSql() {
  const [
    hasTipoEscuela,
    hasKitId,
    hasAmbito,
    hasTipo,
    hasCategoria,
    hasMatriculados,
    hasProductoKit
  ] = await Promise.all([
    columnExists("institucion", "tipo_escuela"),
    columnExists("institucion", "kit_id"),
    columnExists("institucion", "ambito"),
    columnExists("institucion", "tipo"),
    columnExists("institucion", "categoria"),
    columnExists("institucion", "matriculados"),
    tableExists("producto_kit")
  ]);
  const departamentoSql = await getDepartamentoSql();
  const nivelExpr = await getInstitucionNivelExpr();

  return {
    departamentoSql,
    nivelExpr,
    tipoEscuelaExpr: hasTipoEscuela ? "COALESCE(i.tipo_escuela, 'normal')" : "'normal'::text",
    kitIdExpr: hasKitId ? "i.kit_id" : "NULL::int",
    kitJoin: hasKitId && hasProductoKit ? "LEFT JOIN producto_kit k ON k.id = i.kit_id" : "",
    kitNombreExpr: hasKitId && hasProductoKit ? "k.nombre" : "NULL::text",
    tipoExpr: hasAmbito ? "i.ambito" : hasTipo ? "i.tipo" : "NULL::text",
    categoriaExpr: hasCategoria ? "i.categoria" : "NULL::text",
    matriculaExpr: hasMatriculados ? "COALESCE(i.matriculados, 0)" : "0",
    matriculaGroupBy: hasMatriculados ? "i.matriculados" : ""
  };
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
    const productoKitExists = await tableExists("producto_kit");
    await run(`
      ALTER TABLE institucion
      ADD COLUMN IF NOT EXISTS kit_id INT${productoKitExists ? " REFERENCES producto_kit(id)" : ""}
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

// ── Instituciones de la jurisdicción del supervisor ──
router.get("/instituciones", async (req, res) => {
  try {
    await ensureSupervisorSchema();

    if (req.user?.role === "supervisor") {
      if (!(await hasAsignacionesTable())) {
        return res.json({
          instituciones: [],
          meta: {
            zona_label: "",
            zona_count: 0,
            nivel_educativo: req.user?.nivel_educativo || null
          }
        });
      }

      const selectSql = await getInstitucionSelectSql();
      const institucionesAsignadas = await all(
        `SELECT i.id_institucion AS id,
                i.nombre,
                i.cue,
                ${selectSql.departamentoSql.expression} AS departamento,
                ${selectSql.nivelExpr} AS nivel,
                ${selectSql.tipoEscuelaExpr} AS tipo_escuela,
                ${selectSql.kitIdExpr} AS kit_id,
                ${selectSql.kitNombreExpr} AS kit_nombre,
                ${selectSql.tipoExpr} AS tipo,
                ${selectSql.categoriaExpr} AS categoria
         FROM supervisor_escuela_asignacion sea
         JOIN institucion i ON i.id_institucion = sea.institucion_id
         ${selectSql.departamentoSql.joins}
         ${selectSql.kitJoin}
         WHERE sea.supervisor_id = ?
         ORDER BY i.nombre`,
        [req.user.sub]
      );

      let zonaLabel = "";
      let zonaCount = 0;
      const hasZonesTables =
        (await tableExists("zona_supervisor")) && (await tableExists("zona"));

      if (hasZonesTables) {
        const zonas = await all(
          `SELECT DISTINCT z.id, z.name
           FROM zona_supervisor zs
           JOIN zona z ON z.id = zs.zona_id
           WHERE zs.supervisor_id = $1
             AND z.activo = TRUE
           ORDER BY z.name ASC`,
          [req.user.sub]
        );
        zonaCount = zonas.length;
        zonaLabel = zonas.map((z) => z.name).filter(Boolean).join(", ");
      }

      return res.json({
        instituciones: institucionesAsignadas,
        meta: {
          zona_label: zonaLabel,
          zona_count: zonaCount,
          nivel_educativo: req.user?.nivel_educativo || null
        }
      });
    }

    const jurisdiccion = req.query.jurisdiccion || req.user.jurisdiccion;

    if (!jurisdiccion) {
      return res.status(400).json({ error: "Jurisdicción no especificada" });
    }

    // TODO: Ajustar el nombre de columna si en tu tabla 'institucion'
    // el campo de jurisdicción se llama diferente (ej: departamento, zona, etc.)
    const selectSql = await getInstitucionSelectSql();
    const hasJurisdiccion = await columnExists("institucion", "jurisdiccion");
    const jurisdiccionExpr = hasJurisdiccion ? "i.jurisdiccion" : selectSql.departamentoSql.expression;

    const instituciones = await all(
      `SELECT i.id_institucion AS id,
              i.nombre,
              i.cue,
              ${selectSql.tipoExpr} AS tipo,
              ${jurisdiccionExpr} AS jurisdiccion,
              ${selectSql.departamentoSql.expression} AS departamento
       FROM institucion i
       ${selectSql.departamentoSql.joins}
       WHERE LOWER(${jurisdiccionExpr}) = LOWER(?)
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

    const selectSql = await getInstitucionSelectSql();
    const hasJurisdiccion = await columnExists("institucion", "jurisdiccion");
    const jurisdiccionExpr = hasJurisdiccion ? "i.jurisdiccion" : selectSql.departamentoSql.expression;
    const matriculaGroupBy = selectSql.matriculaGroupBy ? `, ${selectSql.matriculaGroupBy}` : "";

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
              ${selectSql.matriculaExpr} AS matricula,
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
       ${selectSql.departamentoSql.joins}
       WHERE p.estado = 'pendiente'
         AND COALESCE(p.respuesta_supervisor_tipo, '') <> 'aclaracion'
         AND LOWER(${jurisdiccionExpr}) = LOWER(?)
       GROUP BY p.id_pedido, p.kit_nombre, p.kit_cantidad, p.observaciones_generales, p.motivo_supervisor,
                p.respuesta_supervisor_tipo, p.estado, p.fecha_creacion, i.nombre, i.id_institucion,
                u.nombre${matriculaGroupBy}
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

    const selectSql = await getInstitucionSelectSql();
    const hasJurisdiccion = await columnExists("institucion", "jurisdiccion");
    const jurisdiccionExpr = hasJurisdiccion ? "i.jurisdiccion" : selectSql.departamentoSql.expression;
    const matriculaGroupBy = selectSql.matriculaGroupBy ? `, ${selectSql.matriculaGroupBy}` : "";

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
              ${selectSql.matriculaExpr} AS matricula,
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
       ${selectSql.departamentoSql.joins}
       WHERE p.estado::text IN ('pendiente', 'aprobado', 'rechazado', 'cancelado', 'entregado', 'finalizado')
         AND LOWER(${jurisdiccionExpr}) = LOWER(?)
       GROUP BY p.id_pedido, p.kit_nombre, p.kit_cantidad, p.observaciones_generales, p.motivo_supervisor,
                p.respuesta_supervisor_tipo, p.estado, p.fecha_creacion, i.nombre, i.id_institucion,
                u.nombre${matriculaGroupBy}
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
