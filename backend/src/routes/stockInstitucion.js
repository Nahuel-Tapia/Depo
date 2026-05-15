const express = require("express");
const { all, get, run, pool } = require("../db.pg");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

// Asegurar esquema de stock interno
async function ensureStockSchema() {
  await run(`
    CREATE TABLE IF NOT EXISTS stock_institucion (
      id_institucion INT NOT NULL REFERENCES institucion(id_institucion) ON DELETE CASCADE,
      id_producto INT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
      cantidad NUMERIC(12,2) DEFAULT 0,
      PRIMARY KEY (id_institucion, id_producto)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS consumo_institucion (
      id_consumo SERIAL PRIMARY KEY,
      id_institucion INT NOT NULL REFERENCES institucion(id_institucion) ON DELETE CASCADE,
      id_producto INT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
      id_usuario INT REFERENCES usuario(id_usuario),
      cantidad NUMERIC(12,2) NOT NULL,
      fecha TIMESTAMP DEFAULT NOW(),
      motivo TEXT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS notificacion (
      id_notificacion SERIAL PRIMARY KEY,
      id_usuario INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
      titulo VARCHAR(150) NOT NULL,
      mensaje TEXT,
      leida BOOLEAN DEFAULT FALSE,
      tipo VARCHAR(30) DEFAULT 'info',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS comentario_pedido (
      id_comentario SERIAL PRIMARY KEY,
      id_pedido INT NOT NULL REFERENCES pedido(id_pedido) ON DELETE CASCADE,
      id_usuario INT NOT NULL REFERENCES usuario(id_usuario),
      mensaje TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Agregar código de retiro a la tabla pedido si no existe
  try {
    await run(`ALTER TABLE pedido ADD COLUMN IF NOT EXISTS codigo_retiro VARCHAR(20)`);
  } catch (e) {}
}

// Listar stock de la institución
router.get("/", async (req, res) => {
  try {
    await ensureStockSchema();
    const usuario = await get("SELECT id_institucion FROM usuario WHERE id_usuario = ?", [req.user.sub]);
    if (!usuario || !usuario.id_institucion) return res.status(400).json({ error: "Sin institución" });

    const stock = await all(`
      SELECT s.cantidad, p.nombre || COALESCE(' - ' || NULLIF(p.marca, ''), '') as producto_nombre, p.id_producto, p.unidad_medida
      FROM stock_institucion s
      JOIN producto p ON p.id_producto = s.id_producto
      WHERE s.id_institucion = ?
      ORDER BY p.nombre ASC
    `, [usuario.id_institucion]);

    res.json({ stock });
  } catch (err) {
    res.status(500).json({ error: "Error al cargar stock" });
  }
});

// Registrar consumo interno
router.post("/consumo", async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureStockSchema();
    const { producto_id, cantidad, motivo } = req.body;
    const usuario = await get("SELECT id_institucion FROM usuario WHERE id_usuario = ?", [req.user.sub]);
    
    if (!usuario?.id_institucion) return res.status(400).json({ error: "Sin institución" });

    await client.query("BEGIN");

    // Descontar del stock
    const update = await client.query(`
      UPDATE stock_institucion 
      SET cantidad = cantidad - $1
      WHERE id_institucion = $2 AND id_producto = $3 AND cantidad >= $1
      RETURNING cantidad
    `, [cantidad, usuario.id_institucion, producto_id]);

    if (update.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Stock insuficiente para registrar este consumo" });
    }

    // Registrar log
    await client.query(`
      INSERT INTO consumo_institucion (id_institucion, id_producto, id_usuario, cantidad, motivo)
      VALUES ($1, $2, $3, $4, $5)
    `, [usuario.id_institucion, producto_id, req.user.sub, cantidad, motivo]);

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Error al registrar consumo" });
  } finally {
    client.release();
  }
});

// Notificaciones
router.get("/notificaciones", async (req, res) => {
  try {
    await ensureStockSchema();
    const rows = await all(`
      SELECT * FROM notificacion 
      WHERE id_usuario = ? 
      ORDER BY created_at DESC 
      LIMIT 20
    `, [req.user.sub]);
    res.json({ notificaciones: rows });
  } catch (err) {
    res.status(500).json({ error: "Error al cargar notificaciones" });
  }
});

router.patch("/notificaciones/:id/leer", async (req, res) => {
  try {
    await run("UPDATE notificacion SET leida = TRUE WHERE id_notificacion = ? AND id_usuario = ?", [req.params.id, req.user.sub]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error" });
  }
});

module.exports = router;
