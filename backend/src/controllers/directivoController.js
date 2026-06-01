const directivoService = require("../services/directivoService");

async function getAlertas(req, res) {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    const result = await directivoService.getAlertas(userId);
    return res.json({
      ok: true,
      ...result
    });
  } catch (err) {
    console.error("Error en GET /api/directivo/alertas:", err);
    const status = Number(err?.status || 500);
    return res.status(status).json({ error: err.message || "Error al obtener alertas" });
  }
}

async function getMiStock(req, res) {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    const result = await directivoService.getMiStock(userId);
    return res.json({
      ok: true,
      ...result
    });
  } catch (err) {
    console.error("Error en GET /api/directivo/mi-stock:", err);
    const status = Number(err?.status || 500);
    return res.status(status).json({ error: err.message || "Error al obtener Mi stock" });
  }
}

async function getHistorialRetiros(req, res) {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    const historial = await directivoService.getHistorialRetiros(userId);
    return res.json({ historial });
  } catch (err) {
    console.error("Error en GET /api/directivo/historial-retiros:", err);
    const status = Number(err?.status || 500);
    return res.status(status).json({ error: err.message || "Error al obtener historial de retiros" });
  }
}

async function getDistribucionesPendientes(req, res) {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    const lotes = await directivoService.getDistribucionesPendientes(userId);
    return res.json({ lotes });
  } catch (err) {
    console.error("Error en GET /api/directivo/distribuciones/pendientes:", err);
    const status = Number(err?.status || 500);
    return res.status(status).json({ error: err.message || "No se pudieron obtener distribuciones pendientes" });
  }
}

async function confirmarRecepcion(req, res) {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    const loteId = Number(req.params.loteId);
    const items = Array.isArray(req.body?.items) ? req.body.items : [];

    const result = await directivoService.confirmarRecepcion(userId, loteId, items);
    return res.json({
      ok: true,
      ...result
    });
  } catch (err) {
    console.error("Error confirmando recepción directivo:", err);
    const status = Number(err?.status || 500);
    return res.status(status).json({ error: err.message || "No se pudo registrar la recepción" });
  }
}

async function getDistribucionesHistorial(req, res) {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    const { desde, hasta } = req.query;
    const lotes = await directivoService.getDistribucionesHistorial(userId, { desde, hasta });
    return res.json({ lotes });
  } catch (err) {
    console.error("Error en GET /api/directivo/distribuciones/historial:", err);
    const status = Number(err?.status || 500);
    return res.status(status).json({ error: err.message || "No se pudo obtener el historial de distribuciones" });
  }
}

async function getDepositoInstitucion(req, res) {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ error: 'Usuario no autenticado' });
    const result = await directivoService.getDepositoInstitucion(userId);
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Error en GET /api/directivo/deposito:', err);
    return res.status(Number(err?.status || 500)).json({ error: err.message || 'Error al obtener depósito' });
  }
}

async function getHistorialConsumos(req, res) {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ error: 'Usuario no autenticado' });
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const historial = await directivoService.getHistorialConsumos(userId, { limit });
    return res.json({ historial });
  } catch (err) {
    console.error('Error en GET /api/directivo/deposito/historial:', err);
    return res.status(Number(err?.status || 500)).json({ error: err.message || 'Error al obtener historial' });
  }
}

async function registrarConsumo(req, res) {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ error: 'Usuario no autenticado' });
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const result = await directivoService.registrarConsumo(userId, items);
    return res.json(result);
  } catch (err) {
    console.error('Error en POST /api/directivo/deposito/consumo:', err);
    return res.status(Number(err?.status || 500)).json({ error: err.message || 'Error al registrar consumo' });
  }
}

module.exports = {
  getAlertas,
  getMiStock,
  getHistorialRetiros,
  getDistribucionesPendientes,
  getDistribucionesHistorial,
  confirmarRecepcion,
  getDepositoInstitucion,
  getHistorialConsumos,
  registrarConsumo,
};
