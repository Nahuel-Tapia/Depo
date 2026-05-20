const pedidoService = require('../services/pedidoService');
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
