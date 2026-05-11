const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { all, run, get } = require('../db.pg');

router.use(authenticate);

// POST /api/zones/:zoneId/supervisores - Asignar supervisores a una zona (solo director de área, solo supervisores de su nivel)
router.post('/:zoneId/supervisores', async (req, res) => {
  try {
    const { supervisorIds } = req.body;
    const zoneId = parseInt(req.params.zoneId, 10);
    if (!Array.isArray(supervisorIds) || supervisorIds.length === 0) {
      return res.status(400).json({ error: 'Debes enviar un array de supervisores.' });
    }
    const zone = await get('SELECT id, nivel_educativo, director_area_id FROM zona WHERE id = $1', [zoneId]);
    if (!zone) return res.status(404).json({ error: 'Zona no encontrada.' });
    if (req.user.role !== 'director_area' || req.user.sub !== zone.director_area_id) {
      return res.status(403).json({ error: 'No autorizado.' });
    }
    const placeholders = supervisorIds.map((_, i) => `$${i + 1}`).join(',');
    const supervisores = await all(
      `SELECT id_usuario, role, nivel_educativo FROM usuario WHERE id_usuario IN (${placeholders})`,
      supervisorIds
    );
    const soloSupervisores = supervisores.every(s => s.role === 'supervisor' && s.nivel_educativo === zone.nivel_educativo);
    if (!soloSupervisores) {
      return res.status(400).json({ error: 'Solo puedes asignar supervisores de tu nivel y rol.' });
    }
    await run('DELETE FROM zona_supervisor WHERE zona_id = $1', [zoneId]);
    for (const s of supervisorIds) {
      await run(
        `INSERT INTO zona_supervisor (zona_id, supervisor_id, created_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
        [zoneId, s]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al asignar supervisores a la zona', details: err.message });
  }
});

module.exports = router;

