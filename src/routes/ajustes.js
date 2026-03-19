const express = require("express");
const { all, get, run } = require("../db");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");

const router = express.Router();

router.use(authenticate);

// Listar ajustes
router.get("/", authorizePermissions(PERMISSIONS.AJUSTES_VIEW), async (req, res) => {
  try {
    const { producto_id, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT 
        a.id, a.producto_id, p.codigo, p.nombre,
        a.cantidad_anterior, a.cantidad_nueva,
        a.motivo,
        u.nombre as usuario_nombre, u.email,
        a.created_at
      FROM ajustes a
      JOIN productos p ON a.producto_id = p.id
      JOIN users u ON a.usuario_id = u.id
      WHERE 1 = 1
    `;
    const params = [];

    if (producto_id) {
      query += " AND a.producto_id = ?";
      params.push(producto_id);
    }

    query += " ORDER BY a.created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const ajustes = await all(query, params);
    return res.json({ ajustes });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo listar ajustes" });
  }
});

// Obtener un ajuste
router.get("/:id", authorizePermissions(PERMISSIONS.AJUSTES_VIEW), async (req, res) => {
  try {
    const { id } = req.params;
    const ajuste = await get(
      `SELECT 
        a.id, a.producto_id, p.codigo, p.nombre,
        a.cantidad_anterior, a.cantidad_nueva,
        a.motivo,
        u.nombre as usuario_nombre, u.email,
        a.created_at
      FROM ajustes a
      JOIN productos p ON a.producto_id = p.id
      JOIN users u ON a.usuario_id = u.id
      WHERE a.id = ?`,
      [id]
    );
    if (!ajuste) {
      return res.status(404).json({ error: "Ajuste no encontrado" });
    }
    return res.json({ ajuste });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo obtener el ajuste" });
  }
});

// Crear ajuste de inventario
router.post("/", authorizePermissions(PERMISSIONS.AJUSTES_CREATE), async (req, res) => {
  try {
    const { producto_id, cantidad_nueva, motivo } = req.body;

    if (!producto_id || cantidad_nueva === undefined || !motivo) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    if (cantidad_nueva < 0) {
      return res.status(400).json({ error: "La cantidad no puede ser negativa" });
    }

    // Obtener producto
    const producto = await get("SELECT * FROM productos WHERE id = ?", [producto_id]);
    if (!producto) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    const cantidad_anterior = producto.stock_actual;

    // Registrar ajuste
    const result = await run(
      "INSERT INTO ajustes (producto_id, cantidad_anterior, cantidad_nueva, motivo, usuario_id) VALUES (?, ?, ?, ?, ?)",
      [producto_id, cantidad_anterior, cantidad_nueva, motivo, req.user.id]
    );

    // Actualizar stock del producto
    await run("UPDATE productos SET stock_actual = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [cantidad_nueva, producto_id]);

    // Auditoría
    const diferencia = cantidad_nueva - cantidad_anterior;
    await run(
      "INSERT INTO auditoria (usuario_id, entidad, accion, id_registro, cambios) VALUES (?, ?, ?, ?, ?)",
      [
        req.user.id,
        "ajustes",
        "CREATE",
        result.lastID,
        JSON.stringify({
          producto_id,
          cantidad_anterior,
          cantidad_nueva,
          diferencia,
          motivo
        })
      ]
    );

    return res.status(201).json({ id: result.lastID });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo crear el ajuste" });
  }
});

module.exports = router;
