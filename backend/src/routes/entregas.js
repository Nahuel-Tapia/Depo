const express = require("express");
const { all, get, run, pool } = require("../db.pg");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");

const router = express.Router();
router.use(authenticate);

// Crear tabla de control de entregas si no existe
async function ensureEntregasSchema() {
  await run(`
    CREATE TABLE IF NOT EXISTS pedido_entrega (
      id SERIAL PRIMARY KEY,
      id_pedido INT NOT NULL REFERENCES pedido(id_pedido) ON DELETE CASCADE,
      id_movimiento INT REFERENCES movimiento_stock(id_movimiento) ON DELETE SET NULL,
      id_producto INT NOT NULL REFERENCES producto(id_producto),
      cantidad_entregada INT NOT NULL,
      fecha_entrega TIMESTAMP DEFAULT NOW(),
      id_usuario INT REFERENCES usuario(id_usuario),
      observaciones TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await run(`
    ALTER TABLE pedido_entrega
    ADD COLUMN IF NOT EXISTS id_solicitud_retiro INT
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS solicitud_retiro (
      id SERIAL PRIMARY KEY,
      id_pedido INT NOT NULL REFERENCES pedido(id_pedido) ON DELETE CASCADE,
      id_institucion INT NOT NULL REFERENCES institucion(id_institucion),
      id_usuario_solicitante INT NOT NULL REFERENCES usuario(id_usuario),
      fecha_retiro DATE NOT NULL,
      retira_tipo VARCHAR(20) NOT NULL,
      retira_nombre VARCHAR(180),
      retira_dni VARCHAR(30),
      estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
      id_usuario_acepta INT REFERENCES usuario(id_usuario),
      fecha_aceptacion TIMESTAMP,
      id_usuario_entrega INT REFERENCES usuario(id_usuario),
      fecha_entrega TIMESTAMP,
      observaciones TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS solicitud_retiro_detalle (
      id SERIAL PRIMARY KEY,
      id_solicitud_retiro INT NOT NULL REFERENCES solicitud_retiro(id) ON DELETE CASCADE,
      id_producto INT NOT NULL REFERENCES producto(id_producto),
      cantidad_solicitada INT NOT NULL,
      cantidad_entregada INT,
      id_movimiento INT REFERENCES movimiento_stock(id_movimiento) ON DELETE SET NULL,
      UNIQUE (id_solicitud_retiro, id_producto)
    )
  `);
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
      u.nombre AS solicitante_nombre,
      p.fecha_creacion,
      dp.id_producto,
      pr.nombre AS producto_nombre,
      pr.unidad_medida,
      COALESCE(pr.stock_actual, 0) AS stock_actual,
      dp.cantidad_solicitada,
      COALESCE(ent.total_entregado, 0) AS cantidad_entregada,
      COALESCE(res.total_reservado, 0) AS cantidad_reservada
    FROM pedido p
    JOIN institucion i ON i.id_institucion = p.id_institucion
    JOIN usuario u ON u.id_usuario = p.id_usuario_solicitante
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
      WHERE sr.estado = 'pendiente'
      GROUP BY sr.id_pedido, srd.id_producto
    ) res ON res.id_pedido = p.id_pedido AND res.id_producto = dp.id_producto
    WHERE p.estado = 'aprobado'
      AND p.aprobado_director_area = TRUE
      AND COALESCE(p.tipo, 'anual') = 'anual'
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
      sr.estado,
      sr.id_usuario_entrega,
      ue.nombre AS entrega_usuario_nombre,
      sr.fecha_entrega,
      sr.observaciones,
      sr.created_at,
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
    estado: first.estado,
    id_usuario_acepta: first.id_usuario_acepta ? Number(first.id_usuario_acepta) : null,
    acepta_usuario_nombre: first.acepta_usuario_nombre || null,
    id_usuario_entrega: first.id_usuario_entrega ? Number(first.id_usuario_entrega) : null,
    entrega_usuario_nombre: first.entrega_usuario_nombre || null,
    fecha_entrega: first.fecha_entrega,
    observaciones: first.observaciones,
    created_at: first.created_at,
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

// GET /api/entregas/pedidos-disponibles - Obtener pedidos anuales aprobados disponibles para retirar
router.get("/pedidos-disponibles", authorizePermissions(PERMISSIONS.MOVIMIENTOS_CREATE), async (req, res) => {
  try {
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
    const pedidosConPendientes = pedidos.filter(p => p.tiene_pendientes);

    res.json({ pedidos: pedidosConPendientes });
  } catch (err) {
    console.error("Error al obtener pedidos disponibles:", err);
    res.status(500).json({ error: "No se pudieron obtener los pedidos disponibles" });
  }
});

// GET /api/entregas/solicitudes/productos-disponibles - Productos del pedido anual aprobado para solicitar retiro
router.get("/solicitudes/productos-disponibles", authorizePermissions(PERMISSIONS.PEDIDOS_CREATE), async (req, res) => {
  try {
    await ensureEntregasSchema();

    if (req.user.role !== "directivo") {
      return res.status(403).json({ error: "Solo el rol directivo puede crear solicitudes de retiro" });
    }

    const usuario = await get(
      "SELECT id_institucion FROM usuario WHERE id_usuario = ?",
      [req.user.sub]
    );

    if (!usuario?.id_institucion) {
      return res.status(400).json({ error: "Tu usuario no tiene instituciÃ³n asignada" });
    }

    const rows = await getRetiroAvailabilityRows(usuario.id_institucion);
    return res.json({ pedidos: groupRetiroAvailability(rows) });
  } catch (err) {
    console.error("Error al obtener productos para solicitud de retiro:", err);
    return res.status(500).json({ error: "No se pudieron obtener productos disponibles para retiro" });
  }
});

// GET /api/entregas/solicitudes/mis - Solicitudes de retiro del directivo
router.get("/solicitudes/mis", authorizePermissions(PERMISSIONS.PEDIDOS_VIEW), async (req, res) => {
  try {
    await ensureEntregasSchema();

    if (req.user.role !== "directivo") {
      return res.status(403).json({ error: "Solo el rol directivo puede consultar sus solicitudes de retiro" });
    }

    const rows = await all(`
      SELECT id
      FROM solicitud_retiro
      WHERE id_usuario_solicitante = ?
      ORDER BY created_at DESC
    `, [req.user.sub]);

    const solicitudes = [];
    for (const row of rows) {
      const solicitud = await getSolicitudRetiro(row.id);
      if (solicitud) solicitudes.push(solicitud);
    }

    return res.json({ solicitudes });
  } catch (err) {
    console.error("Error al listar solicitudes propias de retiro:", err);
    return res.status(500).json({ error: "No se pudieron obtener las solicitudes de retiro" });
  }
});

// POST /api/entregas/solicitudes - Crear solicitud de retiro desde el rol directivo
router.post("/solicitudes", authorizePermissions(PERMISSIONS.PEDIDOS_CREATE), async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureEntregasSchema();

    if (req.user.role !== "directivo") {
      return res.status(403).json({ error: "Solo el rol directivo puede crear solicitudes de retiro" });
    }

    const { id_pedido, fecha_retiro, retira_tipo, retira_nombre, retira_dni, observaciones, items } = req.body;
    const pedidoId = parsePositiveInt(id_pedido);
    const tipoRetira = normalizeRetiraTipo(retira_tipo);
    const fechaRetiro = String(fecha_retiro || "").trim();

    if (!pedidoId || !fechaRetiro || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Faltan campos obligatorios: pedido, fecha de retiro e items" });
    }

    if (Number.isNaN(new Date(`${fechaRetiro}T00:00:00`).getTime())) {
      return res.status(400).json({ error: "La fecha de retiro no es vÃ¡lida" });
    }

    const nombreRetira = tipoRetira === "otro" ? String(retira_nombre || "").trim() : null;
    const dniRetira = tipoRetira === "otro" ? String(retira_dni || "").trim() : null;
    if (tipoRetira === "otro" && (!nombreRetira || !dniRetira)) {
      return res.status(400).json({ error: "DebÃ©s indicar nombre y DNI de quien retira" });
    }

    const usuario = await get(
      "SELECT id_institucion, nombre FROM usuario WHERE id_usuario = ?",
      [req.user.sub]
    );

    if (!usuario?.id_institucion) {
      return res.status(400).json({ error: "Tu usuario no tiene instituciÃ³n asignada" });
    }

    const pedido = await get(`
      SELECT id_pedido, id_institucion
      FROM pedido
      WHERE id_pedido = ?
        AND id_institucion = ?
        AND estado = 'aprobado'
        AND aprobado_director_area = TRUE
        AND COALESCE(tipo, 'anual') = 'anual'
    `, [pedidoId, usuario.id_institucion]);

    if (!pedido) {
      return res.status(404).json({ error: "El pedido anual no estÃ¡ disponible para solicitar retiro" });
    }

    const parsedItems = items.map((item) => ({
      producto_id: parsePositiveInt(item?.producto_id),
      cantidad: parsePositiveInt(item?.cantidad)
    }));

    if (parsedItems.some((item) => !item.producto_id || !item.cantidad)) {
      return res.status(400).json({ error: "Todos los productos deben tener cantidad mayor a cero" });
    }

    const uniqueProductIds = new Set(parsedItems.map((item) => item.producto_id));
    if (uniqueProductIds.size !== parsedItems.length) {
      return res.status(400).json({ error: "No podÃ©s repetir productos en la misma solicitud" });
    }

    const availableRows = await getRetiroAvailabilityRows(usuario.id_institucion);
    const pedidoDisponible = groupRetiroAvailability(availableRows).find((p) => p.id === pedidoId);
    if (!pedidoDisponible) {
      return res.status(400).json({ error: "El pedido no tiene productos pendientes para retirar" });
    }

    const availableByProduct = new Map(pedidoDisponible.items.map((item) => [item.producto_id, item]));
    for (const item of parsedItems) {
      const disponible = availableByProduct.get(item.producto_id);
      if (!disponible) {
        return res.status(400).json({ error: `El producto ${item.producto_id} no pertenece al kit pendiente de este pedido` });
      }
      if (item.cantidad > disponible.cantidad_disponible_kit) {
        return res.status(400).json({
          error: `La cantidad solicitada para ${disponible.producto_nombre} supera el saldo del kit anual`
        });
      }
      if (item.cantidad > disponible.stock_actual) {
        return res.status(400).json({
          error: `Stock insuficiente para ${disponible.producto_nombre}. Disponible: ${disponible.stock_actual}`
        });
      }
    }

    await client.query("BEGIN");

    const solicitudResult = await client.query(`
      INSERT INTO solicitud_retiro
        (id_pedido, id_institucion, id_usuario_solicitante, fecha_retiro, retira_tipo, retira_nombre, retira_dni, observaciones)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [
      pedidoId,
      usuario.id_institucion,
      req.user.sub,
      fechaRetiro,
      tipoRetira,
      nombreRetira,
      dniRetira,
      String(observaciones || "").trim() || null
    ]);

    const solicitudId = solicitudResult.rows[0].id;
    for (const item of parsedItems) {
      await client.query(`
        INSERT INTO solicitud_retiro_detalle (id_solicitud_retiro, id_producto, cantidad_solicitada)
        VALUES ($1, $2, $3)
      `, [solicitudId, item.producto_id, item.cantidad]);
    }

    await client.query("COMMIT");

    const solicitud = await getSolicitudRetiro(solicitudId);
    return res.status(201).json({ ok: true, solicitud });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) { /* ignore */ }
    console.error("Error al crear solicitud de retiro:", err);
    return res.status(500).json({ error: "No se pudo crear la solicitud de retiro" });
  } finally {
    client.release();
  }
});

