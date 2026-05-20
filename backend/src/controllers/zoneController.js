const zoneService = require("../services/zoneService");

async function createZone(req, res) {
  try {
    const zone = await zoneService.createZone(req.user, req.body || {});
    return res.status(201).json(zone);
  } catch (err) {
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Error al crear zona', details: err.message || err });
  }
}

async function addSchoolsToZone(req, res) {
  try {
    const zoneId = parseInt(req.params.zoneId, 10);
    const { escuelaIds } = req.body || {};
    const result = await zoneService.addSchoolsToZone(req.user, zoneId, escuelaIds);
    return res.json(result);
  } catch (err) {
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Error al añadir escuelas a la zona', details: err.message || err });
  }
}

async function assignSupervisorsToZone(req, res) {
  try {
    const zoneId = parseInt(req.params.zoneId, 10);
    const { supervisorIds } = req.body || {};
    const result = await zoneService.assignSupervisorsToZone(req.user, zoneId, supervisorIds);
    return res.json(result);
  } catch (err) {
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Error al asignar supervisores a la zona', details: err.message || err });
  }
}

module.exports = {
  createZone,
  addSchoolsToZone,
  assignSupervisorsToZone
};
