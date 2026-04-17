const { all, get, run, pool } = require("../db.pg");
const { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } = require("../permissions");
const { ensureRoleTableSeeded } = require("./roles");

let rbacReady = false;

function normalizePermissionCode(code) {
  return String(code || "")
    .trim()
    .toLowerCase();
}

function getDefaultPermissionCodes() {
  return Object.values(PERMISSIONS).map(normalizePermissionCode);
}

async function ensureRbacSchemaAndSeed() {
  if (rbacReady) return;

  await ensureRoleTableSeeded();

  await run(`
    CREATE TABLE IF NOT EXISTS permiso (
      id_permiso SERIAL PRIMARY KEY,
      codigo VARCHAR(120) NOT NULL UNIQUE,
      descripcion VARCHAR(255)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS rol_permiso (
      id_rol INT NOT NULL REFERENCES rol(id_rol) ON DELETE CASCADE,
      id_permiso INT NOT NULL REFERENCES permiso(id_permiso) ON DELETE CASCADE,
      PRIMARY KEY (id_rol, id_permiso)
    )
  `);

  const permissionCodes = getDefaultPermissionCodes();
  for (const code of permissionCodes) {
    if (!code) continue;
    await pool.query(
      "INSERT INTO permiso (codigo, descripcion) VALUES ($1, $2) ON CONFLICT (codigo) DO NOTHING",
      [code, code]
    );
  }

  const roles = await all("SELECT id_rol, LOWER(nombre) AS nombre FROM rol");
  const roleIdByName = new Map(roles.map((r) => [r.nombre, r.id_rol]));

  for (const [roleName, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const roleId = roleIdByName.get(String(roleName).toLowerCase());
    if (!roleId) continue;

    for (const permissionCode of permissions) {
      const normalizedCode = normalizePermissionCode(permissionCode);
      await pool.query(
        `INSERT INTO rol_permiso (id_rol, id_permiso)
         SELECT $1, p.id_permiso
         FROM permiso p
         WHERE p.codigo = $2
         ON CONFLICT (id_rol, id_permiso) DO NOTHING`,
        [roleId, normalizedCode]
      );
    }
  }

  rbacReady = true;
}

async function getPermissionsForRole(roleName) {
  const normalizedRole = String(roleName || "").trim().toLowerCase();
  if (!normalizedRole) return [];

  await ensureRbacSchemaAndSeed();

  const rows = await all(
    `SELECT p.codigo
     FROM rol r
     JOIN rol_permiso rp ON rp.id_rol = r.id_rol
     JOIN permiso p ON p.id_permiso = rp.id_permiso
     WHERE LOWER(r.nombre) = ?
     ORDER BY p.codigo ASC`,
    [normalizedRole]
  );

  return rows.map((row) => row.codigo);
}

async function hasPermissionsForRole(roleName, requiredPermissions = []) {
  const required = requiredPermissions.map(normalizePermissionCode).filter(Boolean);
  if (required.length === 0) return true;

  const rolePermissions = await getPermissionsForRole(roleName);
  const rolePermissionSet = new Set(rolePermissions.map(normalizePermissionCode));
  return required.every((permission) => rolePermissionSet.has(permission));
}

async function getRolePermissionMatrix() {
  await ensureRbacSchemaAndSeed();

  const rows = await all(
    `SELECT r.nombre AS role, p.codigo AS permission
     FROM rol r
     LEFT JOIN rol_permiso rp ON rp.id_rol = r.id_rol
     LEFT JOIN permiso p ON p.id_permiso = rp.id_permiso
     ORDER BY r.nombre ASC, p.codigo ASC`
  );

  const matrix = {};
  for (const row of rows) {
    if (!matrix[row.role]) {
      matrix[row.role] = [];
    }
    if (row.permission) {
      matrix[row.role].push(row.permission);
    }
  }
  return matrix;
}

async function getAllPermissions() {
  await ensureRbacSchemaAndSeed();
  return all("SELECT id_permiso AS id, codigo, descripcion FROM permiso ORDER BY codigo ASC");
}

async function setRolePermissionsByRoleId(roleId, permissionCodes) {
  const roleIdNum = Number(roleId);
  if (!Number.isInteger(roleIdNum) || roleIdNum <= 0) {
    throw new Error("Rol inválido");
  }

  await ensureRbacSchemaAndSeed();

  const normalizedCodes = [...new Set((permissionCodes || []).map(normalizePermissionCode).filter(Boolean))];
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const roleResult = await client.query("SELECT id_rol FROM rol WHERE id_rol = $1", [roleIdNum]);
    if (roleResult.rowCount === 0) {
      throw new Error("Rol no encontrado");
    }

    let permissionRows = [];
    if (normalizedCodes.length > 0) {
      const codesPlaceholders = normalizedCodes.map((_, index) => `$${index + 1}`).join(", ");
      const permissionResult = await client.query(
        `SELECT id_permiso, codigo FROM permiso WHERE codigo IN (${codesPlaceholders})`,
        normalizedCodes
      );
      permissionRows = permissionResult.rows;

      if (permissionRows.length !== normalizedCodes.length) {
        const found = new Set(permissionRows.map((r) => r.codigo));
        const missing = normalizedCodes.filter((code) => !found.has(code));
        throw new Error(`Permisos inexistentes: ${missing.join(", ")}`);
      }
    }

    await client.query("DELETE FROM rol_permiso WHERE id_rol = $1", [roleIdNum]);

    for (const permission of permissionRows) {
      await client.query(
        "INSERT INTO rol_permiso (id_rol, id_permiso) VALUES ($1, $2) ON CONFLICT (id_rol, id_permiso) DO NOTHING",
        [roleIdNum, permission.id_permiso]
      );
    }

    await client.query("COMMIT");
    return permissionRows.map((p) => p.codigo).sort();
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  ensureRbacSchemaAndSeed,
  getPermissionsForRole,
  hasPermissionsForRole,
  getRolePermissionMatrix,
  getAllPermissions,
  setRolePermissionsByRoleId,
};
