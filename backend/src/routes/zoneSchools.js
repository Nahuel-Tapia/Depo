const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const zoneController = require('../controllers/zoneController');

router.use(authenticate);

// POST /api/zones/:zoneId/escuelas - Añadir escuelas a una zona
router.post('/:zoneId/escuelas', zoneController.addSchoolsToZone);

module.exports = router;
