const { all, get, run, pool } = require("../db.pg");
const { isAdminLikeRole } = require("../middleware/auth");

const columnExistsCache = new Map();

async function columnExists(tableName, columnName) {
  const cacheKey = `${tableName}.${columnName}`;
  if (columnExistsCache.has(cacheKey)) return columnExistsCache.get(cacheKey);

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
}

async function tableExists(tableName) {
  const row = await get(`SELECT to_regclass($1) AS regclass`, [`public.${tableName}`]);
  return Boolean(row?.regclass);
}

async function getInstitucionNivelExpr(alias = "i") {
  if (await columnExists("institucion", "direccion_area")) return `${alias}.direccion_area`;
  if (await columnExists("institucion", "nivel_educativo")) return `${alias}.nivel_educativo`;
  if (await columnExists("institucion", "nivel")) return `${alias}.nivel`;
  return "NULL::text";
}

async function getDepartamentoSql(alias = "i") {
  const [
    institucionDepartamento,
    edificioDepartamento,
    edificioDireccionId,
    direccionDepartamento,
  ] = await Promise.all([
    columnExists("institucion", "departamento"),
    columnExists("edificio", "departamento"),
    columnExists("edificio", "id_direccion"),
    columnExists("direccion", "departamento"),
  ]);

  const joins = [];
  const sources = [];
  joins.push(`LEFT JOIN edificio e ON ${alias}.id_edificio = e.id_edificio`);

  if (institucionDepartamento) {
    sources.push(`NULLIF(TRIM(${alias}.departamento), '')`);
  }
  if (edificioDireccionId && direccionDepartamento) {
    joins.push("LEFT JOIN direccion d ON e.id_direccion = d.id_direccion");
    sources.push("NULLIF(TRIM(d.departamento), '')");
  }
  if (edificioDepartamento) {
    sources.push("NULLIF(TRIM(e.departamento), '')");
  }

  return {
    joins: joins.join("\n"),
    expression: sources.length > 0 ? `COALESCE(${sources.join(", ")})` : "NULL::text",
  };
}

async function ensureDepositosSchema() {
  // Centralized in schemaManager.js
}

async function listDepositos(user) {
  await ensureDepositosSchema();
  const isEscolar = user.role === "operador_escolar";
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

  return await all(query);
}

async function getProductosByDeposito(id) {
  return await all(
    `SELECT p.id_producto as id, p.nombre, p.unidad_medida, COALESCE(sd.cantidad, 0) as cantidad
     FROM producto p
     LEFT JOIN stock_deposito sd ON sd.id_producto = p.id_producto AND sd.id_deposito = ?`,
    [id]
  );
}

