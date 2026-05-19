const express = require("express");
const { all, get, run, pool } = require("../db.pg");
const { authenticate, authorizePermissions, isAdminLikeRole } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");

const router = express.Router();
router.use(authenticate);

const ESCUELA_TIPOS = ["normal", "albergue", "jornada_extendida"];

let pedidosSchemaReady = false;
let pedidosSchemaPromise = null;

function normalizeTipoEscuela(rawValue) {
  const value = String(rawValue || "").trim().toLowerCase();
  if (value.includes("alberg")) return "albergue";
  if (value.includes("jornada")) return "jornada_extendida";
  return "normal";
}

function formatTipoEscuelaLabel(tipo) {
  if (tipo === "albergue") return "Escuela Albergue";
  if (tipo === "jornada_extendida") return "Jornada Completa";
  return "Jornada Normal";
}

function summarizePedidoItems(items = []) {
  return items
    .map((item) => `${item.producto_nombre} x${item.cantidad}`)
    .join(", ");
}

async function getStockDepositoByProductoIds(productoIds = []) {
  const ids = [...new Set((productoIds || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length) return new Map();

  const rows = await all(
    `SELECT id_producto, COALESCE(SUM(cantidad), 0)::numeric AS stock_actual
     FROM stock_deposito
     WHERE id_producto = ANY($1::int[])
     GROUP BY id_producto`,
    [ids]
  );

  return new Map(rows.map((row) => [Number(row.id_producto), Number(row.stock_actual || 0)]));
}

async function evaluateRefuerzoRouting(items = []) {
  const stockByProducto = await getStockDepositoByProductoIds(items.map((item) => item.producto_id));

  const detalleEvaluado = items.map((item) => {
    const stockDisponible = Number(stockByProducto.get(Number(item.producto_id)) || 0);
    const requiereLicitacion = stockDisponible <= 0;
    return {
      ...item,
      stock_disponible_relevado: stockDisponible,
      requiere_licitacion: requiereLicitacion
    };
  });

  const itemsSinStock = detalleEvaluado.filter((item) => item.requiere_licitacion);

  return {
    detalleEvaluado,
    requiereLicitacion: itemsSinStock.length > 0,
    estadoAbastecimiento: itemsSinStock.length > 0 ? 'requiere_licitacion' : 'stock_disponible',
    itemsSinStock
  };
}

function groupPedidos(rows = []) {
  const grouped = new Map();

  for (const row of rows) {
    const pedidoId = Number(row.id);
    if (!grouped.has(pedidoId)) {
      grouped.set(pedidoId, {
        id: pedidoId,
        estado: row.estado,
        notas: row.notas,
        motivo_supervisor: row.motivo_supervisor || null,
        respuesta_supervisor_tipo: row.respuesta_supervisor_tipo || null,
        tipo: row.tipo || "anual",
        created_at: row.created_at,
        id_institucion: row.id_institucion || null,
        requiere_licitacion: Boolean(row.requiere_licitacion),
        estado_abastecimiento: row.estado_abastecimiento || 'stock_disponible',
        aprobado_por_supervisor_id: row.aprobado_por_supervisor_id || null,
        fecha_aprobacion_supervisor: row.fecha_aprobacion_supervisor || null,
        usuario_nombre: row.usuario_nombre || null,
        institucion: row.institucion || null,
        kit_id: row.kit_id ? Number(row.kit_id) : null,
        kit_nombre: row.kit_nombre || null,
        producto_id: row.detalle_producto_id ? Number(row.detalle_producto_id) : null,
        producto_nombre: row.kit_nombre || row.detalle_producto_nombre || null,
        stock_actual: row.kit_id ? null : (row.detalle_stock_actual ?? null),
        cantidad: row.kit_id ? Number(row.kit_cantidad || 1) : Number(row.detalle_cantidad || 0),
        items: []
      });
    }

    const pedido = grouped.get(pedidoId);
    if (row.detalle_producto_id) {
      pedido.items.push({
        producto_id: Number(row.detalle_producto_id),
        producto_nombre: row.detalle_producto_nombre,
        cantidad: Number(row.detalle_cantidad || 0),
        unidad_medida: row.detalle_unidad_medida || "unidad",
        stock_actual: row.detalle_stock_actual ?? null,
        requiere_licitacion: Boolean(row.detalle_requiere_licitacion),
        stock_disponible_relevado: row.detalle_stock_disponible_relevado !== null && row.detalle_stock_disponible_relevado !== undefined
          ? Number(row.detalle_stock_disponible_relevado)
          : null
      });
    }
  }

  return Array.from(grouped.values()).map((pedido) => ({
    ...pedido,
    resumen_items: summarizePedidoItems(pedido.items)
  }));
}

function normalizeKitRows(rows = []) {
  const grouped = new Map();

  for (const row of rows) {
    const kitId = Number(row.id);
    if (!grouped.has(kitId)) {
      grouped.set(kitId, {
        id: kitId,
        nombre: row.nombre,
        tipo_escuela: row.tipo_escuela,
        tipo_escuela_label: formatTipoEscuelaLabel(row.tipo_escuela),
        descripcion: row.descripcion || "",
        activo: Boolean(row.activo),
        created_at: row.created_at,
        updated_at: row.updated_at,
        cantidad_alumnos: row.cantidad_alumnos || null,
        items: []
      });
    }

    if (row.producto_id) {
      grouped.get(kitId).items.push({
        producto_id: Number(row.producto_id),
        producto_nombre: row.producto_nombre,
        unidad_medida: row.unidad_medida || "unidad",
        cantidad: Number(row.cantidad || 0)
      });
    }
  }

  return Array.from(grouped.values()).map((kit) => ({
    ...kit,
    items: kit.items.sort((a, b) =>
      String(a.producto_nombre || "").localeCompare(String(b.producto_nombre || ""), "es", { sensitivity: "base" })
    )
  }));
}

function sanitizeKitItems(rawItems = []) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { error: "Debés agregar al menos un producto al kit." };
  }

  const normalized = [];
  const seen = new Set();

  for (const rawItem of rawItems) {
    const productoId = Number(rawItem?.producto_id);
    const cantidad = Number(rawItem?.cantidad);

    if (!Number.isInteger(productoId) || productoId <= 0) {
      return { error: "Cada ítem del kit debe tener un producto válido." };
    }
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      return { error: "Cada ítem del kit debe tener una cantidad mayor a cero." };
    }
    if (seen.has(productoId)) {
      return { error: "No podés repetir productos dentro del mismo kit." };
    }

    seen.add(productoId);
    normalized.push({
      producto_id: productoId,
      cantidad: Math.round(cantidad * 100) / 100
    });
  }

  return { items: normalized };
}

function calcularCupoAnual(matriculados, regla) {
  if (!regla) return null;

  const base = Math.max(0, Number(regla.cantidad_base || 0));
  const alumnosPorUnidad = Math.max(0, Number(regla.alumnos_por_unidad || 0));
  const porUnidad = Math.max(0, Number(regla.cantidad_por_unidad || 0));
  const matricula = Math.max(0, Number(matriculados || 0));

  if (!alumnosPorUnidad || !porUnidad) return base;

  const modulos = Math.ceil(matricula / alumnosPorUnidad);
  return base + (modulos * porUnidad);
}

