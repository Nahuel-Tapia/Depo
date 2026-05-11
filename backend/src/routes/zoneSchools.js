const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { all, run, get } = require('../db.pg');

router.use(authenticate);

// POST /api/zones/:zoneId/escuelas - Añadir escuelas a una zona (solo director de área, solo escuelas de su nivel)
router.post('/:zoneId/escuelas', async (req, res) => {
  try {
    const { escuelaIds } = req.body;
    const zoneId = parseInt(req.params.zoneId, 10);
    if (!Array.isArray(escuelaIds) || escuelaIds.length === 0) {
      return res.status(400).json({ error: 'Debes enviar un array de escuelas.' });
    }
    const zone = await get('SELECT id, nivel_educativo, director_area_id FROM zona WHERE id = $1', [zoneId]);
    if (!zone) return res.status(404).json({ error: 'Zona no encontrada.' });
    if (req.user.role !== 'director_area' || req.user.sub !== zone.director_area_id) {
      return res.status(403).json({ error: 'No autorizado.' });
    }
    const placeholders = escuelaIds.map((_, i) => `$${i + 1}`).join(',');
    const escuelas = await all(
      `SELECT id_institucion, nivel_educativo FROM institucion WHERE id_institucion IN (${placeholders})`,
      escuelaIds
    );
    const soloNivel = escuelas.every(e => e.nivel_educativo === zone.nivel_educativo);
    if (!soloNivel) {
      return res.status(400).json({ error: 'Solo puedes añadir escuelas del mismo nivel que la zona.' });
    }
    await run('DELETE FROM zona_institucion WHERE zona_id = $1', [zoneId]);
    for (const escuelaId of escuelaIds) {
      await run(
        `INSERT INTO zona_institucion (zona_id, institucion_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [zoneId, escuelaId]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al añadir escuelas a la zona', details: err.message });
  }
});

module.exports = router;

