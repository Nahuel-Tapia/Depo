const express = require("express");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");
const dashboardController = require("../controllers/dashboardController");

const router = express.Router();

router.use(authenticate);

// Dashboard resumen general
router.get("/stats", authorizePermissions(PERMISSIONS.DASHBOARD_VIEW), dashboardController.obtenerStats);

// Obtener detalles de movimientos del mes (por tipo)
router.get("/movimientos-mes", authorizePermissions(PERMISSIONS.DASHBOARD_VIEW), dashboardController.obtenerMovimientosMes);

module.exports = router;
