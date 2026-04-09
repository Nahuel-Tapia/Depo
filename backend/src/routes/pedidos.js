const express = require("express");
const { all, get, run } = require("../db.pg");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");

const router = express.Router();
router.use(authenticate);

// Listar pedidos
router.get("/", authorizePermissions(PERMISSIONS.PEDIDOS_VIEW), async (req, res) => {
  try {
    let query = `
      SELECT
        p.id_pedido as id,
        p.estado,
        p.observaciones_generales as notas,
        p.fecha_creacion as created_at,
        p.id_institucion,
        pr.nombre as producto_nombre,
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
        p.estado,
        p.observaciones_generales as notas,
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
        p.estado,
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
    const { producto_id, cantidad, notas } = req.body;

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

    const pedidoResult = await run(
      `INSERT INTO pedido (id_usuario_solicitante, id_institucion, observaciones_generales) VALUES (?, ?, ?)`,
      [req.user.sub, usuario.id_institucion, notas || null]
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

    const estadosValidos = ["pendiente", "aprobado", "rechazado", "entregado"];
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ error: "Estado inválido" });
    }

    const pedido = await get(
      `SELECT id_pedido as id, estado, id_institucion FROM pedido WHERE id_pedido = ?`,
      [id]
    );

    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    if (pedido.estado === estado) {
      return res.json({ ok: true, unchanged: true });
    }

    await run(
      "UPDATE pedido SET estado = ? WHERE id_pedido = ?",
      [estado, id]
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

    await run("UPDATE pedido SET estado = 'rechazado' WHERE id_pedido = ?", [id]);

    return res.json({ ok: true });
  } catch (err) {
    console.error("Error al cancelar pedido:", err);
    return res.status(500).json({ error: "No se pudo cancelar pedido" });
  }
});

module.exports = router;
