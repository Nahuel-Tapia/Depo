const { all, get, run, pool } = require("../db.pg");

const columnExistsCache = new Map();

async function columnExists(tableName, columnName) {
  const cacheKey = `${tableName}.${columnName}`;
  if (columnExistsCache.has(cacheKey)) return columnExistsCache.get(cacheKey);

  try {
    const row = await get(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = $1
           AND column_name = $2
       ) AS column_exists`,
      [tableName, columnName]
    );
    const exists = Boolean(row?.column_exists);
    columnExistsCache.set(cacheKey, exists);
    return exists;
  } catch (err) {
    return false;
  }
}

async function hasTable(tableName) {
  const row = await get(`SELECT to_regclass($1) AS regclass`, [`public.${tableName}`]);
  return Boolean(row?.regclass);
}

async function getProductos(user) {
  const isEscolar = user.role === "operador_escolar";
  const [hasStockDeposito, hasDeposito, hasTipo, hasTipoDeposito] = await Promise.all([
    hasTable('stock_deposito'),
    hasTable('deposito'),
    columnExists('deposito', 'tipo'),
    columnExists('deposito', 'tipo_deposito')
  ]);

  let tipoExpr = "'central'";
  if (hasTipo && hasTipoDeposito) {
    tipoExpr = "COALESCE(d.tipo, d.tipo_deposito)";
  } else if (hasTipo) {
    tipoExpr = "d.tipo";
  } else if (hasTipoDeposito) {
    tipoExpr = "d.tipo_deposito";
  }

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
        p.codigo_sku,
        p.marca,
        p.precio_unitario,
        p.ubicacion_estante,
        p.descripcion,
        p.es_perecedero,
        c.nombre as categoria_nombre,
        COALESCE(SUM(sd.cantidad), 0) as stock_total,
        COALESCE(SUM(CASE WHEN ${tipoExpr} = 'central' OR d.id_deposito = 1 THEN sd.cantidad ELSE 0 END), 0) as stock_central,
        COALESCE(SUM(CASE WHEN ${tipoExpr} = 'centro_civico' THEN sd.cantidad ELSE 0 END), 0) as stock_centro_civico,
        COALESCE(SUM(CASE WHEN ${tipoExpr} = 'capsula' THEN sd.cantidad ELSE 0 END), 0) as stock_capsula,
        CASE
          WHEN COALESCE(SUM(CASE WHEN ${tipoExpr} = 'central' OR d.id_deposito = 1 THEN sd.cantidad ELSE 0 END), 0) > 0 THEN 'Depósito Central'
          WHEN COALESCE(SUM(CASE WHEN ${tipoExpr} = 'centro_civico' THEN sd.cantidad ELSE 0 END), 0) > 0 THEN 'Centro Cívico'
          WHEN COALESCE(SUM(CASE WHEN ${tipoExpr} = 'capsula' THEN sd.cantidad ELSE 0 END), 0) > 0 THEN 'Cápsula'
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
      GROUP BY p.id_producto, p.nombre, p.unidad_medida, p.stock_actual, p.stock_minimo, p.id_categoria, p.codigo_sku, p.marca, p.precio_unitario, p.ubicacion_estante, p.descripcion, p.es_perecedero, c.nombre
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
        p.codigo_sku,
        p.marca,
        p.precio_unitario,
        p.ubicacion_estante,
        p.descripcion,
        p.es_perecedero,
        c.nombre as categoria_nombre,
        p.stock_actual as stock_central,
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

  return productos;
}

async function getCategorias() {
  return await all("SELECT id_categoria as id, nombre, tipo_bien FROM categoria ORDER BY nombre");
}

async function getProductoById(id, user) {
  const idNum = parseInt(id, 10);
  if (!Number.isInteger(idNum)) {
    throw { status: 400, message: "ID de producto inválido" };
  }

  const isEscolar = user.role === "operador_escolar";

  const producto = await get(`
    SELECT 
      p.id_producto as id,
      p.nombre,
      p.unidad_medida,
      p.stock_actual,
      p.stock_minimo,
      p.id_categoria,
      p.codigo_sku,
      p.marca,
      p.precio_unitario,
      p.ubicacion_estante,
      p.descripcion,
      p.es_perecedero,
      p.requiere_autorizacion,
      c.nombre as categoria_nombre
    FROM producto p
    LEFT JOIN categoria c ON p.id_categoria = c.id_categoria
    WHERE p.id_producto = ?
  `, [idNum]);

  if (!producto) {
    throw { status: 404, message: "Producto no encontrado" };
  }

  if (isEscolar && producto.requiere_autorizacion) {
    throw { status: 403, message: "No tenés acceso to productos de la cápsula de seguridad" };
  }

  return producto;
}

async function getProductoStockDetalle(id, user) {
  const isEscolar = user.role === "operador_escolar";

  const producto = await get("SELECT requiere_autorizacion FROM producto WHERE id_producto = ?", [id]);
  if (!producto) throw { status: 404, message: "Producto no encontrado" };

  if (isEscolar && producto.requiere_autorizacion) {
    throw { status: 403, message: "No tenés acceso a este producto" };
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

  return { depositos, vencimientos };
}

async function createProducto(user, body) {
  const client = await pool.connect();
  try {
    const {
      nombre,
      unidad_medida,
      stock_minimo,
      id_categoria,
      codigo_sku,
      marca,
      precio_unitario,
      ubicacion_estante,
      descripcion,
      es_perecedero
    } = body;

    if (!nombre) {
      throw { status: 400, message: "El nombre es obligatorio" };
    }

    if (nombre.length > 255) {
      throw { status: 400, message: "El nombre es demasiado largo (máximo 255 caracteres)" };
    }

    const stock_actual_val = parseInt(body.stock_actual) || 0;

    await client.query("BEGIN");

    // Insertar producto con campos extendidos de catálogo
    const insertResult = await client.query(
      `INSERT INTO producto (
        nombre, unidad_medida, stock_actual, stock_minimo, id_categoria,
        codigo_sku, marca, precio_unitario, ubicacion_estante, descripcion, es_perecedero
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id_producto`,
      [
        nombre.trim(),
        unidad_medida ? unidad_medida.trim() : 'unidad',
        stock_actual_val,
        parseInt(stock_minimo) || 0,
        id_categoria || null,
        codigo_sku ? codigo_sku.trim() : null,
        marca ? marca.trim() : null,
        parseFloat(precio_unitario) || 0,
        ubicacion_estante ? ubicacion_estante.trim() : null,
        descripcion ? descripcion.trim() : null,
        Boolean(es_perecedero)
      ]
    );

    const newId = insertResult.rows[0].id_producto;

    // Sincronizar con Depósito Central si hay stock inicial
    if (stock_actual_val > 0) {
      const centralResult = await client.query(
        "SELECT id_deposito FROM deposito WHERE COALESCE(tipo, tipo_deposito) = 'central' LIMIT 1"
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
          const userId = user.id_usuario || user.sub || user.id || null;
          await client.query(
            `INSERT INTO movimiento_stock (id_producto, tipo, cantidad, motivo, id_usuario, id_deposito)
             VALUES ($1, 'ingreso', $2, 'Stock inicial catálogo', $3, $4)`,
            [newId, stock_actual_val, userId, central.id_deposito]
          );
        }
      }
    }

    await client.query("COMMIT");
    return newId;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function updateProducto(id, body) {
  const client = await pool.connect();
  try {
    const {
      nombre,
      unidad_medida,
      stock_minimo,
      id_categoria,
      codigo_sku,
      marca,
      precio_unitario,
      ubicacion_estante,
      descripcion,
      es_perecedero
    } = body;

    const productoResult = await client.query(
      "SELECT * FROM producto WHERE id_producto = $1",
      [id]
    );
    if (productoResult.rows.length === 0) {
      throw { status: 404, message: "Producto no encontrado" };
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (nombre !== undefined) {
      if (nombre && nombre.length > 255) {
        throw { status: 400, message: "El nombre es demasiado largo (máximo 255 caracteres)" };
      }
      updates.push(`nombre = $${paramIndex++}`);
      params.push(nombre.trim());
    }
    if (unidad_medida !== undefined) {
      updates.push(`unidad_medida = $${paramIndex++}`);
      params.push(unidad_medida ? unidad_medida.trim() : 'unidad');
    }
    if (stock_minimo !== undefined) {
      updates.push(`stock_minimo = $${paramIndex++}`);
      params.push(parseInt(stock_minimo) || 0);
    }
    if (id_categoria !== undefined) {
      updates.push(`id_categoria = $${paramIndex++}`);
      params.push(id_categoria || null);
    }
    if (codigo_sku !== undefined) {
      updates.push(`codigo_sku = $${paramIndex++}`);
      params.push(codigo_sku ? codigo_sku.trim() : null);
    }
    if (marca !== undefined) {
      updates.push(`marca = $${paramIndex++}`);
      params.push(marca ? marca.trim() : null);
    }
    if (precio_unitario !== undefined) {
      updates.push(`precio_unitario = $${paramIndex++}`);
      params.push(parseFloat(precio_unitario) || 0);
    }
    if (ubicacion_estante !== undefined) {
      updates.push(`ubicacion_estante = $${paramIndex++}`);
      params.push(ubicacion_estante ? ubicacion_estante.trim() : null);
    }
    if (descripcion !== undefined) {
      updates.push(`descripcion = $${paramIndex++}`);
      params.push(descripcion ? descripcion.trim() : null);
    }
    if (es_perecedero !== undefined) {
      updates.push(`es_perecedero = $${paramIndex++}`);
      params.push(Boolean(es_perecedero));
    }
    if (body.stock_actual !== undefined) {
      updates.push(`stock_actual = $${paramIndex++}`);
      params.push(parseInt(body.stock_actual) || 0);
    }

    if (updates.length === 0) {
      throw { status: 400, message: "No hay campos para actualizar" };
    }

    params.push(id);

    await client.query(
      `UPDATE producto SET ${updates.join(", ")} WHERE id_producto = $${paramIndex}`,
      params
    );

    // Si se actualizó el stock_actual, sincronizar con el depósito central
    if (body.stock_actual !== undefined) {
      const stock_val = parseInt(body.stock_actual) || 0;
      const centralResult = await client.query(
        "SELECT id_deposito FROM deposito WHERE COALESCE(tipo, tipo_deposito) = 'central' LIMIT 1"
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

    return { ok: true };
  } finally {
    client.release();
  }
}

async function deleteProducto(id) {
  const idNum = parseInt(id, 10);
  if (!Number.isInteger(idNum) || idNum <= 0) {
    throw { status: 400, message: "ID de producto inválido" };
  }

  const producto = await get("SELECT * FROM producto WHERE id_producto = ?", [idNum]);
  if (!producto) {
    throw { status: 404, message: "Producto no encontrado" };
  }

  const client = await pool.connect();
  try {
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
      ["stock_deposito", "id_producto"],
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

      await client.query(`DELETE FROM ${table} WHERE ${column} = $1`, [idNum]);
    }

    await client.query("DELETE FROM producto WHERE id_producto = $1", [idNum]);
    await client.query("COMMIT");

    return { ok: true };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
      // ignore rollback errors
    }
    throw err;
  } finally {
    client.release();
  }
}

async function importarProductosMasivo(user, productosArray) {
  if (!Array.isArray(productosArray) || productosArray.length === 0) {
    throw { status: 400, message: "El array de productos está vacío o es inválido" };
  }

  const client = await pool.connect();
  let importados = 0;
  let errores = [];

  try {
    await client.query("BEGIN");

    // Verificar si las columnas tipo o tipo_deposito existen
    const hasTipo = await columnExists('deposito', 'tipo');
    const hasTipoDeposito = await columnExists('deposito', 'tipo_deposito');
    let tipoExpr = "'central'";
    if (hasTipo && hasTipoDeposito) {
      tipoExpr = "COALESCE(tipo, tipo_deposito)";
    } else if (hasTipo) {
      tipoExpr = "tipo";
    } else if (hasTipoDeposito) {
      tipoExpr = "tipo_deposito";
    }

    // Verificar repositorio central y tablas de stock antes de empezar
    const centralResult = await client.query(
      `SELECT id_deposito FROM deposito WHERE ${tipoExpr} = 'central' LIMIT 1`
    );
    const central = centralResult.rows[0];
    const hasStockDeposito = await hasTable('stock_deposito');
    const hasMovimientoStock = await hasTable('movimiento_stock');
    const userId = user.id_usuario || user.sub || user.id || null;

    for (let i = 0; i < productosArray.length; i++) {
      const p = productosArray[i];
      try {
        const nombre = p.nombre ? String(p.nombre).trim() : '';
        if (!nombre) {
          throw new Error("El nombre es obligatorio");
        }
        if (nombre.length > 255) {
          throw new Error("El nombre es demasiado largo (máximo 255 caracteres)");
        }

        // Parse defaults
        const unidad_medida = p.unidad_medida ? String(p.unidad_medida).trim() : 'unidad';
        const stock_actual_val = parseInt(p.stock_actual) || 0;
        const stock_minimo = parseInt(p.stock_minimo) || 0;
        const id_categoria = p.id_categoria ? parseInt(p.id_categoria) : null;
        const codigo_sku = p.codigo_sku ? String(p.codigo_sku).trim() : null;
        const marca = p.marca ? String(p.marca).trim() : null;
        const precio_unitario = parseFloat(p.precio_unitario) || 0;
        const ubicacion_estante = p.ubicacion_estante ? String(p.ubicacion_estante).trim() : null;
        const descripcion = p.descripcion ? String(p.descripcion).trim() : null;
        const es_perecedero = Boolean(p.es_perecedero);

        // Insertar
        const insertResult = await client.query(
          `INSERT INTO producto (
            nombre, unidad_medida, stock_actual, stock_minimo, id_categoria,
            codigo_sku, marca, precio_unitario, ubicacion_estante, descripcion, es_perecedero
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id_producto`,
          [
            nombre, unidad_medida, stock_actual_val, stock_minimo, id_categoria,
            codigo_sku, marca, precio_unitario, ubicacion_estante, descripcion, es_perecedero
          ]
        );

        const newId = insertResult.rows[0].id_producto;

        // Stock
        if (stock_actual_val > 0 && central) {
          if (hasStockDeposito) {
            await client.query(
              `INSERT INTO stock_deposito (id_deposito, id_producto, cantidad)
               VALUES ($1, $2, $3)
               ON CONFLICT (id_deposito, id_producto)
               DO UPDATE SET cantidad = stock_deposito.cantidad + EXCLUDED.cantidad`,
              [central.id_deposito, newId, stock_actual_val]
            );
          }
          if (hasMovimientoStock) {
            await client.query(
              `INSERT INTO movimiento_stock (id_producto, tipo, cantidad, motivo, id_usuario, id_deposito)
               VALUES ($1, 'ingreso', $2, 'Importación inicial masiva', $3, $4)`,
              [newId, stock_actual_val, userId, central.id_deposito]
            );
          }
        }
        importados++;
      } catch (err) {
        errores.push({ fila: i + 2, producto: p.nombre, error: err.message });
      }
    }

    if (errores.length > 0 && importados === 0) {
      // Si todos fallaron, cancelamos transacción
      await client.query("ROLLBACK");
      throw { status: 400, message: "Ningún producto pudo ser importado", errores };
    }

    await client.query("COMMIT");
    return { importados, errores };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  getProductos,
  getCategorias,
  getProductoById,
  getProductoStockDetalle,
  createProducto,
  updateProducto,
  deleteProducto,
  importarProductosMasivo
};
