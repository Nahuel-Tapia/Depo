const express = require("express");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");
const depositoController = require("../controllers/depositoController");

const router = express.Router();

router.use(authenticate);

// Vencimientos y Alertas
router.get("/vencimientos-proximos", authorizePermissions(PERMISSIONS.STOCK_VIEW), depositoController.getVencimientosProximos);

// Distribución
router.get("/distribucion/zonas-pendientes", authorizePermissions(PERMISSIONS.STOCK_VIEW), depositoController.getDistribucionZonasPendientes);
router.get("/distribucion/zonas/:id/detalle", authorizePermissions(PERMISSIONS.STOCK_VIEW), depositoController.getDistribucionZonaDetalle);
router.post("/distribucion/egreso-multiple", authorizePermissions(PERMISSIONS.STOCK_MOVEMENT_CREATE), depositoController.registrarEgresoMultipleZona);
router.get("/distribucion/pendientes", authorizePermissions(PERMISSIONS.STOCK_VIEW), depositoController.getPendientesDistribucion);
router.get("/distribucion/pendientes/:id", authorizePermissions(PERMISSIONS.STOCK_VIEW), depositoController.getDetalleDistribucionEscuela);
router.post("/distribucion/registrar-salida", authorizePermissions(PERMISSIONS.STOCK_MOVEMENT_CREATE), depositoController.registrarSalidaDistribucion);

// Licitaciones & Recepciones
router.get("/licitacion/recepciones", authorizePermissions(PERMISSIONS.STOCK_VIEW), depositoController.getRecepcionesLicitacion);
router.get("/licitacion/recepciones/:id", authorizePermissions(PERMISSIONS.STOCK_VIEW), depositoController.getDetalleRecepcion);
router.post("/licitacion/registrar-ingreso", authorizePermissions(PERMISSIONS.STOCK_MOVEMENT_CREATE), depositoController.registrarIngresoLicitacion);
router.post("/licitacion/cerrar/:id", authorizePermissions(PERMISSIONS.STOCK_MOVEMENT_CREATE), depositoController.cerrarLicitacion);
router.post("/licitacion/danio/imagen", authorizePermissions(PERMISSIONS.STOCK_MOVEMENT_CREATE), depositoController.registrarDanioImagen);
router.get("/licitacion/recepciones/:id/remitos", authorizePermissions(PERMISSIONS.STOCK_VIEW), depositoController.getRemitosByLicitacion);
router.get("/licitacion/remito-general/:id", authorizePermissions(PERMISSIONS.STOCK_VIEW), depositoController.getRemitoGeneralLicitacion);

// Diagnóstico y Reconciliación de Stock
router.get("/diagnostico-stock", authorizePermissions(PERMISSIONS.STOCK_VIEW), depositoController.diagnosticoStock);
router.post("/reconciliar-stock", authorizePermissions(PERMISSIONS.STOCK_MOVEMENT_CREATE), depositoController.reconciliarStock);

// Stock & Traslados
router.get("/stock-por-producto", authorizePermissions(PERMISSIONS.STOCK_VIEW), depositoController.getStockPorProducto);
router.post("/mover", authorizePermissions(PERMISSIONS.STOCK_MOVEMENT_CREATE), depositoController.moverStock);
router.get("/traslados", authorizePermissions(PERMISSIONS.STOCK_MOVEMENT_VIEW), depositoController.getTraslados);

// Depósitos y Operaciones Específicas
router.get("/", authorizePermissions(PERMISSIONS.STOCK_VIEW), depositoController.listDepositos);
router.get("/:id/productos", authorizePermissions(PERMISSIONS.STOCK_VIEW), depositoController.getProductosByDeposito);
router.get("/:id/stock", authorizePermissions(PERMISSIONS.STOCK_VIEW), depositoController.getStockByDeposito);
router.post("/:id/ingreso", authorizePermissions(PERMISSIONS.STOCK_MOVEMENT_CREATE), depositoController.registrarIngreso);
router.post("/:id/egreso", authorizePermissions(PERMISSIONS.STOCK_MOVEMENT_CREATE), depositoController.registrarEgreso);

module.exports = router;
