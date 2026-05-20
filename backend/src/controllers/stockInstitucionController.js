const stockInstitucionService = require("../services/stockInstitucionService");

async function getStock(req, res) {
  try {
    const stock = await stockInstitucionService.getStockByUserId(req.user.sub);
    return res.json({ stock });
  } catch (err) {
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: "Error al cargar stock" });
  }
}

async function registrarConsumo(req, res) {
  try {
    const { producto_id, cantidad, motivo } = req.body || {};
    const result = await stockInstitucionService.registrarConsumo(req.user.sub, producto_id, cantidad, motivo);
    return res.json(result);
  } catch (err) {
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: "Error al registrar consumo" });
  }
}

async function getNotificaciones(req, res) {
  try {
    const notificaciones = await stockInstitucionService.getNotificaciones(req.user.sub);
    return res.json({ notificaciones });
  } catch (err) {
    return res.status(500).json({ error: "Error al cargar notificaciones" });
  }
}

async function leerNotificacion(req, res) {
  try {
    const result = await stockInstitucionService.leerNotificacion(req.params.id, req.user.sub);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: "Error" });
  }
}

module.exports = {
  getStock,
  registrarConsumo,
  getNotificaciones,
  leerNotificacion
};
