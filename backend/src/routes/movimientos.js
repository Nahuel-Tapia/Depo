const express = require("express");
const { all, get, run } = require("../db.pg");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");

const router = express.Router();

// Tipos válidos segun el ENUM de la BD
const TIPOS_MOVIMIENTO = ["ingreso", "egreso", "ajuste", "devolucion"];

router.use(authenticate);

// Listar movimientos
router.get("/", authorizePermissions(PERMISSIONS.MOVIMIENTOS_VIEW), async (req, res) => {
  try {
    const { producto_id, tipo, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT 
        m.id_movimiento as id,
        m.id_producto,
        p.nombre as producto_nombre,
        m.tipo,
        m.cantidad,
        m.estado_producto,
        m.cargo_retira,
        i.nombre as institucion_nombre,
        m.motivo,
        u.nombre as usuario_nombre,
        u.email as usuario_email,
        m.fecha_movimiento as created_at
      FROM movimiento_stock m
      LEFT JOIN producto p ON m.id_producto = p.id_producto
      LEFT JOIN usuario u ON m.id_usuario = u.id_usuario
      LEFT JOIN institucion i ON m.id_institucion = i.id_institucion
      WHERE 1 = 1
    `;
    const params = [];
    let paramIndex = 1;

    if (producto_id) {
      query += ` AND m.id_producto = $${paramIndex++}`;
      params.push(producto_id);
    }

    if (tipo && TIPOS_MOVIMIENTO.includes(tipo)) {
      query += ` AND m.tipo = $${paramIndex++}`;
      params.push(tipo);
    }

    query += ` ORDER BY m.fecha_movimiento DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit), parseInt(offset));

    const movimientos = await all(query, params);
    return res.json({ movimientos });
  } catch (err) {
    console.error("Error listando movimientos:", err);
    return res.status(500).json({ error: "No se pudo listar movimientos" });
  }
});

// Obtener un movimiento
router.get("/:id", authorizePermissions(PERMISSIONS.MOVIMIENTOS_VIEW), async (req, res) => {
  try {
    const { id } = req.params;
    const movimiento = await get(`
      SELECT 
        m.id_movimiento as id,
        m.id_producto,
        p.nombre as producto_nombre,
        m.tipo,
        m.cantidad,
        m.estado_producto,
        m.cargo_retira,
        i.nombre as institucion_nombre,
        m.motivo,
        u.nombre as usuario_nombre,
        m.fecha_movimiento as created_at
      FROM movimiento_stock m
      LEFT JOIN producto p ON m.id_producto = p.id_producto
      LEFT JOIN usuario u ON m.id_usuario = u.id_usuario
      LEFT JOIN institucion i ON m.id_institucion = i.id_institucion
      WHERE m.id_movimiento = ?
    `, [id]);
    
    if (!movimiento) {
      return res.status(404).json({ error: "Movimiento no encontrado" });
    }
    return res.json({ movimiento });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo obtener el movimiento" });
  }
});

// Crear movimiento
router.post("/", authorizePermissions(PERMISSIONS.MOVIMIENTOS_CREATE), async (req, res) => {
  try {
    const { producto_id, tipo, cantidad, motivo } = req.body;

    if (!producto_id || !tipo || !cantidad) {
      return res.status(400).json({ error: "Faltan campos obligatorios (producto_id, tipo, cantidad)" });
    }

    if (!TIPOS_MOVIMIENTO.includes(tipo)) {
      return res.status(400).json({ error: `Tipo inválido. Valores válidos: ${TIPOS_MOVIMIENTO.join(", ")}` });
    }

    const cantidadNum = parseInt(cantidad);
    if (isNaN(cantidadNum) || cantidadNum <= 0) {
      return res.status(400).json({ error: "La cantidad debe ser un número mayor a 0" });
    }

    // Verificar que el producto existe
    const producto = await get("SELECT * FROM producto WHERE id_producto = ?", [producto_id]);
    if (!producto) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    // Registrar movimiento
    const result = await run(
      "INSERT INTO movimiento_stock (id_producto, tipo, cantidad, id_usuario, motivo) VALUES (?, ?, ?, ?, ?)",
      [producto_id, tipo, cantidadNum, req.user.sub, motivo || null]
    );

    return res.status(201).json({ id: result.lastID });
  } catch (err) {
    console.error("Error creando movimiento:", err);
    return res.status(500).json({ error: "No se pudo crear el movimiento" });
  }
});

