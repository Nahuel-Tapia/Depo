const express = require("express");
const { all, get, run, pool } = require("../db.pg");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");

const router = express.Router();

router.use(authenticate);

// Listar todos los depósitos
 router.get("/", authorizePermissions(PERMISSIONS.STOCK_VIEW), async (req, res) => {
  try {
    const depositos = await all(`
      SELECT 
        d.id_deposito as id,
        d.nombre,
        d.descripcion,
        d.ubicacion,
        d.tipo,
        d.activo,
        d.deposito_padre_id,
        dp.nombre as nombre_padre
      FROM deposito d
      LEFT JOIN deposito dp ON dp.id_deposito = d.deposito_padre_id
      WHERE d.activo = TRUE
      ORDER BY d.tipo, d.id_deposito
    `);
    return res.json({ depositos });
  } catch (err) {
    console.error("Error listando depósitos:", err);
    return res.status(500).json({ error: "No se pudo listar depósitos" });
  }
});

// 1) Ver productos en un depósito específico
router.get("/:id/productos", authorizePermissions(PERMISSIONS.STOCK_VIEW), async (req, res) => {
  try {
    const { id } = req.params;
    const productos = await all(
      `SELECT p.id_producto as id, p.nombre, p.unidad_medida, COALESCE(sd.cantidad, 0) as cantidad
       FROM producto p
       LEFT JOIN stock_deposito sd ON sd.id_producto = p.id_producto AND sd.id_deposito = ?`,
      [id]
    );
    return res.json({ productos });
  } catch (err) {
    console.error("Error listando productos en deposito:", err);
    return res.status(500).json({ error: "No se pudo listar productos en el deposito" });
  }
});

// Listar stock por producto en todos los depósitos
router.get("/stock-por-producto", authorizePermissions(PERMISSIONS.STOCK_VIEW), async (req, res) => {
  try {
    const productos = await all(`
      SELECT 
        p.id_producto as id,
        p.nombre,
        p.unidad_medida,
        p.stock_actual,
        p.requiere_autorizacion,
        COALESCE(sd_central.cantidad, 0) as stock_central,
        COALESCE(sd_civico.cantidad, 0) as stock_centro_civico,
        COALESCE(sd_capsula.cantidad, 0) as stock_capsula
      FROM producto p
      LEFT JOIN stock_deposito sd_central ON sd_central.id_producto = p.id_producto 
        AND sd_central.id_deposito = (SELECT id_deposito FROM deposito WHERE tipo = 'central')
      LEFT JOIN stock_deposito sd_civico ON sd_civico.id_producto = p.id_producto 
        AND sd_civico.id_deposito = (SELECT id_deposito FROM deposito WHERE tipo = 'centro_civico')
      LEFT JOIN stock_deposito sd_capsula ON sd_capsula.id_producto = p.id_producto 
        AND sd_capsula.id_deposito = (SELECT id_deposito FROM deposito WHERE tipo = 'capsula')
      ORDER BY p.nombre
    `);
    return res.json({ productos });
  } catch (err) {
    console.error("Error listando stock:", err);
    return res.status(500).json({ error: "No se pudo listar stock" });
  }
});

