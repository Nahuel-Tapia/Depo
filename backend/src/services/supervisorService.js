const { all, get, run } = require("../db.pg");

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

async function getMasterInstitutionIds() {
  const rows = await all(`SELECT id_institucion FROM institucion ORDER BY id_institucion ASC`);
  return rows.map((r) => Number(r.id_institucion)).filter((id) => Number.isInteger(id) && id > 0);
}

async function hasAsignacionesTable() {
  const row = await get(
    `SELECT to_regclass('public.supervisor_escuela_asignacion') AS regclass`
  );
  return Boolean(row?.regclass);
}

async function getInstitucionNivelExpr(alias = "i") {
  if (await columnExists("institucion", "direccion_area")) return `${alias}.direccion_area`;
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
    const niveles = nivelEducativo ? nivelEducativo.split(',').map(n => n.trim().toLowerCase()).filter(Boolean) : [];
    const filterNivel = niveles.length > 0 ? ` AND LOWER(COALESCE(${nivelExpr}, '')) = ANY($2::text[])` : "";
    const params = [parsedId];
    if (niveles.length > 0) params.push(niveles);

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
      const departamentos = jurisdiccion.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
      const allowed = await all(
        `SELECT DISTINCT i.id_institucion AS id
         FROM institucion i
         ${departamentoSql.joins}
         WHERE i.id_institucion = ANY($1::int[])
           AND LOWER(${departamentoSql.expression}) = ANY($2::text[])`,
        [ids, departamentos]
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

async function getDirectorAreaAssignedInstitutionIds(directorAreaId) {
  const parsedId = Number.parseInt(directorAreaId, 10);
  if (!Number.isInteger(parsedId) || parsedId <= 0) return [];

  const hasZonesTables =
    (await tableExists("zona_institucion")) && (await tableExists("zona"));

  if (hasZonesTables) {
    const rows = await all(
      `SELECT DISTINCT zi.institucion_id AS id
       FROM zona z
       JOIN zona_institucion zi ON zi.zona_id = z.id
       WHERE z.director_area_id = $1
         AND z.activo = TRUE`,
      [parsedId]
    );

    return rows.map((r) => r.id).filter((v) => Number.isInteger(v) && v > 0);
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

async function ensureSupervisorSchema() {
  // Centralized in schemaManager.js
}

async function getInstituciones(user, queryJurisdiccion) {
  await ensureSupervisorSchema();

  if (user?.role === "supervisor" || user?.role === "master") {
    const institutionIds =
      user.role === "master"
        ? await getMasterInstitutionIds()
        : await getSupervisorAssignedInstitutionIds(
            user.sub,
            user.jurisdiccion,
            user.nivel_educativo
          );

    if (institutionIds.length === 0) {
      return {
        instituciones: [],
        meta: {
          zona_label: "",
          zona_count: 0,
          nivel_educativo: user?.nivel_educativo || null
        }
      };
    }

    const selectSql = await getInstitucionSelectSql();
    const institucionesAsignadas = await all(
      `SELECT i.id_institucion AS id,
              i.id_edificio AS edificio_id,
              i.nombre,
              i.cue,
              ${selectSql.nivelExpr} AS nivel,
              e.cui,
              ${selectSql.departamentoSql.expression} AS departamento,
              d.latitud,
              d.longitud,
              CASE 
                WHEN i.kit_id IS NULL THEN 'sin_kit'
                WHEN NOT EXISTS (
                  SELECT 1 FROM pedido p WHERE p.id_institucion = i.id_institucion AND COALESCE(p.tipo, 'anual') = 'anual'
                ) THEN 'sin_solicitud'
                WHEN EXISTS (
                  SELECT 1 FROM pedido p WHERE p.id_institucion = i.id_institucion AND COALESCE(p.tipo, 'anual') = 'anual' AND p.estado::text IN ('aprobado', 'entregado', 'finalizado')
                ) THEN 'solicitud_aprobada'
                ELSE 'solicitud_enviada'
              END as status
       FROM institucion i
       LEFT JOIN edificio e ON i.id_edificio = e.id_edificio
       LEFT JOIN direccion d ON e.id_direccion = d.id_direccion
       WHERE i.id_institucion = ANY($1::int[])
       ORDER BY i.nombre`,
      [institutionIds]
    );

    let zonaLabel = "";
    let zonaCount = 0;
    const hasZonesTables =
      (await tableExists("zona_supervisor")) && (await tableExists("zona"));

    if (hasZonesTables && user.role === "supervisor") {
      const zonas = await all(
        `SELECT DISTINCT z.id, z.name
         FROM zona_supervisor zs
         JOIN zona z ON z.id = zs.zona_id
         WHERE zs.supervisor_id = $1
           AND z.activo = TRUE
         ORDER BY z.name ASC`,
        [user.sub]
      );
      zonaCount = zonas.length;
      zonaLabel = zonas.map((z) => z.name).filter(Boolean).join(", ");
    }

    return {
      instituciones: institucionesAsignadas,
      meta: {
        zona_label: zonaLabel,
        zona_count: zonaCount,
        nivel_educativo: user?.nivel_educativo || null
      }
    };
  }

  const jurisdiccion = queryJurisdiccion || user.jurisdiccion;

  if (!jurisdiccion) {
    throw { status: 400, message: "Jurisdicción no especificada" };
  }

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

  return { instituciones };
}

async function getDashboardStats(user) {
  await ensureSupervisorSchema();

  if (user?.role !== "supervisor" && user?.role !== "master") {
    throw { status: 403, message: "Solo el supervisor puede ver estas estadísticas." };
  }

  const institutionIds =
    user.role === "master"
      ? await getMasterInstitutionIds()
      : await getSupervisorAssignedInstitutionIds(
          user.sub,
          user.jurisdiccion,
          user.nivel_educativo
        );

  if (institutionIds.length === 0) {
    return {
      totales: {
        total: 0,
        sin_kit: 0,
        sin_solicitud: 0,
        solicitud_enviada: 0,
        solicitud_aprobada: 0
      },
      pedidos_recientes: [],
      entregas_recientes: []
    };
  }

  const stats = await get(`
    WITH escuelas_estado AS (
      SELECT i.id_institucion,
             CASE 
               WHEN i.kit_id IS NULL THEN 'sin_kit'
               WHEN NOT EXISTS (
                 SELECT 1 FROM pedido p WHERE p.id_institucion = i.id_institucion AND COALESCE(p.tipo, 'anual') = 'anual'
               ) THEN 'sin_solicitud'
               WHEN EXISTS (
                 SELECT 1 FROM pedido p WHERE p.id_institucion = i.id_institucion AND COALESCE(p.tipo, 'anual') = 'anual' AND p.estado::text IN ('aprobado', 'entregado', 'finalizado')
               ) THEN 'solicitud_aprobada'
               ELSE 'solicitud_enviada'
             END as estado
      FROM institucion i
      WHERE i.id_institucion = ANY($1::int[])
    )
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN estado = 'sin_kit' THEN 1 ELSE 0 END) as sin_kit,
      SUM(CASE WHEN estado = 'sin_solicitud' THEN 1 ELSE 0 END) as sin_solicitud,
      SUM(CASE WHEN estado = 'solicitud_enviada' THEN 1 ELSE 0 END) as solicitud_enviada,
      SUM(CASE WHEN estado = 'solicitud_aprobada' THEN 1 ELSE 0 END) as solicitud_aprobada
    FROM escuelas_estado
  `, [institutionIds]);

  const pedidosRecientes = await all(`
    SELECT p.id_pedido as id, p.fecha_creacion as fecha, p.estado, i.nombre as institucion
    FROM pedido p
    JOIN institucion i ON p.id_institucion = i.id_institucion
    WHERE p.id_institucion = ANY($1::int[])
    ORDER BY p.fecha_creacion DESC
    LIMIT 5
  `, [institutionIds]);

  const entregasRecientes = await all(`
    SELECT ms.id_movimiento as id, ms.fecha_movimiento as fecha, ms.cantidad, p.nombre as producto, i.nombre as institucion
    FROM movimiento_stock ms
    JOIN producto p ON ms.id_producto = p.id_producto
    JOIN institucion i ON ms.id_institucion = i.id_institucion
    WHERE ms.id_institucion = ANY($1::int[]) AND ms.tipo = 'egreso'
    ORDER BY ms.fecha_movimiento DESC
    LIMIT 5
  `, [institutionIds]);

  return {
    totales: {
      total: parseInt(stats.total) || 0,
      sin_kit: parseInt(stats.sin_kit) || 0,
      sin_solicitud: parseInt(stats.sin_solicitud) || 0,
      solicitud_enviada: parseInt(stats.solicitud_enviada) || 0,
      solicitud_aprobada: parseInt(stats.solicitud_aprobada) || 0
    },
    pedidos_recientes: pedidosRecientes,
    entregas_recientes: entregasRecientes
  };
}

async function updateInstitucionKit(user, institucionId, kitId) {
  await ensureSupervisorSchema();

  if (user?.role !== "supervisor" && user?.role !== "master") {
    throw { status: 403, message: "Solo el supervisor puede asignar kit." };
  }

  if (!Number.isInteger(institucionId) || institucionId <= 0) {
    throw { status: 400, message: "Institución inválida." };
  }
  if (!Number.isInteger(kitId) || kitId <= 0) {
    throw { status: 400, message: "Kit inválido." };
  }

  if (!(await supervisorHasAssignedInstitution(user.sub, institucionId))) {
    throw { status: 404, message: "La escuela no está asignada a este supervisor." };
  }

  const kit = await get(
    `SELECT id, nombre
     FROM producto_kit
     WHERE id = ? AND activo = TRUE`,
    [kitId]
  );

  if (!kit) {
    throw { status: 404, message: "El kit seleccionado no existe o está inactivo." };
  }

  await get(
    `UPDATE institucion
     SET kit_id = $1,
         updated_at = NOW()
     WHERE id_institucion = $2
     RETURNING id_institucion`,
    [kitId, institucionId]
  );

  return { ok: true, kit_id: kitId, kit_nombre: kit.nombre };
}

async function getPedidosPendientes(user, queryJurisdiccion) {
  await ensureSupervisorSchema();

  if (user?.role === "supervisor" || user?.role === "master") {
    const institutionIds =
      user.role === "master"
        ? await getMasterInstitutionIds()
        : await getSupervisorAssignedInstitutionIds(
            user.sub,
            user.jurisdiccion,
            user.nivel_educativo
          );
    if (institutionIds.length === 0) {
      return { pedidos: [] };
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

    return { pedidos };
  }

  const jurisdiccion = queryJurisdiccion || user.jurisdiccion;

  if (!jurisdiccion) {
    throw { status: 400, message: "Jurisdicción no especificada" };
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

  return { pedidos };
}

async function getSolicitudes(user, queryJurisdiccion) {
  await ensureSupervisorSchema();

  if (user?.role === "supervisor" || user?.role === "director_area" || user?.role === "master") {
    let institutionIds = [];
    if (user.role === "supervisor") {
      institutionIds = await getSupervisorAssignedInstitutionIds(
        user.sub,
        user.jurisdiccion,
        user.nivel_educativo
      );
    } else if (user.role === "master") {
      institutionIds = await getMasterInstitutionIds();
    } else {
      institutionIds = await getDirectorAreaAssignedInstitutionIds(user.sub);
    }

    if (institutionIds.length === 0) {
      return { solicitudes: [] };
    }

    const solicitudes = await all(
      `SELECT p.id_pedido AS id,
              COALESCE(p.kit_cantidad, SUM(dp.cantidad_solicitada)) AS cantidad,
              p.observaciones_generales AS notas,
              p.motivo_supervisor,
              p.respuesta_supervisor_tipo,
              CASE WHEN p.estado::text = 'finalizado' THEN 'entregado' ELSE p.estado::text END AS estado,
              p.fecha_creacion AS fecha,
              COALESCE(p.tipo, 'anual') AS tipo,
              COALESCE(
                p.kit_nombre,
                STRING_AGG(pr.nombre || ' x' || dp.cantidad_solicitada::text, ', ' ORDER BY pr.nombre)
              ) AS producto,
              i.nombre AS institucion,
              i.id_institucion AS institucion_id,
              u.nombre AS solicitante,
              usup.nombre AS supervisor_nombre,
              p.fecha_aprobacion_supervisor,
              p.aprobado_director_area,
              p.fecha_aprobacion_director,
              udir.nombre AS director_nombre,
              COALESCE(
                JSON_AGG(
                  JSON_BUILD_OBJECT('producto', pr.nombre, 'cantidad', dp.cantidad_solicitada)
                  ORDER BY pr.nombre
                ) FILTER (WHERE pr.id_producto IS NOT NULL),
                '[]'::json
              ) AS items
       FROM pedido p
       LEFT JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
       LEFT JOIN producto pr ON pr.id_producto = dp.id_producto
       JOIN usuario u ON u.id_usuario = p.id_usuario_solicitante
       JOIN institucion i ON i.id_institucion = p.id_institucion
       LEFT JOIN usuario usup ON usup.id_usuario = p.aprobado_por_supervisor_id
       LEFT JOIN usuario udir ON udir.id_usuario = p.aprobado_por_director_id
       WHERE i.id_institucion = ANY($1::int[])
         AND p.estado::text IN ('pendiente', 'pendiente_director', 'aprobado', 'rechazado', 'cancelado', 'entregado', 'finalizado')
       GROUP BY p.id_pedido, p.kit_nombre, p.kit_cantidad, p.observaciones_generales, p.motivo_supervisor,
                p.respuesta_supervisor_tipo, p.estado, p.fecha_creacion, i.nombre, i.id_institucion, u.nombre, 
                usup.nombre, p.fecha_aprobacion_supervisor, p.aprobado_director_area, p.fecha_aprobacion_director, udir.nombre, p.tipo
       ORDER BY p.fecha_creacion DESC`,
      [institutionIds]
    );

    return { solicitudes };
  }

  const jurisdiccion = queryJurisdiccion || user.jurisdiccion;

  if (!jurisdiccion) {
    throw { status: 400, message: "Jurisdicción no especificada" };
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

  return { solicitudes };
}

async function getHistorialConsumoInstitucion(institucionId, user) {
  // Verificar que el supervisor tenga acceso a esta institución
  if (user?.role === "supervisor" && !(await supervisorHasAssignedInstitution(user.sub, institucionId))) {
    throw { status: 403, message: "No tenés acceso a esta institución" };
  }

  // Obtener pedidos anteriores (anuales y refuerzos aprobados/entregados)
  const pedidos = await all(
    `SELECT 
       p.id_pedido AS id,
       COALESCE(p.tipo, 'anual') AS tipo,
       p.estado,
       p.fecha_creacion AS fecha,
       p.fecha_aprobacion_supervisor,
       COALESCE(
         p.kit_nombre,
         STRING_AGG(pr.nombre || ' x' || dp.cantidad_solicitada::text, ', ' ORDER BY pr.nombre)
       ) AS detalle,
       u.nombre AS solicitante,
       usup.nombre AS supervisor_nombre,
       COUNT(dp.id_producto) AS cantidad_productos
     FROM pedido p
     LEFT JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
     LEFT JOIN producto pr ON pr.id_producto = dp.id_producto
     LEFT JOIN usuario u ON u.id_usuario = p.id_usuario_solicitante
     LEFT JOIN usuario usup ON usup.id_usuario = p.aprobado_por_supervisor_id
     WHERE p.id_institucion = ?
       AND p.estado::text IN ('aprobado', 'entregado', 'finalizado', 'pendiente_director')
     GROUP BY p.id_pedido, p.tipo, p.estado, p.fecha_creacion, p.fecha_aprobacion_supervisor,
              u.nombre, usup.nombre, p.kit_nombre
     ORDER BY p.fecha_creacion DESC
     LIMIT 20`,
    [institucionId]
  );

  // Obtener movimientos de egreso (entregas efectivas)
  const movimientos = await all(
    `SELECT 
       ms.id_movimiento AS id,
       ms.fecha_movimiento AS fecha,
       pr.nombre AS producto,
       ms.cantidad,
       ms.tipo,
       ms.estado_producto,
       u.nombre AS usuario,
       ms.observacion
     FROM movimiento_stock ms
     LEFT JOIN producto pr ON pr.id_producto = ms.id_producto
     LEFT JOIN usuario u ON u.id_usuario = ms.id_usuario
     WHERE ms.id_institucion = ?
       AND ms.tipo = 'egreso'
     ORDER BY ms.fecha_movimiento DESC
     LIMIT 20`,
    [institucionId]
  );

  // Calcular totales por producto (consumo histórico)
  const consumoPorProducto = await all(
    `SELECT 
       pr.nombre AS producto,
       pr.unidad_medida,
       COALESCE(SUM(ms.cantidad), 0) AS total_consumido,
       COUNT(ms.id_movimiento) AS cantidad_movimientos,
       MAX(ms.fecha_movimiento) AS ultima_entrega
     FROM movimiento_stock ms
     JOIN producto pr ON pr.id_producto = ms.id_producto
     WHERE ms.id_institucion = ?
       AND ms.tipo = 'egreso'
     GROUP BY pr.id_producto, pr.nombre, pr.unidad_medida
     ORDER BY total_consumido DESC`,
    [institucionId]
  );

  // Calcular resumen de pedidos por tipo
  const resumenPedidos = await all(
    `SELECT 
       COALESCE(p.tipo, 'anual') AS tipo,
       COUNT(*) AS total,
       COUNT(CASE WHEN p.estado::text IN ('entregado', 'finalizado') THEN 1 END) AS entregados,
       COUNT(CASE WHEN p.estado::text = 'aprobado' OR p.estado::text = 'pendiente_director' THEN 1 END) AS pendientes
     FROM pedido p
     WHERE p.id_institucion = ?
     GROUP BY COALESCE(p.tipo, 'anual')`,
    [institucionId]
  );

  return {
    pedidos,
    movimientos,
    consumo_por_producto: consumoPorProducto,
    resumen: {
      pedidos_anuales: resumenPedidos.find(r => r.tipo === 'anual') || { total: 0, entregados: 0, pendientes: 0 },
      pedidos_refuerzo: resumenPedidos.find(r => r.tipo === 'refuerzo') || { total: 0, entregados: 0, pendientes: 0 }
    }
  };
}

async function getHistorialInstitucion(id) {
  const institucionService = require("./institucionService");
  return institucionService.getHistorialInstitucion(id, {});
}

module.exports = {
  getInstituciones,
  getDashboardStats,
  updateInstitucionKit,
  getPedidosPendientes,
  getSolicitudes,
  getHistorialInstitucion,
  getHistorialConsumoInstitucion
};
