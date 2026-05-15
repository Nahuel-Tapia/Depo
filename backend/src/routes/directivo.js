const express = require("express");
const { all, get, pool } = require("../db.pg");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

let schemaReady = false;
let schemaPromise = null;

async function ensureDirectivoSchema() {
  if (schemaReady) return;
  if (schemaPromise) {
    await schemaPromise;
    return;
  }

  schemaPromise = (async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS distribucion_lote (
          id SERIAL PRIMARY KEY,
          anio INT NOT NULL,
          zona_id INT,
          id_deposito INT NOT NULL,
          estado VARCHAR(30) NOT NULL DEFAULT 'en_transito',
          observaciones TEXT,
          usuario_id INT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS distribucion_lote_item (
          id SERIAL PRIMARY KEY,
          lote_id INT NOT NULL REFERENCES distribucion_lote(id) ON DELETE CASCADE,
          id_institucion INT NOT NULL,
          id_producto INT NOT NULL,
          cantidad_planificada NUMERIC(12,2) NOT NULL,
          cantidad_recibida NUMERIC(12,2),
          estado_recepcion VARCHAR(20) NOT NULL DEFAULT 'pendiente',
          observaciones_directivo TEXT,
          reclamo_directivo TEXT,
          directivo_usuario_id INT,
          recibido_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE (lote_id, id_institucion, id_producto)
        )
      `);

      schemaReady = true;
    } catch (err) {
      console.error("Error en schema directivo:", err);
    }
  })();

  try {
    await schemaPromise;
  } finally {
    schemaPromise = null;
  }
}

async function getDirectivoContext(userId) {
  const usuario = await get("SELECT * FROM usuario WHERE id_usuario = $1", [userId]);
  if (!usuario || usuario.role !== "directivo") {
    return { error: { status: 403, msg: "Acceso denegado" } };
  }
  if (!usuario.id_institucion) {
    return { error: { status: 400, msg: "El usuario no tiene institución asociada" } };
  }

  const institucion = await get(
    "SELECT id_institucion, nombre, cue FROM institucion WHERE id_institucion = $1",
    [usuario.id_institucion]
  );

  return { usuario, institucion };
}

// GET /api/directivo/alertas - Obtener alertas para el directivo
router.get("/alertas", async (req, res) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    const context = await getDirectivoContext(userId);
    if (context.error) {
      return res.status(context.error.status).json({ error: context.error.msg });
    }

    const { institucion, usuario } = context;

    // Obtener pedidos aprobados con pendiente de retiro
    const pedidosAprobados = await all(
      `SELECT
        p.id_pedido AS id,
        p.estado,
        p.fecha_creacion AS created_at,
        SUM(dp.cantidad_solicitada) AS total_solicitado,
        COALESCE(pe.total_entregado, 0) AS total_entregado,
        (SUM(dp.cantidad_solicitada) - COALESCE(pe.total_entregado, 0)) AS cantidad_pendiente
      FROM pedido p
      LEFT JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
      LEFT JOIN (
        SELECT id_pedido, SUM(cantidad_entregada) AS total_entregado
        FROM pedido_entrega
        GROUP BY id_pedido
      ) pe ON pe.id_pedido = p.id_pedido
      WHERE p.id_institucion = $1 AND p.estado = 'aprobado'
      GROUP BY p.id_pedido, p.estado, p.fecha_creacion, pe.total_entregado
      HAVING (SUM(dp.cantidad_solicitada) - COALESCE(pe.total_entregado, 0)) > 0
      ORDER BY p.fecha_creacion DESC`,
      [usuario.id_institucion]
    );

    // Obtener movimientos recientes
    const fecha15DiasAtras = new Date();
    fecha15DiasAtras.setDate(fecha15DiasAtras.getDate() - 15);

    const movimientosPendientes = await all(
      `SELECT
        m.id_movimiento AS id,
        m.tipo,
        m.cantidad,
        p.nombre || COALESCE(' - ' || NULLIF(p.marca, ''), '') as producto_nombre,
        p.unidad_medida,
        m.fecha_movimiento AS fecha,
        m.motivo AS notas
      FROM movimiento_stock m
      JOIN producto p ON m.id_producto = p.id_producto
      WHERE m.id_institucion = $1
        AND m.tipo = 'egreso'
        AND m.fecha_movimiento >= $2
      ORDER BY m.fecha_movimiento DESC
      LIMIT 10`,
      [usuario.id_institucion, fecha15DiasAtras.toISOString()]
    );

    const ultimasTransacciones = await all(
      `SELECT
        m.id_movimiento AS id,
        m.tipo,
        m.cantidad,
        p.nombre || COALESCE(' - ' || NULLIF(p.marca, ''), '') as producto_nombre,
        p.unidad_medida,
        m.fecha_movimiento AS fecha,
        u.nombre AS usuario_nombre
      FROM movimiento_stock m
      JOIN producto p ON m.id_producto = p.id_producto
      LEFT JOIN usuario u ON m.id_usuario = u.id_usuario
      WHERE m.id_institucion = $1
      ORDER BY m.fecha_movimiento DESC
      LIMIT 5`,
      [usuario.id_institucion]
    );

    return res.json({
      ok: true,
      institucion,
      alertas: {
        pedidosAprobados: {
          cantidad: pedidosAprobados.length,
          items: pedidosAprobados,
        },
        movimientosPendientes: {
          cantidad: movimientosPendientes.length,
          items: movimientosPendientes,
        },
      },
      ultimasTransacciones,
    });
  } catch (err) {
    console.error("Error en GET /api/directivo/alertas:", err);
    return res.status(500).json({ error: "Error al obtener alertas" });
  }
});

// GET /api/directivo/mi-stock - Mostrar el stock del kit asignado a la institución del directivo
router.get("/mi-stock", async (req, res) => {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ error: "Usuario no autenticado" });

    const usuario = await get("SELECT id_institucion FROM usuario WHERE id_usuario = $1", [userId]);
    if (!usuario?.id_institucion) return res.status(400).json({ error: "Usuario sin institución asociada" });

    const inst = await get("SELECT kit_id FROM institucion WHERE id_institucion = $1", [usuario.id_institucion]);
    const kitId = Number(inst?.kit_id || 0);
    if (!kitId) return res.json({ ok: true, kit: null, items: [] });

    const rows = await all(
      `SELECT d.id_producto AS producto_id, p.nombre AS producto_nombre, p.unidad_medida, d.cantidad AS cantidad_por_kit,
              COALESCE(ms.total_egresos, 0) - COALESCE(ref.total_entregado, 0) AS retirado_anual,
              COALESCE(ref.total_entregado, 0) AS retirado_refuerzo,
              COALESCE(ref_solicitado.total_solicitado, 0) AS pedido_refuerzo,
              COALESCE(ms.total_egresos, 0) AS total_egresos
       FROM producto_kit_detalle d
       LEFT JOIN producto p ON p.id_producto = d.id_producto
       LEFT JOIN (
         SELECT m.id_producto, SUM(m.cantidad) AS total_egresos
         FROM movimiento_stock m
         WHERE m.id_institucion = $1 AND m.tipo = 'egreso'
         GROUP BY m.id_producto
       ) ms ON ms.id_producto = d.id_producto
       LEFT JOIN (
         SELECT pe.id_producto, SUM(pe.cantidad_entregada) AS total_entregado
         FROM pedido_entrega pe
         JOIN pedido pd ON pd.id_pedido = pe.id_pedido
         WHERE pd.id_institucion = $2
           AND pd.estado = 'aprobado'
           AND COALESCE(pd.tipo, 'anual') = 'refuerzo'
         GROUP BY pe.id_producto
       ) ref ON ref.id_producto = d.id_producto
       LEFT JOIN (
         SELECT dp.id_producto, SUM(dp.cantidad_solicitada) AS total_solicitado
         FROM detalle_pedido dp
         JOIN pedido pd ON pd.id_pedido = dp.id_pedido
         WHERE pd.id_institucion = $3
           AND pd.estado = 'aprobado'
           AND COALESCE(pd.tipo, 'anual') = 'refuerzo'
         GROUP BY dp.id_producto
       ) ref_solicitado ON ref_solicitado.id_producto = d.id_producto
       WHERE d.kit_id = $4
       ORDER BY p.nombre ASC`,
      [usuario.id_institucion, usuario.id_institucion, usuario.id_institucion, kitId]
    );

    const items = rows.map((r) => {
      const cantidad_por_kit = Number(r.cantidad_por_kit || 0);
      const retirado_anual = Number(r.retirado_anual || 0);
      const retirado_refuerzo = Number(r.retirado_refuerzo || 0);
      const pedido_refuerzo = Number(r.pedido_refuerzo || 0);

      const necesario_anual = Math.max(0, cantidad_por_kit - retirado_anual);
      const pendiente_refuerzo = Math.max(0, pedido_refuerzo - retirado_refuerzo);
      const restante_total = necesario_anual + pendiente_refuerzo;

      return {
        producto_id: Number(r.producto_id),
        producto_nombre: r.producto_nombre,
        unidad_medida: r.unidad_medida,
        cantidad_por_kit,
        retirado_anual,
        retirado_refuerzo,
        pedido_refuerzo,
        restante: restante_total,
        total_retirado: retirado_anual + retirado_refuerzo,
      };
    });

    const kit = await get("SELECT id, nombre, tipo_escuela, cantidad_alumnos FROM producto_kit WHERE id = $1", [kitId]);

    return res.json({ ok: true, kit: kit || null, items });
  } catch (err) {
    console.error("Error en GET /api/directivo/mi-stock:", err);
    return res.status(500).json({ error: "Error al obtener Mi stock" });
  }
});

// GET /api/directivo/distribuciones/pendientes
router.get("/distribuciones/pendientes", async (req, res) => {
  try {
    await ensureDirectivoSchema();
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ error: "Usuario no autenticado" });

    const context = await getDirectivoContext(userId);
    if (context.error) {
      return res.status(context.error.status).json({ error: context.error.msg });
    }

    const institucionId = context.usuario.id_institucion;

    const rows = await all(
      `SELECT
         li.lote_id,
         l.anio,
         l.estado AS lote_estado,
         l.created_at,
         COALESCE(z.nombre, 'Zona sin nombre') AS zona_nombre,
         COALESCE(d.nombre, 'Depósito') AS deposito_nombre,
         li.id_producto,
         p.nombre AS producto_nombre,
         p.unidad_medida,
         li.cantidad_planificada,
         COALESCE(li.cantidad_recibida, 0) AS cantidad_recibida,
         li.estado_recepcion,
         li.observaciones_directivo,
         li.reclamo_directivo
       FROM distribucion_lote_item li
       JOIN distribucion_lote l ON l.id = li.lote_id
       LEFT JOIN zona z ON z.id = l.zona_id
       LEFT JOIN deposito d ON d.id_deposito = l.id_deposito
       JOIN producto p ON p.id_producto = li.id_producto
       WHERE li.id_institucion = $1
         AND li.estado_recepcion IN ('pendiente', 'parcial', 'reclamo')
       ORDER BY l.created_at DESC, p.nombre ASC`,
      [institucionId]
    );

    const lotesMap = new Map();
    for (const row of rows) {
      const loteId = Number(row.lote_id);
      if (!lotesMap.has(loteId)) {
        lotesMap.set(loteId, {
          lote_id: loteId,
          anio: Number(row.anio),
          lote_estado: row.lote_estado,
          created_at: row.created_at,
          zona_nombre: row.zona_nombre,
          deposito_nombre: row.deposito_nombre,
          items: [],
        });
      }
      lotesMap.get(loteId).items.push({
        id_producto: Number(row.id_producto),
        producto_nombre: row.producto_nombre,
        unidad_medida: row.unidad_medida,
        cantidad_planificada: Number(row.cantidad_planificada || 0),
        cantidad_recibida: Number(row.cantidad_recibida || 0),
        estado_recepcion: row.estado_recepcion,
        observaciones_directivo: row.observaciones_directivo || null,
        reclamo_directivo: row.reclamo_directivo || null,
      });
    }

    return res.json({ lotes: Array.from(lotesMap.values()) });
  } catch (err) {
    console.error("Error en GET /api/directivo/distribuciones/pendientes:", err);
    return res.status(500).json({ error: "No se pudieron obtener distribuciones pendientes" });
  }
});

// POST /api/directivo/distribuciones/:loteId/confirmar-recepcion
router.post("/distribuciones/:loteId/confirmar-recepcion", async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureDirectivoSchema();
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ error: "Usuario no autenticado" });

    const context = await getDirectivoContext(userId);
    if (context.error) {
      return res.status(context.error.status).json({ error: context.error.msg });
    }

    const institucionId = Number(context.usuario.id_institucion);
    const loteId = Number(req.params.loteId);
    const items = Array.isArray(req.body?.items) ? req.body.items : [];

    if (!loteId || items.length === 0) {
      return res.status(400).json({ error: "Debe informar el lote y al menos un ítem" });
    }

    await client.query("BEGIN");

    const loteRows = await client.query(
      `SELECT id_producto, cantidad_planificada
       FROM distribucion_lote_item
       WHERE lote_id = $1 AND id_institucion = $2
       FOR UPDATE`,
      [loteId, institucionId]
    );

    if (!loteRows.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "No hay ítems pendientes para este lote/institución" });
    }

    const planificado = new Map(
      loteRows.rows.map((r) => [Number(r.id_producto), Number(r.cantidad_planificada || 0)])
    );

    for (const item of items) {
      const productoId = Number(item.id_producto);
      if (!planificado.has(productoId)) continue;

      const cantidadPlanificada = Number(planificado.get(productoId) || 0);
      const cantidadRecibida = Math.max(0, Number(item.cantidad_recibida || 0));
      const observaciones = String(item.observaciones_directivo || "").trim();
      const reclamo = String(item.reclamo_directivo || "").trim();

      if (cantidadRecibida > cantidadPlanificada) {
        throw new Error(`Cantidad recibida inválida para producto ${productoId}`);
      }

      let estadoRecepcion = "pendiente";
      if (reclamo) {
        estadoRecepcion = "reclamo";
      } else if (cantidadRecibida >= cantidadPlanificada) {
        estadoRecepcion = "recibido";
      } else if (cantidadRecibida > 0) {
        estadoRecepcion = "parcial";
      }

      await client.query(
        `UPDATE distribucion_lote_item
         SET cantidad_recibida = $1,
             estado_recepcion = $2,
             observaciones_directivo = $3,
             reclamo_directivo = $4,
             directivo_usuario_id = $5,
             recibido_at = NOW(),
             updated_at = NOW()
         WHERE lote_id = $6
           AND id_institucion = $7
           AND id_producto = $8`,
        [
          cantidadRecibida,
          estadoRecepcion,
          observaciones || null,
          reclamo || null,
          userId,
          loteId,
          institucionId,
          productoId,
        ]
      );
    }

    const resumen = await client.query(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE estado_recepcion = 'recibido') AS recibidos,
         COUNT(*) FILTER (WHERE estado_recepcion = 'reclamo') AS reclamos,
         COUNT(*) FILTER (WHERE estado_recepcion = 'parcial') AS parciales,
         COUNT(*) FILTER (WHERE estado_recepcion = 'pendiente') AS pendientes
       FROM distribucion_lote_item
       WHERE lote_id = $1`,
      [loteId]
    );

    const s = resumen.rows[0] || {};
    const total = Number(s.total || 0);
    const recibidos = Number(s.recibidos || 0);
    const reclamos = Number(s.reclamos || 0);
    const parciales = Number(s.parciales || 0);

    let estadoLote = "en_transito";
    if (total > 0 && recibidos === total) {
      estadoLote = "recibido_total";
    } else if (reclamos > 0) {
      estadoLote = "con_reclamos";
    } else if (parciales > 0 || recibidos > 0) {
      estadoLote = "parcialmente_recibido";
    }

    await client.query(`UPDATE distribucion_lote SET estado = $1 WHERE id = $2`, [estadoLote, loteId]);

    await client.query("COMMIT");
    return res.json({ ok: true, lote_id: loteId, estado: estadoLote });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error confirmando recepción directivo:", err);
    return res.status(500).json({ error: err.message || "No se pudo registrar la recepción" });
  } finally {
    client.release();
  }
});

module.exports = router;
