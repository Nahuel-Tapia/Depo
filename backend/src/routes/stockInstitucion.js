const express = require("express");
const { authenticate } = require("../middleware/auth");
const stockInstitucionController = require("../controllers/stockInstitucionController");

const router = express.Router();
router.use(authenticate);

// Listar stock de la institución
router.get("/", stockInstitucionController.getStock);

// Registrar consumo interno
router.post("/consumo", stockInstitucionController.registrarConsumo);

// Notificaciones
router.get("/notificaciones", stockInstitucionController.getNotificaciones);
router.patch("/notificaciones/:id/leer", stockInstitucionController.leerNotificacion);

module.exports = router;
