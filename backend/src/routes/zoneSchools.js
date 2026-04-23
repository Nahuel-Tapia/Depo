const express = require('express');
const { Zone } = require('../models/zone');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { all, run, get } = require('../db.pg');

router.use(authenticate);

// POST /api/zones/:zoneId/escuelas - Añadir escuelas a una zona (solo director de área, solo escuelas de su nivel)
router.post('/:zoneId/escuelas', async (req, res) => {
  try {
    const { escuelaIds } = req.body; // array de id_institucion
    const zoneId = parseInt(req.params.zoneId, 10);
    if (!Array.isArray(escuelaIds) || escuelaIds.length === 0) {
      return res.status(400).json({ error: 'Debes enviar un array de escuelas.' });
    }
    // Verificar zona
    const zone = await Zone.findByPk(zoneId);
    if (!zone) return res.status(404).json({ error: 'Zona no encontrada.' });
    // Solo director de área creador puede modificar
    if (req.user.role !== 'director_area' || req.user.sub !== zone.director_area_id) {
      return res.status(403).json({ error: 'No autorizado.' });
    }
    // Solo escuelas del nivel de la zona
    const placeholders = escuelaIds.map((_, i) => `$${i + 1}`).join(',');
    const escuelas = await all(
      `SELECT id_institucion, nivel_educativo FROM institucion WHERE id_institucion IN (${placeholders})`,
      escuelaIds
    );
    const soloNivel = escuelas.every(e => e.nivel_educativo === zone.nivel_educativo);
    if (!soloNivel) {
      return res.status(400).json({ error: 'Solo puedes añadir escuelas del mismo nivel que la zona.' });
    }
    // Actualizar institucion.zoneId
    await run(
      `UPDATE institucion SET zoneId = $1 WHERE id_institucion IN (${placeholders})`,
      [zoneId, ...escuelaIds]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al añadir escuelas a la zona', details: err.message });
  }
});

module.exports = router;
