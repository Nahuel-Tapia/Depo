const fs = require('fs');

const original = fs.readFileSync('backend/src/routes/pedidos.js', 'utf8');

const helpersEndIdx = original.indexOf('function canManageKits(req) {');
let helpersCode = original.substring(0, helpersEndIdx);

const startIdx = helpersCode.indexOf('const ESCUELA_TIPOS');
helpersCode = helpersCode.substring(startIdx);

const serviceLogic = fs.readFileSync('serviceLogic.js', 'utf8');

const serviceFile = 'const { all, get, run, pool } = require("../db.pg");\n\n' + helpersCode + '\n' + serviceLogic;

const controllerFile = `const pedidoService = require('../services/pedidoService');
const { isAdminLikeRole } = require("../middleware/auth");

function canManageKits(req) {
  return req.user?.role === "admin" || req.user?.role === "master" || req.user?.role === "director_area";
}

function requireKitManager(req, res, next) {
  if (!canManageKits(req)) {
    return res.status(403).json({ error: "No tenés permiso para gestionar kits." });
  }
  return next();
}

async function listarKits(req, res) {
  try {
    const includeInactive = canManageKits(req) && String(req.query.include_inactive || "") === "1";
    const kits = await pedidoService.listarKits(req.user, includeInactive);
    return res.json({ kits });
  } catch (err) {
    console.error("Error al listar kits:", err);
    return res.status(500).json({ error: "No se pudieron listar los kits" });
  }
}

async function createKit(req, res) {
  try {
    const kit = await pedidoService.createKit(req.body, req.user.sub);
    return res.status(201).json({ kit });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al crear kit:", err);
    return res.status(500).json({ error: "No se pudo crear el kit" });
  }
}

async function updateKit(req, res) {
  try {
    const kit = await pedidoService.updateKit(Number(req.params.id), req.body);
    return res.json({ kit });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al actualizar kit:", err);
    return res.status(500).json({ error: "No se pudo actualizar el kit" });
  }
}

async function deleteKit(req, res) {
  try {
    await pedidoService.deleteKit(Number(req.params.id));
    return res.json({ ok: true });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al eliminar kit:", err);
    return res.status(500).json({ error: "No se pudo eliminar el kit" });
  }
}

async function listarPedidos(req, res) {
  try {
    const pedidos = await pedidoService.listarPedidos(req.user);
    return res.json({ pedidos });
  } catch (err) {
    console.error("Error al listar pedidos:", err);
    return res.status(500).json({ error: "No se pudo listar pedidos" });
  }
}

async function getCuposAnuales(req, res) {
  try {
    const result = await pedidoService.getCuposAnuales(req.user, req.query.institucion_id, req.query.anio);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al obtener cupos anuales:", err);
    return res.status(500).json({ error: "No se pudieron obtener cupos anuales" });
  }
}

async function getHistorialInstitucion(req, res) {
  try {
    const pedidos = await pedidoService.getHistorialInstitucion(req.params.institucion, req.user);
    return res.json({ pedidos });
  } catch (err) {
    console.error("Error al obtener historial:", err);
    return res.status(500).json({ error: "No se pudo obtener historial" });
  }
}

async function getPedidoById(req, res) {
  try {
    const pedido = await pedidoService.getPedidoById(req.params.id, req.user);
    return res.json({ pedido });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al obtener pedido:", err);
    return res.status(500).json({ error: "No se pudo obtener pedido" });
  }
}

async function createPedido(req, res) {
  try {
    const result = await pedidoService.createPedido(req.body, req.user);
    return res.status(201).json(result);
  } catch (err) {
    if (err.status) {
      if (err.detalle) return res.status(err.status).json({ error: err.message, detalle: err.detalle });
      return res.status(err.status).json({ error: err.message });
    }
    console.error("Error al crear pedido:", err && err.stack ? err.stack : err, "user:", req.user && req.user.sub, "body:", req.body);
    return res.status(500).json({ error: "No se pudo crear pedido" });
  }
}

async function updateEstadoPedido(req, res) {
  try {
    const result = await pedidoService.updateEstadoPedido(req.params.id, req.body, req.user);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al actualizar pedido:", err);
    return res.status(500).json({ error: "No se pudo actualizar pedido" });
  }
}

async function cancelarPedido(req, res) {
  try {
    const result = await pedidoService.cancelarPedido(req.params.id, req.user);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al cancelar pedido:", err);
    return res.status(500).json({ error: "No se pudo cancelar pedido" });
  }
}

async function aprobarDirector(req, res) {
  try {
    if (req.user.role !== "director_area" && !isAdminLikeRole(req.user.role)) {
      return res.status(403).json({ error: "Solo el Director de Área puede realizar esta aprobación." });
    }
    const result = await pedidoService.aprobarDirector(req.params.id, req.body, req.user);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al aprobar director:", err);
    return res.status(500).json({ error: "No se pudo procesar la aprobación del director." });
  }
}

module.exports = {
  requireKitManager,
  listarKits,
  createKit,
  updateKit,
  deleteKit,
  listarPedidos,
  getCuposAnuales,
  getHistorialInstitucion,
  getPedidoById,
  createPedido,
  updateEstadoPedido,
  cancelarPedido,
  aprobarDirector
};
`;

const routeFile = `const express = require("express");
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
`;

const fs2 = require('fs');
fs2.mkdirSync('backend/src/services', { recursive: true });
fs2.mkdirSync('backend/src/controllers', { recursive: true });

fs2.writeFileSync('backend/src/services/pedidoService.js', serviceFile);
fs2.writeFileSync('backend/src/controllers/pedidoController.js', controllerFile);
fs2.writeFileSync('backend/src/routes/pedidos.js', routeFile);

console.log('Success');
