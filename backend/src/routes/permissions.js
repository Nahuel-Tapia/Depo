const express = require("express");
const { authenticate } = require("../middleware/auth");
const {
  getPermissionsForRole,
  getRolePermissionMatrix,
  getAllPermissions,
} = require("../services/rbac");

const router = express.Router();
router.use(authenticate);

router.get("/me", async (req, res) => {
  const role = req.user.role;
  try {
    const permissions = await getPermissionsForRole(role);
    return res.json({ role, permissions });
  } catch (err) {
    return res.status(500).json({ error: "No se pudieron obtener permisos" });
  }
});

router.get("/matrix", async (req, res) => {
  try {
    const matrix = await getRolePermissionMatrix();
    return res.json({ matrix });
  } catch (err) {
    return res.status(500).json({ error: "No se pudo obtener la matriz de permisos" });
  }
});

router.get("/catalog", async (req, res) => {
  try {
    const permissions = await getAllPermissions();
    return res.json({ permissions });
  } catch (err) {
    return res.status(500).json({ error: "No se pudo obtener catálogo de permisos" });
  }
});

module.exports = router;