// PATCH /api/entregas/solicitudes/:id/aceptar - Operador acepta la solicitud para proceder con la entrega
router.patch("/solicitudes/:id/aceptar", authorizePermissions(PERMISSIONS.MOVIMIENTOS_CREATE), async (req, res) => {
  try {
    await ensureEntregasSchema();

    const solicitudId = parsePositiveInt(req.params.id);
    if (!solicitudId) return res.status(400).json({ error: "Solicitud inválida" });

    const solicitud = await getSolicitudRetiro(solicitudId);
    if (!solicitud) return res.status(404).json({ error: "Solicitud de retiro no encontrada" });

    if (solicitud.estado !== 'pendiente') {
      return res.status(400).json({ error: 'Solo se pueden aceptar solicitudes pendientes' });
    }

    await run(`UPDATE solicitud_retiro SET estado = 'aceptada', id_usuario_acepta = ?, fecha_aceptacion = NOW() WHERE id = ?`, [req.user.sub, solicitudId]);

    const updated = await getSolicitudRetiro(solicitudId);
    return res.json({ ok: true, estado: 'aceptada', solicitud: updated });
  } catch (err) {
    console.error('Error al aceptar solicitud de retiro:', err);
    return res.status(500).json({ error: 'No se pudo aceptar la solicitud' });
  }
});

