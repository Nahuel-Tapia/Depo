const express = require("express");
const { all, get, run } = require("../db.pg");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");

const router = express.Router();

router.use(authenticate);

// Listar todos los proveedores
router.get("/", authorizePermissions(PERMISSIONS.PROVEEDORES_VIEW), async (req, res) => {
  try {
    const proveedores = await all(`
      SELECT id_proveedor as id, nombre, cuit, contacto, telefono, email, categoria, activo
      FROM proveedor
      ORDER BY nombre ASC
    `);
    return res.json({ proveedores });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo listar proveedores" });
  }
});

// Crear proveedor
router.post("/", authorizePermissions(PERMISSIONS.PROVEEDORES_CREATE), async (req, res) => {
  try {
    const { nombre, cuit, contacto, telefono, email, categoria } = req.body;
    if (!nombre) {
      return res.status(400).json({ error: "El nombre es obligatorio" });
    }

    const result = await run(`
      INSERT INTO proveedor (nombre, cuit, contacto, telefono, email, categoria)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [nombre.trim(), cuit || null, contacto || null, telefono || null, email || null, categoria || null]);

    return res.status(201).json({ id: result.lastID, message: "Proveedor creado correctamente" });
  } catch (err) {
    console.error(err);
    if (String(err.message).includes("unique") || String(err.message).includes("UNIQUE")) {
      return res.status(409).json({ error: "Ya existe un proveedor con ese CUIT" });
    }
    return res.status(500).json({ error: "No se pudo crear el proveedor" });
  }
});

// Actualizar proveedor
router.patch("/:id", authorizePermissions(PERMISSIONS.PROVEEDORES_EDIT), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, cuit, contacto, telefono, email, categoria } = req.body;

    const proveedor = await get("SELECT id_proveedor FROM proveedor WHERE id_proveedor = ?", [id]);
    if (!proveedor) {
      return res.status(404).json({ error: "Proveedor no encontrado" });
    }

    const updates = [];
    const params = [];
    if (nombre !== undefined) { updates.push("nombre = ?"); params.push(nombre.trim()); }
    if (cuit !== undefined) { updates.push("cuit = ?"); params.push(cuit); }
    if (contacto !== undefined) { updates.push("contacto = ?"); params.push(contacto); }
    if (telefono !== undefined) { updates.push("telefono = ?"); params.push(telefono); }
    if (email !== undefined) { updates.push("email = ?"); params.push(email); }
    if (categoria !== undefined) { updates.push("categoria = ?"); params.push(categoria); }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No hay campos para actualizar" });
    }

    params.push(id);
    await run(`UPDATE proveedor SET ${updates.join(", ")} WHERE id_proveedor = ?`, params);

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo actualizar el proveedor" });
  }
});

// Eliminar proveedor
router.delete("/:id", authorizePermissions(PERMISSIONS.PROVEEDORES_DELETE), async (req, res) => {
  try {
    const { id } = req.params;
    const proveedor = await get("SELECT id_proveedor FROM proveedor WHERE id_proveedor = ?", [id]);
    if (!proveedor) {
      return res.status(404).json({ error: "Proveedor no encontrado" });
    }
    await run("DELETE FROM proveedor WHERE id_proveedor = ?", [id]);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo eliminar el proveedor" });
  }
});

module.exports = router;
