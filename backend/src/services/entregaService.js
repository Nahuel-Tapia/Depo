const { all, get, run, pool } = require("../db.pg");

const columnExistsCache = new Map();

async function columnExists(tableName, columnName) {
  const cacheKey = `${tableName}.${columnName}`;
  if (columnExistsCache.has(cacheKey)) return columnExistsCache.get(cacheKey);

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

async function getDepartamentoSql(alias = "i") {
  const [
    institucionDepartamento,
    edificioDepartamento,
    edificioDireccionId,
    direccionDepartamento,
  ] = await Promise.all([
    columnExists("institucion", "departamento"),
    columnExists("edificio", "departamento"),
    columnExists("edificio", "id_direccion"),
    columnExists("direccion", "departamento"),
  ]);

  const joins = [];
  const sources = [];
  joins.push(`LEFT JOIN edificio e ON ${alias}.id_edificio = e.id_edificio`);

  if (institucionDepartamento) {
    sources.push(`NULLIF(TRIM(${alias}.departamento), '')`);
  }
  if (edificioDireccionId && direccionDepartamento) {
    joins.push("LEFT JOIN direccion d ON e.id_direccion = d.id_direccion");
    sources.push("NULLIF(TRIM(d.departamento), '')");
  }
  if (edificioDepartamento) {
    sources.push("NULLIF(TRIM(e.departamento), '')");
  }

  return {
    joins: joins.join("\n"),
    expression: sources.length > 0 ? `COALESCE(${sources.join(", ")})` : "NULL::text",
  };
}

async function resolveInstitucionDepartamento(institucionId, client = null) {
  const departamentoSql = await getDepartamentoSql("i");
  const query = `
    SELECT ${departamentoSql.expression} AS departamento
    FROM institucion i
    ${departamentoSql.joins}
    WHERE i.id_institucion = $1
  `;

  let row = null;
  if (client) {
    const result = await client.query(query, [institucionId]);
    row = result.rows[0] || null;
  } else {
    row = await get(query, [institucionId]);
  }

  const departamento = String(row?.departamento || "").trim();
  return departamento || null;
}

async function getInstitucionesFaltantesSolicitudPorDepartamento(departamento, anio) {
  const departamentoSql = await getDepartamentoSql("i");

  const rows = await all(
    `WITH pedidos_objetivo AS (
       SELECT p.id_pedido, p.id_institucion
       FROM pedido p
       WHERE COALESCE(p.tipo, 'anual') = 'anual'
         AND p.estado = 'aprobado'
         AND p.aprobado_director_area = TRUE
     ),
     saldo_por_institucion AS (
       SELECT
         po.id_institucion,
         COUNT(*) FILTER (WHERE GREATEST(dp.cantidad_solicitada - COALESCE(pe.entregado, 0), 0) > 0) AS productos_pendientes,
         COALESCE(SUM(GREATEST(dp.cantidad_solicitada - COALESCE(pe.entregado, 0), 0)), 0) AS cantidad_pendiente_total
       FROM pedidos_objetivo po
       JOIN detalle_pedido dp ON dp.id_pedido = po.id_pedido
       LEFT JOIN (
         SELECT id_pedido, id_producto, SUM(cantidad_entregada) AS entregado
         FROM pedido_entrega
         GROUP BY id_pedido, id_producto
       ) pe ON pe.id_pedido = dp.id_pedido AND pe.id_producto = dp.id_producto
       GROUP BY po.id_institucion
     ),
     institucion_departamento AS (
       SELECT
         i.id_institucion,
         i.nombre,
         i.cue,
         COALESCE(NULLIF(TRIM(${departamentoSql.expression}), ''), 'SIN_DEPARTAMENTO') AS departamento
       FROM institucion i
       ${departamentoSql.joins}
       WHERE COALESCE(i.activo, TRUE) = TRUE
     )
     SELECT
       idp.id_institucion,
       idp.nombre AS institucion_nombre,
       idp.cue,
       spi.productos_pendientes,
       spi.cantidad_pendiente_total
     FROM saldo_por_institucion spi
     JOIN institucion_departamento idp ON idp.id_institucion = spi.id_institucion
     WHERE LOWER(idp.departamento) = LOWER($1)
       AND COALESCE(spi.cantidad_pendiente_total, 0) > 0
       AND NOT EXISTS (
         SELECT 1
         FROM solicitud_retiro sr
         WHERE sr.id_institucion = idp.id_institucion
           AND EXTRACT(YEAR FROM sr.fecha_retiro) = $2
       )
     ORDER BY idp.nombre ASC`,
    [departamento, anio]
  );

  return rows.map((row) => ({
    id_institucion: Number(row.id_institucion),
    institucion_nombre: row.institucion_nombre,
    cue: row.cue || null,
    productos_pendientes: Number(row.productos_pendientes || 0),
    cantidad_pendiente_total: Number(row.cantidad_pendiente_total || 0),
  }));
}

function parseBoolean(value) {
  if (value === true || value === false) return value;
  if (typeof value === "number") return value === 1;
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "si" || normalized === "sí";
}

class RequestValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "RequestValidationError";
    this.status = status;
  }
}

function badRequest(message) {
  return new RequestValidationError(message, 400);
}

// Crear tabla de control de entregas si no existe
async function ensureEntregasSchema() {
  // Centralized in schemaManager.js
}

