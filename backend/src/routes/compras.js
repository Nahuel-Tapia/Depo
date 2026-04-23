const express = require("express");
const { all, get, run, pool } = require("../db.pg");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");

const router = express.Router();
router.use(authenticate);

let tablesReady = false;

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
  const row = await get(
    `SELECT NULLIF(BTRIM(nivel_educativo), '') AS nivel_educativo
     FROM usuario
     WHERE id_usuario = ?`,
    [userId]
  );
  return row?.nivel_educativo || null;
}

function normalizeEstadoPlanilla(estado) {
  const value = String(estado || "").trim().toLowerCase();
  if (!value) return null;
  if (value === "procesada") return "aceptada";
  return value;
}

async function ensureTables() {
  if (tablesReady) return;

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS supervisor_escuela_asignacion (
        id SERIAL PRIMARY KEY,
        supervisor_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
        institucion_id INT NOT NULL REFERENCES institucion(id_institucion) ON DELETE CASCADE,
        director_area_id INT REFERENCES usuario(id_usuario),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (supervisor_id, institucion_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS planilla_pedido_anual (
        id SERIAL PRIMARY KEY,
        director_area_id INT NOT NULL REFERENCES usuario(id_usuario),
        anio INT NOT NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'borrador',
        observaciones TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        enviada_at TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS planilla_pedido_anual_detalle (
        id SERIAL PRIMARY KEY,
        planilla_id INT NOT NULL REFERENCES planilla_pedido_anual(id) ON DELETE CASCADE,
        id_pedido INT NOT NULL REFERENCES pedido(id_pedido),
        id_institucion INT NOT NULL REFERENCES institucion(id_institucion),
        id_producto INT NOT NULL REFERENCES producto(id_producto),
        cantidad INT NOT NULL,
        notas TEXT
      )
    `);

    await client.query(`
      ALTER TABLE usuario
      ADD COLUMN IF NOT EXISTS nivel_educativo VARCHAR(120)
    `);

    await client.query(`
      ALTER TABLE planilla_pedido_anual
      ADD COLUMN IF NOT EXISTS aceptada_at TIMESTAMP
    `);

    await client.query(`
      ALTER TABLE planilla_pedido_anual
      ADD COLUMN IF NOT EXISTS aceptada_por INT REFERENCES usuario(id_usuario)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS compra_precio_historico (
        id SERIAL PRIMARY KEY,
        anio INT NOT NULL,
        id_producto INT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
        id_proveedor INT NOT NULL REFERENCES proveedor(id_proveedor),
        precio_compra_real NUMERIC(14,2) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (anio, id_producto)
      )
    `);

    await client.query(`
      UPDATE planilla_pedido_anual
      SET estado = 'aceptada'
      WHERE estado = 'procesada'
    `);

    tablesReady = true;
  } finally {
    client.release();
  }
}

async function getPlanillaCoverage(planillaId, directorAreaId) {
  const expectedSchools = await all(
    `SELECT DISTINCT i.id_institucion AS id, i.nombre, COALESCE(i.cue, '') AS cue
     FROM supervisor_escuela_asignacion sea
     JOIN institucion i ON i.id_institucion = sea.institucion_id
     WHERE sea.director_area_id = $1
     ORDER BY i.nombre ASC`,
    [directorAreaId]
  );

  const loadedSchools = await all(
    `SELECT DISTINCT i.id_institucion AS id, i.nombre, COALESCE(i.cue, '') AS cue
     FROM planilla_pedido_anual_detalle d
     JOIN institucion i ON i.id_institucion = d.id_institucion
     WHERE d.planilla_id = $1
     ORDER BY i.nombre ASC`,
    [planillaId]
  );

  const loadedSet = new Set(loadedSchools.map((school) => Number(school.id)));
  const missingSchools = expectedSchools.filter((school) => !loadedSet.has(Number(school.id)));

  return {
    ok: missingSchools.length === 0 && expectedSchools.length > 0,
    escuelas_esperadas: expectedSchools.length,
    escuelas_cargadas: loadedSchools.length,
    escuelas_faltantes: missingSchools.length,
    faltantes: missingSchools
  };
}

async function buildPlanillasQuery({ role, userId, directorAreaId, estado, nivel }) {
  const nivelColumn = await getInstitucionNivelColumn();
  const params = [];
  const where = [];

  if (role === "area_compras" || role === "admin") {
    where.push("p.estado IN ('enviada', 'aceptada', 'adjudicada', 'cerrada')");
  } else {
    params.push(userId);
    where.push(`p.director_area_id = $${params.length}`);
  }

  if (directorAreaId) {
    params.push(directorAreaId);
    where.push(`p.director_area_id = $${params.length}`);
  }

  const normalizedEstado = normalizeEstadoPlanilla(estado);
  if (normalizedEstado) {
    params.push(normalizedEstado);
    where.push(`LOWER(p.estado) = $${params.length}`);
  }

  if (nivel) {
    if (!nivelColumn) {
      throw new Error("No se encontro la columna de nivel educativo en instituciones");
    }
    params.push(String(nivel).trim().toLowerCase());
    where.push(`
      EXISTS (
        SELECT 1
        FROM planilla_pedido_anual_detalle d
        JOIN institucion i ON i.id_institucion = d.id_institucion
        WHERE d.planilla_id = p.id
          AND LOWER(COALESCE(i.${nivelColumn}, 'sin nivel')) = $${params.length}
      )
    `);
  }

  const sql = `
    SELECT p.id,
           p.anio,
           p.estado,
           p.observaciones,
           p.created_at,
           p.enviada_at,
           p.aceptada_at,
           u.id_usuario AS director_area_id,
           u.nombre AS director_nombre,
           u.apellido AS director_apellido,
           (
             SELECT COUNT(DISTINCT sea.institucion_id)
             FROM supervisor_escuela_asignacion sea
             WHERE sea.director_area_id = p.director_area_id
           ) AS escuelas_esperadas,
           (
             SELECT COUNT(DISTINCT d.id_institucion)
             FROM planilla_pedido_anual_detalle d
             WHERE d.planilla_id = p.id
           ) AS escuelas_cargadas
    FROM planilla_pedido_anual p
    JOIN usuario u ON u.id_usuario = p.director_area_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY p.created_at DESC
  `;

  return { sql, params };
}

async function getConsolidado({ anio, directorAreaId, nivel, estado }) {
  const nivelColumn = await getInstitucionNivelColumn();
  const params = [];
  const where = [];

  if (anio) {
    params.push(anio);
    where.push(`p.anio = $${params.length}`);
  }

  if (directorAreaId) {
    params.push(directorAreaId);
    where.push(`p.director_area_id = $${params.length}`);
  }

  const normalizedEstado = normalizeEstadoPlanilla(estado);
  if (normalizedEstado) {
    params.push(normalizedEstado);
    where.push(`LOWER(p.estado) = $${params.length}`);
  } else {
    where.push(`p.estado IN ('aceptada', 'adjudicada', 'cerrada')`);
  }

  if (nivel) {
    if (!nivelColumn) {
      throw new Error("No se encontro la columna de nivel educativo en instituciones");
    }
    params.push(String(nivel).trim().toLowerCase());
    where.push(`LOWER(COALESCE(i.${nivelColumn}, 'sin nivel')) = $${params.length}`);
  }

  params.push(anio || new Date().getFullYear());
  const previousPriceIndex = params.length;

  params.push(anio || new Date().getFullYear());
  const currentYearIndex = params.length;

  const rows = await all(
    `SELECT
       d.id_producto AS producto_id,
       pr.nombre AS producto,
       COALESCE(pr.unidad_medida, 'unidad') AS unidad_medida,
       SUM(d.cantidad)::numeric AS cantidad_total,
       COUNT(DISTINCT p.id) AS planillas_origen,
       COUNT(DISTINCT d.id_institucion) AS escuelas_origen,
       STRING_AGG(DISTINCT TRIM(CONCAT(u.nombre, ' ', u.apellido)), ', ' ORDER BY TRIM(CONCAT(u.nombre, ' ', u.apellido))) AS directores,
       STRING_AGG(DISTINCT COALESCE(i.${nivelColumn || "nivel_educativo"}, 'Sin nivel'), ', ' ORDER BY COALESCE(i.${nivelColumn || "nivel_educativo"}, 'Sin nivel')) AS niveles,
       prev.anio AS anio_referencia,
       prev.precio_compra_real AS precio_anterior,
       prev.id_proveedor AS proveedor_anterior_id,
       prev.proveedor_nombre AS proveedor_anterior_nombre,
       actual.id_proveedor AS proveedor_actual_id,
       actual.precio_compra_real AS precio_actual
     FROM planilla_pedido_anual p
     JOIN usuario u ON u.id_usuario = p.director_area_id
     JOIN planilla_pedido_anual_detalle d ON d.planilla_id = p.id
     JOIN producto pr ON pr.id_producto = d.id_producto
     JOIN institucion i ON i.id_institucion = d.id_institucion
     LEFT JOIN LATERAL (
       SELECT h.anio, h.id_proveedor, h.precio_compra_real, prov.nombre AS proveedor_nombre
       FROM compra_precio_historico h
       LEFT JOIN proveedor prov ON prov.id_proveedor = h.id_proveedor
       WHERE h.id_producto = d.id_producto
         AND h.anio < $${previousPriceIndex}
       ORDER BY h.anio DESC
       LIMIT 1
     ) prev ON TRUE
     LEFT JOIN LATERAL (
       SELECT h.id_proveedor, h.precio_compra_real
       FROM compra_precio_historico h
       WHERE h.id_producto = d.id_producto
         AND h.anio = $${currentYearIndex}
       LIMIT 1
     ) actual ON TRUE
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     GROUP BY d.id_producto, pr.nombre, pr.unidad_medida,
              prev.anio, prev.precio_compra_real, prev.id_proveedor, prev.proveedor_nombre,
              actual.id_proveedor, actual.precio_compra_real
     ORDER BY pr.nombre ASC`,
    params
  );

  return rows.map((row) => ({
    ...row,
    producto_id: Number(row.producto_id),
    cantidad_total: Number(row.cantidad_total || 0),
    planillas_origen: Number(row.planillas_origen || 0),
    escuelas_origen: Number(row.escuelas_origen || 0),
    precio_anterior: row.precio_anterior !== null ? Number(row.precio_anterior) : null,
    proveedor_anterior_id: row.proveedor_anterior_id ? Number(row.proveedor_anterior_id) : null,
    proveedor_actual_id: row.proveedor_actual_id ? Number(row.proveedor_actual_id) : null,
    precio_actual: row.precio_actual !== null ? Number(row.precio_actual) : null
  }));
}

router.get("/planillas", authorizePermissions(PERMISSIONS.PLANILLA_VIEW), async (req, res) => {
  try {
    await ensureTables();

    const directorAreaId = Number(req.query.director_area_id || 0) || null;
    const { estado = "", nivel = "" } = req.query;
    const { sql, params } = await buildPlanillasQuery({
      role: req.user.role,
      userId: req.user.sub,
      directorAreaId,
      estado,
      nivel
    });

    const rows = await all(sql, params);
    const planillas = [];

    for (const row of rows) {
      const coverage = await getPlanillaCoverage(row.id, row.director_area_id);
      planillas.push({
        ...row,
        director_area_id: Number(row.director_area_id),
        escuelas_esperadas: Number(row.escuelas_esperadas || 0),
        escuelas_cargadas: Number(row.escuelas_cargadas || 0),
        validacion_cobertura: coverage
      });
    }

    res.json({ planillas });
  } catch (err) {
    console.error("Error al listar planillas:", err);
    res.status(500).json({ error: "No se pudieron listar planillas" });
  }
});

router.get("/planillas/:id", authorizePermissions(PERMISSIONS.PLANILLA_VIEW), async (req, res) => {
  try {
    await ensureTables();

    const id = Number(req.params.id);
    const nivelColumn = await getInstitucionNivelColumn();

    const planilla = await get(
      `SELECT p.id, p.anio, p.estado, p.observaciones, p.created_at, p.enviada_at, p.aceptada_at,
              p.director_area_id, u.nombre AS director_nombre, u.apellido AS director_apellido
       FROM planilla_pedido_anual p
       JOIN usuario u ON u.id_usuario = p.director_area_id
       WHERE p.id = $1`,
      [id]
    );

    if (!planilla) return res.status(404).json({ error: "Planilla no encontrada" });
    if (req.user.role === "area_compras" && !["enviada", "aceptada", "adjudicada", "cerrada"].includes(planilla.estado)) {
      return res.status(403).json({ error: "No tenés acceso a esta planilla" });
    }
    if (req.user.role !== "area_compras" && req.user.role !== "admin" && Number(planilla.director_area_id) !== Number(req.user.sub)) {
      return res.status(403).json({ error: "No tenés acceso a esta planilla" });
    }

    const detalles = await all(
      `SELECT d.id, d.cantidad, d.notas,
              i.nombre AS institucion,
              COALESCE(i.cue, '') AS cue,
              COALESCE(i.${nivelColumn || "nivel_educativo"}, 'Sin nivel') AS nivel,
              pr.nombre AS producto,
              pr.unidad_medida,
              ped.id_pedido AS pedido_id
       FROM planilla_pedido_anual_detalle d
       JOIN institucion i ON i.id_institucion = d.id_institucion
       JOIN producto pr ON pr.id_producto = d.id_producto
       JOIN pedido ped ON ped.id_pedido = d.id_pedido
       WHERE d.planilla_id = $1
       ORDER BY i.nombre, pr.nombre`,
      [id]
    );

    const validacion_cobertura = await getPlanillaCoverage(id, planilla.director_area_id);
    res.json({ planilla, detalles, validacion_cobertura });
  } catch (err) {
    console.error("Error al obtener planilla:", err);
    res.status(500).json({ error: "No se pudo obtener la planilla" });
  }
});

router.post("/planillas", authorizePermissions(PERMISSIONS.PLANILLA_MANAGE), async (req, res) => {
  try {
    await ensureTables();

    const { observaciones } = req.body;
    const anio = new Date().getFullYear();
    const nivelColumn = await getInstitucionNivelColumn();
    const directorNivel = await getDirectorAreaNivel(req.user.sub);

    if (!nivelColumn) {
      return res.status(500).json({ error: "No se encontro la columna de nivel educativo en instituciones" });
    }
    if (!directorNivel) {
      return res.status(400).json({ error: "El Director de Area no tiene un nivel educativo configurado" });
    }

    const existente = await get(
      `SELECT id
       FROM planilla_pedido_anual
       WHERE director_area_id = $1
         AND anio = $2
         AND estado != 'cerrada'`,
      [req.user.sub, anio]
    );

    if (existente) {
      return res.status(409).json({ error: `Ya existe una planilla para ${anio}. Primero terminá o eliminá la actual.` });
    }

    const solicitudes = await all(
      `SELECT MIN(p.id_pedido) AS id_pedido,
              p.id_institucion,
              dp.id_producto,
              SUM(dp.cantidad_solicitada) AS cantidad,
              NULLIF(STRING_AGG(DISTINCT NULLIF(BTRIM(p.observaciones_generales), ''), ' | '), '') AS notas
       FROM supervisor_escuela_asignacion sea
       JOIN pedido p ON p.id_institucion = sea.institucion_id
       JOIN institucion i ON i.id_institucion = p.id_institucion
       JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
       WHERE sea.director_area_id = $1
         AND LOWER(COALESCE(i.${nivelColumn}, '')) = LOWER($2)
         AND COALESCE(p.tipo, 'anual') = 'anual'
         AND p.estado = 'aprobado'
         AND p.aprobado_director_area IS TRUE
         AND EXTRACT(YEAR FROM p.fecha_creacion) = $3
       GROUP BY p.id_institucion, dp.id_producto`,
      [req.user.sub, directorNivel, anio]
    );

    if (solicitudes.length === 0) {
      return res.status(400).json({ error: "No hay solicitudes anuales aceptadas por Dirección de Área para incluir en la planilla." });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const planillaRes = await client.query(
        `INSERT INTO planilla_pedido_anual (director_area_id, anio, estado, observaciones)
         VALUES ($1, $2, 'borrador', $3)
         RETURNING id`,
        [req.user.sub, anio, observaciones || null]
      );

      const planillaId = Number(planillaRes.rows[0].id);
      for (const item of solicitudes) {
        await client.query(
          `INSERT INTO planilla_pedido_anual_detalle
             (planilla_id, id_pedido, id_institucion, id_producto, cantidad, notas)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [planillaId, item.id_pedido, item.id_institucion, item.id_producto, item.cantidad, item.notas]
        );
      }

      await client.query("COMMIT");
      res.status(201).json({ id: planillaId, estado: "borrador", items: solicitudes.length });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Error al crear planilla:", err);
    res.status(500).json({ error: "No se pudo crear la planilla" });
  }
});

