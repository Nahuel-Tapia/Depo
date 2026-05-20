const compraService = require("../services/compraService");

async function listarPlanillas(req, res) {
  try {
    const planillas = await compraService.listarPlanillas(req.user, req.query);
    res.json({ planillas });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al listar planillas:", err);
    res.status(500).json({ error: "No se pudieron listar planillas" });
  }
}

async function getPlanillaById(req, res) {
  try {
    const result = await compraService.getPlanillaById(Number(req.params.id), req.user);
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al obtener planilla:", err);
    res.status(500).json({ error: "No se pudo obtener la planilla" });
  }
}

async function createPlanilla(req, res) {
  try {
    const result = await compraService.createPlanilla(req.user, req.body, req.query);
    res.status(201).json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al crear planilla:", err);
    res.status(500).json({ error: "No se pudo crear la planilla" });
  }
}

async function enviarPlanilla(req, res) {
  try {
    const result = await compraService.enviarPlanilla(Number(req.params.id), req.user);
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al enviar planilla:", err);
    res.status(500).json({ error: "No se pudo enviar la planilla" });
  }
}

async function aceptarPlanilla(req, res) {
  try {
    const result = await compraService.aceptarPlanilla(Number(req.params.id), req.user);
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al aceptar planilla:", err);
    res.status(500).json({ error: "No se pudo aceptar la planilla" });
  }
}

async function devolverPlanilla(req, res) {
  try {
    const result = await compraService.devolverPlanilla(Number(req.params.id), req.body?.motivo);
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al devolver planilla:", err);
    res.status(500).json({ error: err.message || "No se pudo devolver la planilla" });
  }
}

async function deletePlanilla(req, res) {
  try {
    const result = await compraService.deletePlanilla(Number(req.params.id), req.user);
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al eliminar planilla:", err);
    res.status(500).json({ error: "No se pudo eliminar la planilla" });
  }
}

async function getLicitacionConsolidado(req, res) {
  try {
    const anio = Number(req.query.anio || new Date().getFullYear());
    const directorAreaId = Number(req.query.director_area_id || 0) || null;
    const { nivel = "", estado = "" } = req.query;
    const items = await compraService.getConsolidado({ anio, directorAreaId, nivel, estado });
    res.json({ anio, items });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al generar consolidado de licitación:", err);
    res.status(500).json({ error: "No se pudo generar el listado final" });
  }
}

async function getLicitacionAnualConsolidado(req, res) {
  try {
    const anio = Number(req.query.anio || new Date().getFullYear());
    const items = await compraService.getConsolidadoRealTime({ anio });
    res.json({ anio, items });
  } catch (err) {
    console.error("[ERROR] Licitación Consolidado Real-Time:", err);
    res.status(500).json({ error: err.message || "No se pudo generar el consolidado" });
  }
}

async function getLicitacionAnualEstadoDirectores(req, res) {
  try {
    const anio = Number(req.query.anio || new Date().getFullYear());
    const directores = await compraService.getEstadoDirectores({ anio });
    res.json({ anio, directores });
  } catch (err) {
    console.error("[ERROR] Licitación Estado Directores:", err);
    res.status(500).json({ error: err.message || "No se pudo obtener el estado de los directores" });
  }
}

async function getEnviadaStatus(req, res) {
  try {
    const result = await compraService.getEnviadaStatus(req.user, req.query);
    res.json(result);
  } catch (err) {
    console.error("Error al obtener estado de envío:", err);
    res.status(500).json({ error: "No se pudo obtener el estado de envío" });
  }
}

async function getEscuelasPendientes(req, res) {
  try {
    const result = await compraService.getEscuelasPendientes(req.user, req.query);
    res.json(result);
  } catch (err) {
    console.error("Error al obtener escuelas pendientes:", err);
    res.status(500).json({ error: "No se pudieron obtener las escuelas pendientes" });
  }
}