// GET /api/entregas/solicitudes/pendientes - Bandeja del operador
router.get("/solicitudes/pendientes", authorizePermissions(PERMISSIONS.MOVIMIENTOS_CREATE), async (req, res) => {
  try {
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

    return res.json({ solicitudes });
  } catch (err) {
    console.error("Error al listar solicitudes pendientes:", err);
    return res.status(500).json({ error: "No se pudieron obtener las solicitudes pendientes" });
  }
});

// GET /api/entregas/solicitudes/:id/comprobante - Datos imprimibles del comprobante
router.get("/solicitudes/:id/comprobante", authorizePermissions(PERMISSIONS.PEDIDOS_VIEW), async (req, res) => {
  try {
    await ensureEntregasSchema();

    const solicitud = await getSolicitudRetiro(req.params.id);
    if (!solicitud) {
      return res.status(404).json({ error: "Solicitud de retiro no encontrada" });
    }

    if (req.user.role === "directivo" && solicitud.id_usuario_solicitante !== Number(req.user.sub)) {
      return res.status(403).json({ error: "No tenÃ©s acceso a este comprobante" });
    }

    return res.json({ solicitud });
  } catch (err) {
    console.error("Error al obtener comprobante de retiro:", err);
    return res.status(500).json({ error: "No se pudo obtener el comprobante" });
  }
});

