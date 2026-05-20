const express = require("express");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");
const ajustesController = require("../controllers/ajustesController");

const router = express.Router();

router.use(authenticate);

// Listar ajustes
router.get("/", authorizePermissions(PERMISSIONS.AJUSTES_VIEW), ajustesController.listAjustes);

// Obtener un ajuste
router.get("/:id", authorizePermissions(PERMISSIONS.AJUSTES_VIEW), ajustesController.getAjuste);

// Crear ajuste de inventario
router.post("/", authorizePermissions(PERMISSIONS.AJUSTES_CREATE), ajustesController.createAjuste);

module.exports = router;
