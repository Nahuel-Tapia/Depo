const express = require("express");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");
const pedidoController = require("../controllers/pedidoController");

const router = express.Router();
router.use(authenticate);

router.get("/kits", authorizePermissions(PERMISSIONS.PEDIDOS_VIEW), pedidoController.listarKits);
router.post("/kits", authorizePermissions(PERMISSIONS.PEDIDOS_VIEW), pedidoController.requireKitManager, pedidoController.createKit);
router.put("/kits/:id(\\d+)", authorizePermissions(PERMISSIONS.PEDIDOS_VIEW), pedidoController.requireKitManager, pedidoController.updateKit);
router.delete("/kits/:id(\\d+)", authorizePermissions(PERMISSIONS.PEDIDOS_VIEW), pedidoController.requireKitManager, pedidoController.deleteKit);

router.get("/", authorizePermissions(PERMISSIONS.PEDIDOS_VIEW), pedidoController.listarPedidos);
router.get("/cupos-anuales", authorizePermissions(PERMISSIONS.PEDIDOS_VIEW), pedidoController.getCuposAnuales);
router.get("/institucion/:institucion", authorizePermissions(PERMISSIONS.PEDIDOS_MANAGE), pedidoController.getHistorialInstitucion);
router.get("/:id(\\d+)", authorizePermissions(PERMISSIONS.PEDIDOS_VIEW), pedidoController.getPedidoById);

router.post("/", authorizePermissions(PERMISSIONS.PEDIDOS_CREATE), pedidoController.createPedido);
router.patch("/:id/estado", authorizePermissions(PERMISSIONS.PEDIDOS_MANAGE), pedidoController.updateEstadoPedido);
router.patch("/:id/cancelar", authorizePermissions(PERMISSIONS.PEDIDOS_CREATE), pedidoController.cancelarPedido);
router.patch("/:id/aprobar-director", authorizePermissions(PERMISSIONS.SUPERVISION_MANAGE), pedidoController.aprobarDirector);

module.exports = router;
