const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const zoneController = require('../controllers/zoneController');

router.use(authenticate);

// POST /api/zones - Crear zona (solo director de área)
router.post('/', zoneController.createZone);

module.exports = router;
