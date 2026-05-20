const express = require("express");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");
const auditoriaController = require("../controllers/auditoriaController");

const router = express.Router();

router.use(authenticate);

// Listar auditoría
router.get("/", authorizePermissions(PERMISSIONS.AUDITORIA_VIEW), auditoriaController.listAuditoria);

// Resumen de auditoría
router.get("/stats/resumen", authorizePermissions(PERMISSIONS.AUDITORIA_VIEW), auditoriaController.getStatsResumen);

// Obtener un registro de auditoría
router.get("/:id", authorizePermissions(PERMISSIONS.AUDITORIA_VIEW), auditoriaController.getAuditoria);

// Auditoría por usuario
router.get("/usuario/:usuario_id", authorizePermissions(PERMISSIONS.AUDITORIA_VIEW), auditoriaController.listAuditoriaByUsuario);

module.exports = router;
