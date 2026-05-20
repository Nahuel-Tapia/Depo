const roles = require("./roles");
const rbac = require("./rbac");

async function listAllRoles() {
  return await roles.getAllRoles();
}

async function createSystemRole(nombre) {
  return await roles.createRole(nombre);
}

async function getRolePermissionsById(id) {
  const allRoles = await roles.getAllRoles();
  const role = allRoles.find((r) => Number(r.id) === Number(id));
  if (!role) {
    throw { status: 404, message: "Rol no encontrado" };
  }
  const permissions = await rbac.getPermissionsForRole(role.nombre);
  return { role, permissions };
}

async function saveRolePermissions(id, permissionsList) {
  const permissions = Array.isArray(permissionsList) ? permissionsList : [];
  const updated = await rbac.setRolePermissionsByRoleId(id, permissions);
  rbac.invalidateRbacCache();
  return updated;
}

module.exports = {
  listAllRoles,
  createSystemRole,
  getRolePermissionsById,
  saveRolePermissions
};