async function ensurePedidosSchema() {
  if (pedidosSchemaReady) return;
  if (pedidosSchemaPromise) {
    await pedidosSchemaPromise;
    return;
  }

  pedidosSchemaPromise = (async () => {
    try {
      await run(`
        ALTER TABLE pedido
        ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) DEFAULT 'anual'
      `);
    } catch (_) { /* ya existe o no se puede */ }

    try {
      await run(`
        ALTER TABLE pedido
        ADD COLUMN IF NOT EXISTS aprobado_por_supervisor_id INT REFERENCES usuario(id_usuario)
      `);
    } catch (_) { /* no aplica en alguna base */ }

    try {
      await run(`
        ALTER TABLE pedido
        ADD COLUMN IF NOT EXISTS fecha_aprobacion_supervisor TIMESTAMP
      `);
    } catch (_) { /* no aplica en alguna base */ }

    try {
      await run(`
        ALTER TABLE pedido
        ADD COLUMN IF NOT EXISTS motivo_supervisor TEXT
      `);
    } catch (_) { /* no aplica en alguna base */ }

    try {
      await run(`
        ALTER TABLE pedido
        ADD COLUMN IF NOT EXISTS respuesta_supervisor_tipo VARCHAR(30)
      `);
    } catch (_) { /* no aplica en alguna base */ }

    try {
      await run(`
        ALTER TABLE pedido
        ADD COLUMN IF NOT EXISTS kit_id INT
      `);
    } catch (_) { /* ya existe o no se puede */ }

    try {
      await run(`
        ALTER TABLE pedido
        ADD COLUMN IF NOT EXISTS kit_nombre VARCHAR(180)
      `);
    } catch (_) { /* ya existe o no se puede */ }

    try {
      await run(`
        ALTER TABLE pedido
        ADD COLUMN IF NOT EXISTS kit_cantidad NUMERIC(12,2)
      `);
    } catch (_) { /* ya existe o no se puede */ }

    try {
      await run(`
        ALTER TABLE pedido
        ADD COLUMN IF NOT EXISTS aprobado_por_director_id INT REFERENCES usuario(id_usuario)
      `);
    } catch (_) { /* ya existe o no se puede */ }

    try {
      await run(`
        ALTER TABLE pedido
        ADD COLUMN IF NOT EXISTS fecha_aprobacion_director TIMESTAMP
      `);
    } catch (_) { /* ya existe o no se puede */ }

    try {
      await run(`
        ALTER TABLE pedido
        ADD COLUMN IF NOT EXISTS requiere_licitacion BOOLEAN NOT NULL DEFAULT FALSE
      `);
    } catch (_) { /* ya existe o no se puede */ }

    try {
      await run(`
        ALTER TABLE pedido
        ADD COLUMN IF NOT EXISTS estado_abastecimiento VARCHAR(40) NOT NULL DEFAULT 'stock_disponible'
      `);
    } catch (_) { /* ya existe o no se puede */ }

    try {
      await run(`
        ALTER TABLE institucion
        ADD COLUMN IF NOT EXISTS tipo_escuela VARCHAR(40)
      `);
    } catch (_) { /* no aplica en alguna base */ }

    try {
      await run(`
        ALTER TABLE institucion
        ADD COLUMN IF NOT EXISTS matriculados INT DEFAULT 0
      `);
    } catch (_) { /* no aplica en alguna base */ }

    try {
      await run(`
        UPDATE institucion
        SET tipo_escuela = CASE
          WHEN COALESCE(tipo_escuela, '') <> '' THEN tipo_escuela
          WHEN LOWER(COALESCE(categoria, '')) LIKE '%alberg%' OR LOWER(COALESCE(ambito, '')) LIKE '%alberg%' THEN 'albergue'
          WHEN LOWER(COALESCE(categoria, '')) LIKE '%jornada%' OR LOWER(COALESCE(ambito, '')) LIKE '%jornada%' THEN 'jornada_extendida'
          ELSE 'normal'
        END
      `);
    } catch (_) { /* la base puede no tener categoria/ambito */ }

    await run(`
      CREATE TABLE IF NOT EXISTS kit_producto_anual (
        id SERIAL PRIMARY KEY,
        tipo_escuela VARCHAR(40) NOT NULL,
        id_producto INT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
        cantidad_base INT NOT NULL DEFAULT 0,
        alumnos_por_unidad INT NOT NULL DEFAULT 100,
        cantidad_por_unidad INT NOT NULL DEFAULT 0,
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        UNIQUE (tipo_escuela, id_producto)
      )
    `);

    await run(`
      INSERT INTO kit_producto_anual (tipo_escuela, id_producto, cantidad_base, alumnos_por_unidad, cantidad_por_unidad)
      SELECT
        tipos.tipo_escuela,
        p.id_producto,
        CASE
          WHEN tipos.tipo_escuela = 'albergue' THEN 14
          WHEN tipos.tipo_escuela = 'jornada_extendida' THEN 12
          ELSE 10
        END,
        100,
        CASE
          WHEN tipos.tipo_escuela = 'albergue' THEN 3
          ELSE 2
        END
      FROM producto p
      CROSS JOIN (VALUES ('normal'), ('albergue'), ('jornada_extendida')) AS tipos(tipo_escuela)
      ON CONFLICT (tipo_escuela, id_producto) DO NOTHING
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS producto_kit (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(180) NOT NULL,
        tipo_escuela VARCHAR(40) NOT NULL,
        descripcion TEXT,
        cantidad_alumnos INT,
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        created_by INT REFERENCES usuario(id_usuario),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    try {
      await run(`
        ALTER TABLE producto_kit
        ADD COLUMN IF NOT EXISTS cantidad_alumnos INT
      `);
    } catch (_) { /* ya existe o no aplica */ }

    try {
      await run(`
        ALTER TABLE institucion
        ADD COLUMN IF NOT EXISTS kit_id INT REFERENCES producto_kit(id)
      `);
    } catch (_) { /* no aplica en alguna base */ }

    await run(`
      CREATE TABLE IF NOT EXISTS producto_kit_detalle (
        id SERIAL PRIMARY KEY,
        kit_id INT NOT NULL REFERENCES producto_kit(id) ON DELETE CASCADE,
        id_producto INT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
        cantidad NUMERIC(12,2) NOT NULL,
        UNIQUE (kit_id, id_producto)
      )
    `);

    try {
      await run(`
        ALTER TABLE detalle_pedido
        ADD COLUMN IF NOT EXISTS requiere_licitacion BOOLEAN NOT NULL DEFAULT FALSE
      `);
    } catch (_) { /* ya existe o no se puede */ }

    try {
      await run(`
        ALTER TABLE detalle_pedido
        ADD COLUMN IF NOT EXISTS stock_disponible_relevado NUMERIC(12,2)
      `);
    } catch (_) { /* ya existe o no se puede */ }

    pedidosSchemaReady = true;
  })();

  try {
    await pedidosSchemaPromise;
  } finally {
    pedidosSchemaPromise = null;
  }
}

// Asegura que exista el estado 'cancelado' en el enum de tramites.
async function ensureEstadoCancelado() {
  try {
    await run(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_enum e ON e.enumtypid = t.oid
          WHERE t.typname = 'estado_tramite'
            AND e.enumlabel = 'cancelado'
        ) THEN
          ALTER TYPE estado_tramite ADD VALUE 'cancelado';
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_enum e ON e.enumtypid = t.oid
          WHERE t.typname = 'estado_tramite'
            AND e.enumlabel = 'pendiente_director'
        ) THEN
          ALTER TYPE estado_tramite ADD VALUE 'pendiente_director';
        END IF;
      END
      $$;
    `);
  } catch (_) { /* ya existe o no se puede */ }
}

ensureEstadoCancelado();

async function hasInstitucionColumn(columnName) {
  try {
    const res = await get(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'institucion' AND column_name = ?
      ) AS exists`, [columnName]);
    return res.exists;
  } catch {
    return false;
  }
}

async function getInstitucionPerfil(institucionId) {
  await ensurePedidosSchema();

  const [hasTipoEscuela, hasMatriculados, hasCategoria, hasAmbito] = await Promise.all([
    hasInstitucionColumn("tipo_escuela"),
    hasInstitucionColumn("matriculados"),
    hasInstitucionColumn("categoria"),
    hasInstitucionColumn("ambito")
  ]);

  const tipoExpr = hasTipoEscuela ? "i.tipo_escuela" : "NULL::text";
  const matriculaExpr = hasMatriculados ? "COALESCE(i.matriculados, 0)" : "0";
  const categoriaExpr = hasCategoria ? "i.categoria" : "NULL::text";
  const ambitoExpr = hasAmbito ? "i.ambito" : "NULL::text";

  const institucion = await get(
    `SELECT i.id_institucion,
            ${tipoExpr} AS tipo_escuela,
            ${matriculaExpr} AS matriculados,
            ${categoriaExpr} AS categoria,
            ${ambitoExpr} AS ambito
     FROM institucion i
     WHERE i.id_institucion = ?`,
    [institucionId]
  );

  if (!institucion) return null;

  const tipo = normalizeTipoEscuela(
    institucion.tipo_escuela || institucion.categoria || institucion.ambito
  );

  return {
    id_institucion: institucion.id_institucion,
    tipo_escuela: ESCUELA_TIPOS.includes(tipo) ? tipo : "normal",
    matriculados: Math.max(0, Number(institucion.matriculados || 0))
  };
}

async function getReglaKit(tipoEscuela, productoId) {
  await ensurePedidosSchema();

  return get(
    `SELECT tipo_escuela, id_producto, cantidad_base, alumnos_por_unidad, cantidad_por_unidad, activo
     FROM kit_producto_anual
     WHERE tipo_escuela = ?
       AND id_producto = ?
       AND activo = TRUE`,
    [tipoEscuela, productoId]
  );
}

async function getConsumoAnualProducto(institucionId, productoId, anio, excludePedidoId = null) {
  const params = [institucionId, productoId, anio];
  let extraSql = "";
  if (excludePedidoId) {
    params.push(excludePedidoId);
    extraSql = " AND p.id_pedido <> ?";
  }

  const row = await get(
    `SELECT COALESCE(SUM(dp.cantidad_solicitada), 0) AS total
     FROM pedido p
     JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
     WHERE p.id_institucion = ?
       AND dp.id_producto = ?
       AND COALESCE(p.tipo, 'anual') = 'anual'
       AND EXTRACT(YEAR FROM p.fecha_creacion) = ?
       AND p.estado::text NOT IN ('rechazado', 'cancelado')
       ${extraSql}`,
    params
  );

  return Math.max(0, Number(row?.total || 0));
}

async function getDisponibilidadAnual(institucionId, productoId, anio) {
  const perfil = await getInstitucionPerfil(institucionId);
  if (!perfil) return null;

  const regla = await getReglaKit(perfil.tipo_escuela, productoId);
  if (!regla) {
    return {
      tipo_escuela: perfil.tipo_escuela,
      matriculados: perfil.matriculados,
      cuota_anual: null,
      solicitado_anual: 0,
      disponible_anual: null,
      tiene_regla: false
    };
  }

  const cuota = calcularCupoAnual(perfil.matriculados, regla);
  const solicitado = await getConsumoAnualProducto(institucionId, productoId, anio);

  return {
    tipo_escuela: perfil.tipo_escuela,
    matriculados: perfil.matriculados,
    cuota_anual: cuota,
    solicitado_anual: solicitado,
    disponible_anual: Math.max(0, cuota - solicitado),
    tiene_regla: true
  };
}

async function getPedidoActivoBloqueante(institucionId) {
  return get(
    `SELECT p.id_pedido AS id,
            CASE WHEN p.estado::text = 'finalizado' THEN 'entregado' ELSE p.estado::text END AS estado,
            p.motivo_supervisor,
            p.respuesta_supervisor_tipo,
            COALESCE(p.tipo, 'anual') AS tipo,
            p.fecha_creacion AS created_at
     FROM pedido p
     WHERE p.id_institucion = ?
       AND p.estado::text = 'pendiente'
     ORDER BY p.fecha_creacion DESC
     LIMIT 1`,
    [institucionId]
  );
}

async function getEstadoEntregadoDb() {
  const rows = await all(`
    SELECT e.enumlabel
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'estado_tramite'
  `);

  const estados = rows.map(r => r.enumlabel);
  if (estados.includes("entregado")) return "entregado";
  if (estados.includes("finalizado")) return "finalizado";
  return "entregado";
}

async function hasAsignacionesTable() {
  const row = await get("SELECT to_regclass('public.supervisor_escuela_asignacion') AS regclass");
  return Boolean(row?.regclass);
}

async function hasZoneAssignmentTables() {
  const rows = await all(
    `SELECT to_regclass(name) AS regclass
     FROM unnest($1::text[]) AS name`,
    [["public.zona", "public.zona_institucion", "public.zona_supervisor"]]
  );

  return rows.length === 3 && rows.every((row) => Boolean(row?.regclass));
}

async function supervisorHasAssignedInstitution(supervisorId, institucionId) {
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
      [supervisorId, institucionId]
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
    [supervisorId, institucionId]
  );

  return Boolean(legacyAssignment);
}

async function getKitById(kitId, { includeInactive = false } = {}) {
  const rows = await all(
    `SELECT k.id,
            k.nombre,
            k.tipo_escuela,
            k.descripcion,
            k.activo,
            k.created_at,
            k.updated_at,
            d.id_producto AS producto_id,
            p.nombre as producto_nombre,
            p.unidad_medida,
            d.cantidad
     FROM producto_kit k
     LEFT JOIN producto_kit_detalle d ON d.kit_id = k.id
     LEFT JOIN producto p ON p.id_producto = d.id_producto
     WHERE k.id = ?
       ${includeInactive ? "" : "AND k.activo = TRUE"}
     ORDER BY p.nombre ASC`,
    [kitId]
  );

  return normalizeKitRows(rows)[0] || null;
}

function canManageKits(req) {
  return req.user?.role === "admin" || req.user?.role === "master" || req.user?.role === "director_area";
}

function requireKitManager(req, res, next) {
  if (!canManageKits(req)) {
    return res.status(403).json({ error: "No tenés permiso para gestionar kits." });
  }
  return next();
}

router.get("/kits", authorizePermissions(PERMISSIONS.PEDIDOS_VIEW), async (req, res) => {
  try {
    await ensurePedidosSchema();

    const includeInactive = canManageKits(req) && String(req.query.include_inactive || "") === "1";
    let whereSql = "WHERE 1 = 1";
    const params = [];
    if (!includeInactive) {
      whereSql += " AND k.activo = TRUE";
    }

    if (req.user?.role === "directivo") {
      const usuario = await get(
        `SELECT u.id_institucion, i.kit_id
         FROM usuario u
         JOIN institucion i ON i.id_institucion = u.id_institucion
         WHERE u.id_usuario = ?`,
        [req.user.sub]
      );

      const kitAsignadoId = Number(usuario?.kit_id || 0);
      if (!kitAsignadoId) {
        return res.json({ kits: [] });
      }

      whereSql += " AND k.id = ?";
      params.push(kitAsignadoId);
    }

    const rows = await all(
      `SELECT k.id,
              k.nombre,
              k.tipo_escuela,
              k.descripcion,
              k.activo,
              k.created_at,
              k.updated_at,
              k.cantidad_alumnos,
              d.id_producto AS producto_id,
              p.nombre as producto_nombre,
              p.unidad_medida,
              d.cantidad
       FROM producto_kit k
       LEFT JOIN producto_kit_detalle d ON d.kit_id = k.id
       LEFT JOIN producto p ON p.id_producto = d.id_producto
       ${whereSql}
       ORDER BY k.nombre ASC, p.nombre ASC`,
      params
    );

    return res.json({ kits: normalizeKitRows(rows) });
  } catch (err) {
    console.error("Error al listar kits:", err);
    return res.status(500).json({ error: "No se pudieron listar los kits" });
  }
});

router.post("/kits", authorizePermissions(PERMISSIONS.PEDIDOS_VIEW), requireKitManager, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensurePedidosSchema();

    const nombre = String(req.body?.nombre || "").trim();
    const descripcion = String(req.body?.descripcion || "").trim() || null;
    const parsedItems = sanitizeKitItems(req.body?.items);

    if (!nombre) {
      return res.status(400).json({ error: "El nombre del kit es obligatorio." });
    }
    if (parsedItems.error) {
      return res.status(400).json({ error: parsedItems.error });
    }

    const productoIds = parsedItems.items.map((item) => item.producto_id);
    const productos = await all(
      `SELECT id_producto FROM producto WHERE id_producto = ANY($1::int[])`,
      [productoIds]
    );
    if (productos.length !== productoIds.length) {
      return res.status(400).json({ error: "Uno o más productos seleccionados no existen." });
    }

    await client.query("BEGIN");
    const insertKit = await client.query(
      `INSERT INTO producto_kit (nombre, tipo_escuela, descripcion, activo, created_by)
       VALUES ($1, $2, $3, TRUE, $4)
       RETURNING id`,
      [nombre, "normal", descripcion, req.user.sub]
    );
    const kitId = Number(insertKit.rows[0].id);

    for (const item of parsedItems.items) {
      await client.query(
        `INSERT INTO producto_kit_detalle (kit_id, id_producto, cantidad)
         VALUES ($1, $2, $3)`,
        [kitId, item.producto_id, item.cantidad]
      );
    }

    await client.query("COMMIT");
    const kit = await getKitById(kitId, { includeInactive: true });
    return res.status(201).json({ kit });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error al crear kit:", err);
    return res.status(500).json({ error: "No se pudo crear el kit" });
  } finally {
    client.release();
  }
});

router.put("/kits/:id(\\d+)", authorizePermissions(PERMISSIONS.PEDIDOS_VIEW), requireKitManager, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensurePedidosSchema();

    const id = Number(req.params.id);
    const nombre = String(req.body?.nombre || "").trim();
    const descripcion = String(req.body?.descripcion || "").trim() || null;
    const activo = req.body?.activo !== false;
    const parsedItems = sanitizeKitItems(req.body?.items);

    if (!nombre) {
      return res.status(400).json({ error: "El nombre del kit es obligatorio." });
    }
    if (parsedItems.error) {
      return res.status(400).json({ error: parsedItems.error });
    }

    const existing = await get(`SELECT id FROM producto_kit WHERE id = ?`, [id]);
    if (!existing) {
      return res.status(404).json({ error: "Kit no encontrado." });
    }

    const productoIds = parsedItems.items.map((item) => item.producto_id);
    const productos = await all(
      `SELECT id_producto FROM producto WHERE id_producto = ANY($1::int[])`,
      [productoIds]
    );
    if (productos.length !== productoIds.length) {
      return res.status(400).json({ error: "Uno o más productos seleccionados no existen." });
    }

    await client.query("BEGIN");
    const existingKit = await client.query(
      `SELECT tipo_escuela FROM producto_kit WHERE id = $1`,
      [id]
    );
    const tipoEscuela = existingKit.rows[0]?.tipo_escuela || "normal";
    await client.query(
      `UPDATE producto_kit
       SET nombre = $1,
           tipo_escuela = $2,
           descripcion = $3,
           activo = $4,
           updated_at = NOW()
       WHERE id = $5`,
      [nombre, tipoEscuela, descripcion, activo, id]
    );
    await client.query(`DELETE FROM producto_kit_detalle WHERE kit_id = $1`, [id]);

    for (const item of parsedItems.items) {
      await client.query(
        `INSERT INTO producto_kit_detalle (kit_id, id_producto, cantidad)
         VALUES ($1, $2, $3)`,
        [id, item.producto_id, item.cantidad]
      );
    }

    await client.query("COMMIT");
    const kit = await getKitById(id, { includeInactive: true });
    return res.json({ kit });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error al actualizar kit:", err);
    return res.status(500).json({ error: "No se pudo actualizar el kit" });
  } finally {
    client.release();
  }
});

router.delete("/kits/:id(\\d+)", authorizePermissions(PERMISSIONS.PEDIDOS_VIEW), requireKitManager, async (req, res) => {
  try {
    await ensurePedidosSchema();
    const id = Number(req.params.id);

    const existing = await get(`SELECT id FROM producto_kit WHERE id = ?`, [id]);
    if (!existing) {
      return res.status(404).json({ error: "Kit no encontrado." });
    }

    await run(
      `UPDATE producto_kit
       SET activo = FALSE,
           updated_at = NOW()
       WHERE id = ?`,
      [id]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("Error al eliminar kit:", err);
    return res.status(500).json({ error: "No se pudo eliminar el kit" });
  }
});

// Listar pedidos
router.get("/", authorizePermissions(PERMISSIONS.PEDIDOS_VIEW), async (req, res) => {
  try {
    await ensurePedidosSchema();

    let query = `
      SELECT
        p.id_pedido as id,
        CASE WHEN p.estado::text = 'finalizado' THEN 'entregado' ELSE p.estado::text END as estado,
        p.observaciones_generales as notas,
        p.motivo_supervisor,
        p.respuesta_supervisor_tipo,
        COALESCE(p.tipo, 'anual') as tipo,
        p.fecha_creacion as created_at,
        p.id_institucion,
        COALESCE(p.requiere_licitacion, FALSE) as requiere_licitacion,
        COALESCE(p.estado_abastecimiento, 'stock_disponible') as estado_abastecimiento,
        p.aprobado_por_supervisor_id,
        p.fecha_aprobacion_supervisor,
        p.kit_id,
        p.kit_nombre,
        p.kit_cantidad,
        dp.id_producto as detalle_producto_id,
        pr.nombre as detalle_producto_nombre,
        pr.unidad_medida as detalle_unidad_medida,
        pr.stock_actual as detalle_stock_actual,
        COALESCE(dp.requiere_licitacion, FALSE) as detalle_requiere_licitacion,
        dp.stock_disponible_relevado as detalle_stock_disponible_relevado,
        dp.cantidad_solicitada as detalle_cantidad,
        p.aprobado_por_director_id,
        p.fecha_aprobacion_director,
        p.aprobado_director_area,
        u.nombre as usuario_nombre,
        i.nombre as institucion
      FROM pedido p
      LEFT JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
      JOIN producto pr ON dp.id_producto = pr.id_producto
      JOIN usuario u ON p.id_usuario_solicitante = u.id_usuario
      LEFT JOIN institucion i ON p.id_institucion = i.id_institucion
      WHERE 1 = 1
    `;
    const params = [];

    if (req.user.role === "directivo") {
      query += " AND p.id_institucion = (SELECT id_institucion FROM usuario WHERE id_usuario = ?)";
      params.push(req.user.sub);
    }

    if (req.user.role === "director_area") {
      query += " AND LOWER(TRIM(i.nivel_educativo)) = LOWER(TRIM(?))";
      params.push(req.user.nivel_educativo || '');
    }

    query += " ORDER BY p.fecha_creacion DESC, pr.nombre ASC";
    const pedidoRows = await all(query, params);
    const grouped = groupPedidos(pedidoRows);

    // Enriquecer pedidos anuales con progreso de logística
    for (const p of grouped) {
      if (p.tipo === 'anual' && p.estado === 'aprobado') {
        const anio = new Date(p.created_at).getFullYear();
        // 1. Estado de la licitación
        const lic = await get(`SELECT estado FROM licitacion_publicada WHERE anio = ?`, [anio]);
        
        // 2. Progreso de entrega (consolidado)
        const progreso = await get(`
          SELECT 
            SUM(pad.cantidad) as total_pedida,
            COALESCE(SUM(ea.entregada), 0) as total_entregada
          FROM planilla_pedido_anual_detalle pad
          LEFT JOIN (
            SELECT id_institucion, id_producto, SUM(cantidad_entregada) as entregada
            FROM entrega_anual
            WHERE anio = $1
            GROUP BY id_institucion, id_producto
          ) ea ON ea.id_institucion = pad.id_institucion AND ea.id_producto = pad.id_producto
          WHERE pad.id_institucion = $2 
            AND pad.planilla_id IN (SELECT id FROM planilla_pedido_anual WHERE anio = $1)
        `, [anio, p.id_institucion]);

        p.logistica = {
          estado_licitacion: lic?.estado || 'pendiente',
          total_pedida: progreso?.total_pedida || 0,
          total_entregada: progreso?.total_entregada || 0,
          porcentaje_entrega: progreso?.total_pedida > 0 
            ? Math.round((progreso.total_entregada / progreso.total_pedida) * 100) 
            : 0
        };
      }
    }

    return res.json({ pedidos: grouped });
  } catch (err) {
    console.error("Error al listar pedidos:", err);
    return res.status(500).json({ error: "No se pudo listar pedidos" });
  }
});

// Cupos anuales de kit por institución/producto
router.get("/cupos-anuales", authorizePermissions(PERMISSIONS.PEDIDOS_VIEW), async (req, res) => {
  try {
    await ensurePedidosSchema();

    let institucionId = Number(req.query.institucion_id || 0);

    if (req.user.role === "directivo") {
      const usuario = await get(
        "SELECT id_institucion FROM usuario WHERE id_usuario = ?",
        [req.user.sub]
      );
      institucionId = Number(usuario?.id_institucion || 0);
    }

    if (!Number.isInteger(institucionId) || institucionId <= 0) {
      return res.status(400).json({ error: "Institución inválida" });
    }

    const perfil = await getInstitucionPerfil(institucionId);
    if (!perfil) {
      return res.status(404).json({ error: "Institución no encontrada" });
    }

    const anio = Number(req.query.anio || new Date().getFullYear());

    const productos = await all(
      `SELECT p.id_producto AS id, p.nombre, p.unidad_medida,
              k.cantidad_base, k.alumnos_por_unidad, k.cantidad_por_unidad
       FROM kit_producto_anual k
       JOIN producto p ON p.id_producto = k.id_producto
       WHERE k.tipo_escuela = ?
         AND k.activo = TRUE
       ORDER BY p.nombre ASC`,
      [perfil.tipo_escuela]
    );

    const consumoRows = await all(
      `SELECT dp.id_producto, COALESCE(SUM(dp.cantidad_solicitada), 0) AS total
       FROM pedido p
       JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
       WHERE p.id_institucion = ?
         AND COALESCE(p.tipo, 'anual') = 'anual'
         AND EXTRACT(YEAR FROM p.fecha_creacion) = ?
         AND p.estado::text NOT IN ('rechazado', 'cancelado')
       GROUP BY dp.id_producto`,
      [institucionId, anio]
    );

    const consumoByProducto = new Map(
      consumoRows.map((row) => [Number(row.id_producto), Number(row.total || 0)])
    );

    const cupos = productos.map((p) => {
      const regla = p.cantidad_base === null
        ? null
        : {
            cantidad_base: p.cantidad_base,
            alumnos_por_unidad: p.alumnos_por_unidad,
            cantidad_por_unidad: p.cantidad_por_unidad
          };

      const cuota = calcularCupoAnual(perfil.matriculados, regla);
      const solicitado = consumoByProducto.get(Number(p.id)) || 0;

      return {
        producto_id: p.id,
        producto_nombre: p.nombre,
        unidad_medida: p.unidad_medida,
        tipo_escuela: perfil.tipo_escuela,
        matriculados: perfil.matriculados,
        cuota_anual: cuota,
        solicitado_anual: solicitado,
        disponible_anual: cuota === null ? null : Math.max(0, cuota - solicitado),
        regla: regla ? {
          cantidad_base: Number(regla.cantidad_base || 0),
          alumnos_por_unidad: Number(regla.alumnos_por_unidad || 0),
          cantidad_por_unidad: Number(regla.cantidad_por_unidad || 0)
        } : null
      };
    });

    return res.json({
      institucion_id: institucionId,
      tipo_escuela: perfil.tipo_escuela,
      matriculados: perfil.matriculados,
      anio,
      cupos
    });
  } catch (err) {
    console.error("Error al obtener cupos anuales:", err);
    return res.status(500).json({ error: "No se pudieron obtener cupos anuales" });
  }
});

// Historial de pedidos por institución (solo admin)
router.get("/institucion/:institucion", authorizePermissions(PERMISSIONS.PEDIDOS_MANAGE), async (req, res) => {
  try {
    const { institucion } = req.params;

    const pedidos = await all(
      `
      SELECT
        ms.id_movimiento as id,
        ms.tipo,
        ms.cantidad,
        ms.fecha_movimiento as created_at,
        ms.id_institucion,
        ms.id_producto as producto_id,
        pr.nombre AS producto_nombre,
        pr.unidad_medida,
        ms.estado_producto,
        ms.cargo_retira,
        ms.motivo,
        u.nombre as usuario_nombre
      FROM movimiento_stock ms
      LEFT JOIN producto pr ON ms.id_producto = pr.id_producto
      LEFT JOIN usuario u ON ms.id_usuario = u.id_usuario
      JOIN institucion i ON ms.id_institucion = i.id_institucion
      WHERE ms.id_institucion = ?
        AND ms.tipo = 'egreso'
        AND (? != 'director_area' OR LOWER(TRIM(i.nivel_educativo)) = LOWER(TRIM(?)))
      ORDER BY ms.fecha_movimiento DESC, ms.id_movimiento DESC
      LIMIT 5
      `,
      [institucion, req.user.role, req.user.nivel_educativo || '']
    );

    return res.json({ pedidos });
  } catch (err) {
    console.error("Error al obtener historial:", err);
    return res.status(500).json({ error: "No se pudo obtener historial" });
  }
});

// Ver pedido específico
router.get("/:id(\\d+)", authorizePermissions(PERMISSIONS.PEDIDOS_VIEW), async (req, res) => {
  try {
    const { id } = req.params;

    const pedidoRows = await all(
      `
      SELECT
        p.id_pedido as id,
        CASE WHEN p.estado::text = 'finalizado' THEN 'entregado' ELSE p.estado::text END as estado,
        p.observaciones_generales as notas,
        p.fecha_creacion as created_at,
        p.id_institucion,
        COALESCE(p.tipo, 'anual') as tipo,
        p.motivo_supervisor,
        p.respuesta_supervisor_tipo,
        p.aprobado_por_supervisor_id,
        p.fecha_aprobacion_supervisor,
        p.kit_id,
        p.kit_nombre,
        p.kit_cantidad,
        dp.id_producto as detalle_producto_id,
        pr.nombre as detalle_producto_nombre,
        pr.unidad_medida as detalle_unidad_medida,
        pr.stock_actual as detalle_stock_actual,
        dp.cantidad_solicitada as detalle_cantidad,
        u.nombre as usuario_nombre,
        i.nombre as institucion
      FROM pedido p
      JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
      JOIN producto pr ON dp.id_producto = pr.id_producto
      JOIN usuario u ON p.id_usuario_solicitante = u.id_usuario
      LEFT JOIN institucion i ON i.id_institucion = p.id_institucion
      WHERE p.id_pedido = ?
      ORDER BY pr.nombre ASC
      `,
      [id]
    );

    const pedido = groupPedidos(pedidoRows)[0];

    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    if (req.user.role === "directivo") {
      const userInstitution = await get(
        "SELECT id_institucion FROM usuario WHERE id_usuario = ?",
        [req.user.sub]
      );
      if (!userInstitution || pedido.id_institucion !== userInstitution.id_institucion) {
        return res.status(403).json({ error: "No tenés acceso a este pedido" });
      }
    }

    return res.json({ pedido });
  } catch (err) {
    console.error("Error al obtener pedido:", err);
    return res.status(500).json({ error: "No se pudo obtener pedido" });
  }
});

// Crear pedido
router.post("/", authorizePermissions(PERMISSIONS.PEDIDOS_CREATE), async (req, res) => {
  try {
    await ensurePedidosSchema();

    const { producto_id, kit_id, cantidad, notas, tipo, items } = req.body;
    const tipoValido = ['anual', 'refuerzo'].includes(tipo) ? tipo : 'anual';
    const cantidadSolicitada = Number(cantidad);

    const hasItemsArray = Array.isArray(items) && items.length > 0;

    if (!hasItemsArray) {
      if ((!producto_id && !kit_id) || !cantidadSolicitada || cantidadSolicitada <= 0) {
        return res.status(400).json({ error: "Debés seleccionar un kit o producto y una cantidad válida" });
      }
    } else if (tipoValido !== 'refuerzo') {
      return res.status(400).json({ error: "Los items múltiples solo están disponibles para solicitudes de refuerzo" });
    }

    const usuario = await get(
      "SELECT id_institucion FROM usuario WHERE id_usuario = ?",
      [req.user.sub]
    );

    if (!usuario || !usuario.id_institucion) {
      return res.status(400).json({ error: "Tu usuario no tiene institución asignada" });
    }

    const perfilInstitucion = await getInstitucionPerfil(usuario.id_institucion);
    if (!perfilInstitucion) {
      return res.status(404).json({ error: "Institución no encontrada" });
    }

    if (req.user.role === "directivo") {
      const pedidoBloqueante = await getPedidoActivoBloqueante(usuario.id_institucion);

      if (pedidoBloqueante) {
        return res.status(409).json({
          error: "Tu institucion ya tiene una solicitud en revision. Vas a poder cargar otra cuando la anterior sea aprobada o rechazada.",
          detalle: {
            pedido_id: Number(pedidoBloqueante.id),
            estado: pedidoBloqueante.estado,
            tipo: pedidoBloqueante.tipo,
            respuesta_supervisor_tipo: pedidoBloqueante.respuesta_supervisor_tipo || null,
            motivo_supervisor: pedidoBloqueante.motivo_supervisor || null,
            created_at: pedidoBloqueante.created_at
          }
        });
      }
    }

    let kit = null;
    let detalleItems = [];
    let routingData = {
      detalleEvaluado: [],
      requiereLicitacion: false,
      estadoAbastecimiento: 'stock_disponible',
      itemsSinStock: []
    };

    if (hasItemsArray) {
      const parsedItems = items
        .map((item) => ({
          producto_id: Number(item?.producto_id),
          cantidad: Number(item?.cantidad)
        }))
        .filter((item) => Number.isInteger(item.producto_id) && item.producto_id > 0 && item.cantidad > 0);

      if (parsedItems.length === 0) {
        return res.status(400).json({ error: "Debés seleccionar al menos un producto con cantidad válida" });
      }

      const productoIds = [...new Set(parsedItems.map((item) => item.producto_id))];
      const productos = await all(
        `SELECT id_producto AS id FROM producto WHERE id_producto = ANY($1::int[])`,
        [productoIds]
      );
      if (productos.length !== productoIds.length) {
        return res.status(404).json({ error: "Uno o más productos no existen" });
      }

      for (const item of parsedItems) {
        const reglaKit = await getReglaKit(perfilInstitucion.tipo_escuela, item.producto_id);
        if (!reglaKit) {
          return res.status(400).json({
            error: "Hay productos seleccionados que no forman parte del kit asignado a tu escuela."
          });
        }
      }

      detalleItems = parsedItems;
    } else if (kit_id) {
      kit = await getKitById(Number(kit_id));
      if (!kit) {
        return res.status(404).json({ error: "Kit no encontrado o inactivo." });
      }
      if (!kit.items.length) {
        return res.status(400).json({ error: "El kit seleccionado no tiene productos configurados." });
      }

      detalleItems = kit.items.map((item) => ({
        producto_id: item.producto_id,
        cantidad: Number(item.cantidad) * cantidadSolicitada
      }));
    } else {
      const producto = await get("SELECT id_producto as id FROM producto WHERE id_producto = ?", [producto_id]);
      if (!producto) {
        return res.status(404).json({ error: "Producto no encontrado" });
      }

      const reglaKit = await getReglaKit(perfilInstitucion.tipo_escuela, producto_id);
      if (!reglaKit) {
        return res.status(400).json({
          error: "El producto seleccionado no forma parte del kit asignado a tu escuela."
        });
      }

      detalleItems = [{ producto_id: Number(producto_id), cantidad: cantidadSolicitada }];
    }

    if (tipoValido === 'refuerzo') {
      routingData = await evaluateRefuerzoRouting(detalleItems);
      detalleItems = routingData.detalleEvaluado;
    }

    const pedidoResult = await run(
      `INSERT INTO pedido (
         id_usuario_solicitante,
         id_institucion,
         observaciones_generales,
         tipo,
         kit_id,
         kit_nombre,
         kit_cantidad,
         requiere_licitacion,
         estado_abastecimiento
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.sub,
        usuario.id_institucion,
        notas || null,
        tipoValido,
        kit?.id || null,
        kit?.nombre || null,
        kit ? cantidadSolicitada : null,
        routingData.requiereLicitacion,
        routingData.estadoAbastecimiento
      ]
    );

    // Asegurar que las cantidades sean enteras positivas antes de insertar
    for (const item of detalleItems) {
      const cantidadEntera = Math.round(Number(item.cantidad || 0));
      if (!Number.isFinite(cantidadEntera) || cantidadEntera <= 0) {
        return res.status(400).json({ error: "Cada ítem del pedido debe tener una cantidad entera mayor a cero" });
      }
      await run(
        `INSERT INTO detalle_pedido (
           id_pedido,
           id_producto,
           cantidad_solicitada,
           observacion,
           requiere_licitacion,
           stock_disponible_relevado
         ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          pedidoResult.lastID,
          item.producto_id,
          cantidadEntera,
          null,
          Boolean(item.requiere_licitacion),
          item.stock_disponible_relevado ?? null
        ]
      );
    }

    return res.status(201).json({
      id: pedidoResult.lastID,
      estado: "pendiente",
      requiere_licitacion: routingData.requiereLicitacion,
      estado_abastecimiento: routingData.estadoAbastecimiento,
      items_sin_stock: routingData.itemsSinStock.map((item) => ({
        producto_id: item.producto_id,
        stock_disponible_relevado: item.stock_disponible_relevado
      }))
    });
  } catch (err) {
    console.error("Error al crear pedido:", err && err.stack ? err.stack : err, "user:", req.user && req.user.sub, "body:", req.body);
    return res.status(500).json({ error: "No se pudo crear pedido" });
  }
});

// Actualizar estado del pedido (solo admin)
router.patch("/:id/estado", authorizePermissions(PERMISSIONS.PEDIDOS_MANAGE), async (req, res) => {
  try {
    await ensurePedidosSchema();

    const { id } = req.params;
    const { estado, motivo } = req.body;

    const estadosValidos = ["pendiente", "aprobado", "rechazado", "cancelado", "entregado", "aclaracion"];
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ error: "Estado inválido" });
    }

    const pedido = await get(
      `SELECT id_pedido as id, estado::text as estado_db, id_institucion, COALESCE(tipo, 'anual') as tipo FROM pedido WHERE id_pedido = ?`,
      [id]
    );

    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    const estadoEntregadoDb = await getEstadoEntregadoDb();
    const estadoObjetivoDb = estado === "entregado" ? estadoEntregadoDb : estado;
    const pedidoYaEntregado = pedido.estado_db === "entregado" || pedido.estado_db === "finalizado";
    const solicitaAclaracion = estado === "aclaracion";

    const transicionSupervisor = solicitaAclaracion || estadoObjetivoDb === "aprobado" || estadoObjetivoDb === "rechazado";

    if (transicionSupervisor) {
      const isSupervisorFlow = req.user.role === "supervisor" || req.user.role === "master";
      if (!isSupervisorFlow) {
        return res.status(403).json({ error: "Solo un supervisor puede aprobar o rechazar pedidos" });
      }

      if (
        req.user.role === "supervisor" &&
        !(await supervisorHasAssignedInstitution(req.user.sub, pedido.id_institucion))
      ) {
        return res.status(403).json({ error: "El pedido no pertenece a una escuela asignada a este supervisor" });
      }

      if (pedido.estado_db !== "pendiente") {
        return res.status(400).json({ error: "Solo se pueden aprobar o rechazar pedidos pendientes" });
      }

      const motivoSupervisor = String(motivo || "").trim() || null;
      const esPedidoAnual = (pedido.tipo || "anual") === "anual";

      if (!esPedidoAnual && estadoObjetivoDb === "aprobado") {
        const detalleRefuerzo = await all(
          `SELECT id_producto, cantidad_solicitada AS cantidad
           FROM detalle_pedido
           WHERE id_pedido = ?`,
          [id]
        );

        const routingRefuerzo = await evaluateRefuerzoRouting(
          detalleRefuerzo.map((item) => ({
            producto_id: Number(item.id_producto),
            cantidad: Number(item.cantidad || 0)
          }))
        );

        for (const item of routingRefuerzo.detalleEvaluado) {
          await run(
            `UPDATE detalle_pedido
             SET requiere_licitacion = ?,
                 stock_disponible_relevado = ?
             WHERE id_pedido = ?
               AND id_producto = ?`,
            [item.requiere_licitacion, item.stock_disponible_relevado, id, item.producto_id]
          );
        }

        await run(
          `UPDATE pedido
           SET requiere_licitacion = ?,
               estado_abastecimiento = ?
           WHERE id_pedido = ?`,
          [routingRefuerzo.requiereLicitacion, routingRefuerzo.estadoAbastecimiento, id]
        );
      }

      if (solicitaAclaracion) {
        if (!motivoSupervisor) {
          return res.status(400).json({ error: "Debés ingresar una aclaración para enviar la réplica." });
        }

        await run(
          `UPDATE pedido
           SET aprobado_por_supervisor_id = ?,
               fecha_aprobacion_supervisor = NOW(),
               motivo_supervisor = ?,
               respuesta_supervisor_tipo = 'aclaracion'
           WHERE id_pedido = ?`,
          [req.user.sub, motivoSupervisor, id]
        );

        return res.json({ ok: true, estado: "pendiente", respuesta_supervisor_tipo: "aclaracion" });
      }

      // Nuevo flujo: Si es anual, pasa a pendiente_director. Si es refuerzo, pasa a aprobado directamente.
      const nuevoEstado = (estadoObjetivoDb === "aprobado" && esPedidoAnual) ? "pendiente_director" : estadoObjetivoDb;

      await run(
        `UPDATE pedido
         SET estado = ?,
             aprobado_por_supervisor_id = ?,
             fecha_aprobacion_supervisor = NOW(),
             motivo_supervisor = ?,
             respuesta_supervisor_tipo = ?
         WHERE id_pedido = ?`,
        [
          nuevoEstado,
          req.user.sub,
          estadoObjetivoDb === "rechazado" ? motivoSupervisor : null,
          estadoObjetivoDb === "rechazado" ? "rechazo" : "aprobacion",
          id
        ]
      );

      const pedidoActualizado = await get(
        `SELECT COALESCE(requiere_licitacion, FALSE) AS requiere_licitacion,
                COALESCE(estado_abastecimiento, 'stock_disponible') AS estado_abastecimiento
         FROM pedido
         WHERE id_pedido = ?`,
        [id]
      );

      return res.json({
        ok: true,
        estado: nuevoEstado,
        requiere_licitacion: Boolean(pedidoActualizado?.requiere_licitacion),
        estado_abastecimiento: pedidoActualizado?.estado_abastecimiento || 'stock_disponible'
      });
    }

    if (pedido.estado_db === estadoObjetivoDb) {
      return res.json({ ok: true, unchanged: true });
    }

    // Si ya fue entregado, evitamos cambiarlo para no desincronizar stock.
    if (pedidoYaEntregado && estadoObjetivoDb !== estadoEntregadoDb) {
      return res.status(400).json({ error: "El pedido ya fue entregado y su estado no puede revertirse" });
    }

    if (estadoObjetivoDb === estadoEntregadoDb && pedido.estado_db !== "aprobado") {
      return res.status(400).json({ error: "Solo se pueden entregar pedidos aprobados por supervisor" });
    }

    if (estadoObjetivoDb === estadoEntregadoDb) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const detalleRes = await client.query(
          `SELECT id_producto, cantidad_solicitada as cantidad
           FROM detalle_pedido
           WHERE id_pedido = $1`,
          [id]
        );

        if (!detalleRes.rows.length) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "El pedido no tiene productos para entregar" });
        }

        for (const item of detalleRes.rows) {
          const cantidad = Number(item.cantidad || 0);

          const updateStock = await client.query(
            `UPDATE producto
             SET stock_actual = stock_actual - $1
             WHERE id_producto = $2 AND stock_actual >= $1
             RETURNING id_producto, stock_actual`,
            [cantidad, item.id_producto]
          );

          if (!updateStock.rowCount) {
            const stockRow = await client.query(
              `SELECT stock_actual FROM producto WHERE id_producto = $1`,
              [item.id_producto]
            );
            const disponible = Number(stockRow.rows[0]?.stock_actual || 0);
            await client.query("ROLLBACK");
            return res.status(400).json({
              error: `Stock insuficiente para entregar pedido. Producto ${item.id_producto}: solicitado ${cantidad}, disponible ${disponible}`
            });
          }

          await client.query(
            `INSERT INTO movimiento_stock (id_producto, cantidad, tipo, id_institucion, id_usuario, motivo)
             VALUES ($1, $2, 'egreso', $3, $4, $5)`,
            [item.id_producto, cantidad, pedido.id_institucion, req.user.sub, `Entrega de pedido #${id}`]
          );
        }

        await client.query(
          "UPDATE pedido SET estado = $1 WHERE id_pedido = $2",
          [estadoObjetivoDb, id]
        );

        await client.query("COMMIT");
        return res.json({ ok: true });
      } catch (txErr) {
        await client.query("ROLLBACK");
        throw txErr;
      } finally {
        client.release();
      }
    }

    await run(
      "UPDATE pedido SET estado = ? WHERE id_pedido = ?",
      [estadoObjetivoDb, id]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("Error al actualizar pedido:", err);
    return res.status(500).json({ error: "No se pudo actualizar pedido" });
  }
});

