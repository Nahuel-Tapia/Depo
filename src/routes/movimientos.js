const express = require("express");
const { all, get, run } = require("../db");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");

const router = express.Router();

router.use(authenticate);

// Listar movimientos
router.get("/", authorizePermissions(PERMISSIONS.MOVIMIENTOS_VIEW), async (req, res) => {
  try {
    const { producto_id, tipo, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT 
        m.id, m.producto_id, p.codigo, p.nombre,
        m.tipo, m.cantidad, m.motivo, m.proveedor, m.cue,
        u.nombre as usuario_nombre, u.email,
        m.created_at
      FROM movimientos m
      JOIN productos p ON m.producto_id = p.id
      JOIN users u ON m.usuario_id = u.id
      WHERE 1 = 1
    `;
    const params = [];

    if (producto_id) {
      query += " AND m.producto_id = ?";
      params.push(producto_id);
    }

    if (tipo && ["entrada", "salida"].includes(tipo)) {
      query += " AND m.tipo = ?";
      params.push(tipo);
    }

    query += " ORDER BY m.created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const movimientos = await all(query, params);
    return res.json({ movimientos });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo listar movimientos" });
  }
});

// Obtener un movimiento
router.get("/:id", authorizePermissions(PERMISSIONS.MOVIMIENTOS_VIEW), async (req, res) => {
  try {
    const { id } = req.params;
    const movimiento = await get(
      `SELECT 
        m.id, m.producto_id, p.codigo, p.nombre,
        m.tipo, m.cantidad, m.motivo,
        u.nombre as usuario_nombre, u.email,
        m.created_at
      FROM movimientos m
      JOIN productos p ON m.producto_id = p.id
      JOIN users u ON m.usuario_id = u.id
      WHERE m.id = ?`,
      [id]
    );
    if (!movimiento) {
      return res.status(404).json({ error: "Movimiento no encontrado" });
    }
    return res.json({ movimiento });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo obtener el movimiento" });
  }
});

// Crear movimiento (entrada o salida)
router.post("/", authorizePermissions(PERMISSIONS.MOVIMIENTOS_CREATE), async (req, res) => {
  try {
    const { producto_id, tipo, cantidad, motivo, proveedor, cue } = req.body;

    if (!producto_id || !tipo || !cantidad) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    if (!["entrada", "salida"].includes(tipo)) {
      return res.status(400).json({ error: "Tipo de movimiento inválido (entrada|salida)" });
    }

    if (cantidad <= 0) {
      return res.status(400).json({ error: "La cantidad debe ser mayor a 0" });
    }

    // Obtener producto
    const producto = await get("SELECT * FROM productos WHERE id = ?", [producto_id]);
    if (!producto) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    // Validar si hay stock suficiente en caso de salida
    if (tipo === "salida" && producto.stock_actual < cantidad) {
      return res.status(400).json({ error: `Stock insuficiente. Disponible: ${producto.stock_actual}` });
    }

    // Registrar movimiento
    const result = await run(
      "INSERT INTO movimientos (producto_id, tipo, cantidad, usuario_id, motivo, proveedor, cue) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [producto_id, tipo, cantidad, req.user.sub, motivo || null, proveedor || null, cue || null]
    );

    // Actualizar stock del producto
    const nuevoStock = tipo === "entrada" 
      ? producto.stock_actual + cantidad 
      : producto.stock_actual - cantidad;

    await run("UPDATE productos SET stock_actual = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [nuevoStock, producto_id]);

    // Auditoría
    await run(
      "INSERT INTO auditoria (usuario_id, entidad, accion, id_registro, cambios) VALUES (?, ?, ?, ?, ?)",
      [
        req.user.sub,
        "movimientos",
        "CREATE",
        result.lastID,
        JSON.stringify({
          tipo,
          cantidad,
          producto_id,
          stock_anterior: producto.stock_actual,
          stock_nuevo: nuevoStock,
          proveedor,
          cue
        })
      ]
    );

    return res.status(201).json({ id: result.lastID });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo crear el movimiento" });
  }
});

// Estadísticas de movimientos
router.get("/stats/resumen", authorizePermissions(PERMISSIONS.MOVIMIENTOS_VIEW), async (req, res) => {
  try {
    const { producto_id } = req.query;

    let query = `
      SELECT 
        SUM(CASE WHEN tipo = 'entrada' THEN cantidad ELSE 0 END) as total_entradas,
        SUM(CASE WHEN tipo = 'salida' THEN cantidad ELSE 0 END) as total_salidas
      FROM movimientos
    `;
    const params = [];

    if (producto_id) {
      query += " WHERE producto_id = ?";
      params.push(producto_id);
    }

    const stats = await get(query, params);
    return res.json({ stats });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo obtener estadísticas" });
  }
});

module.exports = router;
