const express = require("express");
const { all, get, run } = require("../db");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");

const router = express.Router();

router.use(authenticate);

// Listar productos
router.get("/", authorizePermissions(PERMISSIONS.PRODUCTOS_VIEW), async (req, res) => {
  try {
    const productos = await all(
      "SELECT id, codigo, nombre, descripcion, precio, stock_actual, created_at, updated_at FROM productos ORDER BY id DESC"
    );
    return res.json({ productos });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo listar productos" });
  }
});

// Obtener un producto
router.get("/:id", authorizePermissions(PERMISSIONS.PRODUCTOS_VIEW), async (req, res) => {
  try {
    const { id } = req.params;
    const producto = await get(
      "SELECT id, codigo, nombre, descripcion, precio, stock_actual, created_at, updated_at FROM productos WHERE id = ?",
      [id]
    );
    if (!producto) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }
    return res.json({ producto });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo obtener el producto" });
  }
});

// Crear producto
router.post("/", authorizePermissions(PERMISSIONS.PRODUCTOS_CREATE), async (req, res) => {
  try {
    const { codigo, nombre, descripcion, precio } = req.body;
    if (!codigo || !nombre) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    const existing = await get("SELECT id FROM productos WHERE codigo = ?", [codigo]);
    if (existing) {
      return res.status(409).json({ error: "El código de producto ya existe" });
    }

    const result = await run(
      "INSERT INTO productos (codigo, nombre, descripcion, precio, stock_actual) VALUES (?, ?, ?, ?, 0)",
      [codigo, nombre, descripcion || null, precio || 0]
    );

    // Auditoría
    await run(
      "INSERT INTO auditoria (usuario_id, entidad, accion, id_registro, cambios) VALUES (?, ?, ?, ?, ?)",
      [req.user.id, "productos", "CREATE", result.lastID, JSON.stringify({ codigo, nombre, descripcion, precio })]
    );

    return res.status(201).json({ id: result.lastID });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo crear el producto" });
  }
});

// Editar producto
router.patch("/:id", authorizePermissions(PERMISSIONS.PRODUCTOS_EDIT), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, precio } = req.body;

    const producto = await get("SELECT * FROM productos WHERE id = ?", [id]);
    if (!producto) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    const updates = [];
    const params = [];
    
    if (nombre !== undefined) {
      updates.push("nombre = ?");
      params.push(nombre);
    }
    if (descripcion !== undefined) {
      updates.push("descripcion = ?");
      params.push(descripcion);
    }
    if (precio !== undefined) {
      updates.push("precio = ?");
      params.push(precio);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No hay campos para actualizar" });
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    params.push(id);

    await run(
      `UPDATE productos SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    // Auditoría
    const cambios = {};
    if (nombre !== undefined) cambios.nombre = { antes: producto.nombre, despues: nombre };
    if (descripcion !== undefined) cambios.descripcion = { antes: producto.descripcion, despues: descripcion };
    if (precio !== undefined) cambios.precio = { antes: producto.precio, despues: precio };

    await run(
      "INSERT INTO auditoria (usuario_id, entidad, accion, id_registro, cambios) VALUES (?, ?, ?, ?, ?)",
      [req.user.id, "productos", "UPDATE", id, JSON.stringify(cambios)]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo editar el producto" });
  }
});

// Eliminar producto
router.delete("/:id", authorizePermissions(PERMISSIONS.PRODUCTOS_DELETE), async (req, res) => {
  try {
    const { id } = req.params;

    const producto = await get("SELECT * FROM productos WHERE id = ?", [id]);
    if (!producto) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    // Verificar que no haya movimientos o ajustes
    const movimientos = await get("SELECT COUNT(*) as count FROM movimientos WHERE producto_id = ?", [id]);
    const ajustes = await get("SELECT COUNT(*) as count FROM ajustes WHERE producto_id = ?", [id]);

    if (movimientos.count > 0 || ajustes.count > 0) {
      return res.status(409).json({ error: "No se puede eliminar un producto con movimientos o ajustes registrados" });
    }

    await run("DELETE FROM productos WHERE id = ?", [id]);

    // Auditoría
    await run(
      "INSERT INTO auditoria (usuario_id, entidad, accion, id_registro, cambios) VALUES (?, ?, ?, ?, ?)",
      [req.user.id, "productos", "DELETE", id, JSON.stringify(producto)]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo eliminar el producto" });
  }
});

module.exports = router;
