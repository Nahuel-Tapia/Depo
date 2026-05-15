const express = require("express");
const { all, get, run, pool } = require("../db.pg");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");

const router = express.Router();

router.use(authenticate);

async function hasTable(tableName) {
  const row = await get(`SELECT to_regclass($1) AS regclass`, [`public.${tableName}`]);
  return Boolean(row?.regclass);
}

// Listar productos (con ubicación de depósito)
router.get("/", authorizePermissions(PERMISSIONS.PRODUCTOS_VIEW), async (req, res) => {
  try {
    const isEscolar = req.user.role === "operador_escolar";
    const [hasStockDeposito, hasDeposito] = await Promise.all([
      hasTable('stock_deposito'),
      hasTable('deposito')
    ]);

    let productos;
    if (hasStockDeposito && hasDeposito) {
      let query = `
        SELECT
          p.id_producto as id,
          p.nombre,
          p.unidad_medida,
          p.stock_actual,
          p.stock_minimo,
          p.id_categoria,
          c.nombre as categoria_nombre,
          COALESCE(SUM(sd.cantidad), 0) as stock_total,
          COALESCE(SUM(CASE WHEN d.tipo = 'central' THEN sd.cantidad ELSE 0 END), 0) as stock_central,
          COALESCE(SUM(CASE WHEN d.tipo = 'centro_civico' THEN sd.cantidad ELSE 0 END), 0) as stock_centro_civico,
          COALESCE(SUM(CASE WHEN d.tipo = 'capsula' THEN sd.cantidad ELSE 0 END), 0) as stock_capsula,
          CASE
            WHEN COALESCE(SUM(CASE WHEN d.tipo = 'central' THEN sd.cantidad ELSE 0 END), 0) > 0 THEN 'Depósito Central'
            WHEN COALESCE(SUM(CASE WHEN d.tipo = 'centro_civico' THEN sd.cantidad ELSE 0 END), 0) > 0 THEN 'Centro Cívico'
            WHEN COALESCE(SUM(CASE WHEN d.tipo = 'capsula' THEN sd.cantidad ELSE 0 END), 0) > 0 THEN 'Cápsula'
            ELSE 'Depósito Central'
          END as deposito
        FROM producto p
        LEFT JOIN stock_deposito sd ON sd.id_producto = p.id_producto
        LEFT JOIN deposito d ON d.id_deposito = sd.id_deposito
        LEFT JOIN categoria c ON p.id_categoria = c.id_categoria
        WHERE 1=1
      `;
      
      const params = [];
      if (isEscolar) {
        query += " AND (p.requiere_autorizacion = FALSE OR p.requiere_autorizacion IS NULL)";
      }

      query += `
        GROUP BY p.id_producto, p.nombre, p.unidad_medida, p.stock_actual, p.stock_minimo, p.id_categoria, c.nombre
        ORDER BY p.id_producto DESC
      `;
      
      productos = await all(query, params);
    } else {
      let query = `
        SELECT
          p.id_producto as id,
          p.nombre,
          p.unidad_medida,
          p.stock_actual,
          p.stock_minimo,
          p.id_categoria,
          c.nombre as categoria_nombre,
          0 as stock_central,
          0 as stock_centro_civico,
          0 as stock_capsula,
          'Depósito Central' as deposito
        FROM producto p
        LEFT JOIN categoria c ON p.id_categoria = c.id_categoria
        WHERE 1=1
      `;
      
      if (isEscolar) {
        query += " AND (p.requiere_autorizacion = FALSE OR p.requiere_autorizacion IS NULL)";
      }
      
      query += " ORDER BY p.id_producto DESC";
      
      productos = await all(query);
    }

    return res.json({ productos });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo listar productos" });
  }
});

// Listar categorías (para dropdown)
router.get("/categorias", authorizePermissions(PERMISSIONS.PRODUCTOS_VIEW), async (req, res) => {
  try {
    const categorias = await all("SELECT id_categoria as id, nombre, tipo_bien FROM categoria ORDER BY nombre");
    return res.json({ categorias });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo listar categorías" });
  }
});

