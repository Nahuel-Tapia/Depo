const supervisorService = require("../services/supervisorService");

async function getInstituciones(req, res) {
  try {
    const result = await supervisorService.getInstituciones(req.user, req.query.jurisdiccion);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al obtener instituciones del supervisor:", err);
    return res.status(500).json({ error: "Error interno del servidor", details: err.message });
  }
}

async function getDashboardStats(req, res) {
  try {
    const result = await supervisorService.getDashboardStats(req.user);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al obtener stats del dashboard del supervisor:", err);
    return res.status(500).json({ error: "No se pudo obtener el resumen", details: err.message });
  }
}

async function updateInstitucionKit(req, res) {
  try {
    const institucionId = Number(req.params.id);
    const kitId = Number(req.body?.kit_id);
    const result = await supervisorService.updateInstitucionKit(req.user, institucionId, kitId);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al actualizar kit de la institución:", err);
    return res.status(500).json({ error: "No se pudo actualizar el kit." });
  }
}

async function getPedidosPendientes(req, res) {
  try {
    const result = await supervisorService.getPedidosPendientes(req.user, req.query.jurisdiccion);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al obtener pedidos pendientes del supervisor:", err);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}

async function getSolicitudes(req, res) {
  try {
    const result = await supervisorService.getSolicitudes(req.user, req.query.jurisdiccion);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al obtener solicitudes del supervisor:", err);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}

async function getHistorialInstitucion(req, res) {
  try {
    const result = await supervisorService.getHistorialInstitucion(req.params.id, req.user);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al obtener historial de institución:", err);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}

async function getHistorialConsumo(req, res) {
  try {
    const institucionId = Number(req.params.id);
    if (!Number.isInteger(institucionId) || institucionId <= 0) {
      return res.status(400).json({ error: "Institución inválida" });
    }
    const result = await supervisorService.getHistorialConsumoInstitucion(institucionId, req.user);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al obtener historial de consumo:", err);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}

module.exports = {
  getInstituciones,
  getDashboardStats,
  updateInstitucionKit,
  getPedidosPendientes,
  getSolicitudes,
  getHistorialInstitucion,
  getHistorialConsumo
};
