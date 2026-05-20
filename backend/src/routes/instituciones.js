const express = require("express");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");
const institucionController = require("../controllers/institucionController");

const router = express.Router();

// Endpoint público para obtener instituciones por CUE (sin autenticación)
router.get("/public/cue/:cue", institucionController.getPublicByCue);

// Endpoint público para listar instituciones (para dropdowns)
router.get("/public/list", institucionController.listPublic);

router.use(authenticate);

// Listar todas las instituciones con status de retiro
router.get("/", institucionController.list);

// === HISTORIAL GLOBAL (todas las instituciones) ===
router.get("/historial", authorizePermissions(PERMISSIONS.INSTITUCIONES_VIEW), institucionController.getHistorialGlobal);

// Obtener una institución por ID
router.get("/:id(\\d+)", authorizePermissions(PERMISSIONS.INSTITUCIONES_VIEW), institucionController.getById);

// Buscar instituciones por CUE (puede devolver múltiples modalidades)
router.get("/cue/:cue", authorizePermissions(PERMISSIONS.INSTITUCIONES_VIEW), institucionController.getByCue);

// Crear institución
router.post("/", authorizePermissions(PERMISSIONS.INSTITUCIONES_CREATE), institucionController.create);

// Actualizar institución
router.patch("/:id", authorizePermissions(PERMISSIONS.INSTITUCIONES_EDIT), institucionController.update);

// Eliminar institución
router.delete("/:id", authorizePermissions(PERMISSIONS.INSTITUCIONES_DELETE), institucionController.deleteInstitucion);

// === ASIGNACIONES DE STOCK ===

// Obtener asignaciones de una institución
router.get("/:id/asignaciones", authorizePermissions(PERMISSIONS.INSTITUCIONES_VIEW), institucionController.getAsignaciones);

// Asignar stock a institución
router.post("/:id/asignar", authorizePermissions(PERMISSIONS.INSTITUCIONES_ASIGNAR), institucionController.asignar);

// Asignación masiva a todas las instituciones
router.post("/asignar-masivo", authorizePermissions(PERMISSIONS.INSTITUCIONES_ASIGNAR), institucionController.asignarMasivo);

// Registrar entrega de stock
router.post("/:id/entregar", authorizePermissions(PERMISSIONS.INSTITUCIONES_ASIGNAR), institucionController.entregar);

// Resumen de asignaciones por periodo
router.get("/resumen/:periodo", authorizePermissions(PERMISSIONS.INSTITUCIONES_VIEW), institucionController.getResumenPeriodo);

// === HISTORIAL POR INSTITUCIÓN ===
router.get("/:id/historial", authorizePermissions(PERMISSIONS.INSTITUCIONES_VIEW), institucionController.getHistorialInstitucion);

module.exports = router;