// Obtener stock de un depósito específico
router.get("/:id/stock", authorizePermissions(PERMISSIONS.STOCK_VIEW), async (req, res) => {
  try {
    const { id } = req.params;
    const deposito = await get("SELECT * FROM deposito WHERE id_deposito = $1", [id]);
    if (!deposito) {
      return res.status(404).json({ error: "Depósito no encontrado" });
    }

    // Si tiene hijos (capsula dentro de central), mostrar ambos stocks
    const isPadre = deposito.tipo === "central";
    let stockQuery = `
      SELECT 
        p.id_producto as id,
        p.nombre,
        p.unidad_medida,
        COALESCE(sd.cantidad, 0) as cantidad,
        p.requiere_autorizacion
      FROM producto p
      LEFT JOIN stock_deposito sd ON sd.id_producto = p.id_producto 
        AND sd.id_deposito = $1
      WHERE p.id_producto > 0
    `;

    // Para Central, también mostrar stock de Cápsula
    if (isPadre) {
      stockQuery = `
        SELECT 
          p.id_producto as id,
          p.nombre,
          p.unidad_medida,
          COALESCE(SUM(sd.cantidad), 0) as cantidad,
          p.requiere_autorizacion,
          CASE WHEN sd_caps.id_deposito IS NOT NULL THEN 'capsula' ELSE NULL END as en_capsula
        FROM producto p
        LEFT JOIN stock_deposito sd ON sd.id_producto = p.id_producto AND sd.id_deposito = $1
        LEFT JOIN stock_deposito sd_caps ON sd_caps.id_producto = p.id_producto 
          AND sd_caps.id_deposito = (SELECT id_deposito FROM deposito WHERE tipo = 'capsula')
        GROUP BY p.id_producto, p.nombre, p.unidad_medida, p.requiere_autorizacion, sd_caps.id_deposito
      `;
    }

    const stock = await all(stockQuery, [id]);
    return res.json({ deposito, stock });
  } catch (err) {
    console.error("Error obteniendo stock:", err);
    return res.status(500).json({ error: "No se pudo obtener stock" });
  }
});

// Traslado de stock entre depósitos
router.post("/mover", authorizePermissions(PERMISSIONS.STOCK_MOVEMENT_CREATE), async (req, res) => {
  const { id_producto, cantidad, origen_id, destino_id, motivo } = req.body
  if (!id_producto || !cantidad || !origen_id || !destino_id) {
    return res.status(400).json({ error: "Faltan campos obligatorios" })
  }
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const src = await client.query(
      `SELECT cantidad FROM stock_deposito WHERE id_deposito = $1 AND id_producto = $2 FOR UPDATE`,
      [origen_id, id_producto]
    )
    const available = src.rows[0]?.cantidad || 0
    if (available < cantidad) {
      await client.query("ROLLBACK")
      return res.status(400).json({ error: "Stock insuficiente en origen" })
    }
    await client.query(
      `UPDATE stock_deposito SET cantidad = cantidad - $1 WHERE id_deposito = $2 AND id_producto = $3`,
      [cantidad, origen_id, id_producto]
    )
    await client.query(
      `INSERT INTO stock_deposito (id_deposito, id_producto, cantidad) VALUES ($1, $2, $3)
       ON CONFLICT (id_deposito, id_producto) DO UPDATE SET cantidad = stock_deposito.cantidad + EXCLUDED.cantidad`,
      [destino_id, id_producto, cantidad]
    )
    const mot = (motivo || `Traslado ${id_producto} ${origen_id}→${destino_id}`)
    // Log egreso de origen
    await client.query(
      `INSERT INTO movimiento_stock (id_producto, tipo, cantidad, motivo, id_usuario, id_deposito) VALUES ($1, 'egreso', $2, $3, NULL, $4)`,
      [id_producto, cantidad, mot, origen_id]
    )
    // Log ingreso a destino
    await client.query(
      `INSERT INTO movimiento_stock (id_producto, tipo, cantidad, motivo, id_usuario, id_deposito) VALUES ($1, 'ingreso', $2, $3, NULL, $4)`,
      [id_producto, cantidad, mot, destino_id]
    )
    await client.query("COMMIT")
    res.json({ ok: true, moved: true })
  } catch (err) {
    await client.query("ROLLBACK")
    console.error("Error moviendo entre depósitos:", err)
    res.status(500).json({ error: "Error moviendo entre depósitos" })
  } finally {
    client.release()
  }
})