// POST /api/entregas/solicitudes/:id/entregar - Confirmar entrega de una solicitud pendiente
router.post("/solicitudes/:id/entregar", authorizePermissions(PERMISSIONS.MOVIMIENTOS_CREATE), async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureEntregasSchema();

    const solicitudId = parsePositiveInt(req.params.id);
    if (!solicitudId) {
      return res.status(400).json({ error: "Solicitud invÃ¡lida" });
    }

    await client.query("BEGIN");

    const solicitud = await getSolicitudRetiro(solicitudId, client);
    if (!solicitud) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Solicitud de retiro no encontrada" });
    }

    if (!(solicitud.estado === "pendiente" || solicitud.estado === "aceptada")) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "La solicitud ya fue procesada" });
    }

    const pedidoRes = await client.query(`
      SELECT id_pedido, id_institucion
      FROM pedido
      WHERE id_pedido = $1
        AND estado = 'aprobado'
        AND aprobado_director_area = TRUE
        AND COALESCE(tipo, 'anual') = 'anual'
    `, [solicitud.id_pedido]);

    if (!pedidoRes.rowCount) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "El pedido anual ya no estÃ¡ disponible para entregar" });
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
        await client.query("ROLLBACK");
        return res.status(404).json({ error: `Producto ${item.producto_id} no encontrado` });
      }

      const detalleRes = await client.query(`
        SELECT cantidad_solicitada
        FROM detalle_pedido
        WHERE id_pedido = $1 AND id_producto = $2
      `, [solicitud.id_pedido, item.producto_id]);

      if (!detalleRes.rowCount) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: `${producto.nombre} no pertenece al pedido anual` });
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
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `La entrega de ${producto.nombre} supera el saldo del kit anual`
        });
      }

      if (Number(producto.stock_actual) < cantidad) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `Stock insuficiente para ${producto.nombre}. Disponible: ${producto.stock_actual}, solicitado: ${cantidad}`
        });
      }

      const movResult = await client.query(`
        INSERT INTO movimiento_stock
          (id_producto, tipo, cantidad, estado_producto, cargo_retira, id_institucion, id_usuario, motivo, fecha_movimiento)
        VALUES ($1, 'egreso', $2, 'nuevo', $3, $4, $5, $6, NOW())
        RETURNING id_movimiento
      `, [
        item.producto_id,
        cantidad,
        cargoRetira,
        solicitud.id_institucion,
        req.user.sub,
        `Entrega de solicitud de retiro #${solicitud.id} - pedido anual #${solicitud.id_pedido}`
      ]);

      const idMovimiento = movResult.rows[0].id_movimiento;
      movimientosIds.push(idMovimiento);

      await client.query(
        "UPDATE producto SET stock_actual = COALESCE(stock_actual, 0) - $1 WHERE id_producto = $2",
        [cantidad, item.producto_id]
      );

      await client.query(`
        INSERT INTO pedido_entrega
          (id_pedido, id_movimiento, id_producto, cantidad_entregada, id_usuario, observaciones, id_solicitud_retiro)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        solicitud.id_pedido,
        idMovimiento,
        item.producto_id,
        cantidad,
        req.user.sub,
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
    `, [req.user.sub, solicitud.id]);

    await client.query("COMMIT");

    const comprobante = await getSolicitudRetiro(solicitud.id);
    return res.json({
      ok: true,
      movimientos: movimientosIds,
      pedido_completo: pedidoCompleto,
      solicitud: comprobante
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) { /* ignore */ }
    console.error("Error al confirmar solicitud de retiro:", err);
    return res.status(500).json({ error: "No se pudo confirmar la entrega" });
  } finally {
    client.release();
  }
});

