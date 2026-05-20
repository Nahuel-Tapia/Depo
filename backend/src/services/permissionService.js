const rbac = require("./rbac");

async function getPermissionsForRole(role) {
  return await rbac.getPermissionsForRole(role);
}

async function getRolePermissionMatrix() {
  return await rbac.getRolePermissionMatrix();
}

async function getAllPermissions() {
  return await rbac.getAllPermissions();
}

module.exports = {
  getPermissionsForRole,
  getRolePermissionMatrix,
  getAllPermissions
};