// Crear movimiento de ingreso a depósito
router.post("/:id/ingreso", authorizePermissions(PERMISSIONS.STOCK_MOVEMENT_CREATE), async (req, res) => {
  try {
    const { id } = req.params;
    const { id_producto, cantidad, id_proveedor, motivo } = req.body;

    if (!id_producto || !cantidad) {
      return res.status(400).json({ error: "Producto y cantidad requeridos" });
    }

    const deposito = await get("SELECT * FROM deposito WHERE id_deposito = $1", [id]);
    if (!deposito) {
      return res.status(404).json({ error: "Depósito no encontrado" });
    }

    // Verificar si producto requiere autorización y el usuario tiene permiso
    const producto = await get("SELECT * FROM producto WHERE id_producto = $1", [id_producto]);
    if (producto.requiere_autorizacion) {
      // Solo admin puede meter items a capsula directamente
      const esCapsula = deposito.tipo === "capsula";
      if (esCapsula && req.user.role !== "admin") {
        return res.status(403).json({ error: "Requiere autorización para ingresos a Cápsula" });
      }
    }

    // Insertar movimiento
    const movimiento = await run(`
      INSERT INTO movimiento_stock (id_producto, cantidad, tipo, id_proveedor, motivo, id_usuario, id_deposito)
      VALUES ($1, $2, 'ingreso', $3, $4, $5, $6)
    `, [id_producto, cantidad, id_proveedor || null, motivo || "Ingreso a depósito", req.user.sub, id]);

    // Actualizar stock
    await run(`
      INSERT INTO stock_deposito (id_deposito, id_producto, cantidad)
      VALUES ($1, $2, $3)
      ON CONFLICT (id_deposito, id_producto) 
      DO UPDATE SET cantidad = stock_deposito.cantidad + $3
    `, [id, id_producto, cantidad]);

    // Actualizar stock global
    await pool.query(
      "UPDATE producto SET stock_actual = stock_actual + $1 WHERE id_producto = $2",
      [cantidad, id_producto]
    );

    return res.json({ ok: true, message: "Ingreso registrado" });
  } catch (err) {
    console.error("Error en ingreso:", err);
    return res.status(500).json({ error: "No se pudo registrar ingreso" });
  }
});

// Crear movimiento de egreso desde depósito
router.post("/:id/egreso", authorizePermissions(PERMISSIONS.STOCK_MOVEMENT_CREATE), async (req, res) => {
  try {
    const { id } = req.params;
    const { id_producto, cantidad, id_institucion, motivo } = req.body;

    if (!id_producto || !cantidad) {
      return res.status(400).json({ error: "Producto y cantidad requeridos" });
    }

    const deposito = await get("SELECT * FROM deposito WHERE id_deposito = $1", [id]);
    if (!deposito) {
      return res.status(404).json({ error: "Depósito no encontrado" });
    }

    // Verificar stock disponible
    const stockDep = await get(
      "SELECT cantidad FROM stock_deposito WHERE id_deposito = $1 AND id_producto = $2",
      [id, id_producto]
    );
    const stockDisp = stockDep?.cantidad || 0;
    if (stockDisp < cantidad) {
      return res.status(400).json({ error: `Stock insuficiente. Disponible: ${stockDisp}` });
    }

    // Verificar si producto requiere autorización
    const producto = await get("SELECT requiere_autorizacion FROM producto WHERE id_producto = $1", [id_producto]);
    if (producto.requiere_autorizacion) {
      const esCapsula = deposito.tipo === "capsula";
      if (esCapsula && req.user.role !== "admin") {
        return res.status(403).json({ error: "Requiere autorización para egresar de Cápsula" });
      }
    }

    // Insertar movimiento
    await run(`
      INSERT INTO movimiento_stock (id_producto, cantidad, tipo, id_institucion, motivo, id_usuario, id_deposito)
      VALUES ($1, $2, 'egreso', $3, $4, $5, $6)
    `, [id_producto, cantidad, id_institucion || null, motivo || "Egreso de depósito", req.user.sub, id]);

    // Actualizar stock
    await run(
      "UPDATE stock_deposito SET cantidad = cantidad - $1 WHERE id_deposito = $2 AND id_producto = $3",
      [cantidad, id, id_producto]
    );

    // Actualizar stock global
    await pool.query(
      "UPDATE producto SET stock_actual = stock_actual - $1 WHERE id_producto = $2",
      [cantidad, id_producto]
    );

    return res.json({ ok: true, message: "Egreso registrado" });
  } catch (err) {
    console.error("Error en egreso:", err);
    return res.status(500).json({ error: "No se pudo registrar egreso" });
  }
});

module.exports = router;