// Cancelar pedido (solo si está pendiente)
router.patch("/:id/cancelar", authorizePermissions(PERMISSIONS.PEDIDOS_CREATE), async (req, res) => {
  try {
    const { id } = req.params;

    const pedido = await get("SELECT id_usuario_solicitante as usuario_id, estado FROM pedido WHERE id_pedido = ?", [id]);
    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    if (req.user.role === "directivo" && pedido.usuario_id !== req.user.sub) {
      return res.status(403).json({ error: "No podés cancelar este pedido" });
    }

    if (pedido.estado !== "pendiente") {
      return res.status(400).json({ error: "Solo se pueden cancelar pedidos pendientes" });
    }

    await run("UPDATE pedido SET estado = 'cancelado' WHERE id_pedido = ?", [id]);

    return res.json({ ok: true });
  } catch (err) {
    console.error("Error al cancelar pedido:", err);
    return res.status(500).json({ error: "No se pudo cancelar pedido" });
  }
});

// Aprobación final del Director de Área
router.patch("/:id/aprobar-director", authorizePermissions(PERMISSIONS.SUPERVISION_MANAGE), async (req, res) => {
  try {
    if (req.user.role !== "director_area" && !isAdminLikeRole(req.user.role)) {
      return res.status(403).json({ error: "Solo el Director de Área puede realizar esta aprobación." });
    }

    const { id } = req.params;
    const { decision } = req.body; // 'aceptar' o 'rechazar'

    const pedido = await get(
      `SELECT id_pedido, estado::text, id_institucion FROM pedido WHERE id_pedido = ?`,
      [id]
    );

    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    if (pedido.estado !== "pendiente_director") {
      return res.status(400).json({ error: "Solo se pueden aprobar pedidos pendientes de aprobación del Director." });
    }

    if (decision === 'rechazar') {
      await run(
        `UPDATE pedido 
         SET estado = 'rechazado',
             aprobado_director_area = FALSE,
             aprobado_por_director_id = ?,
             fecha_aprobacion_director = NOW()
         WHERE id_pedido = ?`,
        [req.user.sub, id]
      );
      return res.json({ ok: true, estado: 'rechazado' });
    }

    await run(
      `UPDATE pedido 
       SET estado = 'aprobado',
           aprobado_director_area = TRUE,
           aprobado_por_director_id = ?,
           fecha_aprobacion_director = NOW()
       WHERE id_pedido = ?`,
      [req.user.sub, id]
    );

    return res.json({ ok: true, estado: 'aprobado' });
  } catch (err) {
    console.error("Error al aprobar director:", err);
    return res.status(500).json({ error: "No se pudo procesar la aprobación del director." });
  }
});

module.exports = router;
