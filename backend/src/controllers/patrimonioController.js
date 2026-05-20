const patrimonioService = require("../services/patrimonioService");

async function getTickets(req, res) {
  try {
    const tickets = await patrimonioService.getTickets();
    return res.json({ tickets });
  } catch (err) {
    console.error("Error al obtener tickets de patrimonio:", err);
    return res.status(500).json({ error: "No se pudieron cargar los tickets" });
  }
}

async function updateTicketEstado(req, res) {
  try {
    const { ticketId } = req.params;
    const { estado, observacion } = req.body || {};
    const updated = await patrimonioService.updateTicketEstado(ticketId, estado, observacion);
    return res.json({ ok: true, ticket: updated });
  } catch (err) {
    console.error("Error al actualizar estado del ticket:", err);
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: "No se pudo actualizar el ticket" });
  }
}

module.exports = {
  getTickets,
  updateTicketEstado
};
