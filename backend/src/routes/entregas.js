const express = require("express");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");
const entregaController = require("../controllers/entregaController");

const router = express.Router();
router.use(authenticate);

// GET /api/entregas/pedidos-disponibles - Obtener pedidos anuales aprobados disponibles para retirar
router.get(
  "/pedidos-disponibles",
  authorizePermissions(PERMISSIONS.MOVIMIENTOS_CREATE),
  entregaController.listarPedidosDisponibles
);

// GET /api/entregas/solicitudes/productos-disponibles - Obtener productos disponibles para retirar (rol directivo)
router.get(
  "/solicitudes/productos-disponibles",
  authorizePermissions(PERMISSIONS.PEDIDOS_CREATE),
  entregaController.getProductosDisponiblesRetiro
);

// GET /api/entregas/solicitudes/mis - Obtener solicitudes propias (rol directivo)
router.get(
  "/solicitudes/mis",
  authorizePermissions(PERMISSIONS.PEDIDOS_VIEW),
  entregaController.listarMisSolicitudesRetiro
);

// POST /api/entregas/solicitudes - Crear una nueva solicitud de retiro (rol directivo)
router.post(
  "/solicitudes",
  authorizePermissions(PERMISSIONS.PEDIDOS_CREATE),
  entregaController.createSolicitudRetiro
);

// GET /api/entregas/solicitudes-envio/departamentos - Listado consolidado de solicitudes de envío por departamento
router.get(
  "/solicitudes-envio/departamentos",
  authorizePermissions(PERMISSIONS.MOVIMIENTOS_CREATE),
  entregaController.listarSolicitudesEnvioDepartamentos
);

// GET /api/entregas/solicitudes-envio/departamentos/:departamento/detalle - Detalle e instituciones de un departamento con envío
router.get(
  "/solicitudes-envio/departamentos/:departamento/detalle",
  authorizePermissions(PERMISSIONS.MOVIMIENTOS_CREATE),
  entregaController.getDetalleSolicitudesEnvioDepartamento
);

// POST /api/entregas/solicitudes-envio/egreso-multiple - Egreso de stock y creación de lote en tránsito para envío por departamento
router.post(
  "/solicitudes-envio/egreso-multiple",
  authorizePermissions(PERMISSIONS.MOVIMIENTOS_CREATE),
  entregaController.registrarEgresoMultipleEnvio
);

// GET /api/entregas/solicitudes-envio/seguimiento - Historial y seguimiento de lotes de distribución
router.get(
  "/solicitudes-envio/seguimiento",
  authorizePermissions(PERMISSIONS.MOVIMIENTOS_CREATE),
  entregaController.listarSeguimientoEnvios
);

// GET /api/entregas/solicitudes-envio/seguimiento/:loteId - Detalle de un lote de distribución con recepción por escuela
router.get(
  "/solicitudes-envio/seguimiento/:loteId",
  authorizePermissions(PERMISSIONS.MOVIMIENTOS_CREATE),
  entregaController.getDetalleSeguimientoLote
);

// PATCH /api/entregas/solicitudes/:id/aceptar - Aceptar solicitud de retiro (pasa a aceptada)
router.patch(
  "/solicitudes/:id/aceptar",
  authorizePermissions(PERMISSIONS.MOVIMIENTOS_CREATE),
  entregaController.aceptarSolicitudRetiro
);

// GET /api/entregas/solicitudes/pendientes - Obtener solicitudes pendientes o aceptadas
router.get(
  "/solicitudes/pendientes",
  authorizePermissions(PERMISSIONS.MOVIMIENTOS_CREATE),
  entregaController.listarSolicitudesPendientes
);

// GET /api/entregas/solicitudes/entregadas - Obtener historial de solicitudes entregadas
router.get(
  "/solicitudes/entregadas",
  authorizePermissions(PERMISSIONS.PEDIDOS_VIEW),
  entregaController.listarSolicitudesEntregadas
);

// GET /api/entregas/solicitudes/:id/comprobante - Obtener comprobante de una solicitud
router.get(
  "/solicitudes/:id/comprobante",
  authorizePermissions(PERMISSIONS.PEDIDOS_VIEW),
  entregaController.getComprobanteRetiro
);

// POST /api/entregas/solicitudes/:id/entregar - Entregar solicitud de retiro (egreso de stock central)
router.post(
  "/solicitudes/:id/entregar",
  authorizePermissions(PERMISSIONS.MOVIMIENTOS_CREATE),
  entregaController.entregarSolicitudRetiro
);

// POST /api/entregas/retirar - Registrar entrega directa (sin solicitud previa)
router.post(
  "/retirar",
  authorizePermissions(PERMISSIONS.MOVIMIENTOS_CREATE),
  entregaController.retirarPedido
);

// GET /api/entregas/historial/:id_pedido - Historial de entregas de un pedido
router.get(
  "/historial/:id_pedido",
  authorizePermissions(PERMISSIONS.PEDIDOS_VIEW),
  entregaController.getHistorialEntregasPedido
);

module.exports = router;
