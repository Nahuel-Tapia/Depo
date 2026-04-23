const express = require('express');
const { Zone } = require('../models/zone');
const router = express.Router();

// Middleware de autenticación y obtención de usuario
const { authenticate } = require('../middleware/auth');
router.use(authenticate);

// POST /api/zones - Crear zona (solo director de área)
router.post('/', async (req, res) => {
  try {
    const { name, nivel_educativo } = req.body;
    // Solo director de área puede crear zonas
    if (req.user.role !== 'director_area') {
      return res.status(403).json({ error: 'Solo el director de área puede crear zonas.' });
    }
    if (!name || !nivel_educativo) {
      return res.status(400).json({ error: 'Faltan datos requeridos.' });
    }
    // El nivel educativo debe coincidir con el asignado al director
    if (req.user.nivel_educativo !== nivel_educativo) {
      return res.status(403).json({ error: 'Solo puede crear zonas de su nivel asignado.' });
    }
    const zone = await Zone.create({
      name,
      nivel_educativo,
      director_area_id: req.user.sub
    });
    res.status(201).json(zone);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear zona', details: err.message });
  }
});

module.exports = router;
