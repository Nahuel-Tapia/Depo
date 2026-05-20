const express = require("express");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");
const compraController = require("../controllers/compraController");

const router = express.Router();

router.use(authenticate);

// Planillas
router.get("/planillas", authorizePermissions(PERMISSIONS.PLANILLA_VIEW), compraController.listarPlanillas);
router.get("/planillas/:id", authorizePermissions(PERMISSIONS.PLANILLA_VIEW), compraController.getPlanillaById);
router.post("/planillas", authorizePermissions(PERMISSIONS.PLANILLA_MANAGE), compraController.createPlanilla);
router.patch("/planillas/:id/enviar", authorizePermissions(PERMISSIONS.PLANILLA_ENVIAR), compraController.enviarPlanilla);
router.patch("/planillas/:id/aceptar", authorizePermissions(PERMISSIONS.PLANILLA_MANAGE), compraController.aceptarPlanilla);
router.patch("/planillas/:id/devolver", authorizePermissions(PERMISSIONS.PLANILLA_MANAGE), compraController.devolverPlanilla);
router.patch("/planillas/:id/procesar", authorizePermissions(PERMISSIONS.PLANILLA_MANAGE), compraController.aceptarPlanilla);
router.delete("/planillas/:id", authorizePermissions(PERMISSIONS.PLANILLA_MANAGE), compraController.deletePlanilla);

// Licitacion Consolidado & Tools
router.get("/licitacion/consolidado", authorizePermissions(PERMISSIONS.PLANILLA_VIEW), compraController.getLicitacionConsolidado);
router.get("/licitacion/anual/consolidado", authorizePermissions(PERMISSIONS.PLANILLA_VIEW), compraController.getLicitacionAnualConsolidado);
router.get("/licitacion/anual/estado-directores", authorizePermissions(PERMISSIONS.PLANILLA_VIEW), compraController.getLicitacionAnualEstadoDirectores);
router.get("/licitacion/anual/enviada-status", compraController.getEnviadaStatus);
router.get("/licitacion/anual/escuelas-pendientes", compraController.getEscuelasPendientes);
router.post("/licitacion/anual/enviar-final", compraController.enviarLicitacionFinal);
router.get("/licitacion/anual/final-items", authorizePermissions(PERMISSIONS.PLANILLA_VIEW), compraController.getFinalItems);

// Licitacion Publicación
router.get("/licitacion/anual/publicada-status", authorizePermissions(PERMISSIONS.PLANILLA_VIEW), compraController.getPublicadaStatus);
router.post("/licitacion/anual/publicar", authorizePermissions(PERMISSIONS.PLANILLA_MANAGE), compraController.publicarLicitacion);
router.delete("/licitacion/anual/publicar/:id(\\d+)", authorizePermissions(PERMISSIONS.PLANILLA_MANAGE), compraController.reabrirLicitacion);

// Licitaciones Cerradas & Adjudicación
router.get("/licitacion/anual/cerradas", authorizePermissions(PERMISSIONS.PLANILLA_VIEW), compraController.getLicitacionesCerradas);
router.post("/licitacion/anual/enviar-deposito", authorizePermissions(PERMISSIONS.PLANILLA_MANAGE), compraController.enviarADeposito);

// Refuerzos
router.get("/refuerzos/pendientes-licitacion", authorizePermissions(PERMISSIONS.PLANILLA_VIEW), compraController.getRefuerzosPendientesLicitacion);

// Adjudicacion
router.get("/adjudicacion", authorizePermissions(PERMISSIONS.PLANILLA_MANAGE), compraController.getAdjudicacion);
router.post("/adjudicacion", authorizePermissions(PERMISSIONS.PLANILLA_MANAGE), compraController.adjudicar);
router.get("/adjudicacion/historial", authorizePermissions(PERMISSIONS.PLANILLA_VIEW), compraController.getAdjudicacionHistorial);

module.exports = router;
