const express = require("express");
const { authenticate } = require("../middleware/auth");
const supervisorController = require("../controllers/supervisorController");

const router = express.Router();

router.use(authenticate);

router.get("/instituciones", supervisorController.getInstituciones);
router.get("/dashboard/stats", supervisorController.getDashboardStats);
router.patch("/instituciones/:id/tipo-kit", supervisorController.updateInstitucionKit);
router.get("/pedidos-pendientes", supervisorController.getPedidosPendientes);
router.get("/solicitudes", supervisorController.getSolicitudes);
router.get("/instituciones/:id/historial", supervisorController.getHistorialInstitucion);
router.get("/instituciones/:id/historial-consumo", supervisorController.getHistorialConsumo);

module.exports = router;
