const express = require("express");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");
const proveedorController = require("../controllers/proveedorController");

const router = express.Router();

router.use(authenticate);

// Listar todos los proveedores
router.get("/", authorizePermissions(PERMISSIONS.PROVEEDORES_VIEW), proveedorController.listProveedores);

// Crear proveedor
router.post("/", authorizePermissions(PERMISSIONS.PROVEEDORES_CREATE), proveedorController.createProveedor);

// Actualizar proveedor
router.patch("/:id", authorizePermissions(PERMISSIONS.PROVEEDORES_EDIT), proveedorController.updateProveedor);

// Eliminar proveedor
router.delete("/:id", authorizePermissions(PERMISSIONS.PROVEEDORES_DELETE), proveedorController.deleteProveedor);

module.exports = router;
