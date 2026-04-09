const express = require("express");
const { all, get, run } = require("../db.pg");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");

const router = express.Router();

router.use(authenticate);

// Listar productos
router.get("/", authorizePermissions(PERMISSIONS.PRODUCTOS_VIEW), async (req, res) => {
  try {
    const productos = await all(`
      SELECT 
        p.id_producto as id,
        p.nombre,
        p.unidad_medida,
        p.stock_actual,
        p.stock_minimo,
        p.id_categoria,
        c.nombre as categoria_nombre
      FROM producto p
      LEFT JOIN categoria c ON p.id_categoria = c.id_categoria
      ORDER BY p.id_producto DESC
    `);
    return res.json({ productos });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo listar productos" });
  }
});

// Listar categorías (para dropdown)
router.get("/categorias", authorizePermissions(PERMISSIONS.PRODUCTOS_VIEW), async (req, res) => {
  try {
    const categorias = await all("SELECT id_categoria as id, nombre, tipo_bien FROM categoria ORDER BY nombre");
    return res.json({ categorias });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo listar categorías" });
  }
});

// Obtener un producto
router.get("/:id", authorizePermissions(PERMISSIONS.PRODUCTOS_VIEW), async (req, res) => {
  try {
    const { id } = req.params;
    const producto = await get(`
      SELECT 
        p.id_producto as id,
        p.nombre,
        p.unidad_medida,
        p.stock_actual,
        p.stock_minimo,
        p.id_categoria,
        c.nombre as categoria_nombre
      FROM producto p
      LEFT JOIN categoria c ON p.id_categoria = c.id_categoria
      WHERE p.id_producto = ?
    `, [id]);
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
    const { nombre, unidad_medida, stock_minimo, id_categoria } = req.body;
    
    if (!nombre) {
      return res.status(400).json({ error: "El nombre es obligatorio" });
    }

    const stock_actual_val = parseInt(req.body.stock_actual) || 0;
    const result = await run(
      "INSERT INTO producto (nombre, unidad_medida, stock_actual, stock_minimo, id_categoria) VALUES (?, ?, ?, ?, ?)",
      [nombre, unidad_medida || 'unidad', stock_actual_val, parseInt(stock_minimo) || 0, id_categoria || null]
    );

    return res.status(201).json({ id: result.lastID });
  } catch (err) {
    console.error("Error creando producto:", err);
    return res.status(500).json({ error: "No se pudo crear el producto" });
  }
});

// Editar producto
router.patch("/:id", authorizePermissions(PERMISSIONS.PRODUCTOS_EDIT), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, unidad_medida, stock_minimo, id_categoria } = req.body;

    const producto = await get("SELECT * FROM producto WHERE id_producto = ?", [id]);
    if (!producto) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    const updates = [];
    const params = [];
    
    if (nombre !== undefined) {
      updates.push("nombre = ?");
      params.push(nombre);
    }
    if (unidad_medida !== undefined) {
      updates.push("unidad_medida = ?");
      params.push(unidad_medida);
    }
    if (stock_minimo !== undefined) {
      updates.push("stock_minimo = ?");
      params.push(parseInt(stock_minimo) || 0);
    }
    if (id_categoria !== undefined) {
      updates.push("id_categoria = ?");
      params.push(id_categoria || null);
    }
    if (req.body.stock_actual !== undefined) {
      updates.push("stock_actual = ?");
      params.push(parseInt(req.body.stock_actual) || 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No hay campos para actualizar" });
    }

    params.push(id);

    await run(
      `UPDATE producto SET ${updates.join(", ")} WHERE id_producto = ?`,
      params
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

    const producto = await get("SELECT * FROM producto WHERE id_producto = ?", [id]);
    if (!producto) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    await run("DELETE FROM producto WHERE id_producto = ?", [id]);

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo eliminar el producto" });
  }
});

module.exports = router;
