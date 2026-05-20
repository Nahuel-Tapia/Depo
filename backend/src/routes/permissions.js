const express = require("express");
const { authenticate } = require("../middleware/auth");
const permissionController = require("../controllers/permissionController");

const router = express.Router();
router.use(authenticate);

router.get("/me", permissionController.getMyPermissions);
router.get("/matrix", permissionController.getPermissionMatrix);
router.get("/catalog", permissionController.getPermissionCatalog);

module.exports = router;
