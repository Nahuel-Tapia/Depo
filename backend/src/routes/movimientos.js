const express = require("express");
const { all, get, run } = require("../db.pg");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");

const router = express.Router();

// Tipos válidos segun el ENUM de la BD
const TIPOS_MOVIMIENTO = ["ingreso", "egreso", "ajuste", "devolucion"];

router.use(authenticate);

// Listar movimientos
router.get("/", authorizePermissions(PERMISSIONS.MOVIMIENTOS_VIEW), async (req, res) => {
  try {
    const { producto_id, tipo, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT 
        m.id_movimiento as id,
        m.id_producto,
        p.nombre as producto_nombre,
        m.tipo,
        m.cantidad,
        m.motivo,
        u.nombre as usuario_nombre,
        u.email as usuario_email,
        m.fecha_movimiento as created_at
      FROM movimiento_stock m
      LEFT JOIN producto p ON m.id_producto = p.id_producto
      LEFT JOIN usuario u ON m.id_usuario = u.id_usuario
      WHERE 1 = 1
    `;
    const params = [];
    let paramIndex = 1;

    if (producto_id) {
      query += ` AND m.id_producto = $${paramIndex++}`;
      params.push(producto_id);
    }

    if (tipo && TIPOS_MOVIMIENTO.includes(tipo)) {
      query += ` AND m.tipo = $${paramIndex++}`;
      params.push(tipo);
    }

    query += ` ORDER BY m.fecha_movimiento DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit), parseInt(offset));

    const movimientos = await all(query, params);
    return res.json({ movimientos });
  } catch (err) {
    console.error("Error listando movimientos:", err);
    return res.status(500).json({ error: "No se pudo listar movimientos" });
  }
});

// Obtener un movimiento
router.get("/:id", authorizePermissions(PERMISSIONS.MOVIMIENTOS_VIEW), async (req, res) => {
  try {
    const { id } = req.params;
    const movimiento = await get(`
      SELECT 
        m.id_movimiento as id,
        m.id_producto,
        p.nombre as producto_nombre,
        m.tipo,
        m.cantidad,
        m.motivo,
        u.nombre as usuario_nombre,
        m.fecha_movimiento as created_at
      FROM movimiento_stock m
      LEFT JOIN producto p ON m.id_producto = p.id_producto
      LEFT JOIN usuario u ON m.id_usuario = u.id_usuario
      WHERE m.id_movimiento = ?
    `, [id]);
    
    if (!movimiento) {
      return res.status(404).json({ error: "Movimiento no encontrado" });
    }
    return res.json({ movimiento });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo obtener el movimiento" });
  }
});

// Crear movimiento
router.post("/", authorizePermissions(PERMISSIONS.MOVIMIENTOS_CREATE), async (req, res) => {
  try {
    const { producto_id, tipo, cantidad, motivo } = req.body;

    if (!producto_id || !tipo || !cantidad) {
      return res.status(400).json({ error: "Faltan campos obligatorios (producto_id, tipo, cantidad)" });
    }

    if (!TIPOS_MOVIMIENTO.includes(tipo)) {
      return res.status(400).json({ error: `Tipo inválido. Valores válidos: ${TIPOS_MOVIMIENTO.join(", ")}` });
    }

    const cantidadNum = parseInt(cantidad);
    if (isNaN(cantidadNum) || cantidadNum <= 0) {
      return res.status(400).json({ error: "La cantidad debe ser un número mayor a 0" });
    }

    // Verificar que el producto existe
    const producto = await get("SELECT * FROM producto WHERE id_producto = ?", [producto_id]);
    if (!producto) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    // Registrar movimiento
    const result = await run(
      "INSERT INTO movimiento_stock (id_producto, tipo, cantidad, id_usuario, motivo) VALUES (?, ?, ?, ?, ?)",
      [producto_id, tipo, cantidadNum, req.user.sub, motivo || null]
    );

    return res.status(201).json({ id: result.lastID });
  } catch (err) {
    console.error("Error creando movimiento:", err);
    return res.status(500).json({ error: "No se pudo crear el movimiento" });
  }
});

// Estadísticas de movimientos
router.get("/stats/resumen", authorizePermissions(PERMISSIONS.MOVIMIENTOS_VIEW), async (req, res) => {
  try {
    const stats = await get(`
      SELECT 
        SUM(CASE WHEN tipo = 'ingreso' THEN cantidad ELSE 0 END) as total_ingresos,
        SUM(CASE WHEN tipo = 'egreso' THEN cantidad ELSE 0 END) as total_egresos,
        SUM(CASE WHEN tipo = 'ajuste' THEN cantidad ELSE 0 END) as total_ajustes,
        SUM(CASE WHEN tipo = 'devolucion' THEN cantidad ELSE 0 END) as total_devoluciones
      FROM movimiento_stock
    `);
    return res.json({ stats });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo obtener estadísticas" });
  }
});

module.exports = router;
