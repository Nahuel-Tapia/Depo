const express = require("express");
const { all, get, run, pool } = require("../db.pg");
const { authenticate, authorizePermissions, isAdminLikeRole } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");

const router = express.Router();
router.use(authenticate);

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
  const row = await get(
    `SELECT NULLIF(BTRIM(nivel_educativo), '') AS nivel_educativo
     FROM usuario
     WHERE id_usuario = ?`,
    [userId]
  );
  return row?.nivel_educativo || null;
}

async function resolvePlanillaDirectorUserId(req) {
  const role = String(req.user?.role || "").toLowerCase();
  if (role === "director_area") {
    return Number(req.user.sub);
  }
  if (isAdminLikeRole(role)) {
    const pick = Number(req.body?.director_area_id || req.query?.director_area_id || 0);
    if (Number.isInteger(pick) && pick > 0) {
      const row = await get(
        `SELECT id_usuario FROM usuario WHERE id_usuario = ? AND role = 'director_area' AND (activo IS NULL OR activo = TRUE)`,
        [pick]
      );
      if (row?.id_usuario) return Number(row.id_usuario);
    }
    const first = await get(
      `SELECT id_usuario FROM usuario WHERE role = 'director_area' AND (activo IS NULL OR activo = TRUE) ORDER BY id_usuario ASC LIMIT 1`
    );
    return first?.id_usuario ? Number(first.id_usuario) : null;
  }
  return Number(req.user.sub);
}

function normalizeEstadoPlanilla(estado) {
  const value = String(estado || "").trim().toLowerCase();
  if (!value) return null;
  if (value === "procesada") return "aceptada";
  return value;
}

