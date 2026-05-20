const dashboardService = require("../services/dashboardService");

async function obtenerStats(req, res) {
  try {
    const stats = await dashboardService.getDashboardStats(req.user);
    return res.json(stats);
  } catch (err) {
    console.error("Error obteniendo stats del dashboard:", err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || "No se pudo obtener el resumen" });
  }
}

async function obtenerMovimientosMes(req, res) {
  try {
    const movimientos = await dashboardService.getMovimientosMes(req.query);
    return res.json({ movimientos });
  } catch (err) {
    console.error("Error obteniendo movimientos del mes:", err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || "No se pudo obtener los movimientos" });
  }
}

module.exports = {
  obtenerStats,
  obtenerMovimientosMes
};
