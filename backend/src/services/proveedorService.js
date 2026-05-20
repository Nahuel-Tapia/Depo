const { all, get, pool } = require("../db.pg");

async function getProveedores() {
  return await all(`
    SELECT 
      id_proveedor as id, nombre, cuit, contacto, telefono, email, categoria, activo,
      razon_social, direccion, rubro, email_secundario, sitio_web, observaciones
    FROM proveedor
    ORDER BY nombre ASC
  `);
}

async function createProveedor(body) {
  const client = await pool.connect();
  try {
    const {
      nombre, cuit, contacto, telefono, email, categoria,
      razon_social, direccion, rubro, email_secundario, sitio_web, observaciones
    } = body || {};

    if (!nombre) {
      throw { status: 400, message: "El nombre es obligatorio" };
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

    return { id: result.rows[0].id_proveedor };
  } catch (err) {
    if (String(err.message).includes("unique") || String(err.message).includes("UNIQUE")) {
      throw { status: 409, message: "Ya existe un proveedor con ese CUIT" };
    }
    throw err;
  } finally {
    client.release();
  }
}

async function updateProveedor(id, body) {
  const client = await pool.connect();
  try {
    const {
      nombre, cuit, contacto, telefono, email, categoria, activo,
      razon_social, direccion, rubro, email_secundario, sitio_web, observaciones
    } = body || {};

    const proveedorResult = await client.query(
      "SELECT id_proveedor FROM proveedor WHERE id_proveedor = $1",
      [id]
    );
    if (proveedorResult.rows.length === 0) {
      throw { status: 404, message: "Proveedor no encontrado" };
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
      throw { status: 400, message: "No hay campos para actualizar" };
    }

    params.push(id);

    await client.query(
      `UPDATE proveedor SET ${updates.join(", ")} WHERE id_proveedor = $${paramIndex}`,
      params
    );

    return { ok: true };
  } finally {
    client.release();
  }
}

async function deleteProveedor(id) {
  const client = await pool.connect();
  try {
    const proveedorResult = await client.query(
      "SELECT id_proveedor FROM proveedor WHERE id_proveedor = $1",
      [id]
    );
    if (proveedorResult.rows.length === 0) {
      throw { status: 404, message: "Proveedor no encontrado" };
    }

    await client.query("DELETE FROM proveedor WHERE id_proveedor = $1", [id]);
    return { ok: true };
  } finally {
    client.release();
  }
}

module.exports = {
  getProveedores,
  createProveedor,
  updateProveedor,
  deleteProveedor
};