async function getStockPorProducto(user) {
  const isEscolar = user.role === "operador_escolar";
  return await all(`
      SELECT 
        p.id_producto as id,
        p.nombre, p.unidad_medida,
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
}

async function getStockByDeposito(id, user) {
  const isEscolar = user.role === "operador_escolar";
  const deposito = await get("SELECT * FROM deposito WHERE id_deposito = $1", [id]);
  if (!deposito) {
    throw { status: 404, message: "Depósito no encontrado" };
  }

  if (isEscolar && deposito.tipo === "capsula") {
    throw { status: 403, message: "No tenés acceso a la cápsula de seguridad" };
  }

  const isPadre = deposito.tipo === "central";
  let stockQuery = `
    SELECT 
      p.id_producto as id,
      p.nombre, p.unidad_medida,
      COALESCE(sd.cantidad, 0) as cantidad
    FROM producto p
    LEFT JOIN stock_deposito sd ON sd.id_producto = p.id_producto 
      AND sd.id_deposito = $1
    WHERE p.id_producto > 0
  `;

  if (isPadre) {
    stockQuery = `
      SELECT 
        p.id_producto as id,
        p.nombre, p.unidad_medida,
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
  return { deposito, stock };
}

async function moverStock({ id_producto, cantidad, origen_id, destino_id, motivo, user }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const src = await client.query(
      `SELECT cantidad FROM stock_deposito WHERE id_deposito = $1 AND id_producto = $2 FOR UPDATE`,
      [origen_id, id_producto]
    );
    const available = src.rows[0]?.cantidad || 0;
    if (available < cantidad) {
      await client.query("ROLLBACK");
      throw { status: 400, message: "Stock insuficiente en origen" };
    }
    await client.query(
      `UPDATE stock_deposito SET cantidad = cantidad - $1 WHERE id_deposito = $2 AND id_producto = $3`,
      [cantidad, origen_id, id_producto]
    );
    await client.query(
      `INSERT INTO stock_deposito (id_deposito, id_producto, cantidad) VALUES ($1, $2, $3)
       ON CONFLICT (id_deposito, id_producto) DO UPDATE SET cantidad = stock_deposito.cantidad + EXCLUDED.cantidad`,
      [destino_id, id_producto, cantidad]
    );
    const mot = (motivo || `Traslado ${id_producto} ${origen_id}→${destino_id}`);
    await client.query(
      `INSERT INTO movimiento_stock (id_producto, tipo, cantidad, motivo, id_usuario, id_deposito, id_deposito_destino)
       VALUES ($1, 'traslado', $2, $3, $4, $5, $6)`,
      [id_producto, cantidad, mot, user.sub, origen_id, destino_id]
    );
    await client.query("COMMIT");
    return { ok: true, moved: true };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function getTraslados() {
  return await all(`
    SELECT
      m.id_movimiento,
      m.id_producto,
      p.nombre as producto_nombre,
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
}

async function registrarIngreso({ id, id_producto, cantidad, id_proveedor, motivo, fecha_vencimiento, user }) {
  await ensureDepositosSchema();
  const productoIdNum = parseInt(id_producto, 10);
  const cantidadNum = parseInt(cantidad, 10);
  const depositoIdNum = parseInt(id, 10);
  const proveedorIdNum = id_proveedor ? parseInt(id_proveedor, 10) : null;

  const deposito = await get("SELECT * FROM deposito WHERE id_deposito = $1", [depositoIdNum]);
  if (!deposito) {
    throw { status: 404, message: "Depósito no encontrado" };
  }

  const producto = await get("SELECT * FROM producto WHERE id_producto = $1", [productoIdNum]);
  if (!producto) {
    throw { status: 404, message: "Producto no encontrado" };
  }

  if (producto.requiere_autorizacion) {
    const esCapsula = deposito.tipo === "capsula";
    if (esCapsula && !isAdminLikeRole(user.role)) {
      throw { status: 403, message: "Requiere autorización para ingresos a Cápsula" };
    }
  }

  // Insertar movimiento
  await run(`
    INSERT INTO movimiento_stock (id_producto, cantidad, tipo, id_proveedor, motivo, id_usuario, id_deposito, fecha_vencimiento)
    VALUES ($1, $2, 'ingreso', $3, $4, $5, $6, $7)
  `, [productoIdNum, cantidadNum, proveedorIdNum, motivo || "Ingreso a depósito", user.sub, depositoIdNum, fecha_vencimiento || null]);

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

  return { ok: true, message: "Ingreso registrado" };
}

async function registrarEgreso({ id, id_producto, cantidad, id_institucion, motivo, user }) {
  await ensureDepositosSchema();
  const productoIdNum = parseInt(id_producto, 10);
  const cantidadNum = parseInt(cantidad, 10);
  const depositoIdNum = parseInt(id, 10);
  const institucionIdNum = id_institucion ? parseInt(id_institucion, 10) : null;

  const deposito = await get("SELECT * FROM deposito WHERE id_deposito = $1", [depositoIdNum]);
  if (!deposito) {
    throw { status: 404, message: "Depósito no encontrado" };
  }

  const stockDep = await get(
    "SELECT cantidad FROM stock_deposito WHERE id_deposito = $1 AND id_producto = $2",
    [depositoIdNum, productoIdNum]
  );
  const stockDisp = stockDep?.cantidad || 0;
  if (stockDisp < cantidadNum) {
    throw { status: 400, message: `Stock insuficiente. Disponible: ${stockDisp}` };
  }

  const producto = await get("SELECT requiere_autorizacion FROM producto WHERE id_producto = $1", [productoIdNum]);
  if (producto?.requiere_autorizacion) {
    const esCapsula = deposito.tipo === "capsula";
    if (esCapsula && !isAdminLikeRole(user.role)) {
      throw { status: 403, message: "Requiere autorización para egresar de Cápsula" };
    }
  }

  await run(`
    INSERT INTO movimiento_stock (id_producto, cantidad, tipo, id_institucion, motivo, id_usuario, id_deposito)
    VALUES ($1, $2, 'egreso', $3, $4, $5, $6)
  `, [productoIdNum, cantidadNum, institucionIdNum, motivo || "Egreso de depósito", user.sub, depositoIdNum]);

  await run(
    "UPDATE stock_deposito SET cantidad = cantidad - $1 WHERE id_deposito = $2 AND id_producto = $3",
    [cantidadNum, depositoIdNum, productoIdNum]
  );

  await pool.query(
    "UPDATE producto SET stock_actual = COALESCE(stock_actual, 0) - $1 WHERE id_producto = $2",
    [cantidadNum, productoIdNum]
  );

  return { ok: true, message: "Egreso registrado" };
}

async function getRecepcionesLicitacion() {
  await ensureDepositosSchema();
  return await all(
    `SELECT lp.id,
            lp.anio,
            lp.fecha_publicacion,
            lp.estado,
            lp.titulo,
            lp.motivo,
            COALESCE(NULLIF(BTRIM(lp.motivo), ''), NULLIF(BTRIM(lp.titulo), ''), 'Licitación Anual ' || lp.anio::text) AS titulo_display,
            COALESCE(prov_data.proveedores, 'Sin proveedor asignado') AS proveedores
     FROM licitacion_publicada lp
     LEFT JOIN LATERAL (
       SELECT string_agg(DISTINCT pr.nombre, ', ' ORDER BY pr.nombre) AS proveedores
       FROM jsonb_array_elements(lp.items) it
       LEFT JOIN compra_precio_historico cph
         ON cph.anio = lp.anio
        AND cph.id_producto = CASE
          WHEN (it->>'producto_id') ~ '^\\d+$' THEN (it->>'producto_id')::INT
          ELSE NULL
        END
       LEFT JOIN proveedor pr ON pr.id_proveedor = cph.id_proveedor
     ) prov_data ON TRUE
     WHERE lp.estado IN ('en_deposito', 'completada')
     ORDER BY
       CASE
         WHEN lp.estado = 'en_deposito' THEN 0
         WHEN lp.estado = 'completada' THEN 1
         ELSE 2
       END,
       lp.fecha_publicacion DESC,
       lp.id DESC`
  );
}

async function getDetalleRecepcion(id) {
  await ensureDepositosSchema();
  const row = await get(
    `SELECT id, items, anio, titulo, motivo, estado,
            COALESCE(NULLIF(BTRIM(motivo), ''), NULLIF(BTRIM(titulo), ''), 'Licitación Anual ' || anio::text) AS titulo_display
     FROM licitacion_publicada
     WHERE id = $1`,
    [id]
  );
  if (!row) throw { status: 404, message: "Licitación no encontrada" };

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

  const proveedoresRows = await all(
    `SELECT cph.id_producto, cph.id_proveedor, pr.nombre AS proveedor_nombre
     FROM compra_precio_historico cph
     LEFT JOIN proveedor pr ON pr.id_proveedor = cph.id_proveedor
     WHERE cph.anio = $1`,
    [row.anio]
  );
  const proveedorPorProducto = new Map(
    proveedoresRows.map((r) => [Number(r.id_producto), { id: r.id_proveedor, nombre: r.proveedor_nombre }])
  );

  const itemsEnriquecidos = cleanItems.map((item) => {
    const proveedor = proveedorPorProducto.get(Number(item.producto_id));
    return {
      ...item,
      proveedor_id: proveedor?.id || null,
      proveedor_nombre: proveedor?.nombre || 'Sin proveedor asignado',
    };
  });

  const recibidos = await all(
    `SELECT pr.nombre AS producto, SUM(rl.cantidad_recibida) as total_recibida
     FROM recepcion_licitacion rl
     JOIN producto pr ON pr.id_producto = rl.producto_id
     WHERE rl.licitacion_id = $1
     GROUP BY pr.nombre`,
    [id]
  );

  return {
    id: row.id,
    anio: row.anio,
    estado: row.estado,
    titulo: row.titulo || null,
    motivo: row.motivo || null,
    titulo_display: row.titulo_display,
    items: itemsEnriquecidos,
    recibidos,
  };
}

async function registrarIngresoLicitacion({ licitacion_id, ingresos, id_deposito, observaciones, user }) {
  if (!licitacion_id || !ingresos || !id_deposito) {
    throw { status: 400, message: "Faltan datos obligatorios" };
  }

  await ensureDepositosSchema();

  const ingresosValidos = ingresos.filter(
    ing => Number(ing.cantidad) > 0 || Number(ing.cantidad_danada) > 0
  );
  if (ingresosValidos.length === 0) {
    throw { status: 400, message: "Cargue al menos una cantidad recibida o dañada mayor a 0" };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const licRow = await client.query(
      `SELECT anio FROM licitacion_publicada WHERE id = $1`,
      [licitacion_id]
    );
    if (!licRow.rowCount) {
      await client.query("ROLLBACK");
      throw { status: 404, message: "Licitación no encontrada" };
    }
    const anio = licRow.rows[0].anio;

    const proveedoresPorProductoRows = await client.query(
      `SELECT cph.id_producto, MIN(cph.id_proveedor) AS id_proveedor
       FROM compra_precio_historico cph
       WHERE cph.anio = $1
       GROUP BY cph.id_producto`,
      [anio]
    );
    const proveedorPorProducto = new Map(
      proveedoresPorProductoRows.rows.map((r) => [Number(r.id_producto), Number(r.id_proveedor)])
    );

    const countRow = await client.query(
      `SELECT COUNT(*) AS total FROM remito_licitacion
       WHERE licitacion_id IN (SELECT id FROM licitacion_publicada WHERE anio = $1)`,
      [anio]
    );
    const seq = String(Number(countRow.rows[0].total) + 1).padStart(3, '0');
    const numero = `REMITO-${anio}-${seq}`;

    const remitoRes = await client.query(
      `INSERT INTO remito_licitacion (numero, licitacion_id, id_deposito, usuario_id, observaciones)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [numero, licitacion_id, id_deposito, user.sub, observaciones || null]
    );
    const remito_id = remitoRes.rows[0].id;

    for (const ing of ingresosValidos) {
      const { producto_id, cantidad, cantidad_danada, obs_danio, fecha_vencimiento } = ing;
      const cantidadBuena = Number(cantidad) || 0;
      const cantidadDanada = Number(cantidad_danada) || 0;

      if (cantidadBuena < 0 || cantidadDanada < 0) {
        await client.query("ROLLBACK");
        throw { status: 400, message: "Las cantidades no pueden ser negativas" };
      }

      await client.query(
        `INSERT INTO recepcion_licitacion (licitacion_id, producto_id, cantidad_recibida, usuario_id, observaciones, fecha_vencimiento, id_deposito, remito_id, cantidad_danada, obs_danio)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          licitacion_id,
          producto_id,
          cantidadBuena,
          user.sub,
          observaciones || null,
          fecha_vencimiento || null,
          id_deposito,
          remito_id,
          cantidadDanada,
          obs_danio || null,
        ]
      );

      if (cantidadBuena > 0) {
        const proveedorId = proveedorPorProducto.get(Number(producto_id)) || null;

        await client.query(
          `INSERT INTO stock_deposito (id_deposito, id_producto, cantidad)
           VALUES ($1, $2, $3)
           ON CONFLICT (id_deposito, id_producto)
           DO UPDATE SET cantidad = stock_deposito.cantidad + $3`,
          [id_deposito, producto_id, cantidadBuena]
        );

        await client.query(
          `INSERT INTO movimiento_stock (id_producto, cantidad, tipo, motivo, id_usuario, id_deposito, fecha_vencimiento, id_proveedor)
           VALUES ($1, $2, 'ingreso', $3, $4, $5, $6, $7)`,
          [
            producto_id,
            cantidadBuena,
            `Ingreso por Licitación #${licitacion_id} — ${numero}`,
            user.sub,
            id_deposito,
            fecha_vencimiento || null,
            proveedorId,
          ]
        );
      }
    }

    await client.query("COMMIT");
    return { ok: true, message: "Mercadería ingresada con éxito", numero_remito: numero, remito_id };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function cerrarLicitacion(id) {
  await ensureDepositosSchema();
  const lic = await get(`SELECT id, estado FROM licitacion_publicada WHERE id = $1`, [id]);
  if (!lic) throw { status: 404, message: "Licitación no encontrada" };
  if (lic.estado === 'completada') return { ok: true, message: "La licitación ya estaba completada" };
  if (lic.estado !== 'en_deposito') {
    throw { status: 400, message: "Solo se puede cerrar una licitación en estado 'en_deposito'" };
  }
  await run(`UPDATE licitacion_publicada SET estado = 'completada' WHERE id = $1`, [id]);
  return { ok: true, message: "Licitación cerrada correctamente" };
}

async function registrarDanioImagen({ remito_id, producto_id, nombre, mime_type, datos }) {
  await ensureDepositosSchema();
  if (!remito_id || !datos) {
    throw { status: 400, message: "remito_id y datos son obligatorios" };
  }

  const remito = await get(`SELECT id FROM remito_licitacion WHERE id = $1`, [remito_id]);
  if (!remito) {
    throw { status: 404, message: "Remito no encontrado" };
  }

  await run(
    `INSERT INTO recepcion_danio_imagen (remito_id, producto_id, nombre, mime_type, datos)
     VALUES ($1, $2, $3, $4, $5)`,
    [remito_id, producto_id || null, nombre || null, mime_type || null, datos]
  );
  return { ok: true };
}

async function getRemitosByLicitacion(id) {
  await ensureDepositosSchema();
  const licRow = await get(`SELECT anio FROM licitacion_publicada WHERE id = $1`, [id]);
  if (!licRow) throw { status: 404, message: "Licitación no encontrada" };
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

  for (const remito of remitos) {
    remito.items = await all(
      `SELECT rl.id, rl.producto_id, p.nombre as producto_nombre, p.unidad_medida,
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

  return { remitos };
}

async function getRemitoGeneralLicitacion(id) {
  await ensureDepositosSchema();
  const lic = await get(
    `SELECT id, anio, estado, items, titulo, motivo,
            COALESCE(NULLIF(BTRIM(motivo), ''), NULLIF(BTRIM(titulo), ''), 'Licitación Anual ' || anio::text) AS titulo_display
     FROM licitacion_publicada
     WHERE id = $1`,
    [id]
  );
  if (!lic) throw { status: 404, message: "Licitación no encontrada" };
  if (lic.estado !== 'completada') {
    throw { status: 400, message: "El Remito General solo está disponible cuando la licitación está completada" };
  }

  const anio = lic.anio;
  const rawItems = typeof lic.items === 'string' ? JSON.parse(lic.items) : lic.items;

  const adjudicadoMap = {};
  rawItems.forEach(item => {
    const pid = item.producto_id;
    if (!adjudicadoMap[pid]) {
      adjudicadoMap[pid] = { producto_id: pid, producto: item.producto, unidad_medida: item.unidad_medida, cantidad_adjudicada: 0 };
    }
    adjudicadoMap[pid].cantidad_adjudicada += Number(item.cantidad_a_licitar || 0);
  });

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

  const remitos = await all(
    `SELECT r.numero, r.created_at, u.nombre AS usuario_nombre, d.nombre AS deposito_nombre
     FROM remito_licitacion r
     LEFT JOIN usuario u ON u.id_usuario = r.usuario_id
     LEFT JOIN deposito d ON d.id_deposito = r.id_deposito
     WHERE r.licitacion_id = $1 ORDER BY r.created_at`,
    [id]
  );

  return {
    licitacion_id: lic.id,
    anio,
    estado: lic.estado,
    titulo: lic.titulo || null,
    motivo: lic.motivo || null,
    titulo_display: lic.titulo_display,
    items,
    remitos,
  };
}

async function getPendientesDistribucion(anio) {
  return await all(`
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
}

async function getDetalleDistribucionEscuela(id, anio) {
  return await all(`
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
}

async function registrarSalidaDistribucion({ id_institucion, anio, entregas, id_deposito, observaciones, user }) {
  if (!id_institucion || !entregas || !id_deposito) {
    throw { status: 400, message: "Faltan datos obligatorios" };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const ent of entregas) {
      const { id_producto, cantidad } = ent;
      if (!cantidad || cantidad <= 0) continue;

      const stockRes = await client.query(
        "SELECT cantidad FROM stock_deposito WHERE id_deposito = $1 AND id_producto = $2 FOR UPDATE",
        [id_deposito, id_producto]
      );
      const stockDisp = stockRes.rows[0]?.cantidad || 0;
      if (stockDisp < cantidad) {
        throw new Error(`Stock insuficiente para producto ${id_producto}. Disponible: ${stockDisp}`);
      }

      await client.query(
        `INSERT INTO entrega_anual (id_institucion, anio, id_producto, cantidad_entregada, id_deposito, id_usuario, observaciones)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id_institucion, anio, id_producto, cantidad, id_deposito, user.sub, observaciones]
      );

      await client.query(
        `UPDATE stock_deposito SET cantidad = cantidad - $1 WHERE id_deposito = $2 AND id_producto = $3`,
        [cantidad, id_deposito, id_producto]
      );

      await client.query(
        "UPDATE producto SET stock_actual = stock_actual - $1 WHERE id_producto = $2",
        [cantidad, id_producto]
      );

      await client.query(
        `INSERT INTO movimiento_stock (id_producto, cantidad, tipo, motivo, id_usuario, id_deposito, id_institucion)
         VALUES ($1, $2, 'egreso', $3, $4, $5, $6)`,
        [id_producto, cantidad, `Distribución Anual ${anio}`, user.sub, id_deposito, id_institucion]
      );
    }

    await client.query("COMMIT");
    return { ok: true, message: "Distribución registrada con éxito" };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function getDistribucionZonasPendientes(anio) {
  await ensureDepositosSchema();
  const hasZonas = (await tableExists("zona")) && (await tableExists("zona_institucion"));
  if (!hasZonas) {
    throw { status: 400, message: "No existe configuración de zonas para distribución" };
  }

  return await all(
    `WITH pendientes_por_escuela AS (
       SELECT
         pad.id_institucion,
         COUNT(*) FILTER (WHERE GREATEST(pad.cantidad - COALESCE(e.entregado, 0), 0) > 0) AS productos_pendientes,
         SUM(GREATEST(pad.cantidad - COALESCE(e.entregado, 0), 0)) AS cantidad_pendiente_total
       FROM planilla_pedido_anual_detalle pad
       JOIN planilla_pedido_anual pa ON pa.id = pad.planilla_id
       LEFT JOIN (
         SELECT id_institucion, id_producto, SUM(cantidad_entregada) AS entregado
         FROM entrega_anual
         WHERE anio = $1
         GROUP BY id_institucion, id_producto
       ) e ON e.id_institucion = pad.id_institucion AND e.id_producto = pad.id_producto
       WHERE pa.anio = $1
         AND pa.estado = 'adjudicada'
       GROUP BY pad.id_institucion
     )
     SELECT
       z.id AS zona_id,
       z.name AS zona_nombre,
       COUNT(*) FILTER (WHERE COALESCE(ppe.productos_pendientes, 0) > 0) AS escuelas_pendientes,
       COALESCE(SUM(COALESCE(ppe.productos_pendientes, 0)), 0) AS productos_pendientes,
       COALESCE(SUM(COALESCE(ppe.cantidad_pendiente_total, 0)), 0) AS cantidad_pendiente_total
     FROM zona z
     JOIN zona_institucion zi ON zi.zona_id = z.id
     LEFT JOIN pendientes_por_escuela ppe ON ppe.id_institucion = zi.institucion_id
     WHERE z.activo = TRUE
     GROUP BY z.id, z.name
     HAVING COALESCE(SUM(COALESCE(ppe.productos_pendientes, 0)), 0) > 0
     ORDER BY z.name ASC`,
    [anio]
  );
}

async function getDistribucionZonaDetalle(zonaId, anio) {
  await ensureDepositosSchema();
  if (!zonaId) throw { status: 400, message: "Zona inválida" };

  const hasZonas = (await tableExists("zona")) && (await tableExists("zona_institucion"));
  if (!hasZonas) {
    throw { status: 400, message: "No existe configuración de zonas para distribución" };
  }

  const zona = await get(`SELECT id, name AS nombre FROM zona WHERE id = $1`, [zonaId]);
  if (!zona) throw { status: 404, message: "Zona no encontrada" };

  const nivelExpr = await getInstitucionNivelExpr("i");
  const departamentoSql = await getDepartamentoSql("i");

  const escuelas = await all(
    `WITH pendientes_por_escuela AS (
       SELECT
         pad.id_institucion,
         COUNT(*) FILTER (WHERE GREATEST(pad.cantidad - COALESCE(e.entregado, 0), 0) > 0) AS productos_pendientes,
         SUM(GREATEST(pad.cantidad - COALESCE(e.entregado, 0), 0)) AS cantidad_pendiente_total
       FROM planilla_pedido_anual_detalle pad
       JOIN planilla_pedido_anual pa ON pa.id = pad.planilla_id
       LEFT JOIN (
         SELECT id_institucion, id_producto, SUM(cantidad_entregada) AS entregado
         FROM entrega_anual
         WHERE anio = $1
         GROUP BY id_institucion, id_producto
       ) e ON e.id_institucion = pad.id_institucion AND e.id_producto = pad.id_producto
       WHERE pa.anio = $1
         AND pa.estado = 'adjudicada'
       GROUP BY pad.id_institucion
     )
     SELECT
       i.id_institucion AS id,
       i.nombre,
       i.cue,
       ${nivelExpr} AS nivel,
       ${departamentoSql.expression} AS ubicacion,
       COALESCE(ppe.productos_pendientes, 0) AS productos_pendientes,
       COALESCE(ppe.cantidad_pendiente_total, 0) AS cantidad_pendiente_total
     FROM zona_institucion zi
     JOIN institucion i ON i.id_institucion = zi.institucion_id
     ${departamentoSql.joins}
     LEFT JOIN pendientes_por_escuela ppe ON ppe.id_institucion = i.id_institucion
     WHERE zi.zona_id = $2
       AND i.activo = TRUE
       AND COALESCE(ppe.productos_pendientes, 0) > 0
     ORDER BY i.nombre ASC`,
    [anio, zonaId]
  );

  const escuelaIds = escuelas.map((e) => Number(e.id)).filter((id) => Number.isInteger(id) && id > 0);
  const itemsPorEscuela = new Map();
  if (escuelaIds.length > 0) {
    const items = await all(
      `SELECT
         pad.id_institucion,
         p.id_producto AS id,
         p.nombre AS producto,
         p.unidad_medida,
         pad.cantidad AS cantidad_adjudicada,
         COALESCE(e.entregado, 0) AS cantidad_entregada,
         GREATEST(pad.cantidad - COALESCE(e.entregado, 0), 0) AS cantidad_pendiente
       FROM planilla_pedido_anual_detalle pad
       JOIN planilla_pedido_anual pa ON pa.id = pad.planilla_id
       JOIN producto p ON p.id_producto = pad.id_producto
       LEFT JOIN (
         SELECT id_institucion, id_producto, SUM(cantidad_entregada) AS entregado
         FROM entrega_anual
         WHERE anio = $1
         GROUP BY id_institucion, id_producto
       ) e ON e.id_institucion = pad.id_institucion AND e.id_producto = pad.id_producto
       WHERE pa.anio = $1
         AND pa.estado = 'adjudicada'
         AND pad.id_institucion = ANY($2::int[])
         AND GREATEST(pad.cantidad - COALESCE(e.entregado, 0), 0) > 0
       ORDER BY pad.id_institucion, p.nombre`,
      [anio, escuelaIds]
    );

    for (const item of items) {
      const key = Number(item.id_institucion);
      if (!itemsPorEscuela.has(key)) itemsPorEscuela.set(key, []);
      itemsPorEscuela.get(key).push(item);
    }
  }

  const escuelasConItems = escuelas.map((escuela) => ({
    ...escuela,
    items: itemsPorEscuela.get(Number(escuela.id)) || [],
  }));

  return { zona, anio, escuelas: escuelasConItems };
}

async function registrarEgresoMultipleZona({ zona_id, anio, id_deposito, observaciones, entregas, user }) {
  if (!zona_id || !id_deposito || !Array.isArray(entregas) || entregas.length === 0) {
    throw { status: 400, message: "Faltan datos obligatorios para egreso múltiple" };
  }

  await ensureDepositosSchema();
  const zonaId = Number(zona_id);
  const depositoId = Number(id_deposito);
  const anioNum = Number(anio || new Date().getFullYear());

  const hasZonas = (await tableExists("zona")) && (await tableExists("zona_institucion"));
  if (!hasZonas) {
    throw { status: 400, message: "No existe configuración de zonas para distribución" };
  }

  const client = await pool.connect();
  try {
    const zona = await client.query(`SELECT id, name AS nombre FROM zona WHERE id = $1`, [zonaId]);
    if (!zona.rowCount) throw { status: 404, message: "Zona no encontrada" };
    const zonaNombre = zona.rows[0].nombre;

    const institucionesSolicitadas = [];
    const porInstitucion = new Map();
    const totalPorProducto = new Map();

    for (const entregaEscuela of entregas) {
      const institucionId = Number(entregaEscuela.id_institucion);
      const items = Array.isArray(entregaEscuela.items) ? entregaEscuela.items : [];
      if (!institucionId || items.length === 0) continue;

      institucionesSolicitadas.push(institucionId);
      if (!porInstitucion.has(institucionId)) porInstitucion.set(institucionId, []);

      for (const item of items) {
        const productoId = Number(item.id_producto);
        const cantidad = Number(item.cantidad);
        if (!productoId || !cantidad || cantidad <= 0) continue;

        porInstitucion.get(institucionId).push({ id_producto: productoId, cantidad });
        totalPorProducto.set(productoId, (totalPorProducto.get(productoId) || 0) + cantidad);
      }
    }

    const institucionesUnicas = [...new Set(institucionesSolicitadas)];
    if (institucionesUnicas.length === 0) {
      throw { status: 400, message: "No hay entregas válidas para procesar" };
    }

    await client.query("BEGIN");

    // Validar pertenencia de instituciones a la zona.
    const institucionesZona = await client.query(
      `SELECT institucion_id
       FROM zona_institucion
       WHERE zona_id = $1
         AND institucion_id = ANY($2::int[])`,
      [zonaId, institucionesUnicas]
    );
    const permitidas = new Set(institucionesZona.rows.map((r) => Number(r.institucion_id)));
    const fueraDeZona = institucionesUnicas.filter((id) => !permitidas.has(id));
    if (fueraDeZona.length > 0) {
      throw new Error(`Hay instituciones fuera de la zona seleccionada: ${fueraDeZona.join(', ')}`);
    }

    // Validar pendientes por institución/producto.
    const pendientesRows = await client.query(
      `SELECT
         pad.id_institucion,
         pad.id_producto,
         GREATEST(pad.cantidad - COALESCE(e.entregado, 0), 0) AS cantidad_pendiente
       FROM planilla_pedido_anual_detalle pad
       JOIN planilla_pedido_anual pa ON pa.id = pad.planilla_id
       LEFT JOIN (
         SELECT id_institucion, id_producto, SUM(cantidad_entregada) AS entregado
         FROM entrega_anual
         WHERE anio = $1
         GROUP BY id_institucion, id_producto
       ) e ON e.id_institucion = pad.id_institucion AND e.id_producto = pad.id_producto
       WHERE pa.anio = $1
         AND pa.estado = 'adjudicada'
         AND pad.id_institucion = ANY($2::int[])
         AND pad.id_producto = ANY($3::int[])`,
      [anioNum, institucionesUnicas, [...totalPorProducto.keys()]]
    );

    const pendienteMap = new Map();
    for (const row of pendientesRows.rows) {
      pendienteMap.set(`${row.id_institucion}:${row.id_producto}`, Number(row.cantidad_pendiente || 0));
    }

    for (const [institucionId, items] of porInstitucion.entries()) {
      for (const item of items) {
        const key = `${institucionId}:${item.id_producto}`;
        const pendiente = Number(pendienteMap.get(key) || 0);
        if (item.cantidad > pendiente) {
          throw new Error(`La cantidad para institución ${institucionId}, producto ${item.id_producto} supera pendiente (${pendiente})`);
        }
      }
    }

    // Validar stock agrupado por producto.
    const stockRows = await client.query(
      `SELECT id_producto, cantidad
       FROM stock_deposito
       WHERE id_deposito = $1
         AND id_producto = ANY($2::int[])
       FOR UPDATE`,
      [depositoId, [...totalPorProducto.keys()]]
    );
    const stockMap = new Map(stockRows.rows.map((r) => [Number(r.id_producto), Number(r.cantidad || 0)]));

    for (const [productoId, total] of totalPorProducto.entries()) {
      const disponible = Number(stockMap.get(productoId) || 0);
      if (disponible < total) {
        throw new Error(`Stock insuficiente para producto ${productoId}. Disponible: ${disponible}`);
      }
    }

    // Crear lote.
    const loteRes = await client.query(
      `INSERT INTO distribucion_lote (anio, zona_id, id_deposito, estado, observaciones, usuario_id)
       VALUES ($1, $2, $3, 'en_transito', $4, $5)
       RETURNING id`,
      [anioNum, zonaId, depositoId, observaciones || null, user.sub]
    );
    const loteId = Number(loteRes.rows[0].id);

    // Aplicar salidas y registrar trazabilidad por institución.
    for (const [institucionId, items] of porInstitucion.entries()) {
      for (const item of items) {
        await client.query(
          `INSERT INTO entrega_anual (id_institucion, anio, id_producto, cantidad_entregada, id_deposito, id_usuario, observaciones)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [institucionId, anioNum, item.id_producto, item.cantidad, depositoId, user.sub, observaciones || null]
        );

        await client.query(
          `INSERT INTO movimiento_stock (id_producto, cantidad, tipo, motivo, id_usuario, id_deposito, id_institucion)
           VALUES ($1, $2, 'egreso', $3, $4, $5, $6)`,
          [
            item.id_producto,
            item.cantidad,
            `Distribución Zonal #${loteId} (${zonaNombre})`,
            user.sub,
            depositoId,
            institucionId,
          ]
        );

        await client.query(
          `INSERT INTO distribucion_lote_item (lote_id, id_institucion, id_producto, cantidad_planificada)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (lote_id, id_institucion, id_producto)
           DO UPDATE SET cantidad_planificada = EXCLUDED.cantidad_planificada, updated_at = NOW()`,
          [loteId, institucionId, item.id_producto, item.cantidad]
        );
      }
    }

    // Descontar stock físico del depósito por producto (una sola vez por producto).
    for (const [productoId, total] of totalPorProducto.entries()) {
      await client.query(
        `UPDATE stock_deposito
         SET cantidad = cantidad - $1
         WHERE id_deposito = $2
           AND id_producto = $3`,
        [total, depositoId, productoId]
      );
    }

    await client.query("COMMIT");
    return {
      ok: true,
      lote_id: loteId,
      zona: zonaNombre,
      escuelas: institucionesUnicas.length,
      productos: [...totalPorProducto.keys()].length,
      message: "Egreso múltiple zonal registrado con éxito",
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function getVencimientosProximos(dias = 60) {
  await ensureDepositosSchema();

  // Verificar que existen las columnas necesarias
  const columnCheck = await get(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'movimiento_stock' AND column_name = 'fecha_vencimiento'
  `);

  if (!columnCheck) {
    return [];
  }

  // Buscamos ingresos que tengan fecha de vencimiento próxima
  return await all(`
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
}

async function diagnosticoStock() {
  const rows = await all(`
    SELECT 
      p.id_producto AS id,
      p.nombre,
      p.unidad_medida,
      COALESCE(p.stock_actual, 0) AS stock_global,
      COALESCE(sd_sum.total_depositos, 0) AS stock_depositos,
      COALESCE(p.stock_actual, 0) - COALESCE(sd_sum.total_depositos, 0) AS diferencia
    FROM producto p
    LEFT JOIN (
      SELECT id_producto, SUM(cantidad) AS total_depositos
      FROM stock_deposito
      GROUP BY id_producto
    ) sd_sum ON sd_sum.id_producto = p.id_producto
    ORDER BY ABS(COALESCE(p.stock_actual, 0) - COALESCE(sd_sum.total_depositos, 0)) DESC, p.nombre
  `);

  const inconsistentes = rows.filter(r => Number(r.diferencia) !== 0);
  const consistentes = rows.filter(r => Number(r.diferencia) === 0);

  return {
    total_productos: rows.length,
    productos_consistentes: consistentes.length,
    productos_inconsistentes: inconsistentes.length,
    inconsistencias: inconsistentes,
    resumen: inconsistentes.length === 0
      ? 'Stock consistente: producto.stock_actual coincide con la suma de stock_deposito para todos los productos.'
      : `Se encontraron ${inconsistentes.length} producto(s) con diferencias entre stock global y stock por depósito.`
  };
}

async function reconciliarStock(userId) {
  const inconsistentes = await all(`
    SELECT 
      p.id_producto AS id,
      p.nombre,
      COALESCE(p.stock_actual, 0) AS stock_anterior,
      COALESCE(sd_sum.total_depositos, 0) AS stock_correcto
    FROM producto p
    LEFT JOIN (
      SELECT id_producto, SUM(cantidad) AS total_depositos
      FROM stock_deposito
      GROUP BY id_producto
    ) sd_sum ON sd_sum.id_producto = p.id_producto
    WHERE COALESCE(p.stock_actual, 0) <> COALESCE(sd_sum.total_depositos, 0)
  `);

  if (inconsistentes.length === 0) {
    return { ok: true, corregidos: 0, message: 'No hay inconsistencias. Stock ya está sincronizado.' };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const item of inconsistentes) {
      await client.query(
        'UPDATE producto SET stock_actual = $1, updated_at = CURRENT_TIMESTAMP WHERE id_producto = $2',
        [item.stock_correcto, item.id]
      );

      await client.query(
        `INSERT INTO auditoria (usuario_id, entidad, accion, id_registro, cambios)
         VALUES ($1, 'producto', 'RECONCILIACION_STOCK', $2, $3)`,
        [
          userId,
          item.id,
          JSON.stringify({
            producto: item.nombre,
            stock_anterior: Number(item.stock_anterior),
            stock_correcto: Number(item.stock_correcto),
            diferencia: Number(item.stock_anterior) - Number(item.stock_correcto),
            motivo: 'Reconciliación automática: stock_actual ajustado a la suma de stock_deposito'
          })
        ]
      );
    }

    await client.query('COMMIT');

    return {
      ok: true,
      corregidos: inconsistentes.length,
      detalles: inconsistentes.map(i => ({
        id: i.id,
        nombre: i.nombre,
        stock_anterior: Number(i.stock_anterior),
        stock_correcto: Number(i.stock_correcto)
      })),
      message: `Se corrigieron ${inconsistentes.length} producto(s).`
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  listDepositos,
  getProductosByDeposito,
  getStockPorProducto,
  getStockByDeposito,
  moverStock,
  getTraslados,
  registrarIngreso,
  registrarEgreso,
  getRecepcionesLicitacion,
  getDetalleRecepcion,
  registrarIngresoLicitacion,
  cerrarLicitacion,
  registrarDanioImagen,
  getRemitosByLicitacion,
  getRemitoGeneralLicitacion,
  getPendientesDistribucion,
  getDetalleDistribucionEscuela,
  registrarSalidaDistribucion,
  getDistribucionZonasPendientes,
  getDistribucionZonaDetalle,
  registrarEgresoMultipleZona,
  getVencimientosProximos,
  diagnosticoStock,
  reconciliarStock
};