// POST /api/entregas/retirar - Realizar egreso desde un pedido anual aprobado
router.post("/retirar", authorizePermissions(PERMISSIONS.MOVIMIENTOS_CREATE), async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureEntregasSchema();

    const { id_pedido, items, cargo_retira, observaciones } = req.body;

    if (!id_pedido || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Faltan campos obligatorios (id_pedido, items)" });
    }

    if (!cargo_retira) {
      return res.status(400).json({ error: "El cargo de quien retira es obligatorio" });
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
    `, [id_pedido]);

    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado o no está disponible para retirar" });
    }

    await client.query("BEGIN");

    const movimientosIds = [];
    const entregasData = [];

    for (const item of items) {
      const { producto_id, cantidad, estado_producto = 'nuevo' } = item;

      if (!producto_id || !cantidad || cantidad <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: `Item inválido: producto_id ${producto_id}, cantidad ${cantidad}` });
      }

      // Verificar stock actual
      const producto = await get(
        "SELECT id_producto, nombre, COALESCE(stock_actual, 0) AS stock_actual FROM producto WHERE id_producto = $1",
        [producto_id]
      );

      if (!producto) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: `Producto ${producto_id} no encontrado` });
      }

      if (Number(producto.stock_actual) < cantidad) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `Stock insuficiente para ${producto.nombre}. Stock: ${producto.stock_actual}, Solicitado: ${cantidad}`
        });
      }

      // Verificar cantidad pendiente en el pedido
      const detallePedido = await get(`
        SELECT cantidad_solicitada FROM detalle_pedido 
        WHERE id_pedido = $1 AND id_producto = $2
      `, [id_pedido, producto_id]);

      if (!detallePedido) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: `Producto ${producto.nombre} no pertenece a este pedido` });
      }

      // Calcular cuánto se ha entregado previamente
      const entregadoPrevio = await get(`
        SELECT COALESCE(SUM(cantidad_entregada), 0) AS total 
        FROM pedido_entrega 
        WHERE id_pedido = $1 AND id_producto = $2
      `, [id_pedido, producto_id]);

      const totalEntregado = Number(entregadoPrevio?.total || 0) + cantidad;
      const cantidadSolicitada = Number(detallePedido.cantidad_solicitada);

      if (totalEntregado > cantidadSolicitada) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `No se puede entregar más de lo solicitado para ${producto.nombre}. 
                  Solicitado: ${cantidadSolicitada}, Entregado previamente: ${entregadoPrevio?.total || 0}, 
                  Intenta entregar: ${cantidad}`
        });
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
        req.user.sub,
        observaciones || `Retiro desde pedido anual #${id_pedido}`
      ]);

      const idMovimiento = movResult.rows[0].id_movimiento;
      movimientosIds.push(idMovimiento);

      // Actualizar stock
      await client.query(
        "UPDATE producto SET stock_actual = COALESCE(stock_actual, 0) - $1 WHERE id_producto = $2",
        [cantidad, producto_id]
      );

      // Registrar entrega
      const entregaResult = await client.query(`
        INSERT INTO pedido_entrega 
          (id_pedido, id_movimiento, id_producto, cantidad_entregada, id_usuario, observaciones)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [id_pedido, idMovimiento, producto_id, cantidad, req.user.sub, observaciones || null]);

      entregasData.push({
        id: entregaResult.rows[0].id,
        producto_id,
        cantidad
      });
    }

    // Verificar si el pedido quedó completamente entregado
    const itemsTotales = await all(`
      SELECT dp.id_producto, dp.cantidad_solicitada
      FROM detalle_pedido dp
      WHERE dp.id_pedido = $1
    `, [id_pedido]);

    let pedidoCompleto = true;
    for (const itemTotal of itemsTotales) {
      const entregado = await get(`
        SELECT COALESCE(SUM(cantidad_entregada), 0) AS total
        FROM pedido_entrega
        WHERE id_pedido = $1 AND id_producto = $2
      `, [id_pedido, itemTotal.id_producto]);

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
      `, [id_pedido]);
    }

    await client.query("COMMIT");

    res.status(201).json({
      ok: true,
      movimientos: movimientosIds,
      entregas: entregasData,
      pedido_completo: pedidoCompleto,
      mensaje: pedidoCompleto 
        ? `Pedido #${id_pedido} completado y marcado como finalizado` 
        : `Entrega registrada para pedido #${id_pedido}`
    });

  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) { /* ignore */ }
    console.error("Error al registrar entrega:", err);
    res.status(500).json({ error: "No se pudo registrar la entrega" });
  } finally {
    client.release();
  }
});

