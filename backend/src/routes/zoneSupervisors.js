const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const zoneController = require('../controllers/zoneController');

router.use(authenticate);

// POST /api/zones/:zoneId/supervisores - Asignar supervisores a una zona
router.post('/:zoneId/supervisores', zoneController.assignSupervisorsToZone);

module.exports = router;
