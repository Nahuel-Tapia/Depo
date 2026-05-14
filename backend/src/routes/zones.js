const express = require('express');
const { run, get } = require('../db.pg');
const router = express.Router();

const { authenticate, isAdminLikeRole } = require('../middleware/auth');
router.use(authenticate);

// POST /api/zones - Crear zona (solo director de área)
router.post('/', async (req, res) => {
  try {
    const { name, nivel_educativo } = req.body;
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'director_area' && !isAdminLikeRole(req.user?.role)) {
      return res.status(403).json({ error: 'Solo el director de área puede crear zonas.' });
    }
    if (!name || !nivel_educativo) {
      return res.status(400).json({ error: 'Faltan datos requeridos.' });
    }
    if (role === 'director_area' && req.user.nivel_educativo && req.user.nivel_educativo !== nivel_educativo) {
      return res.status(403).json({ error: 'Solo puede crear zonas de su nivel asignado.' });
    }

    let directorAreaId = null;
    if (role === 'director_area') {
      directorAreaId = Number(req.user.sub);
    } else if (isAdminLikeRole(req.user?.role)) {
      const pick = Number(req.body?.director_area_id || 0);
      if (Number.isInteger(pick) && pick > 0) {
        const row = await get(
          `SELECT id_usuario FROM usuario WHERE id_usuario = ? AND role = 'director_area' AND (activo IS NULL OR activo = TRUE)`,
          [pick]
        );
        if (row?.id_usuario) directorAreaId = Number(row.id_usuario);
      }
      if (!directorAreaId) {
        const first = await get(
          `SELECT id_usuario FROM usuario WHERE role = 'director_area' AND (activo IS NULL OR activo = TRUE) ORDER BY id_usuario ASC LIMIT 1`
        );
        if (first?.id_usuario) directorAreaId = Number(first.id_usuario);
      }
      if (!directorAreaId) {
        return res.status(400).json({ error: 'No hay Director de Área para asociar la zona. Creá uno o pasá director_area_id.' });
      }
    }

    const result = await run(
      `INSERT INTO zona (name, nivel_educativo, director_area_id, activo, created_at)
       VALUES ($1, $2, $3, TRUE, NOW())
       RETURNING id`,
      [name, nivel_educativo, directorAreaId]
    );
    const zone = { id: result.lastID, name, nivel_educativo, director_area_id: directorAreaId };
    res.status(201).json(zone);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear zona', details: err.message });
  }
});

module.exports = router;

