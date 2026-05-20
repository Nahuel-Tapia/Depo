const ajustesService = require("../services/ajustesService");

async function listAjustes(req, res) {
  try {
    const { producto_id, limit, offset } = req.query || {};
    const ajustes = await ajustesService.listAjustes({ producto_id, limit, offset });
    return res.json({ ajustes });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo listar ajustes" });
  }
}

async function getAjuste(req, res) {
  try {
    const { id } = req.params;
    const ajuste = await ajustesService.getAjusteById(id);
    return res.json({ ajuste });
  } catch (err) {
    console.error(err);
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: "No se pudo obtener el ajuste" });
  }
}

async function createAjuste(req, res) {
  try {
    const result = await ajustesService.createAjuste(req.user.sub, req.body || {});
    return res.status(201).json(result);
  } catch (err) {
    console.error(err);
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: "No se pudo crear el ajuste" });
  }
}

module.exports = {
  listAjustes,
  getAjuste,
  createAjuste
};