async function enviarLicitacionFinal(req, res) {
  try {
    const result = await compraService.enviarLicitacionFinal(req.user, req.body, req.query);
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al enviar a compras:", err);
    res.status(400).json({ error: err.message });
  }
}

async function getFinalItems(req, res) {
  try {
    const anio = Number(req.query.anio || new Date().getFullYear());
    const result = await compraService.getFinalItems(anio);
    res.json(result);
  } catch (err) {
    console.error("Error al obtener items finales:", err);
    res.status(500).json({ error: "No se pudieron obtener los items finales" });
  }
}

async function publicarLicitacion(req, res) {
  try {
    const result = await compraService.publicarLicitacion(req.user, req.body);
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al publicar licitación:", err);
    res.status(500).json({ error: "No se pudo publicar la licitación" });
  }
}

async function reabrirLicitacion(req, res) {
  try {
    const result = await compraService.reabrirLicitacion(Number(req.params.id));
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al reabrir licitación:", err);
    res.status(500).json({ error: err.message || "No se pudo reabrir la licitación" });
  }
}

async function getPublicadaStatus(req, res) {
  try {
    const result = await compraService.getPublicadaStatus(req.query);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener estado de publicación" });
  }
}

async function getRefuerzosPendientesLicitacion(req, res) {
  try {
    const anio = Number(req.query.anio || new Date().getFullYear());
    const result = await compraService.getRefuerzosPendientesLicitacion(anio);
    res.json(result);
  } catch (err) {
    console.error('Error al obtener refuerzos pendientes de licitación:', err);
    res.status(500).json({ error: 'No se pudieron obtener los refuerzos pendientes de licitación' });
  }
}

async function getLicitacionesCerradas(req, res) {
  try {
    const anio = req.query?.anio ? Number(req.query.anio) : null;
    const rows = await compraService.buildLicitacionHistoryRows({ anio });
    res.json({ licitaciones: rows.filter((row) => ['adjudicada', 'en_deposito', 'completada'].includes(row.estado)) });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener licitaciones cerradas" });
  }
}

async function getAdjudicacionHistorial(req, res) {
  try {
    const anio = req.query?.anio ? Number(req.query.anio) : null;
    const licitaciones = await compraService.buildLicitacionHistoryRows({ anio });
    res.json({ licitaciones });
  } catch (err) {
    console.error('Error al obtener historial de adjudicaciones:', err);
    res.status(500).json({ error: 'No se pudo obtener el historial de adjudicaciones' });
  }
}

async function enviarADeposito(req, res) {
  try {
    const result = await compraService.enviarADeposito(req.body?.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "No se pudo enviar a depósito" });
  }
}

async function getAdjudicacion(req, res) {
  try {
    const result = await compraService.getAdjudicacion(req.query);
    res.json(result);
  } catch (err) {
    console.error("Error al cargar adjudicación:", err);
    res.status(500).json({ error: "No se pudo cargar la adjudicación" });
  }
}

async function adjudicar(req, res) {
  try {
    const result = await compraService.adjudicar(req.body);
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al guardar adjudicación:", err);
    res.status(400).json({ error: err.message || "No se pudo guardar la adjudicación" });
  }
}

module.exports = {
  listarPlanillas,
  getPlanillaById,
  createPlanilla,
  enviarPlanilla,
  aceptarPlanilla,
  devolverPlanilla,
  deletePlanilla,
  getLicitacionConsolidado,
  getLicitacionAnualConsolidado,
  getLicitacionAnualEstadoDirectores,
  getEnviadaStatus,
  getEscuelasPendientes,
  enviarLicitacionFinal,
  getFinalItems,
  getLicitacionesCerradas,
  getAdjudicacionHistorial,
  enviarADeposito,
  getAdjudicacion,
  adjudicar,
  publicarLicitacion,
  reabrirLicitacion,
  getPublicadaStatus,
  getRefuerzosPendientesLicitacion
};
