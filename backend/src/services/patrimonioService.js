const { all, get, run } = require("../db.pg");

async function ensurePatrimonioSchema() {
  // Centralized in schemaManager.js
}

async function getTickets() {
  await ensurePatrimonioSchema();

  return await all(
    `SELECT id,
            institucion_id,
            categoria,
            descripcion,
            prioridad,
            estado,
            observacion,
            created_at,
            updated_at
     FROM patrimonio_ticket
     ORDER BY created_at DESC, id DESC`,
    []
  );
}

async function updateTicketEstado(ticketId, estado, observacion) {
  await ensurePatrimonioSchema();

  const ticketIdNum = Number.parseInt(ticketId, 10);
  const estadoStr = String(estado || "").trim();
  const observacionStr = observacion != null ? String(observacion).trim() : null;

  if (!Number.isInteger(ticketIdNum) || ticketIdNum <= 0) {
    throw { status: 400, message: "ticketId invalido" };
  }
  if (!estadoStr) {
    throw { status: 400, message: "estado requerido" };
  }

  const current = await get(
    `SELECT id
     FROM patrimonio_ticket
     WHERE id = $1`,
    [ticketIdNum]
  );

  if (!current) {
    throw { status: 404, message: "Ticket no encontrado" };
  }

  await run(
    `UPDATE patrimonio_ticket
     SET estado = $1,
         observacion = COALESCE($2, observacion),
         updated_at = NOW()
     WHERE id = $3`,
    [estadoStr, observacionStr, ticketIdNum]
  );

  const updated = await get(
    `SELECT id,
            institucion_id,
            categoria,
            descripcion,
            prioridad,
            estado,
            observacion,
            created_at,
            updated_at
     FROM patrimonio_ticket
     WHERE id = $1`,
    [ticketIdNum]
  );

  return updated;
}

module.exports = {
  getTickets,
  updateTicketEstado
};
