const { all, get, run } = require("../db.pg");
const { DEFAULT_ROLE_PERMISSIONS } = require("../permissions");

function normalizeRoleName(role) {
  return String(role || "")
    .trim()
    .toLowerCase();
}

function getDefaultRoleNames() {
  return Object.keys(DEFAULT_ROLE_PERMISSIONS).map(normalizeRoleName);
}

async function ensureRoleTableSeeded() {
  const defaults = getDefaultRoleNames();
  for (const role of defaults) {
    if (!role) continue;
    await run(
      "INSERT INTO rol (nombre) VALUES (?) ON CONFLICT (nombre) DO NOTHING RETURNING id_rol AS id",
      [role]
    );
  }
}

async function getAllRoles() {
  await ensureRoleTableSeeded();
  return all("SELECT id_rol AS id, nombre FROM rol ORDER BY nombre ASC");
}

async function roleExists(role) {
  const normalized = normalizeRoleName(role);
  if (!normalized) return false;
  await ensureRoleTableSeeded();
  const found = await get("SELECT id_rol FROM rol WHERE LOWER(nombre) = ?", [
    normalized,
  ]);
  return Boolean(found);
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
