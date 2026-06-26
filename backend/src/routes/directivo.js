const express = require("express");
const { authenticate } = require("../middleware/auth");
const directivoController = require("../controllers/directivoController");

// Límite de body mayor para rutas que reciben imágenes base64
const largeBodyParser = express.json({ limit: '10mb' });

const router = express.Router();
router.use(authenticate);

router.get("/alertas", directivoController.getAlertas);
router.get("/mi-stock", directivoController.getMiStock);
router.get("/historial-retiros", directivoController.getHistorialRetiros);
router.get("/distribuciones/pendientes", directivoController.getDistribucionesPendientes);
router.get("/distribuciones/historial", directivoController.getDistribucionesHistorial);
router.post("/distribuciones/:loteId/confirmar-recepcion", largeBodyParser, directivoController.confirmarRecepcion);
router.get("/deposito", directivoController.getDepositoInstitucion);
router.get("/deposito/historial", directivoController.getHistorialConsumos);
router.post("/deposito/consumo", directivoController.registrarConsumo);

module.exports = router;

