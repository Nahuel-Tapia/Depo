const express = require("express");
const { all, get, run } = require("../db");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");

const router = express.Router();

router.use(authenticate);

// Ver pedidos del usuario (filtrado por institución para directivos)
router.get("/", authorizePermissions(PERMISSIONS.PEDIDOS_VIEW), async (req, res) => {
  try {
    let query = `
      SELECT p.id, p.usuario_id, p.producto_id, pr.nombre as producto_nombre, 
             p.cantidad, p.institucion, p.estado, p.notas, p.created_at, p.updated_at,
             u.nombre as usuario_nombre
      FROM pedidos p
      JOIN productos pr ON p.producto_id = pr.id
      JOIN users u ON p.usuario_id = u.id
    `;
    let params = [];

    // Directivos solo ven sus pedidos
    if (req.user.role === "directivo") {
      query += " WHERE p.institucion = (SELECT institucion FROM users WHERE id = ?)";
      params.push(req.user.sub);
    }

    query += " ORDER BY p.created_at DESC";

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
      SELECT p.id, p.usuario_id, p.producto_id, pr.nombre as producto_nombre,
             p.cantidad, p.institucion, p.estado, p.notas, p.created_at, p.updated_at,
             u.nombre as usuario_nombre
      FROM pedidos p
      JOIN productos pr ON p.producto_id = pr.id
      JOIN users u ON p.usuario_id = u.id
      WHERE p.institucion = ?
      ORDER BY p.created_at DESC
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
      SELECT p.*, pr.nombre as producto_nombre, u.nombre as usuario_nombre, u.institucion
      FROM pedidos p
      JOIN productos pr ON p.producto_id = pr.id
      JOIN users u ON p.usuario_id = u.id
      WHERE p.id = ?
      `,
      [id]
    );

    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    // Directivos solo ven sus propios pedidos
    if (req.user.role === "directivo") {
      const userInstitution = await get(
        "SELECT institucion FROM users WHERE id = ?",
        [req.user.sub]
      );
      if (pedido.institucion !== userInstitution.institucion) {
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
    const { producto_id, cantidad, notas } = req.body;

    if (!producto_id || !cantidad || cantidad <= 0) {
      return res.status(400).json({ error: "Producto y cantidad son obligatorios" });
    }

    // Verificar que el producto existe
    const producto = await get("SELECT id FROM productos WHERE id = ?", [producto_id]);
    if (!producto) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    // Obtener institución del usuario
    const usuario = await get(
      "SELECT institucion FROM users WHERE id = ?",
      [req.user.sub]
    );

    if (!usuario.institucion) {
      return res.status(400).json({ error: "Tu usuario no tiene institución asignada" });
    }

    const result = await run(
      `
      INSERT INTO pedidos (usuario_id, producto_id, cantidad, institucion, notas)
      VALUES (?, ?, ?, ?, ?)
      `,
      [req.user.sub, producto_id, cantidad, usuario.institucion, notas || null]
    );

    return res.status(201).json({ id: result.lastID, estado: "pendiente" });
  } catch (err) {
    console.error("Error al crear pedido:", err);
    return res.status(500).json({ error: "No se pudo crear pedido" });
  }
});

// Actualizar estado del pedido (solo admin)
router.patch(
  "/:id/estado",
  authorizePermissions(PERMISSIONS.PEDIDOS_MANAGE),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { estado } = req.body;

      const estadosValidos = ["pendiente", "aprobado", "rechazado", "entregado"];
      if (!estadosValidos.includes(estado)) {
        return res.status(400).json({ error: "Estado inválido" });
      }

      const pedido = await get(
        `
        SELECT p.id, p.usuario_id, p.producto_id, p.cantidad, p.institucion, p.estado,
               pr.stock_actual
        FROM pedidos p
        JOIN productos pr ON pr.id = p.producto_id
        WHERE p.id = ?
        `,
        [id]
      );

      if (!pedido) {
        return res.status(404).json({ error: "Pedido no encontrado" });
      }

      if (pedido.estado === estado) {
        return res.json({ ok: true, unchanged: true });
      }

      // Al marcar como entregado, impactar stock y registrar movimiento asociado.
      if (estado === "entregado") {
        if (pedido.estado === "rechazado") {
          return res.status(400).json({ error: "No se puede entregar un pedido rechazado" });
        }

        const movimientoExistente = await get(
          "SELECT id FROM movimientos WHERE pedido_id = ?",
          [id]
        );
        if (movimientoExistente) {
          return res.status(409).json({ error: "El pedido ya fue entregado y vinculado a stock" });
        }

        if (pedido.stock_actual < pedido.cantidad) {
          return res.status(400).json({
            error: `Stock insuficiente para entregar. Disponible: ${pedido.stock_actual}`
          });
        }

        await run("BEGIN TRANSACTION");
        try {
          await run(
            "UPDATE pedidos SET estado = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [estado, id]
          );

          const movimiento = await run(
            `
            INSERT INTO movimientos (producto_id, tipo, cantidad, usuario_id, motivo, cue, pedido_id)
            VALUES (?, 'salida', ?, ?, ?, ?, ?)
            `,
            [
              pedido.producto_id,
              pedido.cantidad,
              req.user.sub,
              `Entrega de pedido #${id}`,
              pedido.institucion,
              id
            ]
          );

          await run(
            "UPDATE productos SET stock_actual = stock_actual - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [pedido.cantidad, pedido.producto_id]
          );

          await run(
            "INSERT INTO auditoria (usuario_id, entidad, accion, id_registro, cambios) VALUES (?, ?, ?, ?, ?)",
            [
              req.user.sub,
              "pedidos",
              "DELIVER",
              id,
              JSON.stringify({
                estado_anterior: pedido.estado,
                estado_nuevo: estado,
                cantidad: pedido.cantidad,
                producto_id: pedido.producto_id,
                movimiento_id: movimiento.lastID,
                institucion: pedido.institucion
              })
            ]
          );

          await run("COMMIT");
          return res.json({ ok: true, delivered: true });
        } catch (txError) {
          await run("ROLLBACK").catch(() => {});
          throw txError;
        }
      }

      await run(
        "UPDATE pedidos SET estado = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [estado, id]
      );

      await run(
        "INSERT INTO auditoria (usuario_id, entidad, accion, id_registro, cambios) VALUES (?, ?, ?, ?, ?)",
        [
          req.user.sub,
          "pedidos",
          "UPDATE_STATUS",
          id,
          JSON.stringify({ estado_anterior: pedido.estado, estado_nuevo: estado })
        ]
      );

      return res.json({ ok: true });
    } catch (err) {
      console.error("Error al actualizar pedido:", err);
      return res.status(500).json({ error: "No se pudo actualizar pedido" });
    }
  }
);

// Cancelar pedido (solo si está pendiente)
router.patch("/:id/cancelar", authorizePermissions(PERMISSIONS.PEDIDOS_CREATE), async (req, res) => {
  try {
    const { id } = req.params;

    const pedido = await get("SELECT usuario_id, estado FROM pedidos WHERE id = ?", [id]);
    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    // Directivos solo pueden cancelar sus propios pedidos
    if (req.user.role === "directivo" && pedido.usuario_id !== req.user.sub) {
      return res.status(403).json({ error: "No podés cancelar este pedido" });
    }

    if (pedido.estado !== "pendiente") {
      return res.status(400).json({ error: "Solo se pueden cancelar pedidos pendientes" });
    }

    await run("UPDATE pedidos SET estado = 'rechazado', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);

    return res.json({ ok: true });
  } catch (err) {
    console.error("Error al cancelar pedido:", err);
    return res.status(500).json({ error: "No se pudo cancelar pedido" });
  }
});

module.exports = router;
