const express = require("express");
const { all, get, run, pool } = require("../db.pg");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");

const router = express.Router();
router.use(authenticate);

// Agrega columna tipo si aún no existe
async function ensureTipoPedido() {
  try {
    await run(`
      ALTER TABLE pedido
      ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) DEFAULT 'anual'
    `);
  } catch (_) { /* ya existe o no se puede */ }
}
ensureTipoPedido();

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

// Listar pedidos
router.get("/", authorizePermissions(PERMISSIONS.PEDIDOS_VIEW), async (req, res) => {
  try {
    let query = `
      SELECT
        p.id_pedido as id,
        CASE WHEN p.estado::text = 'finalizado' THEN 'entregado' ELSE p.estado::text END as estado,
        p.observaciones_generales as notas,
        COALESCE(p.tipo, 'anual') as tipo,
        p.fecha_creacion as created_at,
        p.id_institucion,
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
router.get("/:id", authorizePermissions(PERMISSIONS.PEDIDOS_VIEW), async (req, res) => {
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

    // Validar que la solicitud anual sea única por institución por año
    if (tipoValido === 'anual') {
      const existente = await get(
        `SELECT id_pedido FROM pedido
         WHERE id_institucion = $1
           AND COALESCE(tipo, 'anual') = 'anual'
           AND EXTRACT(YEAR FROM fecha_creacion) = EXTRACT(YEAR FROM NOW())
           AND estado NOT IN ('rechazado', 'cancelado')`,
        [usuario.id_institucion]
      );
      if (existente) {
        return res.status(409).json({
          error: "Ya existe una solicitud anual para este año. Solo se permite una por año."
        });
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
    const { id } = req.params;
    const { estado } = req.body;

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

    if (pedido.estado_db === estadoObjetivoDb) {
      return res.json({ ok: true, unchanged: true });
    }

    // Si ya fue entregado, evitamos cambiarlo para no desincronizar stock.
    if (pedidoYaEntregado && estadoObjetivoDb !== estadoEntregadoDb) {
      return res.status(400).json({ error: "El pedido ya fue entregado y su estado no puede revertirse" });
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
