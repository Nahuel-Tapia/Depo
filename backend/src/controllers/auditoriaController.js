const auditoriaService = require("../services/auditoriaService");

async function listAuditoria(req, res) {
  try {
    const { usuario_id, entidad, accion, limit, offset } = req.query || {};
    const registros = await auditoriaService.listAuditoria({ usuario_id, entidad, accion, limit, offset });
    return res.json({ registros });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo listar auditoría" });
  }
}

async function getAuditoria(req, res) {
  try {
    const { id } = req.params;
    const registro = await auditoriaService.getAuditoriaById(id);
    return res.json({ registro });
  } catch (err) {
    console.error(err);
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: "No se pudo obtener el registro" });
  }
}

async function listAuditoriaByUsuario(req, res) {
  try {
    const { usuario_id } = req.params;
    const { limit, offset } = req.query || {};
    const registros = await auditoriaService.listAuditoriaByUsuario(usuario_id, { limit, offset });
    return res.json({ registros });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo listar auditoría por usuario" });
  }
}

async function getStatsResumen(req, res) {
  try {
    const { fecha_desde, fecha_hasta } = req.query || {};
    const resumen = await auditoriaService.getAuditoriaStatsResumen({ fecha_desde, fecha_hasta });
    return res.json({ resumen });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo obtener el resumen" });
  }
}

module.exports = {
  listAuditoria,
  getAuditoria,
  listAuditoriaByUsuario,
  getStatsResumen
};
