const express = require("express");
const { all, get, run } = require("../db.pg");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");

const router = express.Router();

router.use(authenticate);

let schemaReady = false;
let schemaPromise = null;

async function ensureProveedoresSchema() {
  if (schemaReady) return;
  if (schemaPromise) {
    await schemaPromise;
    return;
  }

  schemaPromise = (async () => {
    const columns = [
      "razon_social VARCHAR(255)",
      "direccion VARCHAR(255)",
      "rubro VARCHAR(100)",
      "email_secundario VARCHAR(100)",
      "sitio_web VARCHAR(255)",
      "observaciones TEXT"
    ];

    for (const col of columns) {
      try {
        await run(`ALTER TABLE proveedor ADD COLUMN IF NOT EXISTS ${col}`);
      } catch (err) {
        console.error(`Error agregando columna ${col} a proveedor:`, err);
      }
    }
    schemaReady = true;
  })();

  try {
    await schemaPromise;
  } finally {
    schemaPromise = null;
  }
}

// Listar todos los proveedores
router.get("/", authorizePermissions(PERMISSIONS.PROVEEDORES_VIEW), async (req, res) => {
  try {
    await ensureProveedoresSchema();
    const proveedores = await all(`
      SELECT 
        id_proveedor as id, nombre, cuit, contacto, telefono, email, categoria, activo,
        razon_social, direccion, rubro, email_secundario, sitio_web, observaciones
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
    const { 
      nombre, cuit, contacto, telefono, email, categoria,
      razon_social, direccion, rubro, email_secundario, sitio_web, observaciones 
    } = req.body;
    
    if (!nombre) {
      return res.status(400).json({ error: "El nombre es obligatorio" });
    }

    const result = await run(`
      INSERT INTO proveedor (
        nombre, cuit, contacto, telefono, email, categoria,
        razon_social, direccion, rubro, email_secundario, sitio_web, observaciones
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      nombre.trim(), cuit || null, contacto || null, telefono || null, email || null, categoria || null,
      razon_social || null, direccion || null, rubro || null, email_secundario || null, sitio_web || null, observaciones || null
    ]);

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
    const { 
      nombre, cuit, contacto, telefono, email, categoria, activo,
      razon_social, direccion, rubro, email_secundario, sitio_web, observaciones 
    } = req.body;

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
    if (activo !== undefined) { updates.push("activo = ?"); params.push(activo); }
    if (razon_social !== undefined) { updates.push("razon_social = ?"); params.push(razon_social); }
    if (direccion !== undefined) { updates.push("direccion = ?"); params.push(direccion); }
    if (rubro !== undefined) { updates.push("rubro = ?"); params.push(rubro); }
    if (email_secundario !== undefined) { updates.push("email_secundario = ?"); params.push(email_secundario); }
    if (sitio_web !== undefined) { updates.push("sitio_web = ?"); params.push(sitio_web); }
    if (observaciones !== undefined) { updates.push("observaciones = ?"); params.push(observaciones); }

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
