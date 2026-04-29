const express = require("express");
const { all, get, run } = require("../db.pg");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

let schemaReady = false;
let schemaPromise = null;

async function ensurePatrimonioSchema() {
  if (schemaReady) return;
  if (schemaPromise) {
    await schemaPromise;
    return;
  }

  schemaPromise = (async () => {
    await run(`
      CREATE TABLE IF NOT EXISTS patrimonio_ticket (
        id SERIAL PRIMARY KEY,
        institucion_id INT,
        categoria VARCHAR(120),
        descripcion TEXT,
        prioridad VARCHAR(30),
        estado VARCHAR(30) DEFAULT 'pendiente',
        observacion TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    schemaReady = true;
  })();

  try {
    await schemaPromise;
  } finally {
    schemaPromise = null;
  }
}

router.get("/tickets", async (req, res) => {
  try {
    await ensurePatrimonioSchema();

    const rows = await all(
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

    res.json({ tickets: rows });
  } catch (err) {
    console.error("Error al obtener tickets de patrimonio:", err);
    res.status(500).json({ error: "No se pudieron cargar los tickets" });
  }
});

router.patch("/tickets/:ticketId/estado", async (req, res) => {
  try {
    await ensurePatrimonioSchema();

    const ticketId = Number.parseInt(req.params.ticketId, 10);
    const estado = String(req.body?.estado || "").trim();
    const observacion = req.body?.observacion != null ? String(req.body.observacion).trim() : null;

    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return res.status(400).json({ error: "ticketId invalido" });
    }
    if (!estado) {
      return res.status(400).json({ error: "estado requerido" });
    }

    const current = await get(
      `SELECT id
       FROM patrimonio_ticket
       WHERE id = $1`,
      [ticketId]
    );

    if (!current) {
      return res.status(404).json({ error: "Ticket no encontrado" });
    }

    await run(
      `UPDATE patrimonio_ticket
       SET estado = $1,
           observacion = COALESCE($2, observacion),
           updated_at = NOW()
       WHERE id = $3`,
      [estado, observacion, ticketId]
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
      [ticketId]
    );

    return res.json({ ok: true, ticket: updated });
  } catch (err) {
    console.error("Error al actualizar estado del ticket:", err);
    return res.status(500).json({ error: "No se pudo actualizar el ticket" });
  }
});

module.exports = router;