// GET /api/entregas/historial/:id_pedido - Historial de entregas de un pedido
router.get("/historial/:id_pedido", authorizePermissions(PERMISSIONS.PEDIDOS_VIEW), async (req, res) => {
  try {
    await ensureEntregasSchema();

    const { id_pedido } = req.params;

    // Si el usuario es directivo, verificar que el pedido pertenezca a su institución
    if (req.user && String(req.user.role || '').toLowerCase() === 'directivo') {
      const pedidoRow = await get('SELECT id_institucion FROM pedido WHERE id_pedido = ?', [id_pedido]);
      if (!pedidoRow) return res.status(404).json({ error: 'Pedido no encontrado' });

      const usuarioRow = await get('SELECT id_institucion FROM usuario WHERE id_usuario = ?', [req.user.sub]);
      if (!usuarioRow || usuarioRow.id_institucion !== pedidoRow.id_institucion) {
        return res.status(403).json({ error: 'No tenés acceso a este historial' });
      }
    }

    const entregas = await all(`
      SELECT 
        pe.id,
        pe.id_pedido,
        pe.id_producto,
        p.nombre AS producto_nombre,
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

    res.json({ entregas });
  } catch (err) {
    console.error("Error al obtener historial de entregas:", err);
    res.status(500).json({ error: "No se pudo obtener el historial de entregas" });
  }
});

module.exports = router;