// Crear lote de movimientos
router.post("/lote", authorizePermissions(PERMISSIONS.MOVIMIENTOS_CREATE), async (req, res) => {
  try {
    const { tipo, motivo, movimientos } = req.body;

    if (!tipo || !movimientos || !Array.isArray(movimientos) || movimientos.length === 0) {
      return res.status(400).json({ error: "Faltan campos obligatorios (tipo, movimientos array)" });
    }

    if (!TIPOS_MOVIMIENTO.includes(tipo)) {
      return res.status(400).json({ error: `Tipo inválido. Valores válidos: ${TIPOS_MOVIMIENTO.join(", ")}` });
    }

    // Validar cada movimiento
    for (const mov of movimientos) {
      if (!mov.producto_id || !mov.cantidad) {
        return res.status(400).json({ error: "Cada movimiento debe tener producto_id y cantidad" });
      }
      const cantidadNum = parseInt(mov.cantidad);
      if (isNaN(cantidadNum) || cantidadNum <= 0) {
        return res.status(400).json({ error: "La cantidad debe ser un número mayor a 0" });
      }
      // Verificar que el producto existe
      const producto = await get("SELECT * FROM producto WHERE id_producto = ?", [mov.producto_id]);
      if (!producto) {
        return res.status(404).json({ error: `Producto con id ${mov.producto_id} no encontrado` });
      }
    }

    // Insertar movimientos en una transacción
    const ids = [];
    for (const mov of movimientos) {
      const result = await run(
        "INSERT INTO movimiento_stock (id_producto, tipo, cantidad, id_usuario, motivo) VALUES (?, ?, ?, ?, ?)",
        [mov.producto_id, tipo, parseInt(mov.cantidad), req.user.sub, motivo || null]
      );
      ids.push(result.lastID);
    }

    return res.status(201).json({ ids });
  } catch (err) {
    console.error("Error creando lote de movimientos:", err);
    return res.status(500).json({ error: "No se pudo crear el lote de movimientos" });
  }
});

// Crear movimiento directo (egreso/ingreso)
router.post("/directo", authorizePermissions(PERMISSIONS.MOVIMIENTOS_CREATE), async (req, res) => {
  try {
    const { tipo, institucion_id, cargo_retira, motivo, productos } = req.body;

    if (!tipo || !productos || !Array.isArray(productos) || productos.length === 0) {
      return res.status(400).json({ error: "Faltan campos obligatorios (tipo, productos array)" });
    }

    if (!TIPOS_MOVIMIENTO.includes(tipo)) {
      return res.status(400).json({ error: `Tipo inválido. Valores válidos: ${TIPOS_MOVIMIENTO.join(", ")}` });
    }

    // Para egresos, validar institución y cargo
    if (tipo === "egreso") {
      if (!institucion_id || !cargo_retira) {
        return res.status(400).json({ error: "Para egresos se requiere institución y cargo de quien retira" });
      }
    }

    // Validar cada producto
    for (const prod of productos) {
      if (!prod.producto_id || !prod.cantidad || !prod.estado) {
        return res.status(400).json({ error: "Cada producto debe tener producto_id, cantidad y estado" });
      }
      const cantidadNum = parseInt(prod.cantidad);
      if (isNaN(cantidadNum) || cantidadNum <= 0) {
        return res.status(400).json({ error: "La cantidad debe ser un número mayor a 0" });
      }
      // Verificar que el producto existe
      const producto = await get("SELECT * FROM producto WHERE id_producto = ?", [prod.producto_id]);
      if (!producto) {
        return res.status(404).json({ error: `Producto con id ${prod.producto_id} no encontrado` });
      }
    }

    // Insertar movimientos
    const ids = [];
    for (const prod of productos) {
      const result = await run(
        `INSERT INTO movimiento_stock (id_producto, tipo, cantidad, estado_producto, cargo_retira, id_institucion, id_usuario, motivo, fecha_movimiento)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          prod.producto_id,
          tipo,
          parseInt(prod.cantidad),
          prod.estado,
          tipo === "egreso" ? cargo_retira : null,
          tipo === "egreso" ? institucion_id : null,
          req.user.sub,
          motivo || null
        ]
      );
      ids.push(result.lastID);
    }

    return res.status(201).json({ ids });
  } catch (err) {
    console.error("Error creando movimiento directo:", err);
    return res.status(500).json({ error: "No se pudo crear el movimiento directo" });
  }
});

// Estadísticas de movimientos
router.get("/stats/resumen", authorizePermissions(PERMISSIONS.MOVIMIENTOS_VIEW), async (req, res) => {
  try {
    const stats = await get(`
      SELECT 
        SUM(CASE WHEN tipo = 'ingreso' THEN cantidad ELSE 0 END) as total_ingresos,
        SUM(CASE WHEN tipo = 'egreso' THEN cantidad ELSE 0 END) as total_egresos,
        SUM(CASE WHEN tipo = 'ajuste' THEN cantidad ELSE 0 END) as total_ajustes,
        SUM(CASE WHEN tipo = 'devolucion' THEN cantidad ELSE 0 END) as total_devoluciones
      FROM movimiento_stock
    `);
    return res.json({ stats });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo obtener estadísticas" });
  }
});

module.exports = router;