// Obtener un producto
router.get("/:id", authorizePermissions(PERMISSIONS.PRODUCTOS_VIEW), async (req, res) => {
  try {
    const { id } = req.params;
    const isEscolar = req.user.role === "operador_escolar";

    const producto = await get(`
      SELECT 
        p.id_producto as id,
        p.nombre,
        p.unidad_medida,
        p.stock_actual,
        p.stock_minimo,
        p.id_categoria,
        p.requiere_autorizacion,
        c.nombre as categoria_nombre
      FROM producto p
      LEFT JOIN categoria c ON p.id_categoria = c.id_categoria
      WHERE p.id_producto = ?
    `, [id]);
    if (!producto) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    if (isEscolar && producto.requiere_autorizacion) {
      return res.status(403).json({ error: "No tenés acceso a productos de la cápsula de seguridad" });
    }

    return res.json({ producto });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo obtener el producto" });
  }
});

// Obtener detalle de stock y vencimientos de un producto
router.get("/:id/stock-detalle", authorizePermissions(PERMISSIONS.PRODUCTOS_VIEW), async (req, res) => {
  try {
    const { id } = req.params;
    const isEscolar = req.user.role === "operador_escolar";

    const producto = await get("SELECT requiere_autorizacion FROM producto WHERE id_producto = ?", [id]);
    if (!producto) return res.status(404).json({ error: "Producto no encontrado" });

    if (isEscolar && producto.requiere_autorizacion) {
      return res.status(403).json({ error: "No tenés acceso a este producto" });
    }
    
    // 1. Distribución en depósitos
    const depositos = await all(`
      SELECT d.nombre as deposito, sd.cantidad
      FROM stock_deposito sd
      JOIN deposito d ON d.id_deposito = sd.id_deposito
      WHERE sd.id_producto = $1 AND sd.cantidad > 0
    `, [id]);

    // 2. Vencimientos
    const vencimientos = await all(`
      SELECT d.nombre as deposito, ms.fecha_vencimiento, ms.cantidad
      FROM movimiento_stock ms
      JOIN deposito d ON d.id_deposito = ms.id_deposito
      WHERE ms.id_producto = $1 AND ms.tipo = 'ingreso' AND ms.fecha_vencimiento IS NOT NULL
      ORDER BY ms.fecha_vencimiento ASC
    `, [id]);

    return res.json({ depositos, vencimientos });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo obtener el detalle de stock" });
  }
});

// Crear producto
router.post("/", authorizePermissions(PERMISSIONS.PRODUCTOS_CREATE), async (req, res) => {
  const client = await pool.connect();
  try {
    const { nombre, unidad_medida, stock_minimo, id_categoria } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: "El nombre es obligatorio" });
    }

    const stock_actual_val = parseInt(req.body.stock_actual) || 0;

    await client.query("BEGIN");

    // Insertar producto
    const insertResult = await client.query(
      `INSERT INTO producto (nombre, unidad_medida, stock_actual, stock_minimo, id_categoria)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id_producto`,
      [nombre, unidad_medida || 'unidad', stock_actual_val, parseInt(stock_minimo) || 0, id_categoria || null]
    );

    const newId = insertResult.rows[0].id_producto;

    // Sincronizar con Depósito Central si hay stock inicial
    if (stock_actual_val > 0) {
      const centralResult = await client.query(
        "SELECT id_deposito FROM deposito WHERE tipo = 'central' LIMIT 1"
      );
      const central = centralResult.rows[0];

      if (central) {
        // Verificar si existe la tabla stock_deposito
        const hasStockDeposito = await hasTable('stock_deposito');
        if (hasStockDeposito) {
          await client.query(
            `INSERT INTO stock_deposito (id_deposito, id_producto, cantidad)
             VALUES ($1, $2, $3)
             ON CONFLICT (id_deposito, id_producto)
             DO UPDATE SET cantidad = EXCLUDED.cantidad`,
            [central.id_deposito, newId, stock_actual_val]
          );
        }

        // Verificar si existe la tabla movimiento_stock
        const hasMovimientoStock = await hasTable('movimiento_stock');
        if (hasMovimientoStock) {
          await client.query(
            `INSERT INTO movimiento_stock (id_producto, tipo, cantidad, motivo, id_usuario, id_deposito)
             VALUES ($1, 'ingreso', $2, 'Stock inicial catálogo', $3, $4)`,
            [newId, stock_actual_val, req.user.sub, central.id_deposito]
          );
        }
      }
    }

    await client.query("COMMIT");
    return res.status(201).json({ id: newId });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[crear-producto] Error:", err.message);
    return res.status(500).json({ error: "No se pudo crear el producto", details: err.message });
  } finally {
    client.release();
  }
});

