const permissionService = require("../services/permissionService");

async function getMyPermissions(req, res) {
  const role = req.user.role;
  try {
    const permissions = await permissionService.getPermissionsForRole(role);
    return res.json({ role, permissions });
  } catch (err) {
    return res.status(500).json({ error: "No se pudieron obtener permisos" });
  }
}

async function getPermissionMatrix(req, res) {
  try {
    const matrix = await permissionService.getRolePermissionMatrix();
    return res.json({ matrix });
  } catch (err) {
    return res.status(500).json({ error: "No se pudo obtener la matriz de permisos" });
  }
}

async function getPermissionCatalog(req, res) {
  try {
    const permissions = await permissionService.getAllPermissions();
    return res.json({ permissions });
  } catch (err) {
    return res.status(500).json({ error: "No se pudo obtener catálogo de permisos" });
  }
}

module.exports = {
  getMyPermissions,
  getPermissionMatrix,
  getPermissionCatalog
};