router.patch("/planillas/:id/enviar", authorizePermissions(PERMISSIONS.PLANILLA_ENVIAR), async (req, res) => {
  try {
    await ensureTables();
    const id = Number(req.params.id);
    const planilla = await get("SELECT id, estado, director_area_id FROM planilla_pedido_anual WHERE id = $1", [id]);

    if (!planilla) return res.status(404).json({ error: "Planilla no encontrada" });
    if (Number(planilla.director_area_id) !== Number(req.user.sub)) {
      return res.status(403).json({ error: "No tenés acceso a esta planilla" });
    }
    if (planilla.estado !== "borrador") {
      return res.status(400).json({ error: "Solo se pueden enviar planillas en estado borrador" });
    }

    await run(`UPDATE planilla_pedido_anual SET estado = 'enviada', enviada_at = NOW() WHERE id = $1`, [id]);
    res.json({ ok: true, estado: "enviada" });
  } catch (err) {
    console.error("Error al enviar planilla:", err);
    res.status(500).json({ error: "No se pudo enviar la planilla" });
  }
});

async function aceptarPlanilla(req, res) {
  try {
    await ensureTables();

    if (req.user.role !== "area_compras" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Solo el Área de Compras puede aceptar planillas" });
    }

    const id = Number(req.params.id);
    const planilla = await get("SELECT id, estado, director_area_id FROM planilla_pedido_anual WHERE id = $1", [id]);

    if (!planilla) return res.status(404).json({ error: "Planilla no encontrada" });
    if (planilla.estado !== "enviada") {
      return res.status(400).json({ error: "Solo se pueden aceptar planillas en estado enviada" });
    }

    const coverage = await getPlanillaCoverage(id, planilla.director_area_id);
    if (!coverage.ok) {
      return res.status(400).json({
        error: "No se puede aceptar la planilla porque no cubre el 100% de las escuelas asignadas.",
        validacion_cobertura: coverage
      });
    }

    await run(
      `UPDATE planilla_pedido_anual
       SET estado = 'aceptada',
           aceptada_at = NOW(),
           aceptada_por = $2
       WHERE id = $1`,
      [id, req.user.sub]
    );

    res.json({ ok: true, estado: "aceptada", validacion_cobertura: coverage });
  } catch (err) {
    console.error("Error al aceptar planilla:", err);
    res.status(500).json({ error: "No se pudo aceptar la planilla" });
  }
}

