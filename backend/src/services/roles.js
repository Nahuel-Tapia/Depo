const { all, get, run, pool } = require("../db.pg");
const { DEFAULT_ROLE_PERMISSIONS } = require("../permissions");

function normalizeRoleName(role) {
  return String(role || "")
    .trim()
    .toLowerCase();
}

function getDefaultRoleNames() {
  return Object.keys(DEFAULT_ROLE_PERMISSIONS).map(normalizeRoleName);
}

let roleSeededReady = false;

async function ensureRoleTableSeeded() {
  if (roleSeededReady) return;
  // En Vercel la BD ya está seeded — skip para evitar errores de pool
  if (process.env.VERCEL) {
    roleSeededReady = true;
    return;
  }
  const defaults = getDefaultRoleNames();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const role of defaults) {
      if (!role) continue;
      await client.query(
        "INSERT INTO rol (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING",
        [role]
      );
    }
    await client.query("COMMIT");
    roleSeededReady = true;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Error seeding roles table:", err);
    throw err;
  } finally {
    client.release();
  }
}

async function getAllRoles() {
  try {
    await ensureRoleTableSeeded();
    const rows = await all("SELECT id_rol AS id, nombre FROM rol ORDER BY nombre ASC");
    if (Array.isArray(rows) && rows.length > 0) {
      return rows;
    }
  } catch (err) {
    console.error("[getAllRoles error]", err.message || err);
  }

  return Object.keys(DEFAULT_ROLE_PERMISSIONS).map((r, idx) => ({ id: idx + 1, nombre: r }));
}

async function roleExists(role) {
  const normalized = normalizeRoleName(role);
  if (!normalized) return false;

  // Primero intentar la BD
  try {
    await ensureRoleTableSeeded();
    const found = await get("SELECT id_rol FROM rol WHERE LOWER(nombre) = $1", [normalized]);
    if (found !== undefined) return Boolean(found);
  } catch (err) {
    console.error("[roleExists DB error]", err.message || err);
  }

  // Fallback: verificar contra permisos conocidos
  return getDefaultRoleNames().includes(normalized);
}

async function createRole(role) {
  const normalized = normalizeRoleName(role);
  if (!normalized) {
    throw new Error("El nombre del rol es obligatorio");
  }

  const created = await run(
    "INSERT INTO rol (nombre) VALUES (?) ON CONFLICT (nombre) DO NOTHING RETURNING id_rol AS id, nombre",
    [normalized]
  );

  if (!created.rows || created.rows.length === 0) {
    const existing = await get(
      "SELECT id_rol AS id, nombre FROM rol WHERE LOWER(nombre) = ?",
      [normalized]
    );
    return { created: false, role: existing };
  }

  return { created: true, role: created.rows[0] };
}

module.exports = {
  getAllRoles,
  roleExists,
  createRole,
  ensureRoleTableSeeded,
  normalizeRoleName,
};
