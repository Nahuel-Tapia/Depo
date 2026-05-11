const express = require('express');
const { run, get } = require('../db.pg');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
router.use(authenticate);

// POST /api/zones - Crear zona (solo director de área)
router.post('/', async (req, res) => {
  try {
    const { name, nivel_educativo } = req.body;
    if (req.user.role !== 'director_area') {
      return res.status(403).json({ error: 'Solo el director de área puede crear zonas.' });
    }
    if (!name || !nivel_educativo) {
      return res.status(400).json({ error: 'Faltan datos requeridos.' });
    }
    if (req.user.nivel_educativo && req.user.nivel_educativo !== nivel_educativo) {
      return res.status(403).json({ error: 'Solo puede crear zonas de su nivel asignado.' });
    }
    const result = await run(
      `INSERT INTO zona (name, nivel_educativo, director_area_id, activo, created_at)
       VALUES ($1, $2, $3, TRUE, NOW())
       RETURNING id`,
      [name, nivel_educativo, req.user.sub]
    );
    const zone = { id: result.lastID, name, nivel_educativo, director_area_id: req.user.sub };
    res.status(201).json(zone);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear zona', details: err.message });
  }
});

module.exports = router;

