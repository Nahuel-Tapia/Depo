const express = require("express");
const { all, get, run, pool } = require("../db.pg");
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
  const client = await pool.connect();
  try {
    const {
      nombre, cuit, contacto, telefono, email, categoria,
      razon_social, direccion, rubro, email_secundario, sitio_web, observaciones
    } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: "El nombre es obligatorio" });
    }

    const result = await client.query(`
      INSERT INTO proveedor (
        nombre, cuit, contacto, telefono, email, categoria,
        razon_social, direccion, rubro, email_secundario, sitio_web, observaciones
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id_proveedor
    `, [
      nombre.trim(), cuit || null, contacto || null, telefono || null, email || null, categoria || null,
      razon_social || null, direccion || null, rubro || null, email_secundario || null, sitio_web || null, observaciones || null
    ]);

    return res.status(201).json({ id: result.rows[0].id_proveedor, message: "Proveedor creado correctamente" });
  } catch (err) {
    console.error("[crear-proveedor] Error:", err.message);
    if (String(err.message).includes("unique") || String(err.message).includes("UNIQUE")) {
      return res.status(409).json({ error: "Ya existe un proveedor con ese CUIT" });
    }
    return res.status(500).json({ error: "No se pudo crear el proveedor", details: err.message });
  } finally {
    client.release();
  }
});

// Actualizar proveedor
router.patch("/:id", authorizePermissions(PERMISSIONS.PROVEEDORES_EDIT), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const {
      nombre, cuit, contacto, telefono, email, categoria, activo,
      razon_social, direccion, rubro, email_secundario, sitio_web, observaciones
    } = req.body;

    const proveedorResult = await client.query(
      "SELECT id_proveedor FROM proveedor WHERE id_proveedor = $1",
      [id]
    );
    if (proveedorResult.rows.length === 0) {
      return res.status(404).json({ error: "Proveedor no encontrado" });
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (nombre !== undefined) { updates.push(`nombre = $${paramIndex++}`); params.push(nombre.trim()); }
    if (cuit !== undefined) { updates.push(`cuit = $${paramIndex++}`); params.push(cuit); }
    if (contacto !== undefined) { updates.push(`contacto = $${paramIndex++}`); params.push(contacto); }
    if (telefono !== undefined) { updates.push(`telefono = $${paramIndex++}`); params.push(telefono); }
    if (email !== undefined) { updates.push(`email = $${paramIndex++}`); params.push(email); }
    if (categoria !== undefined) { updates.push(`categoria = $${paramIndex++}`); params.push(categoria); }
    if (activo !== undefined) { updates.push(`activo = $${paramIndex++}`); params.push(activo); }
    if (razon_social !== undefined) { updates.push(`razon_social = $${paramIndex++}`); params.push(razon_social); }
    if (direccion !== undefined) { updates.push(`direccion = $${paramIndex++}`); params.push(direccion); }
    if (rubro !== undefined) { updates.push(`rubro = $${paramIndex++}`); params.push(rubro); }
    if (email_secundario !== undefined) { updates.push(`email_secundario = $${paramIndex++}`); params.push(email_secundario); }
    if (sitio_web !== undefined) { updates.push(`sitio_web = $${paramIndex++}`); params.push(sitio_web); }
    if (observaciones !== undefined) { updates.push(`observaciones = $${paramIndex++}`); params.push(observaciones); }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No hay campos para actualizar" });
    }

    params.push(id);

    await client.query(
      `UPDATE proveedor SET ${updates.join(", ")} WHERE id_proveedor = $${paramIndex}`,
      params
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("[actualizar-proveedor] Error:", err.message);
    return res.status(500).json({ error: "No se pudo actualizar el proveedor", details: err.message });
  } finally {
    client.release();
  }
});

// Eliminar proveedor
router.delete("/:id", authorizePermissions(PERMISSIONS.PROVEEDORES_DELETE), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    const proveedorResult = await client.query(
      "SELECT id_proveedor FROM proveedor WHERE id_proveedor = $1",
      [id]
    );
    if (proveedorResult.rows.length === 0) {
      return res.status(404).json({ error: "Proveedor no encontrado" });
    }

    await client.query("DELETE FROM proveedor WHERE id_proveedor = $1", [id]);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[eliminar-proveedor] Error:", err.message);
    return res.status(500).json({ error: "No se pudo eliminar el proveedor", details: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