async function ensureTables() {
  if (tablesReady) return;
  if (tablesInitPromise) {
    await tablesInitPromise;
    return;
  }

  tablesInitPromise = (async () => {
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
      ALTER TABLE pedido
      ADD COLUMN IF NOT EXISTS aprobado_director_area BOOLEAN
    `);

      await client.query(`
      ALTER TABLE pedido
      ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) DEFAULT 'anual'
    `);

      await client.query(`
      ALTER TABLE pedido
      ADD COLUMN IF NOT EXISTS requiere_licitacion BOOLEAN NOT NULL DEFAULT FALSE
    `);

      await client.query(`
      ALTER TABLE pedido
      ADD COLUMN IF NOT EXISTS estado_abastecimiento VARCHAR(40) NOT NULL DEFAULT 'stock_disponible'
    `);

      await client.query(`
      ALTER TABLE detalle_pedido
      ADD COLUMN IF NOT EXISTS requiere_licitacion BOOLEAN NOT NULL DEFAULT FALSE
    `);

      await client.query(`
      ALTER TABLE detalle_pedido
      ADD COLUMN IF NOT EXISTS stock_disponible_relevado NUMERIC(12,2)
    `);

      await client.query(`
      ALTER TABLE usuario
      ADD COLUMN IF NOT EXISTS nivel_educativo VARCHAR(120)
    `);
      await client.query(`
      ALTER TABLE usuario
      ADD COLUMN IF NOT EXISTS director_area_id INT REFERENCES usuario(id_usuario)
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
      ALTER TABLE planilla_pedido_anual
      ADD COLUMN IF NOT EXISTS direccion_area VARCHAR(100)
    `);

      await client.query(`
      ALTER TABLE planilla_pedido_anual
      ADD COLUMN IF NOT EXISTS motivo_devolucion TEXT
    `);

      await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_planilla_anio_direccion
      ON planilla_pedido_anual (anio, direccion_area)
      WHERE estado IN ('enviada', 'aceptada', 'adjudicada', 'cerrada')
        AND direccion_area IS NOT NULL
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
      CREATE TABLE IF NOT EXISTS licitacion_publicada (
        id SERIAL PRIMARY KEY,
        anio INT NOT NULL UNIQUE,
        usuario_id INT,
        items JSONB NOT NULL DEFAULT '[]'::jsonb,
        fecha_publicacion TIMESTAMP DEFAULT NOW(),
        estado VARCHAR(30) NOT NULL DEFAULT 'publicada'
      )
    `);

      await client.query(`
      ALTER TABLE licitacion_publicada
      ADD COLUMN IF NOT EXISTS usuario_id INT
    `);

      await client.query(`
      ALTER TABLE licitacion_publicada
      ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb
    `);

      await client.query(`
      ALTER TABLE licitacion_publicada
      ADD COLUMN IF NOT EXISTS fecha_publicacion TIMESTAMP DEFAULT NOW()
    `);

      await client.query(`
      ALTER TABLE licitacion_publicada
      ADD COLUMN IF NOT EXISTS estado VARCHAR(30) NOT NULL DEFAULT 'publicada'
    `);

      await client.query(`
      ALTER TABLE licitacion_publicada
      ADD COLUMN IF NOT EXISTS titulo VARCHAR(255)
    `);

      await client.query(`
      ALTER TABLE licitacion_publicada
      ADD COLUMN IF NOT EXISTS motivo TEXT
    `);

      await client.query(`
      ALTER TABLE licitacion_publicada
      ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'anual'
    `);

      await client.query(`
      CREATE TABLE IF NOT EXISTS remito_licitacion (
        id SERIAL PRIMARY KEY,
        numero VARCHAR(30) NOT NULL UNIQUE,
        licitacion_id INT NOT NULL,
        id_deposito INT,
        usuario_id INT,
        observaciones TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

      await client.query(`
      CREATE TABLE IF NOT EXISTS recepcion_licitacion (
        id SERIAL PRIMARY KEY,
        licitacion_id INT NOT NULL,
        producto_id INT NOT NULL,
        cantidad_recibida NUMERIC(12,2) NOT NULL,
        usuario_id INT,
        id_deposito INT,
        fecha_vencimiento DATE,
        observaciones TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

      await client.query(`
      ALTER TABLE remito_licitacion
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()
    `);

      await client.query(`
      ALTER TABLE recepcion_licitacion
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()
    `);

      await client.query(`
      ALTER TABLE recepcion_licitacion
      ADD COLUMN IF NOT EXISTS remito_id INT REFERENCES remito_licitacion(id)
    `);

      await client.query(`
      ALTER TABLE recepcion_licitacion
      ADD COLUMN IF NOT EXISTS cantidad_danada NUMERIC(12,2) NOT NULL DEFAULT 0
    `);

      await client.query(`
      ALTER TABLE recepcion_licitacion
      ADD COLUMN IF NOT EXISTS obs_danio TEXT
    `);

      await client.query(`
      ALTER TABLE licitacion_publicada
      DROP CONSTRAINT IF EXISTS licitacion_publicada_anio_key
    `);

      await client.query(`
      ALTER TABLE compra_precio_historico
      DROP CONSTRAINT IF EXISTS compra_precio_historico_anio_id_producto_key
    `);

      await client.query(`
      ALTER TABLE compra_precio_historico
      ADD COLUMN IF NOT EXISTS licitacion_id INT REFERENCES licitacion_publicada(id)
    `);

      await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'compra_precio_historico_licitacion_producto_key'
        ) THEN
          ALTER TABLE compra_precio_historico
          ADD CONSTRAINT compra_precio_historico_licitacion_producto_key
          UNIQUE (licitacion_id, id_producto);
        END IF;
      END
      $$;
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
  })();

  try {
    await tablesInitPromise;
  } finally {
    tablesInitPromise = null;
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

  if (role === "area_compras" || isAdminLikeRole(role)) {
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
           u.nivel_educativo,
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
  if (!nivelColumn) {
    throw new Error("No se encontro la columna de nivel educativo en instituciones");
  }
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
       STRING_AGG(DISTINCT COALESCE(i.${nivelColumn}, 'Sin nivel'), ', ' ORDER BY COALESCE(i.${nivelColumn}, 'Sin nivel')) AS niveles,
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

async function getConsolidadoRealTime({ anio }) {
  const query = `
    SELECT
      dp.id_producto AS producto_id,
      pr.nombre AS producto,
      COALESCE(pr.unidad_medida, 'unidad') AS unidad_medida,
      SUM(dp.cantidad_solicitada)::numeric AS cantidad_total,
      COALESCE((SELECT SUM(sd.cantidad) FROM stock_deposito sd WHERE sd.id_producto = dp.id_producto), 0)::numeric AS stock_actual
    FROM pedido p
    JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
    JOIN producto pr ON pr.id_producto = dp.id_producto
    WHERE COALESCE(p.tipo, 'anual') = 'anual'
      AND p.estado = 'aprobado'
      AND p.aprobado_director_area IS TRUE
      AND EXTRACT(YEAR FROM p.fecha_creacion) = ?
      AND EXISTS (
        SELECT 1 FROM planilla_pedido_anual ppa
        JOIN supervisor_escuela_asignacion sea ON sea.director_area_id = ppa.director_area_id
        WHERE sea.institucion_id = p.id_institucion
          AND ppa.anio = ?
          AND ppa.estado IN ('enviada', 'aceptada')
      )
    GROUP BY dp.id_producto, pr.nombre, pr.unidad_medida
    ORDER BY pr.nombre ASC
  `;
  const rows = await all(query, [anio, anio]);
  return rows.map((row) => ({
    ...row,
    producto_id: Number(row.producto_id),
    cantidad_total: Number(row.cantidad_total || 0),
    stock_actual: Number(row.stock_actual || 0)
  }));
}

async function getEstadoDirectores({ anio }) {
  const rows = await all(
    `SELECT
       COALESCE(da, 'Sin dirección') AS direccion_area,
       EXISTS (
         SELECT 1 FROM planilla_pedido_anual ppa
         WHERE ppa.direccion_area = da
           AND ppa.anio = $1
           AND ppa.estado IN ('enviada', 'aceptada', 'adjudicada', 'cerrada')
       ) AS enviado,
       (
         SELECT ppa.id FROM planilla_pedido_anual ppa
         WHERE ppa.direccion_area = da
           AND ppa.anio = $1
           AND ppa.estado IN ('enviada', 'aceptada', 'adjudicada', 'cerrada')
         ORDER BY ppa.created_at DESC, ppa.id DESC
         LIMIT 1
       ) AS planilla_id,
       (
         SELECT ppa.estado FROM planilla_pedido_anual ppa
         WHERE ppa.direccion_area = da
           AND ppa.anio = $1
           AND ppa.estado IN ('enviada', 'aceptada', 'adjudicada', 'cerrada')
         ORDER BY ppa.created_at DESC, ppa.id DESC
         LIMIT 1
       ) AS planilla_estado
     FROM (
       SELECT DISTINCT NULLIF(BTRIM(i.direccion_area), '') AS da
       FROM institucion i
       WHERE i.direccion_area IS NOT NULL AND BTRIM(i.direccion_area) != ''
     ) sub
     ORDER BY direccion_area ASC`,
    [anio]
  );
  return rows;
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
    if (!nivelColumn) {
      return res.status(500).json({ error: "No se encontro la columna de nivel educativo en instituciones" });
    }
    const planilla = await get(
      `SELECT p.id,
              p.anio,
              p.estado,
              p.observaciones,
              p.created_at,
              p.enviada_at,
              p.aceptada_at,
              p.director_area_id,
              u.nombre AS director_nombre,
              u.apellido AS director_apellido
       FROM planilla_pedido_anual p
       JOIN usuario u ON u.id_usuario = p.director_area_id
       WHERE p.id = $1`,
      [id]
    );

    if (!planilla) {
      return res.status(404).json({ error: "Planilla no encontrada" });
    }

    if (req.user.role === "area_compras" && !["enviada", "aceptada", "adjudicada", "cerrada"].includes(planilla.estado)) {
      return res.status(403).json({ error: "No tenés acceso a esta planilla" });
    }

    if (!isAdminLikeRole(req.user.role) && req.user.role !== "area_compras" && Number(planilla.director_area_id) !== Number(req.user.sub)) {
      return res.status(403).json({ error: "No tenés acceso a esta planilla" });
    }

    const detalles = await all(
      `SELECT 
        dp.id_producto AS producto_id,
        pr.nombre AS producto,
        COALESCE(pr.unidad_medida, 'unidad') AS unidad_medida,
        SUM(dp.cantidad_solicitada)::numeric AS cantidad,
        i.nombre AS institucion,
        COALESCE(i.cue, '') AS cue,
        u.nivel_educativo AS nivel
      FROM pedido p
      JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
      JOIN producto pr ON pr.id_producto = dp.id_producto
      JOIN institucion i ON i.id_institucion = p.id_institucion
      JOIN supervisor_escuela_asignacion sea ON sea.institucion_id = p.id_institucion
      JOIN usuario u ON u.id_usuario = sea.director_area_id
      WHERE sea.director_area_id = $1
        AND COALESCE(p.tipo, 'anual') = 'anual'
        AND p.estado = 'aprobado'
        AND p.aprobado_director_area IS TRUE
        AND EXTRACT(YEAR FROM p.fecha_creacion) = $2
      GROUP BY dp.id_producto, pr.nombre, pr.unidad_medida, i.nombre, i.cue, u.nivel_educativo
      ORDER BY i.nombre, pr.nombre`,
      [planilla.director_area_id, planilla.anio]
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
    const directorUserId = await resolvePlanillaDirectorUserId(req);
    if (!directorUserId) {
      return res.status(400).json({
        error: "No hay un Director de Area activo en el sistema. Creá uno o pasá director_area_id para generar la planilla."
      });
    }
    const directorNivel = await getDirectorAreaNivel(directorUserId);

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
      [directorUserId, anio]
    );

    if (existente) {
      return res.status(409).json({
        error: `Ya existe una planilla para ${anio}. Primero terminá o eliminá la actual.`
      });
    }

    const solicitudes = await all(
      `SELECT MIN(p.id_pedido) AS id_pedido,
              p.id_institucion,
              dp.id_producto,
              SUM(dp.cantidad_solicitada) AS cantidad,
              NULLIF(
                STRING_AGG(DISTINCT NULLIF(BTRIM(p.observaciones_generales), ''), ' | '),
                ''
              ) AS notas
       FROM supervisor_escuela_asignacion sea
       JOIN pedido p ON p.id_institucion = sea.institucion_id
       JOIN institucion i ON i.id_institucion = p.id_institucion
      
       JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
       WHERE LOWER(COALESCE(i.${nivelColumn}, '')) = LOWER($1)
         AND COALESCE(p.tipo, 'anual') = 'anual'
         AND p.estado = 'aprobado'
         AND p.aprobado_director_area IS TRUE
         AND EXTRACT(YEAR FROM p.fecha_creacion) = $2
         AND sea.director_area_id = $3
       GROUP BY p.id_institucion, dp.id_producto`,
      [directorNivel, anio, directorUserId]
    );

    if (solicitudes.length === 0) {
      return res.status(400).json({
        error: "No hay solicitudes anuales aceptadas por Dirección de Área para incluir en la planilla."
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const planillaRes = await client.query(
        `INSERT INTO planilla_pedido_anual (director_area_id, anio, estado, observaciones)
         VALUES ($1, $2, 'borrador', $3)
         RETURNING id`,
        [directorUserId, anio, observaciones || null]
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
    const planilla = await get(
      "SELECT id, estado, director_area_id FROM planilla_pedido_anual WHERE id = $1",
      [id]
    );

    if (!planilla) return res.status(404).json({ error: "Planilla no encontrada" });
    if (
      !isAdminLikeRole(req.user.role) &&
      Number(planilla.director_area_id) !== Number(req.user.sub)
    ) {
      return res.status(403).json({ error: "No tenés acceso a esta planilla" });
    }
    if (planilla.estado !== "borrador") {
      return res.status(400).json({ error: "Solo se pueden enviar planillas en estado borrador" });
    }

    await run(
      `UPDATE planilla_pedido_anual
       SET estado = 'enviada', enviada_at = NOW()
       WHERE id = $1`,
      [id]
    );

    res.json({ ok: true, estado: "enviada" });
  } catch (err) {
    console.error("Error al enviar planilla:", err);
    res.status(500).json({ error: "No se pudo enviar la planilla" });
  }
});

async function aceptarPlanilla(req, res) {
  try {
    await ensureTables();

    if (req.user.role !== "area_compras" && !isAdminLikeRole(req.user.role)) {
      return res.status(403).json({ error: "Solo el Área de Compras puede aceptar planillas" });
    }

    const id = Number(req.params.id);
    const planilla = await get(
      "SELECT id, estado, director_area_id FROM planilla_pedido_anual WHERE id = $1",
      [id]
    );

    if (!planilla) return res.status(404).json({ error: "Planilla no encontrada" });
    if (planilla.estado !== "enviada") {
      return res.status(400).json({ error: "Solo se pueden aceptar planillas en estado enviada" });
    }

    const coverage = await getPlanillaCoverage(id, planilla.director_area_id);
    // Permitimos aceptar planillas parciales por pedido del usuario.

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

async function getEnviadaStatus(req, res) {
  try {
    await ensureTables();
    const anio = Number(req.query.anio || new Date().getFullYear());
    const directorUserId = await resolvePlanillaDirectorUserId(req);
    if (!directorUserId) {
      return res.json({ sent: false, planilla: null });
    }
    const planilla = await get(
      `SELECT id, estado, enviada_at, aceptada_at, motivo_devolucion
       FROM planilla_pedido_anual
       WHERE director_area_id = $1 AND anio = $2
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [directorUserId, anio]
    );
    const sent = !!planilla && ['enviada', 'aceptada', 'adjudicada', 'cerrada'].includes(String(planilla.estado || '').toLowerCase());
    res.json({ sent, planilla });
  } catch (err) {
    console.error("Error al obtener estado de envío:", err);
    res.status(500).json({ error: "No se pudo obtener el estado de envío" });
  }
}

async function getEscuelasPendientes(req, res) {
  try {
    await ensureTables();
    const anio = Number(req.query.anio || new Date().getFullYear());
    const directorUserId = await resolvePlanillaDirectorUserId(req);
    if (!directorUserId) {
      return res.json({ pendientes: [] });
    }

    const assigned = await all(
      `SELECT DISTINCT i.id_institucion AS id, i.nombre, COALESCE(i.cue, '') AS cue
       FROM supervisor_escuela_asignacion sea
       JOIN institucion i ON i.id_institucion = sea.institucion_id
       WHERE sea.director_area_id = $1
       ORDER BY i.nombre ASC`,
      [directorUserId]
    );

    const approved = await all(
      `SELECT DISTINCT id_institucion
       FROM pedido
       WHERE COALESCE(tipo, 'anual') = 'anual'
         AND estado = 'aprobado'
         AND aprobado_director_area IS TRUE
         AND EXTRACT(YEAR FROM fecha_creacion) = $1`,
      [anio]
    );

    const approvedSet = new Set(approved.map(a => Number(a.id_institucion)));
    const pendientes = assigned.filter(i => !approvedSet.has(Number(i.id)));

    res.json({ pendientes });
  } catch (err) {
    console.error("Error al obtener escuelas pendientes:", err);
    res.status(500).json({ error: "No se pudieron obtener las escuelas pendientes" });
  }
}

async function enviarLicitacionFinal(req, res) {
  const client = await pool.connect();
  try {
    await ensureTables();
    await client.query("BEGIN");

    const anio = new Date().getFullYear();
    const directorUserId = await resolvePlanillaDirectorUserId(req);
    if (!directorUserId) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "No hay un Director de Area activo. Creá uno o pasá director_area_id."
      });
    }

    // Obtener la direccion_area del director desde sus instituciones asignadas
    const dirRow = await client.query(
      `SELECT DISTINCT NULLIF(BTRIM(i.direccion_area), '') AS direccion_area
       FROM supervisor_escuela_asignacion sea
       JOIN institucion i ON i.id_institucion = sea.institucion_id
       WHERE sea.director_area_id = $1
         AND i.direccion_area IS NOT NULL AND BTRIM(i.direccion_area) != ''
       LIMIT 1`,
      [directorUserId]
    );
    const direccionArea = dirRow.rows[0]?.direccion_area || null;

    // Verificar si ya existe planilla enviada para esta direccion_area en el año (cualquier director)
    if (direccionArea) {
      const crossCheck = await client.query(
        `SELECT id FROM planilla_pedido_anual
         WHERE direccion_area = $1 AND anio = $2
           AND estado IN ('enviada', 'aceptada', 'adjudicada', 'cerrada')
         LIMIT 1`,
        [direccionArea, anio]
      );
      if (crossCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: `La Dirección de Área "${direccionArea}" ya envió la licitación anual ${anio}. No se puede enviar nuevamente.`
        });
      }
    }

    const existing = await client.query(
      `SELECT id, estado
       FROM planilla_pedido_anual
       WHERE director_area_id = $1 AND anio = $2
       ORDER BY created_at DESC, id DESC`,
      [directorUserId, anio]
    );

    const alreadySent = existing.rows.some((row) => ['enviada', 'aceptada', 'adjudicada', 'cerrada'].includes(String(row.estado || '').toLowerCase()));
    if (alreadySent) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: `La Dirección de Área ya envió la licitación anual ${anio}. No se puede enviar nuevamente.`
      });
    }

    let planillaId;
    const borradorExistente = existing.rows.find((row) => ['borrador', 'devuelta'].includes(String(row.estado || '').toLowerCase()));
    if (borradorExistente) {
      planillaId = borradorExistente.id;
      await client.query(
        `UPDATE planilla_pedido_anual SET estado = 'enviada', enviada_at = NOW(),
         direccion_area = COALESCE(direccion_area, $2) WHERE id = $1`,
        [planillaId, direccionArea]
      );
    } else {
      const resIns = await client.query(
        `INSERT INTO planilla_pedido_anual (director_area_id, anio, estado, enviada_at, direccion_area)
         VALUES ($1, $2, 'enviada', NOW(), $3) RETURNING id`,
        [directorUserId, anio, direccionArea]
      );
      planillaId = resIns.rows[0].id;
    }

    // Opcional: Popular planilla_pedido_anual_detalle para mantener compatibilidad histórica si es necesario,
    // aunque ahora Compras consume de 'pedido' directamente.
    
    await client.query("COMMIT");
    res.json({ ok: true, message: "Envío realizado con éxito", anio });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error al enviar a compras:", err);
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
}

async function devolverPlanilla(req, res) {
  try {
    await ensureTables();
    const { id } = req.params;
    const { motivo } = req.body || {};

    const planilla = await get(
      `SELECT id, estado FROM planilla_pedido_anual WHERE id = $1`,
      [id]
    );
    if (!planilla) {
      return res.status(404).json({ error: 'Planilla no encontrada' });
    }
    const estadoActual = String(planilla.estado || '').toLowerCase();
    if (!['enviada', 'aceptada'].includes(estadoActual)) {
      return res.status(400).json({ error: `No se puede devolver una planilla en estado "${estadoActual}"` });
    }

    await run(
      `UPDATE planilla_pedido_anual SET estado = 'devuelta', motivo_devolucion = $1 WHERE id = $2`,
      [motivo || null, id]
    );
    res.json({ ok: true, message: 'Planilla devuelta al director de área' });
  } catch (err) {
    console.error('Error al devolver planilla:', err);
    res.status(500).json({ error: err.message });
  }
}

router.patch("/planillas/:id/aceptar", authorizePermissions(PERMISSIONS.PLANILLA_MANAGE), aceptarPlanilla);
router.patch("/planillas/:id/devolver", authorizePermissions(PERMISSIONS.PLANILLA_MANAGE), devolverPlanilla);
router.patch("/planillas/:id/procesar", authorizePermissions(PERMISSIONS.PLANILLA_MANAGE), aceptarPlanilla);

router.delete("/planillas/:id", authorizePermissions(PERMISSIONS.PLANILLA_MANAGE), async (req, res) => {
  try {
    await ensureTables();

    const id = Number(req.params.id);
    const planilla = await get(
      "SELECT id, estado, director_area_id FROM planilla_pedido_anual WHERE id = $1",
      [id]
    );

    if (!planilla) return res.status(404).json({ error: "Planilla no encontrada" });
    if (
      !isAdminLikeRole(req.user.role) &&
      Number(planilla.director_area_id) !== Number(req.user.sub)
    ) {
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

router.get("/licitacion/anual/consolidado", authorizePermissions(PERMISSIONS.PLANILLA_VIEW), async (req, res) => {
  try {
    await ensureTables();
    const anio = Number(req.query.anio || new Date().getFullYear());
    console.log("[DEBUG] Consolidado RealTime - Anio:", anio);
    const items = await getConsolidadoRealTime({ anio });
    res.json({ anio, items });
  } catch (err) {
    console.error("[ERROR] Licitación Consolidado Real-Time:", err);
    res.status(500).json({ error: err.message || "No se pudo generar el consolidado" });
  }
});

router.get("/licitacion/anual/estado-directores", authorizePermissions(PERMISSIONS.PLANILLA_VIEW), async (req, res) => {
  try {
    await ensureTables();
    const anio = Number(req.query.anio || new Date().getFullYear());
    console.log("[DEBUG] Estado Directores - Anio:", anio);
    const directores = await getEstadoDirectores({ anio });
    res.json({ anio, directores });
  } catch (err) {
    console.error("[ERROR] Licitación Estado Directores:", err);
    res.status(500).json({ error: err.message || "No se pudo obtener el estado de los directores" });
  }
});

router.get("/licitacion/anual/enviada-status", getEnviadaStatus);
router.get("/licitacion/anual/escuelas-pendientes", getEscuelasPendientes);
router.post("/licitacion/anual/enviar-final", enviarLicitacionFinal);

async function getFinalItems(req, res) {
  try {
    await ensureTables();
    const anio = Number(req.query.anio || new Date().getFullYear());
    
    // Solo traemos items de directores que ya enviaron (estado enviada o aceptada)
    const query = `
      SELECT 
        p.id_pedido,
        i.nombre AS institucion,
        u.nivel_educativo AS nivel,
        pr.id_producto AS producto_id,
        pr.nombre AS producto,
        COALESCE(pr.unidad_medida, 'unidad') AS unidad_medida,
        SUM(dp.cantidad_solicitada)::numeric AS cantidad_solicitada,
        ppa.estado AS estado,
        ppa.enviada_at AS fecha
      FROM pedido p
      JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
      JOIN producto pr ON pr.id_producto = dp.id_producto
      JOIN institucion i ON i.id_institucion = p.id_institucion
      JOIN supervisor_escuela_asignacion sea ON sea.institucion_id = i.id_institucion
      JOIN usuario u ON u.id_usuario = sea.director_area_id
      JOIN LATERAL (
        SELECT ppa.estado, ppa.enviada_at
        FROM planilla_pedido_anual ppa
        WHERE ppa.director_area_id = u.id_usuario
          AND ppa.anio = $1
          AND ppa.estado IN ('enviada', 'aceptada')
        ORDER BY ppa.created_at DESC, ppa.id DESC
        LIMIT 1
      ) ppa ON TRUE
      WHERE ppa.estado IN ('enviada', 'aceptada')
        AND COALESCE(p.tipo, 'anual') = 'anual'
        AND p.estado = 'aprobado'
        AND p.aprobado_director_area IS TRUE
        AND EXTRACT(YEAR FROM p.fecha_creacion) = $1
      GROUP BY p.id_pedido, i.nombre, u.nivel_educativo, pr.id_producto, pr.nombre, pr.unidad_medida, ppa.estado, ppa.enviada_at
      ORDER BY i.nombre, pr.nombre
    `;
    
    const items = await all(query, [anio]);
    res.json({ items });
  } catch (err) {
    console.error("Error al obtener items finales:", err);
    res.status(500).json({ error: "No se pudieron obtener los items finales" });
  }
}

async function getLicitacionesByAnio(anio, tipo = null) {
  const params = [anio];
  const where = [`lp.anio = $1`];

  if (tipo) {
    params.push(tipo);
    where.push(`COALESCE(lp.tipo, 'anual') = $${params.length}`);
  }

  return all(
    `SELECT lp.id,
            lp.anio,
            lp.fecha_publicacion,
            lp.estado,
            COALESCE(lp.tipo, 'anual') AS tipo,
            lp.titulo,
            lp.motivo,
            lp.items,
            lp.usuario_id,
            u.nombre,
            u.apellido
     FROM licitacion_publicada lp
     LEFT JOIN usuario u ON u.id_usuario = lp.usuario_id
     WHERE ${where.join(' AND ')}
     ORDER BY lp.fecha_publicacion DESC, lp.id DESC`,
    params
  );
}

async function buildLicitacionHistoryRows({ anio = null } = {}) {
  const params = [];
  const where = [];

  if (anio) {
    params.push(anio);
    where.push(`lp.anio = $${params.length}`);
  }

  const rows = await all(
    `SELECT lp.id,
            lp.anio,
            lp.fecha_publicacion,
            lp.estado,
            COALESCE(lp.tipo, 'anual') AS tipo,
            lp.titulo,
            lp.motivo,
            lp.items,
            lp.usuario_id,
            u.nombre AS creador_nombre,
            u.apellido AS creador_apellido,
            COUNT(DISTINCT ch.id) AS adjudicaciones_registradas,
            COALESCE(SUM(ch.precio_compra_real * COALESCE((item_qty.item->>'cantidad_a_licitar')::numeric, (item_qty.item->>'cantidad_solicitada')::numeric, 0)), 0)::numeric AS monto_estimado,
            COALESCE(rec.total_recibido, 0)::numeric AS total_recibido,
            MAX(ch.updated_at) AS adjudicada_at,
            rec.ultima_recepcion
     FROM licitacion_publicada lp
     LEFT JOIN usuario u ON u.id_usuario = lp.usuario_id
     LEFT JOIN compra_precio_historico ch ON ch.licitacion_id = lp.id
     LEFT JOIN LATERAL (
       SELECT item
       FROM jsonb_array_elements(COALESCE(lp.items, '[]'::jsonb)) AS item
       WHERE (item->>'producto_id')::int = ch.id_producto
       LIMIT 1
     ) item_qty ON TRUE
     LEFT JOIN LATERAL (
       SELECT COALESCE(SUM(rl.cantidad_recibida), 0)::numeric AS total_recibido,
              MAX(rl.created_at) AS ultima_recepcion
       FROM recepcion_licitacion rl
       WHERE rl.licitacion_id = lp.id
     ) rec ON TRUE
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     GROUP BY lp.id, lp.anio, lp.fecha_publicacion, lp.estado, COALESCE(lp.tipo, 'anual'), lp.titulo, lp.motivo, lp.items, lp.usuario_id, u.nombre, u.apellido, rec.total_recibido, rec.ultima_recepcion
     ORDER BY lp.anio DESC, lp.fecha_publicacion DESC, lp.id DESC`,
    params
  );

  const licitaciones = [];

  for (const row of rows) {
    const detalleRows = await all(
      `SELECT ch.id_producto AS producto_id,
              p.nombre AS producto,
              COALESCE(p.unidad_medida, 'unidad') AS unidad_medida,
              ch.id_proveedor AS proveedor_id,
              prov.nombre AS proveedor_nombre,
              ch.precio_compra_real,
              ch.updated_at,
              COALESCE((
                SELECT SUM(rl.cantidad_recibida)
                FROM recepcion_licitacion rl
                WHERE rl.licitacion_id = ch.licitacion_id
                  AND rl.producto_id = ch.id_producto
              ), 0)::numeric AS cantidad_recibida
       FROM compra_precio_historico ch
       JOIN producto p ON p.id_producto = ch.id_producto
       LEFT JOIN proveedor prov ON prov.id_proveedor = ch.id_proveedor
       WHERE ch.licitacion_id = $1
       ORDER BY p.nombre ASC`,
      [row.id]
    );

    const snapshotItems = typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || []);
    const quantityByProducto = new Map(
      snapshotItems.map((item) => [
        Number(item.producto_id),
        Number(item.cantidad_a_licitar || item.cantidad_solicitada || 0)
      ])
    );

    const detalle = detalleRows.map((detail) => ({
      producto_id: Number(detail.producto_id),
      producto: detail.producto,
      unidad_medida: detail.unidad_medida,
      cantidad_adjudicada: quantityByProducto.get(Number(detail.producto_id)) || 0,
      cantidad_recibida: Number(detail.cantidad_recibida || 0),
      proveedor_id: detail.proveedor_id ? Number(detail.proveedor_id) : null,
      proveedor_nombre: detail.proveedor_nombre || null,
      precio_compra_real: Number(detail.precio_compra_real || 0),
      subtotal_estimado: (quantityByProducto.get(Number(detail.producto_id)) || 0) * Number(detail.precio_compra_real || 0),
      adjudicado_at: detail.updated_at || null
    }));

    licitaciones.push({
      id: Number(row.id),
      anio: Number(row.anio),
      fecha_publicacion: row.fecha_publicacion,
      estado: row.estado,
      tipo: row.tipo || 'anual',
      titulo: row.titulo || null,
      motivo: row.motivo || null,
      usuario_id: row.usuario_id ? Number(row.usuario_id) : null,
      creador_nombre: row.creador_nombre || null,
      creador_apellido: row.creador_apellido || null,
      creador: `${row.creador_nombre || ''} ${row.creador_apellido || ''}`.trim() || null,
      total_items_snapshot: Array.isArray(snapshotItems) ? snapshotItems.length : 0,
      adjudicaciones_registradas: Number(row.adjudicaciones_registradas || 0),
      monto_estimado: Number(row.monto_estimado || 0),
      total_recibido: Number(row.total_recibido || 0),
      adjudicada_at: row.adjudicada_at || null,
      ultima_recepcion: row.ultima_recepcion || null,
      detalle
    });
  }

  return licitaciones;
}

async function getSelectedLicitacion({ anio, licitacionId, tipo = null }) {
  const licitacionIdNum = Number(licitacionId || 0);
  if (licitacionIdNum > 0) {
    return get(
      `SELECT lp.id,
              lp.anio,
              lp.fecha_publicacion,
              lp.estado,
              COALESCE(lp.tipo, 'anual') AS tipo,
              lp.titulo,
              lp.motivo,
              lp.items,
              lp.usuario_id,
              u.nombre,
              u.apellido
       FROM licitacion_publicada lp
       LEFT JOIN usuario u ON u.id_usuario = lp.usuario_id
       WHERE lp.id = $1`,
      [licitacionIdNum]
    );
  }

  const licitaciones = await getLicitacionesByAnio(anio, tipo);
  return licitaciones[0] || null;
}

async function publicarLicitacion(req, res) {
  const client = await pool.connect();
  try {
    await ensureTables();
    const { anio, items, titulo, motivo } = req.body;
    const tipo = String(req.body?.tipo || 'anual').trim().toLowerCase() === 'refuerzo' ? 'refuerzo' : 'anual';
    if (!anio || !items || !items.length) {
      return res.status(400).json({ error: "Datos insuficientes para publicar" });
    }

    const motivoSanitizado = String(motivo || titulo || `Licitación Anual ${anio}`).trim();
    const tituloSanitizado = String(titulo || motivoSanitizado).trim();

    await client.query("BEGIN");

    const inserted = await client.query(
      `INSERT INTO licitacion_publicada (anio, usuario_id, items, titulo, motivo, estado, tipo)
       VALUES ($1, $2, $3, $4, $5, 'publicada', $6)
       RETURNING id, anio, fecha_publicacion, estado, tipo, titulo, motivo`,
      [anio, req.user.sub, JSON.stringify(items), tituloSanitizado || null, motivoSanitizado || null, tipo]
    );

    await client.query("COMMIT");
    res.json({ ok: true, message: "Licitación publicada con éxito", licitacion: inserted.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error al publicar licitación:", err);
    res.status(500).json({ error: "No se pudo publicar la licitación" });
  } finally {
    client.release();
  }
}

async function reabrirLicitacion(req, res) {
  const client = await pool.connect();
  try {
    const id = Number(req.params.id);
    await client.query("BEGIN");

    const lp = await client.query("SELECT estado FROM licitacion_publicada WHERE id = $1", [id]);
    if (lp.rowCount === 0) {
      throw new Error("La licitación seleccionada no existe.");
    }
    if (['en_deposito', 'completada'].includes(lp.rows[0].estado)) {
      throw new Error("No se puede reabrir una licitación que ya fue adjudicada o enviada a depósito.");
    }

    await client.query("DELETE FROM licitacion_publicada WHERE id = $1", [id]);
    await client.query("COMMIT");
    res.json({ ok: true, message: "Licitación reabierta con éxito" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error al reabrir licitación:", err);
    res.status(500).json({ error: err.message || "No se pudo reabrir la licitación" });
  } finally {
    client.release();
  }
}

async function getPublicadaStatus(req, res) {
  try {
    const anio = Number(req.query.anio || new Date().getFullYear());
    const tipo = req.query.tipo ? String(req.query.tipo).trim().toLowerCase() : null;
    const licitaciones = await getLicitacionesByAnio(anio, tipo);
    const row = licitaciones[0] || null;
    res.json({ publicada: licitaciones.length > 0, data: row, licitaciones });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener estado de publicación" });
  }
}

async function getRefuerzosPendientesLicitacion(req, res) {
  try {
    await ensureTables();
    const anio = Number(req.query.anio || new Date().getFullYear());

    const rows = await all(
      `SELECT
         dp.id_producto AS producto_id,
         pr.nombre AS producto,
         COALESCE(pr.unidad_medida, 'unidad') AS unidad_medida,
         SUM(dp.cantidad_solicitada)::numeric AS cantidad_total,
         COALESCE((SELECT SUM(sd.cantidad) FROM stock_deposito sd WHERE sd.id_producto = dp.id_producto), 0)::numeric AS stock_actual,
         MIN(dp.stock_disponible_relevado)::numeric AS stock_relevado_al_crear,
         COUNT(DISTINCT p.id_pedido) AS pedidos_origen,
         COUNT(DISTINCT p.id_institucion) AS escuelas_origen,
         STRING_AGG(DISTINCT i.nombre, ', ' ORDER BY i.nombre) AS instituciones
       FROM pedido p
       JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
       JOIN producto pr ON pr.id_producto = dp.id_producto
       JOIN institucion i ON i.id_institucion = p.id_institucion
       WHERE COALESCE(p.tipo, 'anual') = 'refuerzo'
         AND p.estado = 'aprobado'
         AND COALESCE(p.requiere_licitacion, FALSE) = TRUE
         AND COALESCE(dp.requiere_licitacion, FALSE) = TRUE
         AND EXTRACT(YEAR FROM p.fecha_creacion) = $1
       GROUP BY dp.id_producto, pr.nombre, pr.unidad_medida
       ORDER BY pr.nombre ASC`,
      [anio]
    );

    const items = rows.map((row) => ({
      ...row,
      producto_id: Number(row.producto_id),
      cantidad_total: Number(row.cantidad_total || 0),
      stock_actual: Number(row.stock_actual || 0),
      stock_relevado_al_crear: row.stock_relevado_al_crear !== null ? Number(row.stock_relevado_al_crear) : null,
      pedidos_origen: Number(row.pedidos_origen || 0),
      escuelas_origen: Number(row.escuelas_origen || 0),
      cantidad_a_licitar: Number(row.cantidad_total || 0)
    }));

    res.json({ anio, items });
  } catch (err) {
    console.error('Error al obtener refuerzos pendientes de licitación:', err);
    res.status(500).json({ error: 'No se pudieron obtener los refuerzos pendientes de licitación' });
  }
}

router.get("/licitacion/anual/final-items", authorizePermissions(PERMISSIONS.PLANILLA_VIEW), getFinalItems);
router.get("/licitacion/anual/publicada-status", authorizePermissions(PERMISSIONS.PLANILLA_VIEW), getPublicadaStatus);
router.get("/refuerzos/pendientes-licitacion", authorizePermissions(PERMISSIONS.PLANILLA_VIEW), getRefuerzosPendientesLicitacion);
router.post("/licitacion/anual/publicar", authorizePermissions(PERMISSIONS.PLANILLA_MANAGE), publicarLicitacion);
router.delete("/licitacion/anual/publicar/:id(\\d+)", authorizePermissions(PERMISSIONS.PLANILLA_MANAGE), reabrirLicitacion);

async function getLicitacionesCerradas(req, res) {
  try {
    const rows = await buildLicitacionHistoryRows({ anio: req.query?.anio ? Number(req.query.anio) : null });
    res.json({ licitaciones: rows.filter((row) => ['adjudicada', 'en_deposito', 'completada'].includes(row.estado)) });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener licitaciones cerradas" });
  }
}

async function getAdjudicacionHistorial(req, res) {
  try {
    await ensureTables();
    const anio = req.query?.anio ? Number(req.query.anio) : null;
    const licitaciones = await buildLicitacionHistoryRows({ anio });
    res.json({ licitaciones });
  } catch (err) {
    console.error('Error al obtener historial de adjudicaciones:', err);
    res.status(500).json({ error: 'No se pudo obtener el historial de adjudicaciones' });
  }
}

async function enviarADeposito(req, res) {
  try {
    const { id } = req.body;
    await run(`UPDATE licitacion_publicada SET estado = 'en_deposito' WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "No se pudo enviar a depósito" });
  }
}

router.get("/licitacion/anual/cerradas", authorizePermissions(PERMISSIONS.PLANILLA_VIEW), getLicitacionesCerradas);
router.get("/adjudicacion/historial", authorizePermissions(PERMISSIONS.PLANILLA_VIEW), getAdjudicacionHistorial);
router.post("/licitacion/anual/enviar-deposito", authorizePermissions(PERMISSIONS.PLANILLA_MANAGE), enviarADeposito);

router.get("/adjudicacion", authorizePermissions(PERMISSIONS.PLANILLA_MANAGE), async (req, res) => {
  try {
    await ensureTables();
    const anio = Number(req.query.anio || new Date().getFullYear());
    const licitacionId = Number(req.query.licitacion_id || 0);
    const tipo = req.query.tipo ? String(req.query.tipo).trim().toLowerCase() : null;
    const publicada = await getSelectedLicitacion({ anio, licitacionId, tipo });
    
    let items = [];
    if (publicada && publicada.items) {
      // Si está publicada, usamos el snapshot de productos (consolidado por producto)
      const rawItems = typeof publicada.items === 'string' ? JSON.parse(publicada.items) : publicada.items;
      const consolidadoMap = {};
      rawItems.forEach(item => {
        const key = item.producto.trim().toLowerCase();
        if (!consolidadoMap[key]) {
          consolidadoMap[key] = {
            producto_id: item.producto_id,
            producto: item.producto,
            unidad_medida: item.unidad_medida,
            cantidad_total: 0
          };
        }
        consolidadoMap[key].cantidad_total += Number(item.cantidad_a_licitar || item.cantidad_solicitada || 0);
      });
      items = Object.values(consolidadoMap);
    } else {
      // Si no, fallback al consolidado live de planillas aceptadas (legacy/fallback)
      items = await getConsolidado({ anio });
    }

    const proveedores = await all(
      `SELECT id_proveedor AS id, nombre, cuit, contacto, telefono, email, categoria
       FROM proveedor
       WHERE COALESCE(activo, TRUE) = TRUE
       ORDER BY nombre ASC`
    );

    // Enriquecer items con el precio anterior/actual de la tabla compra_precio_historico
    for (const item of items) {
      let hist = null;
      if (publicada?.id) {
        hist = await get(
          `SELECT precio_compra_real, id_proveedor
           FROM compra_precio_historico
           WHERE licitacion_id = $1 AND id_producto = $2`,
          [publicada.id, item.producto_id]
        );
      }

      if (!hist) {
        hist = await get(
          `SELECT precio_compra_real, id_proveedor
           FROM compra_precio_historico
           WHERE anio = $1 AND id_producto = $2
           ORDER BY updated_at DESC, id DESC
           LIMIT 1`,
          [anio, item.producto_id]
        );
      }

      if (hist) {
        item.precio_actual = hist.precio_compra_real;
        item.proveedor_actual_id = hist.id_proveedor;
      }
      
      const ref = await get(
        `SELECT precio_compra_real, anio FROM compra_precio_historico WHERE id_producto = $1 AND anio < $2 ORDER BY anio DESC LIMIT 1`,
        [item.producto_id, anio]
      );
      if (ref) {
        item.precio_anterior = ref.precio_compra_real;
        item.anio_referencia = ref.anio;
      }
    }

    res.json({ anio, items, proveedores, licitacion: publicada || null });
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
    const licitacionId = Number(req.body?.licitacion_id || 0);
    const items = Array.isArray(req.body?.items) ? req.body.items : [];

    if (!items.length) {
      return res.status(400).json({ error: "No hay productos para adjudicar" });
    }

    const publicada = await getSelectedLicitacion({ anio, licitacionId });
    if (!publicada?.id) {
      return res.status(400).json({ error: "Debes seleccionar una licitación válida para adjudicar." });
    }

    let productoPermitidos;
    
    if (publicada && publicada.items) {
      const rawItems = typeof publicada.items === 'string' ? JSON.parse(publicada.items) : publicada.items;
      productoPermitidos = new Set(rawItems.map(item => Number(item.producto_id)));
    } else {
      const consolidado = await getConsolidado({ anio });
      productoPermitidos = new Set(consolidado.map((item) => Number(item.producto_id)));
    }

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

      // Buscar el nombre del producto para aplicar la adjudicación a todos los productos con el mismo nombre
      const prodResult = await client.query("SELECT nombre FROM producto WHERE id_producto = $1", [productoId]);
      if (prodResult.rowCount === 0) {
        throw new Error(`Producto con ID ${productoId} no encontrado.`);
      }
      const prodNombre = prodResult.rows[0].nombre;

      const allProds = await client.query(
        "SELECT id_producto FROM producto WHERE LOWER(TRIM(nombre)) = LOWER(TRIM($1))",
        [prodNombre]
      );

      for (const p of allProds.rows) {
        await client.query(
          `INSERT INTO compra_precio_historico (anio, licitacion_id, id_producto, id_proveedor, precio_compra_real, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT (licitacion_id, id_producto)
           DO UPDATE SET id_proveedor = EXCLUDED.id_proveedor,
                         precio_compra_real = EXCLUDED.precio_compra_real,
                         updated_at = NOW()`,
          [anio, publicada.id, p.id_producto, proveedorId, precio]
        );
      }
    }

    await client.query(
      `UPDATE licitacion_publicada
       SET estado = 'adjudicada'
       WHERE id = $1`,
      [publicada.id]
    );

    await client.query("COMMIT");
    res.json({ ok: true, anio, licitacion_id: publicada.id });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error al guardar adjudicación:", err);
    res.status(400).json({ error: err.message || "No se pudo guardar la adjudicación" });
  } finally {
    client.release();
  }
});

module.exports = router;
