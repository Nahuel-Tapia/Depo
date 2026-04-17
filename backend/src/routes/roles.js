const express = require("express");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");
const { getAllRoles, createRole } = require("../services/roles");
const { getPermissionsForRole, setRolePermissionsByRoleId } = require("../services/rbac");

const router = express.Router();

router.use(authenticate);

router.get("/", async (req, res) => {
  try {
    const roles = await getAllRoles();
    return res.json({ roles });
  } catch (err) {
    return res.status(500).json({ error: "No se pudieron listar roles" });
  }
});

router.post("/", authorizePermissions(PERMISSIONS.USERS_ROLE_UPDATE), async (req, res) => {
  try {
    const { nombre } = req.body || {};
    const result = await createRole(nombre);
    if (!result.created) {
      return res.status(409).json({ error: "El rol ya existe", role: result.role });
    }
    return res.status(201).json({ ok: true, role: result.role });
  } catch (err) {
    return res.status(400).json({ error: err.message || "No se pudo crear rol" });
  }
});

router.get("/:id/permissions", async (req, res) => {
  try {
    const roles = await getAllRoles();
    const role = roles.find((r) => Number(r.id) === Number(req.params.id));
    if (!role) {
      return res.status(404).json({ error: "Rol no encontrado" });
    }

    const permissions = await getPermissionsForRole(role.nombre);
    return res.json({ role, permissions });
  } catch (err) {
    return res.status(500).json({ error: "No se pudieron obtener permisos del rol" });
  }
});

router.put("/:id/permissions", authorizePermissions(PERMISSIONS.USERS_ROLE_UPDATE), async (req, res) => {
  try {
    const permissions = Array.isArray(req.body?.permissions) ? req.body.permissions : [];
    const updated = await setRolePermissionsByRoleId(req.params.id, permissions);
    return res.json({ ok: true, permissions: updated });
  } catch (err) {
    const message = err.message || "No se pudo actualizar permisos del rol";
    const status = message.includes("no encontrado") || message.includes("inexistentes") || message.includes("inválido") ? 400 : 500;
    return res.status(status).json({ error: message });
  }
});

module.exports = router;