router.patch("/planillas/:id/aceptar", authorizePermissions(PERMISSIONS.PLANILLA_MANAGE), aceptarPlanilla);
router.patch("/planillas/:id/procesar", authorizePermissions(PERMISSIONS.PLANILLA_MANAGE), aceptarPlanilla);

router.delete("/planillas/:id", authorizePermissions(PERMISSIONS.PLANILLA_MANAGE), async (req, res) => {
  try {
    await ensureTables();
    const id = Number(req.params.id);
    const planilla = await get("SELECT id, estado, director_area_id FROM planilla_pedido_anual WHERE id = $1", [id]);

    if (!planilla) return res.status(404).json({ error: "Planilla no encontrada" });
    if (Number(planilla.director_area_id) !== Number(req.user.sub)) {
      return res.status(403).json({ error: "No tenés acceso a esta planilla" });
    }
    if (planilla.estado !== "borrador") {
      return res.status(400).json({ error: "Solo se pueden eliminar planillas en estado borrador" });
    }

    await run("DELETE FROM planilla_pedido_anual WHERE id = $1", [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error al eliminar planilla:", err);
    res.status(500).json({ error: "No se pudo eliminar la planilla" });
  }
});

router.get("/licitacion/consolidado", authorizePermissions(PERMISSIONS.PLANILLA_VIEW), async (req, res) => {
  try {
    await ensureTables();
    const anio = Number(req.query.anio || new Date().getFullYear());
    const directorAreaId = Number(req.query.director_area_id || 0) || null;
    const { nivel = "", estado = "" } = req.query;
    const items = await getConsolidado({ anio, directorAreaId, nivel, estado });
    res.json({ anio, items });
  } catch (err) {
    console.error("Error al generar consolidado de licitación:", err);
    res.status(500).json({ error: "No se pudo generar el listado final" });
  }
});

router.get("/adjudicacion", authorizePermissions(PERMISSIONS.PLANILLA_MANAGE), async (req, res) => {
  try {
    await ensureTables();
    const anio = Number(req.query.anio || new Date().getFullYear());
    const directorAreaId = Number(req.query.director_area_id || 0) || null;
    const { nivel = "", estado = "" } = req.query;

    const [items, proveedores] = await Promise.all([
      getConsolidado({ anio, directorAreaId, nivel, estado }),
      all(
        `SELECT id_proveedor AS id, nombre, cuit, contacto, telefono, email, categoria
         FROM proveedor
         WHERE COALESCE(activo, TRUE) = TRUE
         ORDER BY nombre ASC`
      )
    ]);

    res.json({ anio, items, proveedores });
  } catch (err) {
    console.error("Error al cargar adjudicación:", err);
    res.status(500).json({ error: "No se pudo cargar la adjudicación" });
  }
});

router.post("/adjudicacion", authorizePermissions(PERMISSIONS.PLANILLA_MANAGE), async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureTables();

    const anio = Number(req.body?.anio || new Date().getFullYear());
    const items = Array.isArray(req.body?.items) ? req.body.items : [];

    if (!items.length) {
      return res.status(400).json({ error: "No hay productos para adjudicar" });
    }

    const consolidado = await getConsolidado({ anio });
    const productoPermitidos = new Set(consolidado.map((item) => Number(item.producto_id)));

    await client.query("BEGIN");

    for (const item of items) {
      const productoId = Number(item?.producto_id);
      const proveedorId = Number(item?.proveedor_id);
      const precio = Number(item?.precio_compra_real);

      if (!productoPermitidos.has(productoId)) {
        throw new Error("Uno de los productos no forma parte del listado consolidado.");
      }
      if (!Number.isInteger(proveedorId) || proveedorId <= 0) {
        throw new Error("Cada producto debe tener un proveedor ganador válido.");
      }
      if (!Number.isFinite(precio) || precio <= 0) {
        throw new Error("Cada producto debe tener un precio de compra real mayor a cero.");
      }

      const proveedor = await client.query(
        `SELECT id_proveedor FROM proveedor WHERE id_proveedor = $1 AND COALESCE(activo, TRUE) = TRUE`,
        [proveedorId]
      );

      if (proveedor.rowCount === 0) {
        throw new Error("Uno de los proveedores seleccionados no existe o está inactivo.");
      }

      await client.query(
        `INSERT INTO compra_precio_historico (anio, id_producto, id_proveedor, precio_compra_real, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (anio, id_producto)
         DO UPDATE SET id_proveedor = EXCLUDED.id_proveedor,
                       precio_compra_real = EXCLUDED.precio_compra_real,
                       updated_at = NOW()`,
        [anio, productoId, proveedorId, precio]
      );
    }

    await client.query(
      `UPDATE planilla_pedido_anual
       SET estado = 'adjudicada'
       WHERE anio = $1
         AND estado = 'aceptada'`,
      [anio]
    );

    await client.query("COMMIT");
    res.json({ ok: true, anio });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error al guardar adjudicación:", err);
    res.status(400).json({ error: err.message || "No se pudo guardar la adjudicación" });
  } finally {
    client.release();
  }
});

module.exports = router;
