const express = require("express");
const { all, get, run, pool } = require("../db.pg");
const { authenticate, authorizePermissions } = require("../middleware/auth");
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
      END
      $$;
    `);
  } catch (_) { /* ya existe o no aplica */ }
}
ensureEstadoCancelado();
ensurePedidosSchema();

async function hasInstitucionColumn(columnName) {
  const row = await get(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'institucion'
         AND column_name = ?
     ) AS has_column`,
    [columnName]
  );
  return Boolean(row?.has_column);
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
        COALESCE(p.tipo, 'anual') as tipo,
        p.fecha_creacion as created_at,
        p.id_institucion,
        p.aprobado_por_supervisor_id,
        p.fecha_aprobacion_supervisor,
        dp.id_producto as producto_id,
        pr.nombre as producto_nombre,
        pr.stock_actual as stock_actual,
        dp.cantidad_solicitada as cantidad,
        u.nombre as usuario_nombre,
        i.nombre as institucion
      FROM pedido p
      JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
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

    query += " ORDER BY p.fecha_creacion DESC";
    const pedidos = await all(query, params);
    return res.json({ pedidos });
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
        p.id_pedido as id,
        CASE WHEN p.estado::text = 'finalizado' THEN 'entregado' ELSE p.estado::text END as estado,
        p.observaciones_generales as notas,
        COALESCE(p.tipo, 'anual') as tipo,
        p.fecha_creacion as created_at,
        pr.nombre as producto_nombre,
        dp.cantidad_solicitada as cantidad,
        u.nombre as usuario_nombre
      FROM pedido p
      JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
      JOIN producto pr ON dp.id_producto = pr.id_producto
      JOIN usuario u ON p.id_usuario_solicitante = u.id_usuario
      WHERE p.id_institucion = ?
      ORDER BY p.fecha_creacion DESC
      `,
      [institucion]
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

    const pedido = await get(
      `
      SELECT
        p.id_pedido as id,
        CASE WHEN p.estado::text = 'finalizado' THEN 'entregado' ELSE p.estado::text END as estado,
        p.observaciones_generales as notas,
        p.fecha_creacion as created_at,
        p.id_institucion,
        pr.nombre as producto_nombre,
        dp.cantidad_solicitada as cantidad,
        u.nombre as usuario_nombre
      FROM pedido p
      JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
      JOIN producto pr ON dp.id_producto = pr.id_producto
      JOIN usuario u ON p.id_usuario_solicitante = u.id_usuario
      WHERE p.id_pedido = ?
      `,
      [id]
    );

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

    const { producto_id, cantidad, notas, tipo } = req.body;
    const tipoValido = ['anual', 'refuerzo'].includes(tipo) ? tipo : 'anual';

    if (!producto_id || !cantidad || cantidad <= 0) {
      return res.status(400).json({ error: "Producto y cantidad son obligatorios" });
    }

    const producto = await get("SELECT id_producto as id FROM producto WHERE id_producto = ?", [producto_id]);
    if (!producto) {
      return res.status(404).json({ error: "Producto no encontrado" });
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

    const reglaKit = await getReglaKit(perfilInstitucion.tipo_escuela, producto_id);
    if (!reglaKit) {
      return res.status(400).json({
        error: "El producto seleccionado no forma parte del kit asignado a tu escuela."
      });
    }

    if (tipoValido === 'anual') {
      const anioActual = new Date().getFullYear();
      const disponibilidad = await getDisponibilidadAnual(usuario.id_institucion, producto_id, anioActual);

      if (disponibilidad && disponibilidad.disponible_anual !== null) {
        if (Number(cantidad) > Number(disponibilidad.disponible_anual)) {
          return res.status(409).json({
            error: `Cantidad excede el cupo anual disponible para este producto. Disponible: ${disponibilidad.disponible_anual}.`,
            detalle: disponibilidad
          });
        }

        if (Number(disponibilidad.disponible_anual) <= 0) {
          return res.status(409).json({
            error: "No hay cupo anual disponible para este producto.",
            detalle: disponibilidad
          });
        }
      }
    }

    const pedidoResult = await run(
      `INSERT INTO pedido (id_usuario_solicitante, id_institucion, observaciones_generales, tipo) VALUES (?, ?, ?, ?)`,
      [req.user.sub, usuario.id_institucion, notas || null, tipoValido]
    );

    await run(
      `INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad_solicitada, observacion) VALUES (?, ?, ?, ?)`,
      [pedidoResult.lastID, producto_id, cantidad, null]
    );

    return res.status(201).json({ id: pedidoResult.lastID, estado: "pendiente" });
  } catch (err) {
    console.error("Error al crear pedido:", err);
    return res.status(500).json({ error: "No se pudo crear pedido" });
  }
});

// Actualizar estado del pedido (solo admin)
router.patch("/:id/estado", authorizePermissions(PERMISSIONS.PEDIDOS_MANAGE), async (req, res) => {
  try {
    await ensurePedidosSchema();

    const { id } = req.params;
    const { estado, motivo } = req.body;

    const estadosValidos = ["pendiente", "aprobado", "rechazado", "cancelado", "entregado"];
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ error: "Estado inválido" });
    }

    const pedido = await get(
      `SELECT id_pedido as id, estado::text as estado_db, id_institucion FROM pedido WHERE id_pedido = ?`,
      [id]
    );

    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    const estadoEntregadoDb = await getEstadoEntregadoDb();
    const estadoObjetivoDb = estado === "entregado" ? estadoEntregadoDb : estado;
    const pedidoYaEntregado = pedido.estado_db === "entregado" || pedido.estado_db === "finalizado";

    const transicionSupervisor = estadoObjetivoDb === "aprobado" || estadoObjetivoDb === "rechazado";

    if (transicionSupervisor) {
      if (req.user.role !== "supervisor") {
        return res.status(403).json({ error: "Solo un supervisor puede aprobar o rechazar pedidos" });
      }

      if (!(await hasAsignacionesTable())) {
        return res.status(400).json({ error: "No existe configuración de asignaciones de supervisor" });
      }

      const asignacion = await get(
        `SELECT 1
         FROM supervisor_escuela_asignacion
         WHERE supervisor_id = ? AND institucion_id = ?`,
        [req.user.sub, pedido.id_institucion]
      );

      if (!asignacion) {
        return res.status(403).json({ error: "El pedido no pertenece a una escuela asignada a este supervisor" });
      }

      if (pedido.estado_db !== "pendiente") {
        return res.status(400).json({ error: "Solo se pueden aprobar o rechazar pedidos pendientes" });
      }

      await run(
        `UPDATE pedido
         SET estado = ?,
             aprobado_por_supervisor_id = ?,
             fecha_aprobacion_supervisor = NOW(),
             motivo_supervisor = ?
         WHERE id_pedido = ?`,
        [
          estadoObjetivoDb,
          req.user.sub,
          estadoObjetivoDb === "rechazado" ? (String(motivo || "").trim() || null) : null,
          id
        ]
      );

      return res.json({ ok: true });
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

module.exports = router;