// Editar producto
router.patch("/:id", authorizePermissions(PERMISSIONS.PRODUCTOS_EDIT), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { nombre, unidad_medida, stock_minimo, id_categoria } = req.body;

    const productoResult = await client.query(
      "SELECT * FROM producto WHERE id_producto = $1",
      [id]
    );
    if (productoResult.rows.length === 0) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (nombre !== undefined) {
      updates.push(`nombre = $${paramIndex++}`);
      params.push(nombre);
    }
    if (unidad_medida !== undefined) {
      updates.push(`unidad_medida = $${paramIndex++}`);
      params.push(unidad_medida);
    }
    if (stock_minimo !== undefined) {
      updates.push(`stock_minimo = $${paramIndex++}`);
      params.push(parseInt(stock_minimo) || 0);
    }
    if (id_categoria !== undefined) {
      updates.push(`id_categoria = $${paramIndex++}`);
      params.push(id_categoria || null);
    }
    if (req.body.stock_actual !== undefined) {
      updates.push(`stock_actual = $${paramIndex++}`);
      params.push(parseInt(req.body.stock_actual) || 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No hay campos para actualizar" });
    }

    params.push(id);

    await client.query(
      `UPDATE producto SET ${updates.join(", ")} WHERE id_producto = $${paramIndex}`,
      params
    );

    // Si se actualizó el stock_actual, sincronizar con el depósito central
    if (req.body.stock_actual !== undefined) {
      const stock_val = parseInt(req.body.stock_actual) || 0;
      const centralResult = await client.query(
        "SELECT id_deposito FROM deposito WHERE tipo = 'central' LIMIT 1"
      );
      const central = centralResult.rows[0];

      if (central) {
        const hasStockDeposito = await hasTable('stock_deposito');
        if (hasStockDeposito) {
          await client.query(
            `INSERT INTO stock_deposito (id_deposito, id_producto, cantidad)
             VALUES ($1, $2, $3)
             ON CONFLICT (id_deposito, id_producto)
             DO UPDATE SET cantidad = EXCLUDED.cantidad`,
            [central.id_deposito, id, stock_val]
          );
        }
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("[editar-producto] Error:", err.message);
    return res.status(500).json({ error: "No se pudo editar el producto", details: err.message });
  } finally {
    client.release();
  }
});

// Eliminar producto
router.delete("/:id", authorizePermissions(PERMISSIONS.PRODUCTOS_DELETE), async (req, res) => {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "ID de producto inválido" });
    }

    const producto = await get("SELECT * FROM producto WHERE id_producto = ?", [id]);
    if (!producto) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    await client.query("BEGIN");

    // Limpia referencias históricas para permitir baja física del producto.
    const relatedDeletes = [
      ["movimiento_stock", "id_producto"],
      ["movimientos", "producto_id"],
      ["ajustes", "producto_id"],
      ["asignaciones_stock", "producto_id"],
      ["limite_stock", "id_producto"],
      ["detalle_orden", "id_producto"],
      ["detalle_ingreso", "id_producto"],
      ["detalle_pedido", "id_producto"],
      ["pedidos", "producto_id"],
    ];

    const existingTablesRes = await client.query(
      `SELECT tablename
       FROM pg_tables
       WHERE schemaname = 'public'`
    );
    const existingTables = new Set(existingTablesRes.rows.map((row) => row.tablename));

    for (const [table, column] of relatedDeletes) {
      if (!existingTables.has(table)) {
        continue;
      }

      await client.query(`DELETE FROM ${table} WHERE ${column} = $1`, [id]);
    }

    await client.query("DELETE FROM producto WHERE id_producto = $1", [id]);
    await client.query("COMMIT");

    return res.json({ ok: true });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
      // ignore rollback errors
    }
    console.error(err);
    return res.status(500).json({ error: "No se pudo eliminar el producto" });
  } finally {
    client.release();
  }
});

module.exports = router;
