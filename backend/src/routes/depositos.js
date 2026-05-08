const express = require("express");
const { all, get, run, pool } = require("../db.pg");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");

const router = express.Router();

router.use(authenticate);

let schemaReady = false;
let schemaPromise = null;

async function ensureDepositosSchema() {
  if (schemaReady) return;
  if (schemaPromise) {
    await schemaPromise;
    return;
  }

  schemaPromise = (async () => {
    try {
      // Agregar fecha_vencimiento a movimiento_stock
      await run(`ALTER TABLE movimiento_stock ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE`);
      
      // Asegurar tablas de licitación y distribución
      await run(`
        CREATE TABLE IF NOT EXISTS recepcion_licitacion (
          id SERIAL PRIMARY KEY,
          licitacion_id INT NOT NULL,
          producto_id INT NOT NULL,
          cantidad_recibida NUMERIC(12,2) NOT NULL,
          usuario_id INT,
          id_deposito INT,
          fecha_vencimiento DATE,
          observaciones TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await run(`
        CREATE TABLE IF NOT EXISTS entrega_anual (
          id SERIAL PRIMARY KEY,
          id_institucion INT NOT NULL,
          anio INT NOT NULL,
          id_producto INT NOT NULL,
          cantidad_entregada NUMERIC(12,2) NOT NULL,
          id_deposito INT,
          id_usuario INT,
          observaciones TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      schemaReady = true;
    } catch (err) {
      console.error("Error en migración de depósitos:", err);
    }
  })();

  try {
    await schemaPromise;
  } finally {
    schemaPromise = null;
  }
}

// Listar todos los depósitos
 router.get("/", authorizePermissions(PERMISSIONS.STOCK_VIEW), async (req, res) => {
  try {
    await ensureDepositosSchema();
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
        COALESCE(SUM(CASE WHEN d.tipo = 'central' THEN sd.cantidad ELSE 0 END), 0) as stock_central,
        COALESCE(SUM(CASE WHEN d.tipo = 'centro_civico' THEN sd.cantidad ELSE 0 END), 0) as stock_centro_civico,
        COALESCE(SUM(CASE WHEN d.tipo = 'capsula' THEN sd.cantidad ELSE 0 END), 0) as stock_capsula
      FROM producto p
      LEFT JOIN stock_deposito sd ON sd.id_producto = p.id_producto
      LEFT JOIN deposito d ON d.id_deposito = sd.id_deposito
      GROUP BY p.id_producto, p.nombre, p.unidad_medida, p.stock_actual
      ORDER BY p.nombre
    `);
    return res.json({ productos });
  } catch (err) {
    console.error("Error listando stock:", err);
    return res.status(500).json({ error: "No se pudo listar stock", details: err.message });
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
        COALESCE(sd.cantidad, 0) as cantidad
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
          CASE WHEN sd_caps.id_deposito IS NOT NULL THEN 'capsula' ELSE NULL END as en_capsula
        FROM producto p
        LEFT JOIN stock_deposito sd ON sd.id_producto = p.id_producto AND sd.id_deposito = $1
        LEFT JOIN stock_deposito sd_caps ON sd_caps.id_producto = p.id_producto 
          AND sd_caps.id_deposito = (SELECT id_deposito FROM deposito WHERE tipo = 'capsula')
        GROUP BY p.id_producto, p.nombre, p.unidad_medida, sd_caps.id_deposito
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

async function getRecepcionesLicitacion(req, res) {
  try {
    const rows = await all(
      `SELECT id, anio, fecha_publicacion, estado
       FROM licitacion_publicada
       WHERE estado IN ('en_deposito', 'completada')
       ORDER BY fecha_publicacion DESC`
    );
    res.json({ licitaciones: rows });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener recepciones" });
  }
}

async function getDetalleRecepcion(req, res) {
  try {
    const { id } = req.params;
    const row = await get(`SELECT id, items, anio FROM licitacion_publicada WHERE id = $1`, [id]);
    if (!row) return res.status(404).json({ error: "Licitación no encontrada" });

    // Consolidar por producto_id - El operador no necesita ver qué escuela pidió cada cosa
    const items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items;
    const consolidatedMap = {};
    items.forEach(item => {
      const pid = item.producto_id;
      if (!consolidatedMap[pid]) {
        consolidatedMap[pid] = {
          producto_id: pid,
          producto: item.producto,
          unidad_medida: item.unidad_medida,
          cantidad_total: 0
        };
      }
      consolidatedMap[pid].cantidad_total += Number(item.cantidad_a_licitar || 0);
    });
    const cleanItems = Object.values(consolidatedMap);

    // Obtener lo ya recibido
    const recibidos = await all(
      `SELECT producto_id, SUM(cantidad_recibida) as total_recibida
       FROM recepcion_licitacion
       WHERE licitacion_id = $1
       GROUP BY producto_id`,
      [id]
    );

    res.json({ id: row.id, anio: row.anio, items: cleanItems, recibidos });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener detalle" });
  }
}

async function registrarIngresoLicitacion(req, res) {
  const client = await pool.connect();
  try {
    const { licitacion_id, ingresos, id_deposito, observaciones } = req.body;
    if (!licitacion_id || !ingresos || !id_deposito) {
      return res.status(400).json({ error: "Faltan datos obligatorios" });
    }

    await client.query("BEGIN");

    for (const ing of ingresos) {
      const { producto_id, cantidad, fecha_vencimiento } = ing;
      if (!cantidad || cantidad <= 0) continue;

      // 1. Registrar en recepcion_licitacion
      await client.query(
        `INSERT INTO recepcion_licitacion (licitacion_id, producto_id, cantidad_recibida, usuario_id, observaciones, fecha_vencimiento, id_deposito)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [licitacion_id, producto_id, cantidad, req.user.sub, observaciones, fecha_vencimiento || null, id_deposito]
      );

      // 2. Actualizar stock en depósito
      await client.query(
        `INSERT INTO stock_deposito (id_deposito, id_producto, cantidad)
         VALUES ($1, $2, $3)
         ON CONFLICT (id_deposito, id_producto) 
         DO UPDATE SET cantidad = stock_deposito.cantidad + $3`,
        [id_deposito, producto_id, cantidad]
      );

      // 3. Actualizar stock global
      await client.query(
        "UPDATE producto SET stock_actual = stock_actual + $1 WHERE id_producto = $2",
        [cantidad, producto_id]
      );

      // 4. Registrar movimiento de stock
      await client.query(
        `INSERT INTO movimiento_stock (id_producto, cantidad, tipo, motivo, id_usuario, id_deposito, fecha_vencimiento)
         VALUES ($1, $2, 'ingreso', $3, $4, $5, $6)`,
        [producto_id, cantidad, `Ingreso por Licitación #${licitacion_id}`, req.user.sub, id_deposito, fecha_vencimiento || null]
      );
    }

    await client.query("COMMIT");
    res.json({ ok: true, message: "Mercadería ingresada con éxito" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error al registrar ingreso licitación:", err);
    res.status(500).json({ error: "Error al procesar el ingreso" });
  } finally {
    client.release();
  }
}

router.get("/licitacion/recepciones", authorizePermissions(PERMISSIONS.STOCK_VIEW), getRecepcionesLicitacion);
router.get("/licitacion/recepciones/:id", authorizePermissions(PERMISSIONS.STOCK_VIEW), getDetalleRecepcion);
router.post("/licitacion/registrar-ingreso", authorizePermissions(PERMISSIONS.STOCK_MOVEMENT_CREATE), registrarIngresoLicitacion);

async function getPendientesDistribucion(req, res) {
  try {
    const anio = Number(req.query.anio || new Date().getFullYear());
    // Escuelas que tienen ítems aprobados/adjudicados en su planilla anual
    // y que aún no han recibido el 100%
    const rows = await all(`
      SELECT 
        i.id_institucion as id, i.nombre, i.cue,
        COUNT(DISTINCT pad.id_producto) as total_productos,
        (
          SELECT COUNT(*) 
          FROM planilla_pedido_anual_detalle d
          LEFT JOIN (
            SELECT id_institucion, id_producto, SUM(cantidad_entregada) as entregado
            FROM entrega_anual
            WHERE anio = $1
            GROUP BY id_institucion, id_producto
          ) e ON e.id_institucion = d.id_institucion AND e.id_producto = d.id_producto
          WHERE d.id_institucion = i.id_institucion 
            AND d.planilla_id IN (SELECT id FROM planilla_pedido_anual WHERE anio = $1 AND estado = 'adjudicada')
            AND (e.entregado IS NULL OR e.entregado < d.cantidad)
        ) as productos_pendientes
      FROM institucion i
      JOIN planilla_pedido_anual_detalle pad ON pad.id_institucion = i.id_institucion
      JOIN planilla_pedido_anual pa ON pa.id = pad.planilla_id
      WHERE pa.anio = $1 AND pa.estado = 'adjudicada'
      GROUP BY i.id_institucion, i.nombre, i.cue
      HAVING (
          SELECT COUNT(*) 
          FROM planilla_pedido_anual_detalle d
          LEFT JOIN (
            SELECT id_institucion, id_producto, SUM(cantidad_entregada) as entregado
            FROM entrega_anual
            WHERE anio = $1
            GROUP BY id_institucion, id_producto
          ) e ON e.id_institucion = d.id_institucion AND e.id_producto = d.id_producto
          WHERE d.id_institucion = i.id_institucion 
            AND d.planilla_id IN (SELECT id FROM planilla_pedido_anual WHERE anio = $1 AND estado = 'adjudicada')
            AND (e.entregado IS NULL OR e.entregado < d.cantidad)
      ) > 0
      ORDER BY i.nombre ASC
    `, [anio]);
    res.json({ pendientes: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener pendientes de distribución" });
  }
}

async function getDetalleDistribucionEscuela(req, res) {
  try {
    const { id } = req.params;
    const anio = Number(req.query.anio || new Date().getFullYear());
    
    const items = await all(`
      SELECT 
        p.id_producto as id, p.nombre as producto, p.unidad_medida,
        pad.cantidad as cantidad_adjudicada,
        COALESCE(e.entregado, 0) as cantidad_entregada
      FROM planilla_pedido_anual_detalle pad
      JOIN producto p ON p.id_producto = pad.id_producto
      JOIN planilla_pedido_anual pa ON pa.id = pad.planilla_id
      LEFT JOIN (
        SELECT id_institucion, id_producto, SUM(cantidad_entregada) as entregado
        FROM entrega_anual
        WHERE anio = $1
        GROUP BY id_institucion, id_producto
      ) e ON e.id_institucion = pad.id_institucion AND e.id_producto = pad.id_producto
      WHERE pad.id_institucion = $2 AND pa.anio = $1 AND pa.estado = 'adjudicada'
    `, [anio, id]);

    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener detalle de escuela" });
  }
}

async function registrarSalidaDistribucion(req, res) {
  const client = await pool.connect();
  try {
    const { id_institucion, anio, entregas, id_deposito, observaciones } = req.body;
    if (!id_institucion || !entregas || !id_deposito) {
      return res.status(400).json({ error: "Faltan datos obligatorios" });
    }

    await client.query("BEGIN");

    for (const ent of entregas) {
      const { id_producto, cantidad } = ent;
      if (!cantidad || cantidad <= 0) continue;

      // 1. Verificar stock en depósito
      const stockRes = await client.query(
        "SELECT cantidad FROM stock_deposito WHERE id_deposito = $1 AND id_producto = $2 FOR UPDATE",
        [id_deposito, id_producto]
      );
      const stockDisp = stockRes.rows[0]?.cantidad || 0;
      if (stockDisp < cantidad) {
        throw new Error(`Stock insuficiente para producto ${id_producto}. Disponible: ${stockDisp}`);
      }

      // 2. Registrar en entrega_anual
      await client.query(
        `INSERT INTO entrega_anual (id_institucion, anio, id_producto, cantidad_entregada, id_deposito, id_usuario, observaciones)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id_institucion, anio, id_producto, cantidad, id_deposito, req.user.sub, observaciones]
      );

      // 3. Actualizar stock en depósito
      await client.query(
        `UPDATE stock_deposito SET cantidad = cantidad - $1 WHERE id_deposito = $2 AND id_producto = $3`,
        [cantidad, id_deposito, id_producto]
      );

      // 4. Actualizar stock global
      await client.query(
        "UPDATE producto SET stock_actual = stock_actual - $1 WHERE id_producto = $2",
        [cantidad, id_producto]
      );

      // 5. Registrar movimiento de stock
      await client.query(
        `INSERT INTO movimiento_stock (id_producto, cantidad, tipo, motivo, id_usuario, id_deposito, id_institucion)
         VALUES ($1, $2, 'egreso', $3, $4, $5, $6)`,
        [id_producto, cantidad, `Distribución Anual ${anio}`, req.user.sub, id_deposito, id_institucion]
      );
    }

    await client.query("COMMIT");
    res.json({ ok: true, message: "Distribución registrada con éxito" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error al registrar salida distribución:", err);
    res.status(500).json({ error: err.message || "Error al procesar la salida" });
  } finally {
    client.release();
  }
}

async function getVencimientosProximos(req, res) {
  try {
    await ensureDepositosSchema();
    const dias = Number(req.query.dias || 60);
    console.log("[vencimientos-proximos] Consultando con dias:", dias);

    // Verificar que existen las columnas necesarias
    const columnCheck = await get(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'movimiento_stock' AND column_name = 'fecha_vencimiento'
    `);
    console.log("[vencimientos-proximos] Column check:", columnCheck);

    if (!columnCheck) {
      console.log("[vencimientos-proximos] Columna fecha_vencimiento no existe");
      return res.json({ alertas: [] });
    }

    // Buscamos ingresos que tengan fecha de vencimiento próxima
    const rows = await all(`
      SELECT
        p.nombre as producto,
        p.unidad_medida,
        d.nombre as deposito,
        ms.fecha_vencimiento,
        sd.cantidad as stock_actual_deposito,
        (ms.fecha_vencimiento - CURRENT_DATE) as dias_para_vencer
      FROM movimiento_stock ms
      JOIN producto p ON p.id_producto = ms.id_producto
      JOIN deposito d ON d.id_deposito = ms.id_deposito
      JOIN stock_deposito sd ON sd.id_producto = ms.id_producto AND sd.id_deposito = ms.id_deposito
      WHERE ms.tipo = 'ingreso'
        AND ms.fecha_vencimiento IS NOT NULL
        AND ms.fecha_vencimiento <= (CURRENT_DATE + ? * INTERVAL '1 day')
        AND ms.fecha_vencimiento >= CURRENT_DATE
        AND sd.cantidad > 0
      ORDER BY ms.fecha_vencimiento ASC
    `, [dias]);
    console.log("[vencimientos-proximos] Resultados:", rows.length);
    res.json({ alertas: rows });
  } catch (err) {
    console.error("[vencimientos-proximos] Error detallado:", err.message);
    console.error("[vencimientos-proximos] Stack:", err.stack);
    res.status(500).json({ error: "Error al obtener alertas de vencimiento", details: err.message });
  }
}

router.get("/vencimientos-proximos", authorizePermissions(PERMISSIONS.STOCK_VIEW), getVencimientosProximos);
router.get("/distribucion/pendientes", authorizePermissions(PERMISSIONS.STOCK_VIEW), getPendientesDistribucion);
router.get("/distribucion/pendientes/:id", authorizePermissions(PERMISSIONS.STOCK_VIEW), getDetalleDistribucionEscuela);
router.post("/distribucion/registrar-salida", authorizePermissions(PERMISSIONS.STOCK_MOVEMENT_CREATE), registrarSalidaDistribucion);

module.exports = router;
