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
      // Agregar fecha_vencimiento e id_deposito a movimiento_stock
      await run(`ALTER TABLE movimiento_stock ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE`);
      await run(`ALTER TABLE movimiento_stock ADD COLUMN IF NOT EXISTS id_deposito INT`);
      await run(`ALTER TABLE movimiento_stock ADD COLUMN IF NOT EXISTS id_deposito_destino INT`);
      // Agregar 'traslado' al enum si no existe
      await run(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'tipo_movimiento' AND e.enumlabel = 'traslado') THEN ALTER TYPE tipo_movimiento ADD VALUE 'traslado'; END IF; END $$`);

      // Asegurar tablas de licitación y distribución
      await run(`
        CREATE TABLE IF NOT EXISTS licitacion_publicada (
          id SERIAL PRIMARY KEY,
          anio INT NOT NULL UNIQUE,
          usuario_id INT,
          items JSONB NOT NULL DEFAULT '[]'::jsonb,
          fecha_publicacion TIMESTAMP DEFAULT NOW(),
          estado VARCHAR(30) NOT NULL DEFAULT 'publicada'
        )
      `);

      await run(`ALTER TABLE licitacion_publicada ADD COLUMN IF NOT EXISTS usuario_id INT`);
      await run(`ALTER TABLE licitacion_publicada ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb`);
      await run(`ALTER TABLE licitacion_publicada ADD COLUMN IF NOT EXISTS fecha_publicacion TIMESTAMP DEFAULT NOW()`);
      await run(`ALTER TABLE licitacion_publicada ADD COLUMN IF NOT EXISTS estado VARCHAR(30) NOT NULL DEFAULT 'publicada'`);

      await run(`
        CREATE TABLE IF NOT EXISTS remito_licitacion (
          id SERIAL PRIMARY KEY,
          numero VARCHAR(30) NOT NULL UNIQUE,
          licitacion_id INT NOT NULL,
          id_deposito INT,
          usuario_id INT,
          observaciones TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

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
      await run(`ALTER TABLE recepcion_licitacion ADD COLUMN IF NOT EXISTS remito_id INT REFERENCES remito_licitacion(id)`);
      await run(`ALTER TABLE recepcion_licitacion ADD COLUMN IF NOT EXISTS cantidad_danada NUMERIC(12,2) NOT NULL DEFAULT 0`);
      await run(`ALTER TABLE recepcion_licitacion ADD COLUMN IF NOT EXISTS obs_danio TEXT`);

      await run(`
        CREATE TABLE IF NOT EXISTS recepcion_danio_imagen (
          id SERIAL PRIMARY KEY,
          remito_id INT NOT NULL REFERENCES remito_licitacion(id),
          producto_id INT,
          nombre VARCHAR(255),
          mime_type VARCHAR(80),
          datos TEXT NOT NULL,
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
    const isEscolar = req.user.role === "operador_escolar";
    let query = `
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
    `;

    if (isEscolar) {
      query += " AND d.id_deposito IN (1, 2)";
    }

    query += " ORDER BY d.tipo, d.id_deposito";

    const depositos = await all(query);
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
    const isEscolar = req.user.role === "operador_escolar";
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
        WHERE 1=1 ${isEscolar ? 'AND (p.requiere_autorizacion = FALSE OR p.requiere_autorizacion IS NULL)' : ''}
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
    const isEscolar = req.user.role === "operador_escolar";
    const deposito = await get("SELECT * FROM deposito WHERE id_deposito = $1", [id]);
    if (!deposito) {
      return res.status(404).json({ error: "Depósito no encontrado" });
    }

    if (isEscolar && deposito.tipo === "capsula") {
      return res.status(403).json({ error: "No tenés acceso a la cápsula de seguridad" });
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
    // Log traslado unificado (un solo registro)
    await client.query(
      `INSERT INTO movimiento_stock (id_producto, tipo, cantidad, motivo, id_usuario, id_deposito, id_deposito_destino)
       VALUES ($1, 'traslado', $2, $3, $4, $5, $6)`,
      [id_producto, cantidad, mot, req.user.sub, origen_id, destino_id]
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

// Obtener historial de traslados
router.get("/traslados", authorizePermissions(PERMISSIONS.STOCK_MOVEMENT_VIEW), async (req, res) => {
  try {
    const traslados = await all(`
      SELECT
        m.id_movimiento,
        m.id_producto,
        p.nombre AS producto_nombre,
        m.cantidad,
        m.motivo,
        m.fecha_movimiento AS created_at,
        m.id_deposito AS origen_id,
        d1.nombre AS origen_nombre,
        m.id_deposito_destino AS destino_id,
        d2.nombre AS destino_nombre,
        u.nombre AS usuario_nombre
      FROM movimiento_stock m
      JOIN producto p ON p.id_producto = m.id_producto
      JOIN deposito d1 ON d1.id_deposito = m.id_deposito
      JOIN deposito d2 ON d2.id_deposito = m.id_deposito_destino
      LEFT JOIN usuario u ON u.id_usuario = m.id_usuario
      WHERE m.tipo = 'traslado'
      ORDER BY m.fecha_movimiento DESC
    `);
    return res.json({ traslados });
  } catch (err) {
    console.error("Error obteniendo traslados:", err);
    return res.status(500).json({ error: "No se pudo obtener el historial de traslados" });
  }
})

// Crear movimiento de ingreso a depósito
router.post("/:id/ingreso", authorizePermissions(PERMISSIONS.STOCK_MOVEMENT_CREATE), async (req, res) => {
  try {
    await ensureDepositosSchema();
    const { id } = req.params;
    const { id_producto, cantidad, id_proveedor, motivo, fecha_vencimiento } = req.body;

    if (!id_producto || !cantidad) {
      return res.status(400).json({ error: "Producto y cantidad requeridos" });
    }

    const productoIdNum = parseInt(id_producto, 10);
    const cantidadNum = parseInt(cantidad, 10);
    const depositoIdNum = parseInt(id, 10);
    const proveedorIdNum = id_proveedor ? parseInt(id_proveedor, 10) : null;

    const deposito = await get("SELECT * FROM deposito WHERE id_deposito = $1", [depositoIdNum]);
    if (!deposito) {
      return res.status(404).json({ error: "Depósito no encontrado" });
    }

    // Verificar si producto requiere autorización y el usuario tiene permiso
    const producto = await get("SELECT * FROM producto WHERE id_producto = $1", [productoIdNum]);
    if (!producto) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    if (producto.requiere_autorizacion) {
      const esCapsula = deposito.tipo === "capsula";
      if (esCapsula && req.user.role !== "admin") {
        return res.status(403).json({ error: "Requiere autorización para ingresos a Cápsula" });
      }
    }

    // Insertar movimiento
    await run(`
      INSERT INTO movimiento_stock (id_producto, cantidad, tipo, id_proveedor, motivo, id_usuario, id_deposito, fecha_vencimiento)
      VALUES ($1, $2, 'ingreso', $3, $4, $5, $6, $7)
    `, [productoIdNum, cantidadNum, proveedorIdNum, motivo || "Ingreso a depósito", req.user.sub, depositoIdNum, fecha_vencimiento || null]);

    // Actualizar stock en depósito
    await pool.query(`
      INSERT INTO stock_deposito (id_deposito, id_producto, cantidad)
      VALUES ($1, $2, $3)
      ON CONFLICT (id_deposito, id_producto) 
      DO UPDATE SET cantidad = stock_deposito.cantidad + $3
    `, [depositoIdNum, productoIdNum, cantidadNum]);

    // Actualizar stock global
    await pool.query(
      "UPDATE producto SET stock_actual = COALESCE(stock_actual, 0) + $1 WHERE id_producto = $2",
      [cantidadNum, productoIdNum]
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
    await ensureDepositosSchema();
    const { id } = req.params;
    const { id_producto, cantidad, id_institucion, motivo } = req.body;

    if (!id_producto || !cantidad) {
      return res.status(400).json({ error: "Producto y cantidad requeridos" });
    }

    const productoIdNum = parseInt(id_producto, 10);
    const cantidadNum = parseInt(cantidad, 10);
    const depositoIdNum = parseInt(id, 10);
    const institucionIdNum = id_institucion ? parseInt(id_institucion, 10) : null;

    const deposito = await get("SELECT * FROM deposito WHERE id_deposito = $1", [depositoIdNum]);
    if (!deposito) {
      return res.status(404).json({ error: "Depósito no encontrado" });
    }

    // Verificar stock disponible
    const stockDep = await get(
      "SELECT cantidad FROM stock_deposito WHERE id_deposito = $1 AND id_producto = $2",
      [depositoIdNum, productoIdNum]
    );
    const stockDisp = stockDep?.cantidad || 0;
    if (stockDisp < cantidadNum) {
      return res.status(400).json({ error: `Stock insuficiente. Disponible: ${stockDisp}` });
    }

    // Verificar si producto requiere autorización
    const producto = await get("SELECT requiere_autorizacion FROM producto WHERE id_producto = $1", [productoIdNum]);
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
    `, [productoIdNum, cantidadNum, institucionIdNum, motivo || "Egreso de depósito", req.user.sub, depositoIdNum]);

    // Actualizar stock en depósito
    await run(
      "UPDATE stock_deposito SET cantidad = cantidad - $1 WHERE id_deposito = $2 AND id_producto = $3",
      [cantidadNum, depositoIdNum, productoIdNum]
    );

    // Actualizar stock global
    await pool.query(
      "UPDATE producto SET stock_actual = COALESCE(stock_actual, 0) - $1 WHERE id_producto = $2",
      [cantidadNum, productoIdNum]
    );

    return res.json({ ok: true, message: "Egreso registrado" });
  } catch (err) {
    console.error("Error en egreso:", err);
    return res.status(500).json({ error: "No se pudo registrar egreso" });
  }
});

