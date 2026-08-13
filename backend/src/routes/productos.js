const express = require("express");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");
const productoController = require("../controllers/productoController");

const router = express.Router();

router.use(authenticate);

// Listar productos (con ubicación de depósito)
router.get("/", authorizePermissions(PERMISSIONS.PRODUCTOS_VIEW), productoController.listarProductos);

// Listar categorías (para dropdown)
router.get("/categorias", authorizePermissions(PERMISSIONS.PRODUCTOS_VIEW), productoController.listarCategorias);

// Alias para kits de productos
router.get("/kits/all", authorizePermissions(PERMISSIONS.PRODUCTOS_VIEW), require("../controllers/pedidoController").listarKits);

// Obtener un producto
router.get("/:id", authorizePermissions(PERMISSIONS.PRODUCTOS_VIEW), productoController.obtenerProducto);

// Obtener detalle de stock y vencimientos de un producto
router.get("/:id/stock-detalle", authorizePermissions(PERMISSIONS.PRODUCTOS_VIEW), productoController.obtenerProductoStockDetalle);

// Crear producto
router.post("/", authorizePermissions(PERMISSIONS.PRODUCTOS_CREATE), productoController.crearProducto);

// Importar productos masivamente
router.post("/bulk", authorizePermissions(PERMISSIONS.PRODUCTOS_CREATE), productoController.importarProductos);

// Editar producto
router.patch("/:id", authorizePermissions(PERMISSIONS.PRODUCTOS_EDIT), productoController.editarProducto);

// Eliminar producto
router.delete("/:id", authorizePermissions(PERMISSIONS.PRODUCTOS_DELETE), productoController.eliminarProducto);

module.exports = router;
