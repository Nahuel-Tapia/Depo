const express = require("express");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");
const rolesController = require("../controllers/rolesController");

const router = express.Router();

router.use(authenticate);

router.get("/", rolesController.listRoles);
router.get("/permission-matrix", rolesController.getPermissionMatrix);
router.post("/", authorizePermissions(PERMISSIONS.USERS_ROLE_UPDATE), rolesController.createRole);
router.get("/:id/permissions", rolesController.getRolePermissions);
router.put("/:id/permissions", authorizePermissions(PERMISSIONS.USERS_ROLE_UPDATE), rolesController.updateRolePermissions);

module.exports = router;