async function getRecepcionesLicitacion(req, res) {
  try {
    await ensureDepositosSchema();
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
    await ensureDepositosSchema();
    const { id } = req.params;
    const row = await get(`SELECT id, items, anio FROM licitacion_publicada WHERE id = $1`, [id]);
    if (!row) return res.status(404).json({ error: "Licitación no encontrada" });

    // Consolidar por nombre de producto - El operador no necesita ver qué escuela pidió cada cosa
    const items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items;
    const consolidatedMap = {};
    items.forEach(item => {
      const key = item.producto.trim().toLowerCase();
      if (!consolidatedMap[key]) {
        consolidatedMap[key] = {
          producto_id: item.producto_id,
          producto: item.producto,
          unidad_medida: item.unidad_medida,
          cantidad_total: 0
        };
      }
      consolidatedMap[key].cantidad_total += Number(item.cantidad_a_licitar || 0);
    });
    const cleanItems = Object.values(consolidatedMap);

    // Obtener lo ya recibido agrupado por nombre de producto
    const recibidos = await all(
      `SELECT pr.nombre AS producto, SUM(rl.cantidad_recibida) as total_recibida
       FROM recepcion_licitacion rl
       JOIN producto pr ON pr.id_producto = rl.producto_id
       WHERE rl.licitacion_id = $1
       GROUP BY pr.nombre`,
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

    await ensureDepositosSchema();

    const ingresosValidos = ingresos.filter(
      ing => Number(ing.cantidad) > 0 || Number(ing.cantidad_danada) > 0
    );
    if (ingresosValidos.length === 0) {
      return res.status(400).json({ error: "Cargue al menos una cantidad recibida o dañada mayor a 0" });
    }

    await client.query("BEGIN");

    // Obtener año de la licitación para el número de remito
    const licRow = await client.query(
      `SELECT anio FROM licitacion_publicada WHERE id = $1`,
      [licitacion_id]
    );
    if (!licRow.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Licitación no encontrada" });
    }
    const anio = licRow.rows[0].anio;

    // Generar número de remito secuencial por año: REMITO-YYYY-NNN
    const countRow = await client.query(
      `SELECT COUNT(*) AS total FROM remito_licitacion
       WHERE licitacion_id IN (SELECT id FROM licitacion_publicada WHERE anio = $1)`,
      [anio]
    );
    const seq = String(Number(countRow.rows[0].total) + 1).padStart(3, '0');
    const numero = `REMITO-${anio}-${seq}`;

    // Crear el remito
    const remitoRes = await client.query(
      `INSERT INTO remito_licitacion (numero, licitacion_id, id_deposito, usuario_id, observaciones)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [numero, licitacion_id, id_deposito, req.user.sub, observaciones || null]
    );
    const remito_id = remitoRes.rows[0].id;

    for (const ing of ingresosValidos) {
      const { producto_id, cantidad, cantidad_danada, obs_danio, fecha_vencimiento } = ing;
      const cantidadBuena = Number(cantidad) || 0;
      const cantidadDanada = Number(cantidad_danada) || 0;

      if (cantidadBuena < 0 || cantidadDanada < 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Las cantidades no pueden ser negativas" });
      }

      // 1. Registrar en recepcion_licitacion con remito_id
      await client.query(
        `INSERT INTO recepcion_licitacion (licitacion_id, producto_id, cantidad_recibida, usuario_id, observaciones, fecha_vencimiento, id_deposito, remito_id, cantidad_danada, obs_danio)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          licitacion_id,
          producto_id,
          cantidadBuena,
          req.user.sub,
          observaciones || null,
          fecha_vencimiento || null,
          id_deposito,
          remito_id,
          cantidadDanada,
          obs_danio || null,
        ]
      );

      // 2. Actualizar stock y movimiento solo con mercadería en buen estado.
      if (cantidadBuena > 0) {
        await client.query(
          `INSERT INTO stock_deposito (id_deposito, id_producto, cantidad)
           VALUES ($1, $2, $3)
           ON CONFLICT (id_deposito, id_producto)
           DO UPDATE SET cantidad = stock_deposito.cantidad + $3`,
          [id_deposito, producto_id, cantidadBuena]
        );

        // El trigger de movimiento_stock actualiza stock_actual automáticamente.
        await client.query(
          `INSERT INTO movimiento_stock (id_producto, cantidad, tipo, motivo, id_usuario, id_deposito, fecha_vencimiento)
           VALUES ($1, $2, 'ingreso', $3, $4, $5, $6)`,
          [producto_id, cantidadBuena, `Ingreso por Licitación #${licitacion_id} — ${numero}`, req.user.sub, id_deposito, fecha_vencimiento || null]
        );
      }
    }

    await client.query("COMMIT");
    res.json({ ok: true, message: "Mercadería ingresada con éxito", numero_remito: numero, remito_id });
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

// POST /licitacion/danio/imagen — adjuntar evidencia de daño al remito
router.post("/licitacion/danio/imagen", authorizePermissions(PERMISSIONS.STOCK_MOVEMENT_CREATE), async (req, res) => {
  try {
    await ensureDepositosSchema();
    const { remito_id, producto_id, nombre, mime_type, datos } = req.body;

    if (!remito_id || !datos) {
      return res.status(400).json({ error: "remito_id y datos son obligatorios" });
    }

    const remito = await get(`SELECT id FROM remito_licitacion WHERE id = $1`, [remito_id]);
    if (!remito) {
      return res.status(404).json({ error: "Remito no encontrado" });
    }

    await run(
      `INSERT INTO recepcion_danio_imagen (remito_id, producto_id, nombre, mime_type, datos)
       VALUES ($1, $2, $3, $4, $5)`,
      [remito_id, producto_id || null, nombre || null, mime_type || null, datos]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("Error guardando imagen de daño:", err);
    res.status(500).json({ error: "No se pudo guardar la imagen de daño" });
  }
});

// GET /licitacion/recepciones/:id/remitos — historial de remitos de una licitación
router.get("/licitacion/recepciones/:id/remitos", authorizePermissions(PERMISSIONS.STOCK_VIEW), async (req, res) => {
  try {
    await ensureDepositosSchema();
    const { id } = req.params;

    // Obtener año de la licitación para buscar proveedor en historial
    const licRow = await get(`SELECT anio FROM licitacion_publicada WHERE id = $1`, [id]);
    if (!licRow) return res.status(404).json({ error: "Licitación no encontrada" });
    const anio = licRow.anio;

    const remitos = await all(
      `SELECT r.id, r.numero, r.created_at, r.observaciones,
              d.nombre AS deposito_nombre,
              u.nombre AS usuario_nombre
       FROM remito_licitacion r
       LEFT JOIN deposito d ON d.id_deposito = r.id_deposito
       LEFT JOIN usuario u ON u.id_usuario = r.usuario_id
       WHERE r.licitacion_id = $1
       ORDER BY r.created_at DESC`,
      [id]
    );

    // Para cada remito, traer los items + proveedor desde historial de precios
    for (const remito of remitos) {
      remito.items = await all(
        `SELECT rl.id, rl.producto_id, p.nombre AS producto_nombre, p.unidad_medida,
                rl.cantidad_recibida, rl.cantidad_danada, rl.obs_danio, rl.fecha_vencimiento,
                pr.nombre AS proveedor_nombre
         FROM recepcion_licitacion rl
         JOIN producto p ON p.id_producto = rl.producto_id
         LEFT JOIN compra_precio_historico cph ON cph.id_producto = rl.producto_id AND cph.anio = $2
         LEFT JOIN proveedor pr ON pr.id_proveedor = cph.id_proveedor
         WHERE rl.remito_id = $1
         ORDER BY p.nombre`,
        [remito.id, anio]
      );

      remito.imagenes = await all(
        `SELECT id, producto_id, nombre, mime_type, datos, created_at
         FROM recepcion_danio_imagen
         WHERE remito_id = $1
         ORDER BY created_at DESC`,
        [remito.id]
      );
    }

    res.json({ remitos });
  } catch (err) {
    console.error("Error obteniendo remitos:", err);
    res.status(500).json({ error: "No se pudo obtener el historial de remitos" });
  }
});

// GET /licitacion/remito-general/:id — remito general (solo si licitación completada)
router.get("/licitacion/remito-general/:id", authorizePermissions(PERMISSIONS.STOCK_VIEW), async (req, res) => {
  try {
    await ensureDepositosSchema();
    const { id } = req.params;

    const lic = await get(`SELECT id, anio, estado, items FROM licitacion_publicada WHERE id = $1`, [id]);
    if (!lic) return res.status(404).json({ error: "Licitación no encontrada" });
    if (lic.estado !== 'completada') {
      return res.status(400).json({ error: "El Remito General solo está disponible cuando la licitación está completada" });
    }

    const anio = lic.anio;
    const rawItems = typeof lic.items === 'string' ? JSON.parse(lic.items) : lic.items;

    // Consolidar adjudicado por producto_id
    const adjudicadoMap = {};
    rawItems.forEach(item => {
      const pid = item.producto_id;
      if (!adjudicadoMap[pid]) {
        adjudicadoMap[pid] = { producto_id: pid, producto: item.producto, unidad_medida: item.unidad_medida, cantidad_adjudicada: 0 };
      }
      adjudicadoMap[pid].cantidad_adjudicada += Number(item.cantidad_a_licitar || 0);
    });

    // Total recibido por producto
    const recibidos = await all(
      `SELECT rl.producto_id, SUM(rl.cantidad_recibida) AS total_recibido
       FROM recepcion_licitacion rl WHERE rl.licitacion_id = $1
       GROUP BY rl.producto_id`,
      [id]
    );
    const recibidoMap = {};
    recibidos.forEach(r => { recibidoMap[r.producto_id] = Number(r.total_recibido); });

    const danados = await all(
      `SELECT rl.producto_id, SUM(rl.cantidad_danada) AS total_danado
       FROM recepcion_licitacion rl WHERE rl.licitacion_id = $1
       GROUP BY rl.producto_id`,
      [id]
    );
    const danadoMap = {};
    danados.forEach(d => { danadoMap[d.producto_id] = Number(d.total_danado); });

    // Proveedores desde historial de precios
    const proveedores = await all(
      `SELECT cph.id_producto, pr.nombre AS proveedor_nombre, cph.precio_compra_real
       FROM compra_precio_historico cph
       JOIN proveedor pr ON pr.id_proveedor = cph.id_proveedor
       WHERE cph.anio = $1`,
      [anio]
    );
    const proveedorMap = {};
    proveedores.forEach(p => { proveedorMap[p.id_producto] = { nombre: p.proveedor_nombre, precio: p.precio_compra_real }; });

    const items = Object.values(adjudicadoMap).map(item => ({
      ...item,
      total_recibido: recibidoMap[item.producto_id] || 0,
      total_danado: danadoMap[item.producto_id] || 0,
      diferencia: (recibidoMap[item.producto_id] || 0) - item.cantidad_adjudicada,
      proveedor_nombre: proveedorMap[item.producto_id]?.nombre || '-',
      precio_unitario: proveedorMap[item.producto_id]?.precio || null,
    }));

    // Lista de remitos que componen este general
    const remitos = await all(
      `SELECT r.numero, r.created_at, u.nombre AS usuario_nombre, d.nombre AS deposito_nombre
       FROM remito_licitacion r
       LEFT JOIN usuario u ON u.id_usuario = r.usuario_id
       LEFT JOIN deposito d ON d.id_deposito = r.id_deposito
       WHERE r.licitacion_id = $1 ORDER BY r.created_at`,
      [id]
    );

    res.json({ licitacion_id: lic.id, anio, estado: lic.estado, items, remitos });
  } catch (err) {
    console.error("Error generando remito general:", err);
    res.status(500).json({ error: "No se pudo generar el remito general" });
  }
});

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

    // Verificar que existen las columnas necesarias
    const columnCheck = await get(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'movimiento_stock' AND column_name = 'fecha_vencimiento'
    `);

    if (!columnCheck) {
      return res.json({ alertas: [] });
    }

    // Buscamos ingresos que tengan fecha de vencimiento próxima
    const rows = await all(`
      SELECT
        p.id_producto,
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
