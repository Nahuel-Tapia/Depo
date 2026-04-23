const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { run } = require('../db.pg');

// POST /api/director-area/supervisores - Crear supervisor de mismo nivel
router.post('/supervisores', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'director_area') {
      return res.status(403).json({ error: 'Solo el director de área puede crear supervisores.' });
    }
    const { nombre, apellido, email, dni, password } = req.body;
    if (!nombre || !apellido || !email || !dni || !password) {
      return res.status(400).json({ error: 'Faltan datos requeridos.' });
    }
    // El supervisor debe tener el mismo nivel educativo que el director
    const nivel_educativo = req.user.nivel_educativo;
    await run(
      `INSERT INTO usuario (nombre, apellido, email, dni, password, role, nivel_educativo, activo, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'supervisor', $6, TRUE, NOW(), NOW())
       ON CONFLICT (email) DO NOTHING`,
      [nombre, apellido, email, dni, password, nivel_educativo]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear supervisor', details: err.message });
  }
});

module.exports = router;
