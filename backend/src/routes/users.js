const express = require("express");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");
const userController = require("../controllers/userController");

const router = express.Router();

router.use(authenticate);

router.get("/me", userController.getMe);
router.patch("/me", userController.updateMe);
router.patch("/me/password", userController.updatePassword);

router.get("/", authorizePermissions(PERMISSIONS.USERS_READ), userController.listUsers);
router.post("/", authorizePermissions(PERMISSIONS.USERS_CREATE), userController.createUser);
router.patch("/:id/role", authorizePermissions(PERMISSIONS.USERS_ROLE_UPDATE), userController.updateUserRole);
router.patch("/:id", authorizePermissions(PERMISSIONS.USERS_CREATE), userController.updateUser);
router.patch("/:id/active", authorizePermissions(PERMISSIONS.USERS_STATUS_UPDATE), userController.updateUserActive);
router.delete("/:id", authorizePermissions(PERMISSIONS.USERS_DELETE), userController.deleteUser);

module.exports = router;
