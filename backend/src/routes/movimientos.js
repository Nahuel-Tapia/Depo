const express = require("express");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");
const movimientoController = require("../controllers/movimientoController");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadsDir = path.resolve(__dirname, '..', '..', '..', 'uploads');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  }
});
const upload = multer({ storage });

const router = express.Router();

router.use(authenticate);

// Listar movimientos
router.get("/", authorizePermissions(PERMISSIONS.MOVIMIENTOS_VIEW), movimientoController.listarMovimientos);

// Estadísticas de movimientos
router.get("/stats/resumen", authorizePermissions(PERMISSIONS.MOVIMIENTOS_VIEW), movimientoController.obtenerStatsResumen);

// Listar bajas registradas
router.get("/bajas", authorizePermissions(PERMISSIONS.MOVIMIENTOS_VIEW), movimientoController.listarBajas);

// Obtener un movimiento
// Only match numeric ids to avoid colliding with named routes like `/bajas`
router.get("/:id(\\d+)", authorizePermissions(PERMISSIONS.MOVIMIENTOS_VIEW), movimientoController.obtenerMovimiento);

// Crear movimiento
router.post("/", authorizePermissions(PERMISSIONS.MOVIMIENTOS_CREATE), movimientoController.crearMovimiento);

// Crear lote de movimientos
router.post("/lote", authorizePermissions(PERMISSIONS.MOVIMIENTOS_CREATE), movimientoController.crearLoteMovimientos);

// Crear movimiento directo (egreso/ingreso)
router.post("/directo", authorizePermissions(PERMISSIONS.MOVIMIENTOS_CREATE), movimientoController.crearMovimientoDirecto);

// Registrar baja por daño (subir foto opcional)
router.post("/baja", authorizePermissions(PERMISSIONS.MOVIMIENTOS_CREATE), upload.single('foto'), movimientoController.registrarBaja);

// Autorizar baja
router.post("/bajas/:id(\\d+)/autorizar", authorizePermissions(PERMISSIONS.BAJAS_AUTHORIZE), movimientoController.autorizarBaja);

// Historial de baja
router.get("/bajas/:id(\\d+)/historial", authorizePermissions(PERMISSIONS.MOVIMIENTOS_VIEW), movimientoController.obtenerHistorialBaja);

module.exports = router;