function parsePositiveInt(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function normalizeRetiraTipo(value) {
  return String(value || "").trim().toLowerCase() === "otro" ? "otro" : "directivo";
}

async function getRetiroAvailabilityRows(institucionId = null) {
  const params = [];
  let institucionSql = "";
  if (institucionId) {
    params.push(institucionId);
    institucionSql = `AND p.id_institucion = $${params.length}`;
  }

  return all(`
    SELECT
      p.id_pedido AS id_pedido,
      p.id_institucion,
      i.nombre AS institucion_nombre,
      i.cue,
      COALESCE(u.nombre, 'Directivo') AS solicitante_nombre,
      p.fecha_creacion,
      dp.id_producto,
      pr.nombre AS producto_nombre,
      pr.unidad_medida,
      COALESCE(pr.stock_actual, 0) AS stock_actual,
      dp.cantidad_solicitada,
      COALESCE(ent.total_entregado, 0) AS cantidad_entregada,
      COALESCE(res.total_reservado, 0) AS cantidad_reservada
    FROM pedido p
    LEFT JOIN institucion i ON i.id_institucion = p.id_institucion
    LEFT JOIN usuario u ON u.id_usuario = p.id_usuario_solicitante
    JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
    JOIN producto pr ON pr.id_producto = dp.id_producto
    LEFT JOIN (
      SELECT id_pedido, id_producto, SUM(cantidad_entregada) AS total_entregado
      FROM pedido_entrega
      GROUP BY id_pedido, id_producto
    ) ent ON ent.id_pedido = p.id_pedido AND ent.id_producto = dp.id_producto
    LEFT JOIN (
      SELECT sr.id_pedido, srd.id_producto, SUM(srd.cantidad_solicitada) AS total_reservado
      FROM solicitud_retiro sr
      JOIN solicitud_retiro_detalle srd ON srd.id_solicitud_retiro = sr.id
      WHERE sr.estado IN ('pendiente', 'aceptada')
      GROUP BY sr.id_pedido, srd.id_producto
    ) res ON res.id_pedido = p.id_pedido AND res.id_producto = dp.id_producto
    WHERE p.estado = 'aprobado'
      AND (
        (COALESCE(p.tipo, 'anual') = 'anual' AND COALESCE(p.aprobado_director_area, TRUE) = TRUE)
        OR (COALESCE(p.tipo, 'anual') = 'refuerzo')
      )
      ${institucionSql}
    ORDER BY p.fecha_creacion DESC, pr.nombre ASC
  `, params);
}

function groupRetiroAvailability(rows = []) {
  const grouped = new Map();

  for (const row of rows) {
    const pedidoId = Number(row.id_pedido);
    if (!grouped.has(pedidoId)) {
      grouped.set(pedidoId, {
        id: pedidoId,
        id_institucion: Number(row.id_institucion),
        institucion_nombre: row.institucion_nombre,
        cue: row.cue || null,
        solicitante_nombre: row.solicitante_nombre,
        fecha_creacion: row.fecha_creacion,
        items: []
      });
    }

    const solicitado = Number(row.cantidad_solicitada || 0);
    const entregado = Number(row.cantidad_entregada || 0);
    const reservado = Number(row.cantidad_reservada || 0);
    const disponibleKit = Math.max(0, solicitado - entregado - reservado);
    const stockActual = Number(row.stock_actual || 0);

    grouped.get(pedidoId).items.push({
      producto_id: Number(row.id_producto),
      producto_nombre: row.producto_nombre,
      unidad_medida: row.unidad_medida || "unidad",
      cantidad_solicitada: solicitado,
      cantidad_entregada: entregado,
      cantidad_reservada: reservado,
      cantidad_disponible_kit: disponibleKit,
      stock_actual: stockActual,
      cantidad_disponible: Math.min(disponibleKit, stockActual)
    });
  }

  return Array.from(grouped.values())
    .map((pedido) => ({
      ...pedido,
      items: pedido.items.filter((item) => item.cantidad_disponible_kit > 0)
    }))
    .filter((pedido) => pedido.items.length > 0);
}

async function getSolicitudRetiro(id, client = null) {
  const executor = client
    ? (sql, params) => client.query(sql, params).then((result) => result.rows)
    : all;

  const rows = await executor(`
    SELECT
      sr.id,
      sr.id_pedido,
      sr.id_institucion,
      i.nombre AS institucion_nombre,
      i.cue,
      sr.id_usuario_solicitante,
      us.nombre AS solicitante_nombre,
      sr.id_usuario_acepta,
      ua.nombre AS acepta_usuario_nombre,
      sr.fecha_retiro,
      sr.retira_tipo,
      sr.retira_nombre,
      sr.retira_dni,
      COALESCE(sr.solicitar_envio, FALSE) AS solicitar_envio,
      sr.departamento_envio,
      sr.estado,
      sr.id_usuario_entrega,
      ue.nombre AS entrega_usuario_nombre,
      sr.fecha_entrega,
      sr.observaciones,
      sr.created_at,
      COALESCE(pd.tipo, 'anual') AS tipo_pedido,
      srd.id_producto,
      pr.nombre AS producto_nombre,
      pr.unidad_medida,
      pr.stock_actual,
      srd.cantidad_solicitada,
      srd.cantidad_entregada,
      srd.id_movimiento
    FROM solicitud_retiro sr
    JOIN institucion i ON i.id_institucion = sr.id_institucion
    JOIN usuario us ON us.id_usuario = sr.id_usuario_solicitante
    JOIN pedido pd ON pd.id_pedido = sr.id_pedido
    LEFT JOIN usuario ue ON ue.id_usuario = sr.id_usuario_entrega
    LEFT JOIN usuario ua ON ua.id_usuario = sr.id_usuario_acepta
    JOIN solicitud_retiro_detalle srd ON srd.id_solicitud_retiro = sr.id
    JOIN producto pr ON pr.id_producto = srd.id_producto
    WHERE sr.id = $1
    ORDER BY pr.nombre ASC
  `, [id]);

  if (!rows.length) return null;

  const first = rows[0];
  return {
    id: Number(first.id),
    id_pedido: Number(first.id_pedido),
    id_institucion: Number(first.id_institucion),
    institucion_nombre: first.institucion_nombre,
    cue: first.cue || null,
    id_usuario_solicitante: Number(first.id_usuario_solicitante),
    solicitante_nombre: first.solicitante_nombre,
    fecha_retiro: first.fecha_retiro,
    retira_tipo: first.retira_tipo,
    retira_nombre: first.retira_nombre,
    retira_dni: first.retira_dni,
    solicitar_envio: Boolean(first.solicitar_envio),
    departamento_envio: first.departamento_envio || null,
    estado: first.estado,
    id_usuario_acepta: first.id_usuario_acepta ? Number(first.id_usuario_acepta) : null,
    acepta_usuario_nombre: first.acepta_usuario_nombre || null,
    id_usuario_entrega: first.id_usuario_entrega ? Number(first.id_usuario_entrega) : null,
    entrega_usuario_nombre: first.entrega_usuario_nombre || null,
    fecha_entrega: first.fecha_entrega,
    observaciones: first.observaciones,
    created_at: first.created_at,
    tipo_pedido: first.tipo_pedido || "anual",
    items: rows.map((row) => ({
      producto_id: Number(row.id_producto),
      producto_nombre: row.producto_nombre,
      unidad_medida: row.unidad_medida || "unidad",
      stock_actual: Number(row.stock_actual || 0),
      cantidad_solicitada: Number(row.cantidad_solicitada || 0),
      cantidad_entregada: Number(row.cantidad_entregada || 0),
      id_movimiento: row.id_movimiento ? Number(row.id_movimiento) : null
    }))
  };
}

async function listarPedidosDisponibles() {
  await ensureEntregasSchema();

  const rows = await all(`
    SELECT 
      p.id_pedido AS id,
      p.id_institucion,
      i.nombre AS institucion_nombre,
      p.estado,
      p.aprobado_director_area,
      p.fecha_creacion,
      u.nombre AS solicitante_nombre,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'producto_id', pr.id_producto,
            'producto_nombre', pr.nombre,
            'unidad_medida', pr.unidad_medida,
            'cantidad_solicitada', dp.cantidad_solicitada,
            'stock_actual', COALESCE(pr.stock_actual, 0)
          )
          ORDER BY pr.nombre
        ) FILTER (WHERE pr.id_producto IS NOT NULL),
        '[]'::json
      ) AS items
    FROM pedido p
    JOIN institucion i ON i.id_institucion = p.id_institucion
    JOIN usuario u ON u.id_usuario = p.id_usuario_solicitante
    JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
    JOIN producto pr ON pr.id_producto = dp.id_producto
    WHERE p.estado = 'aprobado'
      AND p.aprobado_director_area = TRUE
      AND COALESCE(p.tipo, 'anual') = 'anual'
    GROUP BY p.id_pedido, p.id_institucion, i.nombre, p.estado, 
             p.aprobado_director_area, p.fecha_creacion, u.nombre
    ORDER BY p.fecha_creacion DESC
  `);

  // Calcular cantidades ya entregadas por pedido
  const entregasRows = await all(`
    SELECT 
      id_pedido,
      id_producto,
      SUM(cantidad_entregada) AS total_entregado
    FROM pedido_entrega
    GROUP BY id_pedido, id_producto
  `);

  const entregasMap = new Map();
  for (const row of entregasRows) {
    const key = `${row.id_pedido}-${row.id_producto}`;
    entregasMap.set(key, Number(row.total_entregado));
  }

  // Procesar pedidos para agregar información de entregas
  const pedidos = rows.map(pedido => {
    const itemsConEntregas = pedido.items.map(item => {
      const key = `${pedido.id}-${item.producto_id}`;
      const entregado = entregasMap.get(key) || 0;
      const pendiente = item.cantidad_solicitada - entregado;
      
      return {
        ...item,
        cantidad_solicitada: Number(item.cantidad_solicitada),
        stock_actual: Number(item.stock_actual),
        cantidad_entregada: entregado,
        cantidad_pendiente: Math.max(0, pendiente),
        puede_entregar: pendiente > 0 && Number(item.stock_actual) >= Math.min(pendiente, Number(item.stock_actual))
      };
    });

    return {
      id: Number(pedido.id),
      id_institucion: Number(pedido.id_institucion),
      institucion_nombre: pedido.institucion_nombre,
      estado: pedido.estado,
      aprobado_director_area: pedido.aprobado_director_area,
      fecha_creacion: pedido.fecha_creacion,
      solicitante_nombre: pedido.solicitante_nombre,
      items: itemsConEntregas,
      tiene_pendientes: itemsConEntregas.some(item => item.cantidad_pendiente > 0)
    };
  });

  // Filtrar solo los que tienen items pendientes
  return pedidos.filter(p => p.tiene_pendientes);
}

async function getProductosDisponiblesRetiro(userId) {
  await ensureEntregasSchema();

  const usuario = await get(
    "SELECT id_institucion FROM usuario WHERE id_usuario = ?",
    [userId]
  );

  if (!usuario?.id_institucion) {
    throw { status: 400, message: "Tu usuario no tiene institución asignada" };
  }

  const rows = await getRetiroAvailabilityRows(usuario.id_institucion);
  return groupRetiroAvailability(rows);
}

async function getMisSolicitudesRetiro(userId) {
  await ensureEntregasSchema();

  const rows = await all(`
    SELECT id
    FROM solicitud_retiro
    WHERE id_usuario_solicitante = ?
    ORDER BY created_at DESC
  `, [userId]);

  const solicitudes = [];
  for (const row of rows) {
    const solicitud = await getSolicitudRetiro(row.id);
    if (solicitud) solicitudes.push(solicitud);
  }

  return solicitudes;
}

async function createSolicitudRetiro(userId, userRole, data) {
  await ensureEntregasSchema();

  if (userRole !== "directivo") {
    throw { status: 403, message: "Solo el rol directivo puede crear solicitudes de retiro" };
  }

  const { id_pedido, fecha_retiro, retira_tipo, retira_nombre, retira_dni, observaciones, items, solicitar_envio } = data;
  const pedidoId = parsePositiveInt(id_pedido);
  const tipoRetira = normalizeRetiraTipo(retira_tipo);
  const solicitarEnvio = parseBoolean(solicitar_envio);
  const fechaRetiro = String(fecha_retiro || "").trim();

  if (!pedidoId || !fechaRetiro || !Array.isArray(items) || items.length === 0) {
    throw { status: 400, message: "Faltan campos obligatorios: pedido, fecha de retiro e items" };
  }

  if (Number.isNaN(new Date(`${fechaRetiro}T00:00:00`).getTime())) {
    throw { status: 400, message: "La fecha de retiro no es válida" };
  }

  const nombreRetira = tipoRetira === "otro" ? String(retira_nombre || "").trim() : null;
  const dniRetira = tipoRetira === "otro" ? String(retira_dni || "").trim() : null;
  if (tipoRetira === "otro" && (!nombreRetira || !dniRetira)) {
    throw { status: 400, message: "Debés indicar nombre y DNI de quien retira" };
  }

  const usuario = await get(
    "SELECT id_institucion, nombre FROM usuario WHERE id_usuario = ?",
    [userId]
  );

  if (!usuario?.id_institucion) {
    throw { status: 400, message: "Tu usuario no tiene institución asignada" };
  }

  const pedido = await get(`
    SELECT id_pedido, id_institucion, COALESCE(tipo, 'anual') AS tipo
    FROM pedido
    WHERE id_pedido = ?
      AND id_institucion = ?
      AND estado = 'aprobado'
      AND (
        (COALESCE(tipo, 'anual') = 'anual' AND COALESCE(aprobado_director_area, TRUE) = TRUE)
        OR COALESCE(tipo, 'anual') = 'refuerzo'
      )
  `, [pedidoId, usuario.id_institucion]);

  if (!pedido) {
    throw { status: 404, message: "El pedido anual no está disponible para solicitar retiro" };
  }

  const parsedItems = items.map((item) => ({
    producto_id: parsePositiveInt(item?.producto_id),
    cantidad: parsePositiveInt(item?.cantidad)
  }));

  if (parsedItems.some((item) => !item.producto_id || !item.cantidad)) {
    throw { status: 400, message: "Todos los productos deben tener cantidad mayor a cero" };
  }

  const uniqueProductIds = new Set(parsedItems.map((item) => item.producto_id));
  if (uniqueProductIds.size !== parsedItems.length) {
    throw { status: 400, message: "No podés repetir productos en la misma solicitud" };
  }

  const availableRows = await getRetiroAvailabilityRows(usuario.id_institucion);
  const pedidoDisponible = groupRetiroAvailability(availableRows).find((p) => p.id === pedidoId);
  if (!pedidoDisponible) {
    throw { status: 400, message: "El pedido no tiene productos pendientes para retirar" };
  }

  const availableByProduct = new Map(pedidoDisponible.items.map((item) => [item.producto_id, item]));
  for (const item of parsedItems) {
    const disponible = availableByProduct.get(item.producto_id);
    if (!disponible) {
      throw { status: 400, message: `El producto ${item.producto_id} no pertenece al saldo pendiente de este pedido` };
    }
    if (item.cantidad > disponible.cantidad_disponible_kit) {
      throw {
        status: 400,
        message: `La cantidad solicitada para ${disponible.producto_nombre} supera el saldo pendiente del pedido`
      };
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const departamentoEnvio = solicitarEnvio
      ? (await resolveInstitucionDepartamento(usuario.id_institucion, client)) || "SIN_DEPARTAMENTO"
      : null;

    const solicitudResult = await client.query(`
      INSERT INTO solicitud_retiro
        (id_pedido, id_institucion, id_usuario_solicitante, fecha_retiro, retira_tipo, retira_nombre, retira_dni, observaciones, solicitar_envio, departamento_envio)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `, [
      pedidoId,
      usuario.id_institucion,
      userId,
      fechaRetiro,
      tipoRetira,
      nombreRetira,
      dniRetira,
      String(observaciones || "").trim() || null,
      solicitarEnvio,
      departamentoEnvio
    ]);

    const solicitudId = solicitudResult.rows[0].id;
    for (const item of parsedItems) {
      await client.query(`
        INSERT INTO solicitud_retiro_detalle (id_solicitud_retiro, id_producto, cantidad_solicitada)
        VALUES ($1, $2, $3)
      `, [solicitudId, item.producto_id, item.cantidad]);
    }

    await client.query("COMMIT");

    return await getSolicitudRetiro(solicitudId);
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

async function getSolicitudesEnvioDepartamentos(anioQuery) {
  await ensureEntregasSchema();
  const anio = Number(anioQuery || new Date().getFullYear());

  const hasDepto = await columnExists('solicitud_retiro', 'departamento_envio');
  const hasSolicitar = await columnExists('solicitud_retiro', 'solicitar_envio');
  if (!hasDepto || !hasSolicitar) {
    return { anio, departamentos: [] };
  }

  const rows = await all(
    `SELECT
       COALESCE(NULLIF(TRIM(sr.departamento_envio), ''), 'SIN_DEPARTAMENTO') AS departamento,
       COUNT(DISTINCT sr.id) AS cantidad_solicitudes,
       COUNT(DISTINCT sr.id_institucion) AS cantidad_escuelas,
       COUNT(*) AS cantidad_productos,
       COALESCE(SUM(GREATEST(srd.cantidad_solicitada - COALESCE(srd.cantidad_entregada, 0), 0)), 0) AS cantidad_total_pendiente
     FROM solicitud_retiro sr
     JOIN solicitud_retiro_detalle srd ON srd.id_solicitud_retiro = sr.id
     WHERE COALESCE(sr.solicitar_envio, FALSE) = TRUE
       AND sr.estado IN ('pendiente', 'aceptada')
       AND EXTRACT(YEAR FROM sr.fecha_retiro) = $1
     GROUP BY COALESCE(NULLIF(TRIM(sr.departamento_envio), ''), 'SIN_DEPARTAMENTO')
     HAVING COALESCE(SUM(GREATEST(srd.cantidad_solicitada - COALESCE(srd.cantidad_entregada, 0), 0)), 0) > 0
     ORDER BY departamento ASC`,
    [anio]
  );

  return { anio, departamentos: rows };
}

async function getDetalleSolicitudesEnvioDepartamento(departamentoParam, anioQuery) {
  await ensureEntregasSchema();
  const anio = Number(anioQuery || new Date().getFullYear());
  const departamento = decodeURIComponent(String(departamentoParam || "")).trim();
  if (!departamento) {
    throw { status: 400, message: "Departamento inválido" };
  }

  // 1. Fetch all matching solicitud_retiro headers
  const solicitudHeaders = await all(
    `SELECT
      sr.id,
      sr.id_pedido,
      sr.id_institucion,
      i.nombre AS institucion_nombre,
      i.cue,
      sr.id_usuario_solicitante,
      us.nombre AS solicitante_nombre,
      sr.id_usuario_acepta,
      ua.nombre AS acepta_usuario_nombre,
      sr.fecha_retiro,
      sr.retira_tipo,
      sr.retira_nombre,
      sr.retira_dni,
      COALESCE(sr.solicitar_envio, FALSE) AS solicitar_envio,
      sr.departamento_envio,
      sr.estado,
      sr.id_usuario_entrega,
      ue.nombre AS entrega_usuario_nombre,
      sr.fecha_entrega,
      sr.observaciones,
      sr.created_at,
      COALESCE(pd.tipo, 'anual') AS tipo_pedido
     FROM solicitud_retiro sr
     JOIN institucion i ON i.id_institucion = sr.id_institucion
     JOIN usuario us ON us.id_usuario = sr.id_usuario_solicitante
     JOIN pedido pd ON pd.id_pedido = sr.id_pedido
     LEFT JOIN usuario ue ON ue.id_usuario = sr.id_usuario_entrega
     LEFT JOIN usuario ua ON ua.id_usuario = sr.id_usuario_acepta
     WHERE COALESCE(sr.solicitar_envio, FALSE) = TRUE
       AND sr.estado IN ('pendiente', 'aceptada')
       AND EXTRACT(YEAR FROM sr.fecha_retiro) = $1
       AND LOWER(COALESCE(NULLIF(TRIM(sr.departamento_envio), ''), 'SIN_DEPARTAMENTO')) = LOWER($2)
     ORDER BY sr.fecha_retiro ASC, sr.created_at ASC`,
    [anio, departamento]
  );

  const solicitudes = [];

  if (solicitudHeaders.length > 0) {
    const solicitudIds = solicitudHeaders.map(s => Number(s.id));
    const pedidoIds = [...new Set(solicitudHeaders.map(s => Number(s.id_pedido)))];

    // 2. Fetch all solicitud_retiro_detalle items in one query
    const srdPlaceholders = solicitudIds.map((_, idx) => `$${idx + 1}`).join(", ");
    const srdRows = await all(`
      SELECT 
        srd.id_solicitud_retiro,
        srd.id_producto AS producto_id,
        pr.nombre AS producto_nombre,
        pr.unidad_medida,
        pr.stock_actual,
        srd.cantidad_solicitada,
        srd.cantidad_entregada,
        srd.id_movimiento
      FROM solicitud_retiro_detalle srd
      JOIN producto pr ON pr.id_producto = srd.id_producto
      WHERE srd.id_solicitud_retiro IN (${srdPlaceholders})
      ORDER BY pr.nombre ASC
    `, solicitudIds);

    // Group srdRows by id_solicitud_retiro
    const itemsBySolicitudId = new Map();
    for (const item of srdRows) {
      const solId = Number(item.id_solicitud_retiro);
      if (!itemsBySolicitudId.has(solId)) {
        itemsBySolicitudId.set(solId, []);
      }
      itemsBySolicitudId.get(solId).push({
        producto_id: Number(item.producto_id),
        producto_nombre: item.producto_nombre,
        unidad_medida: item.unidad_medida || "unidad",
        stock_actual: Number(item.stock_actual || 0),
        cantidad_solicitada: Number(item.cantidad_solicitada),
        cantidad_entregada: item.cantidad_entregada !== null ? Number(item.cantidad_entregada) : null,
        id_movimiento: item.id_movimiento ? Number(item.id_movimiento) : null
      });
    }

    // 3. Fetch all pedidoItems in one query for all unique pedidoIds
    const pedidoPlaceholders = pedidoIds.map((_, idx) => `$${idx + 1}`).join(", ");
    const pedidoItemRows = await all(`
      SELECT
        dp.id_pedido,
        dp.id_producto AS producto_id,
        pr.nombre AS producto_nombre,
        pr.unidad_medida,
        pr.stock_actual,
        dp.cantidad_solicitada AS cantidad_anual,
        COALESCE(ent.total_entregado, 0) AS entregado_anual,
        COALESCE(res.total_reservado, 0) AS reservado_anual
      FROM detalle_pedido dp
      JOIN producto pr ON pr.id_producto = dp.id_producto
      LEFT JOIN (
        SELECT id_pedido, id_producto, SUM(cantidad_entregada) AS total_entregado
        FROM pedido_entrega
        WHERE id_pedido IN (${pedidoPlaceholders})
        GROUP BY id_pedido, id_producto
      ) ent ON ent.id_pedido = dp.id_pedido AND ent.id_producto = dp.id_producto
      LEFT JOIN (
        SELECT sr.id_pedido, srd.id_producto, SUM(srd.cantidad_solicitada) AS total_reservado
        FROM solicitud_retiro sr
        JOIN solicitud_retiro_detalle srd ON srd.id_solicitud_retiro = sr.id
        WHERE sr.id_pedido IN (${pedidoPlaceholders}) AND sr.estado IN ('pendiente', 'aceptada')
        GROUP BY sr.id_pedido, srd.id_producto
      ) res ON res.id_pedido = dp.id_pedido AND res.id_producto = dp.id_producto
      WHERE dp.id_pedido IN (${pedidoPlaceholders})
      ORDER BY pr.nombre ASC
    `, pedidoIds);

    // Group pedidoItems by id_pedido
    const pedidoItemsByPedidoId = new Map();
    for (const p of pedidoItemRows) {
      const pId = Number(p.id_pedido);
      if (!pedidoItemsByPedidoId.has(pId)) {
        pedidoItemsByPedidoId.set(pId, []);
      }
      pedidoItemsByPedidoId.get(pId).push(p);
    }

    // 4. Assemble the solicitudes array
    for (const header of solicitudHeaders) {
      const solId = Number(header.id);
      const items = itemsBySolicitudId.get(solId) || [];
      const solicitud = {
        id: solId,
        id_pedido: Number(header.id_pedido),
        id_institucion: Number(header.id_institucion),
        institucion_nombre: header.institucion_nombre,
        cue: header.cue || null,
        id_usuario_solicitante: Number(header.id_usuario_solicitante),
        solicitante_nombre: header.solicitante_nombre,
        fecha_retiro: header.fecha_retiro,
        retira_tipo: header.retira_tipo,
        retira_nombre: header.retira_nombre,
        retira_dni: header.retira_dni,
        solicitar_envio: Boolean(header.solicitar_envio),
        departamento_envio: header.departamento_envio || null,
        estado: header.estado,
        id_usuario_acepta: header.id_usuario_acepta ? Number(header.id_usuario_acepta) : null,
        acepta_usuario_nombre: header.acepta_usuario_nombre || null,
        id_usuario_entrega: header.id_usuario_entrega ? Number(header.id_usuario_entrega) : null,
        entrega_usuario_nombre: header.entrega_usuario_nombre || null,
        fecha_entrega: header.fecha_entrega,
        observaciones: header.observaciones,
        created_at: header.created_at,
        tipo_pedido: header.tipo_pedido || "anual",
        items
      };

      const pedidoItems = pedidoItemsByPedidoId.get(solicitud.id_pedido) || [];
      solicitud.productos_pedido_anual = pedidoItems.map((p) => {
        const solItem = items.find((item) => item.producto_id === p.producto_id);
        const cantSol = solItem ? Number(solItem.cantidad_solicitada) : 0;
        const cantEnt = solItem ? Number(solItem.cantidad_entregada) : 0;

        const maxPermitido = Number(p.cantidad_anual) - Number(p.entregado_anual) - Number(p.reservado_anual) + cantSol - cantEnt;

        return {
          producto_id: Number(p.producto_id),
          producto_nombre: p.producto_nombre,
          unidad_medida: p.unidad_medida || "unidad",
          stock_actual: Number(p.stock_actual || 0),
          cantidad_anual: Number(p.cantidad_anual),
          entregado_anual: Number(p.entregado_anual),
          reservado_anual: Number(p.reservado_anual),
          max_permitido: Math.max(0, maxPermitido),
          en_solicitud: !!solItem,
          cantidad_solicitada_solicitud: cantSol,
          cantidad_entregada_solicitud: cantEnt
        };
      });

      solicitudes.push(solicitud);
    }
  }

  const faltantesSolicitud = await getInstitucionesFaltantesSolicitudPorDepartamento(departamento, anio);

  const resumen = {
    total_solicitudes: solicitudes.length,
    total_escuelas: new Set(solicitudes.map((s) => Number(s.id_institucion))).size,
    total_productos: solicitudes.reduce((acc, s) => acc + (Array.isArray(s.items) ? s.items.length : 0), 0),
    total_cantidad: solicitudes.reduce(
      (acc, s) => acc + (s.items || []).reduce((sub, item) => sub + Math.max(0, Number(item.cantidad_solicitada || 0) - Number(item.cantidad_entregada || 0)), 0),
      0
    ),
  };

  const resumenFaltantes = {
    total_instituciones: faltantesSolicitud.length,
    total_productos_pendientes: faltantesSolicitud.reduce((acc, item) => acc + Number(item.productos_pendientes || 0), 0),
    total_cantidad_pendiente: faltantesSolicitud.reduce((acc, item) => acc + Number(item.cantidad_pendiente_total || 0), 0),
  };

  const sedesRows = await all(
    `SELECT id_institucion, nombre, cue, establecimiento_cabecera 
     FROM institucion 
     WHERE LOWER(COALESCE(NULLIF(TRIM(departamento), ''), 'sin_departamento')) = LOWER($1)
     ORDER BY nombre ASC`,
    [departamento]
  );

  return {
    anio,
    departamento,
    resumen,
    resumen_faltantes: resumenFaltantes,
    solicitudes,
    faltantes_solicitud: faltantesSolicitud,
    sedes_posibles: sedesRows,
  };
}

async function registrarEgresoMultipleEnvio(userId, body) {
  await ensureEntregasSchema();

  const {
    departamento,
    anio,
    id_deposito,
    observaciones,
    entregas,
    tipo_envio,
    id_institucion_sede,
  } = body || {};

  const departamentoValue = String(departamento || "").trim();
  const anioValue = Number(anio || new Date().getFullYear());
  const depositoId = parsePositiveInt(id_deposito);
  const entregasPayload = Array.isArray(entregas) ? entregas : [];

  if (!departamentoValue || !depositoId || entregasPayload.length === 0) {
    throw { status: 400, message: "Faltan datos obligatorios para registrar el egreso por departamento" };
  }

  const porSolicitud = new Map();
  const totalPorProducto = new Map();

  for (const row of entregasPayload) {
    const solicitudId = parsePositiveInt(row?.id_solicitud);
    const items = Array.isArray(row?.items) ? row.items : [];
    if (!solicitudId || items.length === 0) continue;

    if (!porSolicitud.has(solicitudId)) porSolicitud.set(solicitudId, []);

    for (const item of items) {
      const productoId = parsePositiveInt(item?.id_producto);
      const cantidad = parsePositiveInt(item?.cantidad);
      if (!productoId || !cantidad) continue;

      porSolicitud.get(solicitudId).push({ id_producto: productoId, cantidad });
      totalPorProducto.set(productoId, (totalPorProducto.get(productoId) || 0) + cantidad);
    }
  }

  const solicitudIds = [...porSolicitud.keys()];
  if (solicitudIds.length === 0 || totalPorProducto.size === 0) {
    throw { status: 400, message: "No hay entregas válidas para procesar" };
  }

  const isEscuelaSede = tipo_envio === 'escuela_sede';
  if (isEscuelaSede && !parsePositiveInt(id_institucion_sede)) {
    throw { status: 400, message: "Debe especificar la institución sede" };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let depositoSedeId = null;
    if (isEscuelaSede) {
      // Find or create virtual deposit for Sede
      const sedeRes = await client.query(`SELECT id_deposito FROM deposito WHERE id_institucion = $1 AND tipo_deposito = 'ESCUELA_SEDE'`, [id_institucion_sede]);
      if (sedeRes.rows.length > 0) {
        depositoSedeId = sedeRes.rows[0].id_deposito;
      } else {
        const instRes = await client.query(`SELECT nombre FROM institucion WHERE id_institucion = $1`, [id_institucion_sede]);
        const nombreInst = instRes.rows[0]?.nombre || 'Desconocida';
        const newDepRes = await client.query(
          `INSERT INTO deposito (nombre, descripcion, tipo, activo, tipo_deposito, id_institucion) 
           VALUES ($1, $2, 'virtual', true, 'ESCUELA_SEDE', $3) RETURNING id_deposito`,
          [`Sede - ${nombreInst}`, 'Sub-depósito temporal de Sede cabecera', id_institucion_sede]
        );
        depositoSedeId = newDepRes.rows[0].id_deposito;
      }
    }

    const solicitudesRes = await client.query(
      `SELECT
         sr.id,
         sr.id_pedido,
         sr.id_institucion,
         sr.estado,
         COALESCE(sr.solicitar_envio, FALSE) AS solicitar_envio,
         COALESCE(NULLIF(TRIM(sr.departamento_envio), ''), 'SIN_DEPARTAMENTO') AS departamento
       FROM solicitud_retiro sr
       WHERE sr.id = ANY($1::int[])
       FOR UPDATE`,
      [solicitudIds]
    );

    if (solicitudesRes.rows.length !== solicitudIds.length) {
      throw badRequest("Hay solicitudes que no existen");
    }

    const solicitudesMap = new Map();
    for (const row of solicitudesRes.rows) {
      const solicitudId = Number(row.id);
      const depRow = String(row.departamento || "SIN_DEPARTAMENTO").trim();
      if (!Boolean(row.solicitar_envio)) {
        throw badRequest(`La solicitud #${solicitudId} no está marcada para envío`);
      }
      if (!["pendiente", "aceptada"].includes(String(row.estado || ""))) {
        throw badRequest(`La solicitud #${solicitudId} no se puede procesar en estado ${row.estado}`);
      }
      if (depRow.toLowerCase() !== departamentoValue.toLowerCase()) {
        throw badRequest(`La solicitud #${solicitudId} no pertenece al departamento ${departamentoValue}`);
      }
      solicitudesMap.set(solicitudId, {
        id_pedido: Number(row.id_pedido),
        id_institucion: Number(row.id_institucion),
        estado: String(row.estado),
      });
    }

    const detallesRes = await client.query(
      `SELECT
         srd.id_solicitud_retiro,
         srd.id_producto,
         srd.cantidad_solicitada,
         COALESCE(srd.cantidad_entregada, 0) AS cantidad_entregada,
         p.nombre AS producto_nombre
       FROM solicitud_retiro_detalle srd
       JOIN producto p ON p.id_producto = srd.id_producto
       WHERE srd.id_solicitud_retiro = ANY($1::int[])
       FOR UPDATE`,
      [solicitudIds]
    );

    const detalleMap = new Map();
    for (const row of detallesRes.rows) {
      const key = `${Number(row.id_solicitud_retiro)}:${Number(row.id_producto)}`;
      detalleMap.set(key, {
        cantidad_solicitada: Number(row.cantidad_solicitada || 0),
        cantidad_entregada: Number(row.cantidad_entregada || 0),
        producto_nombre: row.producto_nombre,
      });
    }

    for (const [solicitudId, items] of porSolicitud.entries()) {
      const solicitudData = solicitudesMap.get(solicitudId);
      const idPedido = solicitudData.id_pedido;

      // Fetch annual approved order items
      const pedidoItemsRes = await client.query(`
        SELECT
          dp.id_producto,
          dp.cantidad_solicitada AS cantidad_anual,
          p.nombre AS producto_nombre
        FROM detalle_pedido dp
        JOIN producto p ON p.id_producto = dp.id_producto
        WHERE dp.id_pedido = $1
      `, [idPedido]);

      const pedidoItemsMap = new Map(pedidoItemsRes.rows.map(r => [Number(r.id_producto), r]));

      // Fetch already delivered quantity for this pedido
      const entregasRes = await client.query(`
        SELECT id_producto, SUM(cantidad_entregada) AS total_entregado
        FROM pedido_entrega
        WHERE id_pedido = $1
        GROUP BY id_producto
      `, [idPedido]);
      const entregasMap = new Map(entregasRes.rows.map(r => [Number(r.id_producto), Number(r.total_entregado || 0)]));

      // Fetch reservations in pending/accepted requests
      const reservadoRes = await client.query(`
        SELECT srd.id_producto, SUM(srd.cantidad_solicitada) AS total_reservado
        FROM solicitud_retiro sr
        JOIN solicitud_retiro_detalle srd ON srd.id_solicitud_retiro = sr.id
        WHERE sr.id_pedido = $1 AND sr.estado IN ('pendiente', 'aceptada')
        GROUP BY srd.id_producto
      `, [idPedido]);
      const reservadoMap = new Map(reservadoRes.rows.map(r => [Number(r.id_producto), Number(r.total_reservado || 0)]));

      for (const item of items) {
        const pedItem = pedidoItemsMap.get(item.id_producto);
        if (!pedItem) {
          throw badRequest(`El producto ${item.id_producto} no pertenece al pedido anual aprobado de la escuela.`);
        }

        const cantAnual = Number(pedItem.cantidad_anual || 0);
        const cantEntregadaAnual = Number(entregasMap.get(item.id_producto) || 0);
        const cantReservadaAnual = Number(reservadoMap.get(item.id_producto) || 0);

        const key = `${solicitudId}:${item.id_producto}`;
        const detalle = detalleMap.get(key);
        const cantSolSolicitud = detalle ? Number(detalle.cantidad_solicitada || 0) : 0;
        const cantEntregadaSolicitud = detalle ? Number(detalle.cantidad_entregada || 0) : 0;

        const maxPermitido = cantAnual - cantEntregadaAnual - cantReservadaAnual + cantSolSolicitud - cantEntregadaSolicitud;

        if (item.cantidad > maxPermitido) {
          throw badRequest(`La cantidad (${item.cantidad}) para ${pedItem.producto_nombre} supera el saldo disponible del pedido anual (${maxPermitido})`);
        }
      }
    }

    const stockRes = await client.query(
      `SELECT id_producto, cantidad
       FROM stock_deposito
       WHERE id_deposito = $1
         AND id_producto = ANY($2::int[])
       FOR UPDATE`,
      [depositoId, [...totalPorProducto.keys()]]
    );
    const stockMap = new Map(stockRes.rows.map((row) => [Number(row.id_producto), Number(row.cantidad || 0)]));

    for (const [productoId, total] of totalPorProducto.entries()) {
      const disponible = Number(stockMap.get(productoId) || 0);
      if (disponible < total) {
        throw badRequest(`Stock insuficiente para producto ${productoId}. Disponible: ${disponible}`);
      }
    }

    const solicitudesEntregadas = new Set();
    const solicitudesAceptadas = new Set();
    let movimientosCreados = 0;

    const loteResult = await client.query(
      `INSERT INTO distribucion_lote
        (anio, zona_id, id_deposito, estado, observaciones, usuario_id, origen, departamento)
       VALUES ($1, NULL, $2, 'en_transito', $3, $4, 'solicitud_envio', $5)
       RETURNING id`,
      [
        anioValue,
        isEscuelaSede ? depositoSedeId : depositoId,
        observaciones || `Envío por departamento ${departamentoValue}`,
        userId,
        departamentoValue,
      ]
    );
    const loteId = Number(loteResult.rows[0].id);
    const loteItemsMap = new Map();

    for (const [solicitudId, items] of porSolicitud.entries()) {
      const solicitudData = solicitudesMap.get(solicitudId);

      if (solicitudData.estado === "pendiente") {
        await client.query(
          `UPDATE solicitud_retiro
           SET estado = 'aceptada', id_usuario_acepta = $1, fecha_aceptacion = NOW()
           WHERE id = $2`,
          [userId, solicitudId]
        );
        solicitudesAceptadas.add(solicitudId);
      }

      for (const item of items) {
        const movimiento = await client.query(
          `INSERT INTO movimiento_stock
             (id_producto, tipo, cantidad, estado_producto, cargo_retira, id_institucion, id_usuario, motivo, fecha_movimiento, id_deposito)
           VALUES ($1, 'egreso', $2, 'nuevo', $3, $4, $5, $6, NOW(), $7)
           RETURNING id_movimiento`,
          [
            item.id_producto,
            item.cantidad,
            isEscuelaSede ? `Traslado a Sede ${departamentoValue}` : `Envio por departamento ${departamentoValue}`,
            solicitudData.id_institucion,
            userId,
            observaciones || (isEscuelaSede ? `Traslado a Escuela Sede - Solicitud #${solicitudId}` : `Entrega por envío - Solicitud #${solicitudId} (${departamentoValue})`),
            depositoId,
          ]
        );
        const movimientoId = Number(movimiento.rows[0].id_movimiento);
        movimientosCreados += 1;

        await client.query(
          `INSERT INTO pedido_entrega
             (id_pedido, id_movimiento, id_producto, cantidad_entregada, id_usuario, observaciones, id_solicitud_retiro)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            solicitudData.id_pedido,
            movimientoId,
            item.id_producto,
            item.cantidad,
            userId,
            observaciones || null,
            solicitudId,
          ]
        );

        const updateRes = await client.query(
          `UPDATE solicitud_retiro_detalle
           SET cantidad_entregada = COALESCE(cantidad_entregada, 0) + $1,
               id_movimiento = $2
           WHERE id_solicitud_retiro = $3 AND id_producto = $4`,
          [item.cantidad, movimientoId, solicitudId, item.id_producto]
        );

        if (updateRes.rowCount === 0) {
          await client.query(
            `INSERT INTO solicitud_retiro_detalle
               (id_solicitud_retiro, id_producto, cantidad_solicitada, cantidad_entregada, id_movimiento)
             VALUES ($1, $2, 0, $3, $4)`,
            [solicitudId, item.id_producto, item.cantidad, movimientoId]
          );
        }

        const loteKey = `${solicitudData.id_institucion}:${item.id_producto}`;
        loteItemsMap.set(loteKey, {
          id_institucion: solicitudData.id_institucion,
          id_producto: item.id_producto,
          amount: Number((loteItemsMap.get(loteKey)?.amount || 0) + Number(item.cantidad || 0)),
        });
      }

      const pendientesRes = await client.query(
        `SELECT COUNT(*)::int AS pendientes
         FROM solicitud_retiro_detalle
         WHERE id_solicitud_retiro = $1
           AND COALESCE(cantidad_entregada, 0) < cantidad_solicitada`,
        [solicitudId]
      );

      if (Number(pendientesRes.rows[0]?.pendientes || 0) === 0) {
        await client.query(
          `UPDATE solicitud_retiro
           SET estado = $1,
               id_usuario_entrega = $2,
               fecha_entrega = NOW(),
               id_usuario_acepta = COALESCE(id_usuario_acepta, $2),
               fecha_aceptacion = COALESCE(fecha_aceptacion, NOW())
           WHERE id = $3`,
          [isEscuelaSede ? 'en_sede' : 'entregado', userId, solicitudId]
        );
        solicitudesEntregadas.add(solicitudId);
      }
    }

    for (const [productoId, total] of totalPorProducto.entries()) {
      await client.query(
        `UPDATE stock_deposito
         SET cantidad = cantidad - $1
         WHERE id_deposito = $2 AND id_producto = $3`,
        [total, depositoId, productoId]
      );
      
      if (isEscuelaSede && depositoSedeId) {
        // Ingresar al depósito sede
        await client.query(
          `INSERT INTO stock_deposito (id_deposito, id_producto, cantidad)
           VALUES ($1, $2, $3)
           ON CONFLICT (id_deposito, id_producto) DO UPDATE SET cantidad = stock_deposito.cantidad + $3`,
          [depositoSedeId, productoId, total]
        );
      }
    }

    for (const loteItem of loteItemsMap.values()) {
      await client.query(
        `INSERT INTO distribucion_lote_item
           (lote_id, id_institucion, id_producto, cantidad_planificada, cantidad_recibida, estado_recepcion)
         VALUES ($1, $2, $3, $4, 0, 'pendiente')`,
        [
          loteId,
          Number(loteItem.id_institucion),
          Number(loteItem.id_producto),
          Number(loteItem.amount || 0), // Wait, let's map this properly
        ]
      );
    }

    await client.query("COMMIT");

    return {
      lote_id: loteId,
      departamento: departamentoValue,
      movimientos_creados: movimientosCreados,
      solicitudes_aceptadas: [...solicitudesAceptadas],
      solicitudes_entregadas: [...solicitudesEntregadas],
      total_productos: totalPorProducto.size,
      total_cantidad: [...totalPorProducto.values()].reduce((acc, value) => acc + value, 0),
    };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

async function getSeguimientoEnvios(query) {
  await ensureEntregasSchema();

  const anioValue = Number(query.anio || new Date().getFullYear());
  const departamento = String(query.departamento || "").trim();
  const estadoLote = String(query.estado_lote || "").trim().toLowerCase();

  const hasDepto = await columnExists('distribucion_lote', 'departamento');
  const hasOrigen = await columnExists('distribucion_lote', 'origen');

  if (!hasDepto || !hasOrigen) {
    return {
      anio: anioValue,
      resumen: {
        total_lotes: 0,
        en_transito: 0,
        parcialmente_recibidos: 0,
        con_reclamos: 0,
        recibidos_totales: 0,
      },
      lotes: [],
    };
  }

  const clauses = ["l.origen = 'solicitud_envio'", "l.anio = $1"];
  const params = [anioValue];

  if (departamento) {
    params.push(departamento);
    clauses.push(`LOWER(COALESCE(l.departamento, 'SIN_DEPARTAMENTO')) = LOWER($${params.length})`);
  }
  if (estadoLote) {
    params.push(estadoLote);
    clauses.push(`LOWER(COALESCE(l.estado, 'en_transito')) = LOWER($${params.length})`);
  }

  const rows = await all(
    `SELECT
       l.id AS lote_id,
       l.anio,
       COALESCE(NULLIF(TRIM(l.departamento), ''), 'SIN_DEPARTAMENTO') AS departamento,
       COALESCE(NULLIF(TRIM(l.estado), ''), 'en_transito') AS estado_lote,
       l.created_at,
       l.observaciones,
       l.id_deposito,
       d.nombre AS deposito_nombre,
       u.nombre AS usuario_nombre,
       u.apellido AS usuario_apellido,
       COALESCE(stats.total_instituciones, 0) AS total_instituciones,
       COALESCE(stats.total_items, 0) AS total_items,
       COALESCE(stats.cantidad_planificada_total, 0) AS cantidad_planificada_total,
       COALESCE(stats.cantidad_recibida_total, 0) AS cantidad_recibida_total,
       COALESCE(stats.cantidad_danada_total, 0) AS cantidad_danada_total,
       COALESCE(stats.items_pendientes, 0) AS items_pendientes,
       COALESCE(stats.items_parciales, 0) AS items_parciales,
       COALESCE(stats.items_recibidos, 0) AS items_recibidos,
       COALESCE(stats.items_reclamo, 0) AS items_reclamo
     FROM distribucion_lote l
     LEFT JOIN deposito d ON d.id_deposito = l.id_deposito
     LEFT JOIN usuario u ON u.id_usuario = l.usuario_id
     LEFT JOIN (
       SELECT
         lote_id,
         COUNT(DISTINCT id_institucion) AS total_instituciones,
         COUNT(*) AS total_items,
         SUM(COALESCE(cantidad_planificada, 0)) AS cantidad_planificada_total,
         SUM(COALESCE(cantidad_recibida, 0)) AS cantidad_recibida_total,
         SUM(COALESCE(cantidad_danada, 0)) AS cantidad_danada_total,
         COUNT(*) FILTER (WHERE estado_recepcion = 'pendiente') AS items_pendientes,
         COUNT(*) FILTER (WHERE estado_recepcion = 'parcial') AS items_parciales,
         COUNT(*) FILTER (WHERE estado_recepcion = 'recibido') AS items_recibidos,
         COUNT(*) FILTER (WHERE estado_recepcion = 'reclamo') AS items_reclamo
       FROM distribucion_lote_item
       GROUP BY lote_id
     ) stats ON stats.lote_id = l.id
     WHERE ${clauses.join(" AND ")}
     ORDER BY l.created_at DESC, l.id DESC`,
    params
  );

  const resumen = {
    total_lotes: rows.length,
    en_transito: rows.filter((row) => String(row.estado_lote) === "en_transito").length,
    parcialmente_recibidos: rows.filter((row) => String(row.estado_lote) === "parcialmente_recibido").length,
    con_reclamos: rows.filter((row) => String(row.estado_lote) === "con_reclamos").length,
    recibidos_totales: rows.filter((row) => String(row.estado_lote) === "recibido_total").length,
  };

  return { anio: anioValue, resumen, lotes: rows };
}

async function getDetalleSeguimientoLote(loteIdQuery) {
  await ensureEntregasSchema();

  const loteId = parsePositiveInt(loteIdQuery);
  if (!loteId) throw { status: 400, message: "Lote inválido" };

  const lote = await get(
    `SELECT
       l.id AS lote_id,
       l.anio,
       COALESCE(NULLIF(TRIM(l.departamento), ''), 'SIN_DEPARTAMENTO') AS departamento,
       COALESCE(NULLIF(TRIM(l.estado), ''), 'en_transito') AS estado_lote,
       l.created_at,
       l.observaciones,
       l.id_deposito,
       d.nombre AS deposito_nombre,
       u.nombre AS usuario_nombre,
       u.apellido AS usuario_apellido
     FROM distribucion_lote l
     LEFT JOIN deposito d ON d.id_deposito = l.id_deposito
     LEFT JOIN usuario u ON u.id_usuario = l.usuario_id
     WHERE l.id = $1
       AND l.origen = 'solicitud_envio'`,
    [loteId]
  );

  if (!lote) throw { status: 404, message: "Lote no encontrado" };

  const itemsRows = await all(
    `SELECT
       li.id AS lote_item_id,
       li.id_institucion,
       i.nombre AS institucion_nombre,
       i.cue,
       li.id_producto,
       p.nombre || COALESCE(' - ' || NULLIF(p.marca, ''), '') AS producto_nombre,
       p.unidad_medida,
       COALESCE(li.cantidad_planificada, 0) AS cantidad_planificada,
       COALESCE(li.cantidad_recibida, 0) AS cantidad_recibida,
       COALESCE(li.cantidad_danada, 0) AS cantidad_danada,
       COALESCE(li.estado_recepcion, 'pendiente') AS estado_recepcion,
       COALESCE(li.coincide_esperado, TRUE) AS coincide_esperado,
       li.reclamo_directivo,
       li.detalle_danio,
       li.observaciones_directivo,
       li.recibido_at,
       du.nombre AS directivo_nombre,
       du.apellido AS directivo_apellido
     FROM distribucion_lote_item li
     JOIN institucion i ON i.id_institucion = li.id_institucion
     JOIN producto p ON p.id_producto = li.id_producto
     LEFT JOIN usuario du ON du.id_usuario = li.directivo_usuario_id
     WHERE li.lote_id = $1
     ORDER BY i.nombre ASC, p.nombre ASC`,
    [loteId]
  );

  const institucionesMap = new Map();
  for (const row of itemsRows) {
    const institucionId = Number(row.id_institucion);
    if (!institucionesMap.has(institucionId)) {
      institucionesMap.set(institucionId, {
        id_institucion: institucionId,
        institucion_nombre: row.institucion_nombre,
        cue: row.cue || null,
        items: [],
      });
    }
    institucionesMap.get(institucionId).items.push({
      lote_item_id: Number(row.lote_item_id),
      id_producto: Number(row.id_producto),
      producto_nombre: row.producto_nombre,
      unidad_medida: row.unidad_medida || "unidad",
      cantidad_planificada: Number(row.cantidad_planificada || 0),
      cantidad_recibida: Number(row.cantidad_recibida || 0),
      cantidad_danada: Number(row.cantidad_danada || 0),
      estado_recepcion: row.estado_recepcion,
      coincide_esperado: Boolean(row.coincide_esperado),
      reclamo_directivo: row.reclamo_directivo || null,
      detalle_danio: row.detalle_danio || null,
      observaciones_directivo: row.observaciones_directivo || null,
      recibido_at: row.recibido_at || null,
      directivo_nombre: row.directivo_nombre || null,
      directivo_apellido: row.directivo_apellido || null,
    });
  }

  const items = itemsRows.map((row) => ({
    cantidad_planificada: Number(row.cantidad_planificada || 0),
    cantidad_recibida: Number(row.cantidad_recibida || 0),
    cantidad_danada: Number(row.cantidad_danada || 0),
    estado_recepcion: row.estado_recepcion,
  }));

  const resumen = {
    total_instituciones: institucionesMap.size,
    total_items: items.length,
    cantidad_planificada_total: items.reduce((acc, row) => acc + row.cantidad_planificada, 0),
    cantidad_recibida_total: items.reduce((acc, row) => acc + row.cantidad_recibida, 0),
    cantidad_danada_total: items.reduce((acc, row) => acc + row.cantidad_danada, 0),
    items_pendientes: items.filter((row) => row.estado_recepcion === "pendiente").length,
    items_parciales: items.filter((row) => row.estado_recepcion === "parcial").length,
    items_recibidos: items.filter((row) => row.estado_recepcion === "recibido").length,
    items_reclamo: items.filter((row) => row.estado_recepcion === "reclamo").length,
  };

  return {
    lote,
    resumen,
    instituciones: Array.from(institucionesMap.values()),
  };
}

async function aceptarSolicitudRetiro(solicitudIdQuery, userId) {
  await ensureEntregasSchema();

  const solicitudId = parsePositiveInt(solicitudIdQuery);
  if (!solicitudId) throw { status: 400, message: "Solicitud inválida" };

  const solicitud = await getSolicitudRetiro(solicitudId);
  if (!solicitud) throw { status: 404, message: "Solicitud de retiro no encontrada" };

  if (solicitud.estado !== 'pendiente') {
    throw { status: 400, message: 'Solo se pueden aceptar solicitudes pendientes' };
  }

  await run(`UPDATE solicitud_retiro SET estado = 'aceptada', id_usuario_acepta = ?, fecha_aceptacion = NOW() WHERE id = ?`, [userId, solicitudId]);

  return await getSolicitudRetiro(solicitudId);
}

async function getSolicitudesPendientes() {
  await ensureEntregasSchema();

  const rows = await all(`
    SELECT id
    FROM solicitud_retiro
    WHERE estado IN ('pendiente', 'aceptada')
    ORDER BY fecha_retiro ASC, created_at ASC
  `);

  const solicitudes = [];
  for (const row of rows) {
    const solicitud = await getSolicitudRetiro(row.id);
    if (solicitud) solicitudes.push(solicitud);
  }

  return solicitudes;
}

async function getSolicitudesEntregadas(user) {
  await ensureEntregasSchema();

  let rows;
  if (user.role === "directivo") {
    rows = await all(
      "SELECT id FROM solicitud_retiro WHERE id_usuario_solicitante = ? AND estado = 'entregado' ORDER BY fecha_entrega DESC NULLS LAST, created_at DESC",
      [user.sub]
    );
  } else {
    rows = await all(
      "SELECT id FROM solicitud_retiro WHERE estado = 'entregado' ORDER BY fecha_entrega DESC NULLS LAST, created_at DESC LIMIT 200",
      []
    );
  }

  const solicitudes = [];
  for (const row of rows) {
    const sol = await getSolicitudRetiro(row.id);
    if (sol) solicitudes.push(sol);
  }

  return solicitudes;
}

async function getComprobanteRetiro(id, user) {
  await ensureEntregasSchema();

  const solicitud = await getSolicitudRetiro(id);
  if (!solicitud) {
    throw { status: 404, message: "Solicitud de retiro no encontrada" };
  }

  if (user.role === "directivo" && solicitud.id_usuario_solicitante !== Number(user.sub)) {
    throw { status: 403, message: "No tenés acceso a este comprobante" };
  }

  return solicitud;
}

async function entregarSolicitudRetiro(solicitudIdQuery, userId) {
  await ensureEntregasSchema();

  const solicitudId = parsePositiveInt(solicitudIdQuery);
  if (!solicitudId) {
    throw { status: 400, message: "Solicitud inválida" };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const solicitud = await getSolicitudRetiro(solicitudId, client);
    if (!solicitud) {
      throw { status: 404, message: "Solicitud de retiro no encontrada" };
    }

    if (!(solicitud.estado === "pendiente" || solicitud.estado === "aceptada")) {
      throw { status: 400, message: "La solicitud ya fue procesada" };
    }

    const pedidoRes = await client.query(`
      SELECT id_pedido, id_institucion, COALESCE(tipo, 'anual') AS tipo
      FROM pedido
      WHERE id_pedido = $1
        AND estado = 'aprobado'
        AND (
          (COALESCE(tipo, 'anual') = 'anual' AND aprobado_director_area = TRUE)
          OR COALESCE(tipo, 'anual') = 'refuerzo'
        )
    `, [solicitud.id_pedido]);

    if (!pedidoRes.rowCount) {
      throw { status: 400, message: "El pedido anual ya no está disponible para entregar" };
    }

    const movimientosIds = [];
    const cargoRetira = solicitud.retira_tipo === "otro"
      ? `Otro: ${solicitud.retira_nombre} - DNI ${solicitud.retira_dni}`
      : "Directivo";

    for (const item of solicitud.items) {
      const productoRes = await client.query(
        "SELECT id_producto, nombre, COALESCE(stock_actual, 0) AS stock_actual FROM producto WHERE id_producto = $1 FOR UPDATE",
        [item.producto_id]
      );
      const producto = productoRes.rows[0];

      if (!producto) {
        throw { status: 404, message: `Producto ${item.producto_id} no encontrado` };
      }

      // Verificar stock en depósito 1 (Central)
      const stockDepRes = await client.query(
        "SELECT cantidad FROM stock_deposito WHERE id_deposito = 1 AND id_producto = $1 FOR UPDATE",
        [item.producto_id]
      );
      const stockDep = stockDepRes.rows[0]?.cantidad || 0;

      const detalleRes = await client.query(`
        SELECT cantidad_solicitada
        FROM detalle_pedido
        WHERE id_pedido = $1 AND id_producto = $2
      `, [solicitud.id_pedido, item.producto_id]);

      if (!detalleRes.rowCount) {
        throw { status: 400, message: `${producto.nombre} no pertenece al pedido anual` };
      }

      const entregadoRes = await client.query(`
        SELECT COALESCE(SUM(cantidad_entregada), 0) AS total
        FROM pedido_entrega
        WHERE id_pedido = $1 AND id_producto = $2
      `, [solicitud.id_pedido, item.producto_id]);

      const cantidadPedido = Number(detalleRes.rows[0].cantidad_solicitada || 0);
      const entregadoTotal = Number(entregadoRes.rows[0]?.total || 0);
      const cantidad = Number(item.cantidad_solicitada || 0);

      if (entregadoTotal + cantidad > cantidadPedido) {
        throw {
          status: 400,
          message: `La entrega de ${producto.nombre} supera el saldo pendiente del pedido`
        };
      }

      // Revisar si se pasa del stock del depósito
      if (Number(stockDep) < cantidad) {
        throw {
          status: 400,
          message: `Stock insuficiente en Depósito Central para ${producto.nombre}. Disponible: ${stockDep}, solicitado: ${cantidad}`
        };
      }

      // Restar stock del depósito
      await client.query(
        "UPDATE stock_deposito SET cantidad = cantidad - $1 WHERE id_deposito = 1 AND id_producto = $2",
        [cantidad, item.producto_id]
      );

      const movResult = await client.query(`
        INSERT INTO movimiento_stock
          (id_producto, tipo, cantidad, estado_producto, cargo_retira, id_institucion, id_usuario, motivo, fecha_movimiento, id_deposito)
        VALUES ($1, 'egreso', $2, 'nuevo', $3, $4, $5, $6, NOW(), 1)
        RETURNING id_movimiento
      `, [
        item.producto_id,
        cantidad,
        cargoRetira,
        solicitud.id_institucion,
        userId,
        `Entrega de solicitud de retiro #${solicitud.id} - pedido ${pedidoRes.rows[0].tipo} #${solicitud.id_pedido}`
      ]);

      const idMovimiento = movResult.rows[0].id_movimiento;
      movimientosIds.push(idMovimiento);

      await client.query(`
        INSERT INTO pedido_entrega
          (id_pedido, id_movimiento, id_producto, cantidad_entregada, id_usuario, observaciones, id_solicitud_retiro)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        solicitud.id_pedido,
        idMovimiento,
        item.producto_id,
        cantidad,
        userId,
        solicitud.observaciones || null,
        solicitud.id
      ]);

      await client.query(`
        UPDATE solicitud_retiro_detalle
        SET cantidad_entregada = $1,
            id_movimiento = $2
        WHERE id_solicitud_retiro = $3 AND id_producto = $4
      `, [cantidad, idMovimiento, solicitud.id, item.producto_id]);
    }

    const itemsTotalesRes = await client.query(`
      SELECT dp.id_producto, dp.cantidad_solicitada
      FROM detalle_pedido dp
      WHERE dp.id_pedido = $1
    `, [solicitud.id_pedido]);

    let pedidoCompleto = true;
    for (const itemTotal of itemsTotalesRes.rows) {
      const entregadoRes = await client.query(`
        SELECT COALESCE(SUM(cantidad_entregada), 0) AS total
        FROM pedido_entrega
        WHERE id_pedido = $1 AND id_producto = $2
      `, [solicitud.id_pedido, itemTotal.id_producto]);

      if (Number(entregadoRes.rows[0]?.total || 0) < Number(itemTotal.cantidad_solicitada)) {
        pedidoCompleto = false;
        break;
      }
    }

    if (pedidoCompleto) {
      await client.query("UPDATE pedido SET estado = 'finalizado' WHERE id_pedido = $1", [solicitud.id_pedido]);
    }

    await client.query(`
      UPDATE solicitud_retiro
      SET estado = 'entregado',
          id_usuario_entrega = $1,
          fecha_entrega = NOW()
      WHERE id = $2
    `, [userId, solicitud.id]);

    await client.query("COMMIT");

    const comprobante = await getSolicitudRetiro(solicitud.id);
    return {
      movimientos: movimientosIds,
      pedido_completo: pedidoCompleto,
      solicitud: comprobante
    };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

async function retirarPedido(userId, body) {
  await ensureEntregasSchema();

  const { id_pedido, items, cargo_retira, observaciones } = body;
  const pedidoId = parsePositiveInt(id_pedido);

  if (!pedidoId || !items || !Array.isArray(items) || items.length === 0) {
    throw { status: 400, message: "Faltan campos obligatorios (id_pedido, items)" };
  }

  if (!cargo_retira) {
    throw { status: 400, message: "El cargo de quien retira es obligatorio" };
  }

  const parsedItems = items.map((item) => ({
    producto_id: parsePositiveInt(item?.producto_id),
    cantidad: parsePositiveInt(item?.cantidad),
    estado_producto: String(item?.estado_producto || "nuevo").trim() || "nuevo"
  }));

  if (parsedItems.some((item) => !item.producto_id || !item.cantidad)) {
    throw { status: 400, message: "Todos los items deben tener producto_id y cantidad mayor a cero" };
  }

  const uniqueProductIds = new Set(parsedItems.map((item) => item.producto_id));
  if (uniqueProductIds.size !== parsedItems.length) {
    throw { status: 400, message: "No podés repetir productos en la misma entrega" };
  }

  // Verificar que el pedido existe y está aprobado
  const pedido = await get(`
    SELECT p.id_pedido, p.id_institucion, p.estado, p.aprobado_director_area, i.nombre AS institucion_nombre
    FROM pedido p
    JOIN institucion i ON i.id_institucion = p.id_institucion
    WHERE p.id_pedido = $1
      AND p.estado = 'aprobado'
      AND p.aprobado_director_area = TRUE
      AND COALESCE(p.tipo, 'anual') = 'anual'
  `, [pedidoId]);

  if (!pedido) {
    throw { status: 404, message: "Pedido no encontrado o no está disponible para retirar" };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const movimientosIds = [];
    const entregasData = [];

    for (const item of parsedItems) {
      const { producto_id, cantidad, estado_producto } = item;

      if (!producto_id || !cantidad || cantidad <= 0) {
        throw { status: 400, message: `Item inválido: producto_id ${producto_id}, cantidad ${cantidad}` };
      }

      // Verificar stock actual
      const productoResult = await client.query(
        "SELECT id_producto, nombre, COALESCE(stock_actual, 0) AS stock_actual FROM producto WHERE id_producto = $1 FOR UPDATE",
        [producto_id]
      );
      const producto = productoResult.rows[0];

      if (!producto) {
        throw { status: 404, message: `Producto ${producto_id} no encontrado` };
      }

      if (Number(producto.stock_actual) < cantidad) {
        throw {
          status: 400,
          message: `Stock insuficiente para ${producto.nombre}. Stock: ${producto.stock_actual}, Solicitado: ${cantidad}`
        };
      }

      // Verificar cantidad pendiente en el pedido
      const detallePedidoResult = await client.query(`
        SELECT cantidad_solicitada FROM detalle_pedido 
        WHERE id_pedido = $1 AND id_producto = $2
      `, [pedidoId, producto_id]);
      const detallePedido = detallePedidoResult.rows[0];

      if (!detallePedido) {
        throw { status: 400, message: `Producto ${producto.nombre} no pertenece a este pedido` };
      }

      // Calcular cuánto se ha entregado previamente
      const entregadoPrevioResult = await client.query(`
        SELECT COALESCE(SUM(cantidad_entregada), 0) AS total 
        FROM pedido_entrega 
        WHERE id_pedido = $1 AND id_producto = $2
      `, [pedidoId, producto_id]);
      const entregadoPrevio = entregadoPrevioResult.rows[0];

      const totalEntregado = Number(entregadoPrevio?.total || 0) + cantidad;
      const cantidadSolicitada = Number(detallePedido.cantidad_solicitada);

      if (totalEntregado > cantidadSolicitada) {
        throw {
          status: 400,
          message: `No se puede entregar más de lo solicitado para ${producto.nombre}. 
                  Solicitado: ${cantidadSolicitada}, Entregado previamente: ${entregadoPrevio?.total || 0}, 
                  Intenta entregar: ${cantidad}`
        };
      }

      // Crear movimiento de egreso
      const movResult = await client.query(`
        INSERT INTO movimiento_stock 
          (id_producto, tipo, cantidad, estado_producto, cargo_retira, id_institucion, id_usuario, motivo, fecha_movimiento)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING id_movimiento
      `, [
        producto_id,
        'egreso',
        cantidad,
        estado_producto,
        cargo_retira,
        pedido.id_institucion,
        userId,
        observaciones || `Retiro desde pedido anual #${pedidoId}`
      ]);

      const idMovimiento = movResult.rows[0].id_movimiento;
      movimientosIds.push(idMovimiento);

      // Registrar entrega
      const entregaResult = await client.query(`
        INSERT INTO pedido_entrega 
          (id_pedido, id_movimiento, id_producto, cantidad_entregada, id_usuario, observaciones)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [pedidoId, idMovimiento, producto_id, cantidad, userId, observaciones || null]);

      entregasData.push({
        id: entregaResult.rows[0].id,
        producto_id,
        cantidad
      });
    }

    // Verificar si el pedido quedó completamente entregado
    const itemsTotalesResult = await client.query(`
      SELECT dp.id_producto, dp.cantidad_solicitada
      FROM detalle_pedido dp
      WHERE dp.id_pedido = $1
    `, [pedidoId]);
    const itemsTotales = itemsTotalesResult.rows;

    let pedidoCompleto = true;
    for (const itemTotal of itemsTotales) {
      const entregadoResult = await client.query(`
        SELECT COALESCE(SUM(cantidad_entregada), 0) AS total
        FROM pedido_entrega
        WHERE id_pedido = $1 AND id_producto = $2
      `, [pedidoId, itemTotal.id_producto]);
      const entregado = entregadoResult.rows[0];

      if (Number(entregado?.total || 0) < Number(itemTotal.cantidad_solicitada)) {
        pedidoCompleto = false;
        break;
      }
    }

    // Si está completo, marcar pedido como finalizado
    if (pedidoCompleto) {
      await client.query(`
        UPDATE pedido 
        SET estado = 'finalizado' 
        WHERE id_pedido = $1
      `, [pedidoId]);
    }

    await client.query("COMMIT");

    return {
      movimientos: movimientosIds,
      entregas: entregasData,
      pedido_completo: pedidoCompleto,
    };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

async function getHistorialEntregasPedido(id_pedido, user) {
  await ensureEntregasSchema();

  // Si el usuario es directivo, verificar que el pedido pertenezca a su institución
  if (user && String(user.role || '').toLowerCase() === 'directivo') {
    const pedidoRow = await get('SELECT id_institucion FROM pedido WHERE id_pedido = ?', [id_pedido]);
    if (!pedidoRow) throw { status: 404, message: 'Pedido no encontrado' };

    const usuarioRow = await get('SELECT id_institucion FROM usuario WHERE id_usuario = ?', [user.sub]);
    if (!usuarioRow || usuarioRow.id_institucion !== pedidoRow.id_institucion) {
      throw { status: 403, message: 'No tenés acceso a este historial' };
    }
  }

  const entregas = await all(`
    SELECT 
      pe.id,
      pe.id_pedido,
      pe.id_producto,
      p.nombre as producto_nombre,
      p.unidad_medida,
      pe.cantidad_entregada,
      pe.fecha_entrega,
      pe.observaciones,
      u.nombre AS usuario_nombre,
      pe.id_movimiento,
      ms.cargo_retira,
      i.nombre AS institucion_nombre
    FROM pedido_entrega pe
    JOIN producto p ON p.id_producto = pe.id_producto
    LEFT JOIN usuario u ON u.id_usuario = pe.id_usuario
    LEFT JOIN movimiento_stock ms ON ms.id_movimiento = pe.id_movimiento
    LEFT JOIN institucion i ON i.id_institucion = ms.id_institucion
    WHERE pe.id_pedido = $1
    ORDER BY pe.fecha_entrega DESC
  `, [id_pedido]);

  return entregas;
}

async function listarEnSede(userId, userRole) {
  await ensureEntregasSchema();
  const client = await pool.connect();
  try {
    let institutionClause = "";
    const params = [];
    if (userRole === "directivo") {
      const userRes = await client.query("SELECT id_institucion FROM usuario WHERE id_usuario = $1", [userId]);
      if (!userRes.rows[0]?.id_institucion) return [];
      institutionClause = "AND d.id_institucion = $1";
      params.push(userRes.rows[0].id_institucion);
    }
    
    // Buscar lotes de sede y las solicitudes asociadas
    const query = `
      SELECT sr.*,
             i.nombre as institucion_nombre,
             d.nombre as sede_nombre,
             d.id_institucion as sede_id_institucion
      FROM solicitud_retiro sr
      JOIN institucion i ON i.id_institucion = sr.id_institucion
      JOIN distribucion_lote dl ON dl.departamento = sr.departamento_envio
      JOIN deposito d ON d.id_deposito = dl.id_deposito AND d.tipo_deposito = 'ESCUELA_SEDE'
      WHERE sr.estado = 'en_sede' ${institutionClause}
      ORDER BY sr.fecha_retiro DESC
    `;
    const res = await client.query(query, params);
    
    // populate items for these solicitudes
    for (const sr of res.rows) {
      const itemsRes = await client.query(`
        SELECT srd.*, p.nombre as producto_nombre, p.unidad_medida
        FROM solicitud_retiro_detalle srd
        JOIN producto p ON p.id_producto = srd.id_producto
        WHERE srd.id_solicitud_retiro = $1
      `, [sr.id]);
      sr.items = itemsRes.rows;
    }
    
    return res.rows;
  } finally {
    client.release();
  }
}

async function entregarDesdeSede(userId, solicitudId) {
  await ensureEntregasSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    const solRes = await client.query(`
      SELECT sr.*,
             d.id_deposito as sede_deposito_id
      FROM solicitud_retiro sr
      JOIN distribucion_lote dl ON dl.departamento = sr.departamento_envio AND dl.origen = 'solicitud_envio'
      JOIN deposito d ON d.id_deposito = dl.id_deposito AND d.tipo_deposito = 'ESCUELA_SEDE'
      WHERE sr.id = $1 AND sr.estado = 'en_sede'
      FOR UPDATE
    `, [solicitudId]);
    
    if (solRes.rows.length === 0) {
      throw badRequest("La solicitud no está en estado 'en_sede' o no existe.");
    }
    
    const solicitud = solRes.rows[0];
    
    // Obtener los items a entregar
    const itemsRes = await client.query(`
      SELECT * FROM solicitud_retiro_detalle WHERE id_solicitud_retiro = $1
    `, [solicitudId]);
    
    for (const item of itemsRes.rows) {
      const cantidadEntregada = Number(item.cantidad_entregada || 0);
      if (cantidadEntregada > 0) {
        // Descontar del depósito de la sede
        await client.query(`
          UPDATE stock_deposito
          SET cantidad = cantidad - $1
          WHERE id_deposito = $2 AND id_producto = $3
        `, [cantidadEntregada, solicitud.sede_deposito_id, item.id_producto]);
        
        // Movimiento de egreso desde sede
        await client.query(`
          INSERT INTO movimiento_stock
            (id_producto, tipo, cantidad, estado_producto, id_institucion, id_usuario, motivo, fecha_movimiento, id_deposito)
          VALUES ($1, 'egreso', $2, 'nuevo', $3, $4, $5, NOW(), $6)
        `, [
          item.id_producto,
          cantidadEntregada,
          solicitud.id_institucion,
          userId,
          `Entrega final desde Escuela Sede - Solicitud #${solicitudId}`,
          solicitud.sede_deposito_id
        ]);
      }
    }
    
    await client.query(`
      UPDATE solicitud_retiro
      SET estado = 'entregado',
          fecha_entrega = NOW(),
          id_usuario_entrega = $1
      WHERE id = $2
    `, [userId, solicitudId]);
    
    await client.query("COMMIT");
    return { success: true, message: "Entregado desde Sede correctamente" };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  listarPedidosDisponibles,
  getProductosDisponiblesRetiro,
  getMisSolicitudesRetiro,
  createSolicitudRetiro,
  getSolicitudesEnvioDepartamentos,
  getDetalleSolicitudesEnvioDepartamento,
  registrarEgresoMultipleEnvio,
  getSeguimientoEnvios,
  getDetalleSeguimientoLote,
  listarEnSede,
  entregarDesdeSede,
  aceptarSolicitudRetiro,
  getSolicitudesPendientes,
  getSolicitudesEntregadas,
  getComprobanteRetiro,
  entregarSolicitudRetiro,
  retirarPedido,
  getHistorialEntregasPedido
};
