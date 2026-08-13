const rolesService = require("../services/rolesService");

async function listRoles(req, res) {
  try {
    const roles = await rolesService.listAllRoles();
    return res.json({ roles });
  } catch (err) {
    return res.status(500).json({ error: "No se pudieron listar roles" });
  }
}

async function createRole(req, res) {
  try {
    const { nombre } = req.body || {};
    const result = await rolesService.createSystemRole(nombre);
    if (!result.created) {
      return res.status(409).json({ error: "El rol ya existe", role: result.role });
    }
    return res.status(201).json({ ok: true, role: result.role });
  } catch (err) {
    return res.status(400).json({ error: err.message || "No se pudo crear rol" });
  }
}

async function getRolePermissions(req, res) {
  try {
    const { id } = req.params;
    const { role, permissions } = await rolesService.getRolePermissionsById(id);
    return res.json({ role, permissions });
  } catch (err) {
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: "No se pudieron obtener permisos del rol" });
  }
}

async function updateRolePermissions(req, res) {
  try {
    const { id } = req.params;
    const updated = await rolesService.saveRolePermissions(id, req.body?.permissions);
    return res.json({ ok: true, permissions: updated });
  } catch (err) {
    const message = err.message || "No se pudo actualizar permisos del rol";
    const status = message.includes("no encontrado") || message.includes("inexistentes") || message.includes("inválido") ? 400 : 500;
    return res.status(status).json({ error: message });
  }
}

async function getPermissionMatrix(req, res) {
  try {
    const { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS } = require("../permissions");
    return res.json({ roles: DEFAULT_ROLE_PERMISSIONS, permissions: PERMISSIONS });
  } catch (err) {
    return res.status(500).json({ error: "No se pudo obtener la matriz de permisos" });
  }
}

module.exports = {
  listRoles,
  createRole,
  getRolePermissions,
  updateRolePermissions,
  getPermissionMatrix
};
