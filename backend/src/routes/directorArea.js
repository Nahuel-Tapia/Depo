const express = require("express");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");
const directorAreaController = require("../controllers/directorAreaController");
const directorAreaService = require("../services/directorAreaService");

const router = express.Router();

router.use(authenticate);
router.use(authorizePermissions(PERMISSIONS.SUPERVISION_MANAGE));

async function attachDirectorAreaActingContext(req, res, next) {
  try {
    const role = String(req.user?.role || "").toLowerCase();

    if (role === "master") {
      const pick = Number(req.query.director_area_id || req.body?.director_area_id || 0);
      if (Number.isInteger(pick) && pick > 0) {
        const row = await directorAreaService.getDirectorAreaUser(pick);
        if (row?.id_usuario) {
          req.directorAreaActingId = Number(row.id_usuario);
          return next();
        }
      }
      const first = await directorAreaService.getFirstDirectorAreaUser();
      if (!first?.id_usuario) {
        return res.status(400).json({
          error:
            "Como usuario master necesitás al menos un Director de Área en el sistema, o pasá director_area_id en query o body."
        });
      }
      req.directorAreaActingId = Number(first.id_usuario);
      return next();
    }

    req.directorAreaActingId = Number(req.user.sub);
    return next();
  } catch (err) {
    return next(err);
  }
}

router.use(attachDirectorAreaActingContext);

router.get("/dashboard/resumen", directorAreaController.getInformes);
router.get("/dashboard/escuelas", directorAreaController.getAsignaciones);
router.get("/dashboard/pedidos-pendientes", directorAreaController.getSolicitudes);
router.get("/dashboard/zonas", directorAreaController.getZonasEdificio);

router.get("/catalogo", directorAreaController.getCatalogo);
router.get("/asignaciones", directorAreaController.getAsignaciones);
router.delete("/asignacion/:id", directorAreaController.deleteAsignacion);
router.post("/asignar", directorAreaController.asignar);
router.delete("/desasignar", directorAreaController.desasignar);
router.get("/supervisores", directorAreaController.getSupervisores);
router.post("/supervisores", directorAreaController.createSupervisor);
router.get("/edificios", directorAreaController.getEdificios);
router.get("/edificio/:edificioId/escuelas", directorAreaController.getInstitucionesDelEdificio);
router.get("/zonas-edificio", directorAreaController.getZonasEdificio);
router.get("/informes", directorAreaController.getInformes);
router.get("/solicitudes", directorAreaController.getSolicitudes);
router.post("/zonas", directorAreaController.createZona);
router.patch("/zonas/:zonaId", directorAreaController.updateZona);
router.delete("/zonas/:zonaId", directorAreaController.deleteZona);
router.post("/zonas/:zonaId/supervisores", directorAreaController.assignSupervisoresZona);

module.exports = router;
