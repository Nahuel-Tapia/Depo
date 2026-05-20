const express = require("express");
const { authenticate } = require("../middleware/auth");
const patrimonioController = require("../controllers/patrimonioController");

const router = express.Router();
router.use(authenticate);

router.get("/tickets", patrimonioController.getTickets);
router.patch("/tickets/:ticketId/estado", patrimonioController.updateTicketEstado);

module.exports = router;
