const express = require('express');
const { Zone } = require('../models/zone');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { all, run, get } = require('../db.pg');

router.use(authenticate);

// POST /api/zones/:zoneId/supervisores - Asignar supervisores a una zona (solo director de área, solo supervisores de su nivel)
router.post('/:zoneId/supervisores', async (req, res) => {
  try {
    const { supervisorIds } = req.body; // array de id_usuario
    const zoneId = parseInt(req.params.zoneId, 10);
    if (!Array.isArray(supervisorIds) || supervisorIds.length === 0) {
      return res.status(400).json({ error: 'Debes enviar un array de supervisores.' });
    }
    // Verificar zona
    const zone = await Zone.findByPk(zoneId);
    if (!zone) return res.status(404).json({ error: 'Zona no encontrada.' });
    // Solo director de área creador puede modificar
    if (req.user.role !== 'director_area' || req.user.sub !== zone.director_area_id) {
      return res.status(403).json({ error: 'No autorizado.' });
    }
    // Solo supervisores del mismo nivel
    const placeholders = supervisorIds.map((_, i) => `$${i + 1}`).join(',');
    const supervisores = await all(
      `SELECT id_usuario, role, nivel_educativo FROM usuario WHERE id_usuario IN (${placeholders})`,
      supervisorIds
    );
    const soloSupervisores = supervisores.every(s => s.role === 'supervisor' && s.nivel_educativo === zone.nivel_educativo);
    if (!soloSupervisores) {
      return res.status(400).json({ error: 'Solo puedes asignar supervisores de tu nivel y rol.' });
    }
    // Insertar en tabla ZoneSupervisors (crear si no existe)
    await run(
      `CREATE TABLE IF NOT EXISTS "ZoneSupervisors" (
        zoneId INT REFERENCES "Zones"(id) ON DELETE CASCADE,
        supervisorId INT REFERENCES usuario(id_usuario) ON DELETE CASCADE,
        createdAt TIMESTAMP DEFAULT NOW(),
        updatedAt TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (zoneId, supervisorId)
      )`
    );
    for (const s of supervisorIds) {
      await run(
        `INSERT INTO "ZoneSupervisors" (zoneId, supervisorId, createdAt, updatedAt)
         VALUES ($1, $2, NOW(), NOW())
         ON CONFLICT (zoneId, supervisorId) DO NOTHING`,
        [zoneId, s]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al asignar supervisores a la zona', details: err.message });
  }
});

module.exports = router;
