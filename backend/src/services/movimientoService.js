const { all, get, run, pool } = require("../db.pg");

const TIPOS_MOVIMIENTO = ["ingreso", "egreso", "ajuste", "devolucion"];

async function listarMovimientos(queryParams) {
  const { producto_id, id_deposito, tipo, desde, hasta, usuario, proveedor, limit = 50, offset = 0 } = queryParams;

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
      COALESCE(pr.nombre, pr_lic.proveedor_nombre) as proveedor_nombre,
      m.motivo,
      u.nombre as usuario_nombre,
      u.email as usuario_email,
      m.fecha_movimiento as created_at,
      m.id_deposito,
      d.nombre as deposito_nombre
    FROM movimiento_stock m
    LEFT JOIN producto p ON m.id_producto = p.id_producto
    LEFT JOIN usuario u ON m.id_usuario = u.id_usuario
    LEFT JOIN institucion i ON m.id_institucion = i.id_institucion
    LEFT JOIN proveedor pr ON m.id_proveedor = pr.id_proveedor
    LEFT JOIN LATERAL (
      SELECT cph.id_proveedor, prov.nombre AS proveedor_nombre
      FROM compra_precio_historico cph
      JOIN proveedor prov ON prov.id_proveedor = cph.id_proveedor
      WHERE cph.id_producto = m.id_producto
      ORDER BY 
        (CASE 
          WHEN cph.anio = (
            CASE
              WHEN substring(m.motivo from 'REMITO-([0-9]{4})-') IS NOT NULL
                THEN CAST(substring(m.motivo from 'REMITO-([0-9]{4})-') AS INT)
              WHEN substring(m.motivo from 'Licitación #([0-9]+)') IS NOT NULL
                THEN (
                  SELECT lp.anio
                  FROM licitacion_publicada lp
                  WHERE lp.id = CAST(substring(m.motivo from 'Licitación #([0-9]+)') AS INT)
                  LIMIT 1
                )
              ELSE NULL
            END
          ) THEN 1 
          ELSE 0 
        END) DESC,
        cph.updated_at DESC NULLS LAST, 
        cph.id_proveedor
      LIMIT 1
    ) pr_lic ON m.id_proveedor IS NULL
    LEFT JOIN deposito d ON m.id_deposito = d.id_deposito
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

  if (id_deposito) {
    query += ` AND m.id_deposito = $${paramIndex++}`;
    params.push(id_deposito);
  }

  if (proveedor) {
    const proveedorStr = String(proveedor).trim();
    if (proveedorStr) {
      if (/^\d+$/.test(proveedorStr)) {
        query += ` AND COALESCE(m.id_proveedor, pr_lic.id_proveedor) = $${paramIndex++}`;
        params.push(parseInt(proveedorStr, 10));
      } else {
        query += ` AND COALESCE(pr.nombre, pr_lic.proveedor_nombre) ILIKE $${paramIndex++}`;
        params.push(`%${proveedorStr}%`);
      }
    }
  }

  query += ` ORDER BY m.fecha_movimiento DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
  params.push(parseInt(limit), parseInt(offset));

  return await all(query, params);
}

async function obtenerMovimiento(id) {
  return await get(`
    SELECT 
      m.id_movimiento as id,
      m.id_producto,
      p.nombre as producto_nombre,
      m.tipo,
      m.cantidad,
      m.estado_producto,
      m.cargo_retira,
      i.nombre as institucion_nombre,
      COALESCE(pr.nombre, pr_lic.proveedor_nombre) as proveedor_nombre,
      m.motivo,
      u.nombre as usuario_nombre,
      m.fecha_movimiento as created_at
    FROM movimiento_stock m
    LEFT JOIN producto p ON m.id_producto = p.id_producto
    LEFT JOIN usuario u ON m.id_usuario = u.id_usuario
    LEFT JOIN institucion i ON m.id_institucion = i.id_institucion
    LEFT JOIN proveedor pr ON m.id_proveedor = pr.id_proveedor
    LEFT JOIN LATERAL (
      SELECT cph.id_proveedor, prov.nombre AS proveedor_nombre
      FROM compra_precio_historico cph
      JOIN proveedor prov ON prov.id_proveedor = cph.id_proveedor
      WHERE cph.id_producto = m.id_producto
      ORDER BY 
        (CASE 
          WHEN cph.anio = (
            CASE
              WHEN substring(m.motivo from 'REMITO-([0-9]{4})-') IS NOT NULL
                THEN CAST(substring(m.motivo from 'REMITO-([0-9]{4})-') AS INT)
              WHEN substring(m.motivo from 'Licitación #([0-9]+)') IS NOT NULL
                THEN (
                  SELECT lp.anio
                  FROM licitacion_publicada lp
                  WHERE lp.id = CAST(substring(m.motivo from 'Licitación #([0-9]+)') AS INT)
                  LIMIT 1
                )
              ELSE NULL
            END
          ) THEN 1 
          ELSE 0 
        END) DESC,
        cph.updated_at DESC NULLS LAST, 
        cph.id_proveedor
      LIMIT 1
    ) pr_lic ON m.id_proveedor IS NULL
    WHERE m.id_movimiento = ?
  `, [id]);
}

async function resolveDefaultDepositoId(client = pool) {
  try {
    const res = await client.query(
      `SELECT id_deposito FROM deposito 
       ORDER BY (CASE WHEN (tipo = 'central' OR tipo_deposito = 'central' OR nombre ILIKE '%central%') THEN 0 ELSE 1 END), id_deposito ASC 
       LIMIT 1`
    );
    return res.rows[0]?.id_deposito || 1;
  } catch {
    return 1;
  }
}

async function crearMovimiento(user, body) {
  if (user.role === "operador_escolar") {
    throw { status: 403, message: "No tenés permisos para realizar movimientos manuales" };
  }

  const { producto_id, tipo, cantidad, motivo, id_deposito } = body;

  if (!producto_id || !tipo || !cantidad) {
    throw { status: 400, message: "Faltan campos obligatorios (producto_id, tipo, cantidad)" };
  }

  if (!TIPOS_MOVIMIENTO.includes(tipo)) {
    throw { status: 400, message: `Tipo inválido. Valores válidos: ${TIPOS_MOVIMIENTO.join(", ")}` };
  }

  const cantidadNum = parseInt(cantidad, 10);
  if (isNaN(cantidadNum) || cantidadNum <= 0) {
    throw { status: 400, message: "La cantidad debe ser un número mayor a 0" };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const prodRes = await client.query(
      "SELECT id_producto, nombre, COALESCE(stock_actual, 0) AS stock_actual FROM producto WHERE id_producto = $1",
      [producto_id]
    );
    const producto = prodRes.rows[0];
    if (!producto) {
      throw { status: 404, message: "Producto no encontrado" };
    }

    const depositoId = id_deposito ? parseInt(id_deposito, 10) : await resolveDefaultDepositoId(client);

    if (tipo === "egreso") {
      if (Number(producto.stock_actual) < cantidadNum) {
        throw { status: 400, message: `Stock insuficiente para ${producto.nombre}. Stock actual: ${producto.stock_actual}` };
      }
      if (depositoId) {
        const sdRes = await client.query(
          "SELECT COALESCE(cantidad, 0) as cantidad FROM stock_deposito WHERE id_deposito = $1 AND id_producto = $2",
          [depositoId, producto_id]
        );
        const sdQty = Number(sdRes.rows[0]?.cantidad || 0);
        if (sdQty < cantidadNum) {
          throw { status: 400, message: `Stock insuficiente en depósito para ${producto.nombre}. Disponible: ${sdQty}` };
        }
        await client.query(
          "UPDATE stock_deposito SET cantidad = cantidad - $1 WHERE id_deposito = $2 AND id_producto = $3",
          [cantidadNum, depositoId, producto_id]
        );
      }
      await client.query(
        "UPDATE producto SET stock_actual = COALESCE(stock_actual, 0) - $1 WHERE id_producto = $2",
        [cantidadNum, producto_id]
      );
    } else if (tipo === "ingreso") {
      if (depositoId) {
        await client.query(
          `INSERT INTO stock_deposito (id_deposito, id_producto, cantidad)
           VALUES ($1, $2, $3)
           ON CONFLICT (id_deposito, id_producto)
           DO UPDATE SET cantidad = stock_deposito.cantidad + $3`,
          [depositoId, producto_id, cantidadNum]
        );
      }
      await client.query(
        "UPDATE producto SET stock_actual = COALESCE(stock_actual, 0) + $1 WHERE id_producto = $2",
        [cantidadNum, producto_id]
      );
    }

    const result = await client.query(
      "INSERT INTO movimiento_stock (id_producto, tipo, cantidad, id_usuario, motivo, id_deposito, fecha_movimiento) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id_movimiento",
      [producto_id, tipo, cantidadNum, user.sub, motivo || null, depositoId]
    );

    await client.query("COMMIT");
    return result.rows[0].id_movimiento;
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

async function crearLoteMovimientos(user, body) {
  if (user.role === "operador_escolar") {
    throw { status: 403, message: "No tenés permisos para realizar movimientos manuales" };
  }

  const { tipo, motivo, id_deposito } = body;
  const movimientos = body.movimientos || body.items;

  if (!tipo || !movimientos || !Array.isArray(movimientos) || movimientos.length === 0) {
    throw { status: 400, message: "Faltan campos obligatorios (tipo, movimientos array)" };
  }

  if (!TIPOS_MOVIMIENTO.includes(tipo)) {
    throw { status: 400, message: `Tipo inválido. Valores válidos: ${TIPOS_MOVIMIENTO.join(", ")}` };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const depositoId = id_deposito ? parseInt(id_deposito, 10) : await resolveDefaultDepositoId(client);
    const ids = [];

    for (const mov of movimientos) {
      if (!mov.producto_id || !mov.cantidad) {
        throw { status: 400, message: "Cada movimiento debe tener producto_id y cantidad" };
      }
      const cantidadNum = parseInt(mov.cantidad, 10);
      if (isNaN(cantidadNum) || cantidadNum <= 0) {
        throw { status: 400, message: "La cantidad debe ser un número mayor a 0" };
      }

      const prodRes = await client.query(
        "SELECT id_producto, nombre, COALESCE(stock_actual, 0) AS stock_actual FROM producto WHERE id_producto = $1",
        [mov.producto_id]
      );
      const producto = prodRes.rows[0];
      if (!producto) {
        throw { status: 404, message: `Producto con id ${mov.producto_id} no encontrado` };
      }

      if (tipo === "egreso") {
        if (Number(producto.stock_actual) < cantidadNum) {
          throw { status: 400, message: `Stock insuficiente para ${producto.nombre}. Stock actual: ${producto.stock_actual}` };
        }
        if (depositoId) {
          const sdRes = await client.query(
            "SELECT COALESCE(cantidad, 0) as cantidad FROM stock_deposito WHERE id_deposito = $1 AND id_producto = $2",
            [depositoId, mov.producto_id]
          );
          const sdQty = Number(sdRes.rows[0]?.cantidad || 0);
          if (sdQty < cantidadNum) {
            throw { status: 400, message: `Stock insuficiente en depósito para ${producto.nombre}. Disponible: ${sdQty}` };
          }
          await client.query(
            "UPDATE stock_deposito SET cantidad = cantidad - $1 WHERE id_deposito = $2 AND id_producto = $3",
            [cantidadNum, depositoId, mov.producto_id]
          );
        }
        await client.query(
          "UPDATE producto SET stock_actual = COALESCE(stock_actual, 0) - $1 WHERE id_producto = $2",
          [cantidadNum, mov.producto_id]
        );
      } else if (tipo === "ingreso") {
        if (depositoId) {
          await client.query(
            `INSERT INTO stock_deposito (id_deposito, id_producto, cantidad)
             VALUES ($1, $2, $3)
             ON CONFLICT (id_deposito, id_producto)
             DO UPDATE SET cantidad = stock_deposito.cantidad + $3`,
            [depositoId, mov.producto_id, cantidadNum]
          );
        }
        await client.query(
          "UPDATE producto SET stock_actual = COALESCE(stock_actual, 0) + $1 WHERE id_producto = $2",
          [cantidadNum, mov.producto_id]
        );
      }

      const result = await client.query(
        "INSERT INTO movimiento_stock (id_producto, tipo, cantidad, id_usuario, motivo, id_deposito, fecha_movimiento) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id_movimiento",
        [mov.producto_id, tipo, cantidadNum, user.sub, motivo || null, depositoId]
      );
      ids.push(result.rows[0].id_movimiento);
    }

    await client.query("COMMIT");
    return ids;
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

async function crearMovimientoDirecto(user, body) {
  if (user.role === "operador_escolar") {
    throw { status: 403, message: "No tenés permisos para realizar movimientos manuales" };
  }

  const { tipo, institucion_id, cargo_retira, proveedor_id, motivo, productos, id_deposito } = body;

  if (!tipo || !productos || !Array.isArray(productos) || productos.length === 0) {
    throw { status: 400, message: "Faltan campos obligatorios (tipo, productos array)" };
  }

  if (!TIPOS_MOVIMIENTO.includes(tipo)) {
    throw { status: 400, message: `Tipo inválido. Valores válidos: ${TIPOS_MOVIMIENTO.join(", ")}` };
  }

  // Para egresos, validar institución y cargo
  if (tipo === "egreso") {
    if (!institucion_id || !cargo_retira) {
      throw { status: 400, message: "Para egresos se requiere institución y cargo de quien retira" };
    }
  }

  // Validar cada producto
  for (const prod of productos) {
    if (!prod.estado) {
      prod.estado = 'bueno';
    }
    if (!prod.producto_id || !prod.cantidad) {
      throw { status: 400, message: "Cada producto debe tener producto_id, cantidad y estado" };
    }
    const cantidadNum = parseInt(prod.cantidad, 10);
    if (isNaN(cantidadNum) || cantidadNum <= 0) {
      throw { status: 400, message: "La cantidad debe ser un número mayor a 0" };
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const depositoId = id_deposito ? parseInt(id_deposito, 10) : await resolveDefaultDepositoId(client);

    // Insertar movimientos y actualizar stock
    const ids = [];
    for (const prod of productos) {
      const cantidadNum = parseInt(prod.cantidad, 10);

      const prodRes = await client.query(
        "SELECT id_producto, nombre, COALESCE(stock_actual, 0) AS stock_actual FROM producto WHERE id_producto = $1",
        [prod.producto_id]
      );
      const producto = prodRes.rows[0];

      if (!producto) {
        throw { status: 404, message: `Producto con id ${prod.producto_id} no encontrado` };
      }

      if (tipo === "egreso") {
        if (Number(producto.stock_actual) < cantidadNum) {
          throw {
            status: 400,
            message: `Stock insuficiente para ${producto.nombre}. Stock actual: ${producto.stock_actual}, solicitado: ${cantidadNum}`
          };
        }
        if (depositoId) {
          const sdRes = await client.query(
            "SELECT COALESCE(cantidad, 0) as cantidad FROM stock_deposito WHERE id_deposito = $1 AND id_producto = $2",
            [depositoId, prod.producto_id]
          );
          const sdQty = Number(sdRes.rows[0]?.cantidad || 0);
          if (sdQty < cantidadNum) {
            throw {
              status: 400,
              message: `Stock insuficiente en depósito para ${producto.nombre}. Disponible en depósito: ${sdQty}, solicitado: ${cantidadNum}`
            };
          }
          await client.query(
            "UPDATE stock_deposito SET cantidad = cantidad - $1 WHERE id_deposito = $2 AND id_producto = $3",
            [cantidadNum, depositoId, prod.producto_id]
          );
        }
        await client.query(
          "UPDATE producto SET stock_actual = COALESCE(stock_actual, 0) - $1 WHERE id_producto = $2",
          [cantidadNum, prod.producto_id]
        );
      } else if (tipo === "ingreso") {
        if (depositoId) {
          await client.query(
            `INSERT INTO stock_deposito (id_deposito, id_producto, cantidad)
             VALUES ($1, $2, $3)
             ON CONFLICT (id_deposito, id_producto)
             DO UPDATE SET cantidad = stock_deposito.cantidad + $3`,
            [depositoId, prod.producto_id, cantidadNum]
          );
        }
        await client.query(
          "UPDATE producto SET stock_actual = COALESCE(stock_actual, 0) + $1 WHERE id_producto = $2",
          [cantidadNum, prod.producto_id]
        );
      }

      const movRes = await client.query(
        `INSERT INTO movimiento_stock
          (id_producto, tipo, cantidad, estado_producto, cargo_retira, id_institucion, id_proveedor, id_usuario, motivo, id_deposito, fecha_movimiento)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         RETURNING id_movimiento`,
        [
          prod.producto_id,
          tipo,
          cantidadNum,
          prod.estado,
          tipo === "egreso" ? cargo_retira : null,
          tipo === "egreso" ? institucion_id : null,
          tipo === "ingreso" ? (proveedor_id ? parseInt(proveedor_id, 10) : null) : null,
          user.sub,
          motivo || null,
          depositoId
        ]
      );

      ids.push(movRes.rows[0].id_movimiento);
    }

    await client.query("COMMIT");
    return ids;
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

async function obtenerStatsResumen() {
  return await get(`
    SELECT 
      SUM(CASE WHEN tipo = 'ingreso' THEN cantidad ELSE 0 END) as total_ingresos,
      SUM(CASE WHEN tipo = 'egreso' THEN cantidad ELSE 0 END) as total_egresos,
      SUM(CASE WHEN tipo = 'ajuste' THEN cantidad ELSE 0 END) as total_ajustes,
      SUM(CASE WHEN tipo = 'devolucion' THEN cantidad ELSE 0 END) as total_devoluciones
    FROM movimiento_stock
  `);
}

async function ensureBajaMovimientosSchema(client = pool) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS baja_movimientos (
      id SERIAL PRIMARY KEY,
      id_producto INTEGER NOT NULL,
      cantidad INTEGER NOT NULL DEFAULT 1,
      motivo TEXT,
      foto_path TEXT,
      id_usuario INTEGER,
      id_deposito INTEGER,
      estado VARCHAR(50) DEFAULT 'pendiente',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS baja_status_history (
      id SERIAL PRIMARY KEY,
      baja_id INTEGER NOT NULL,
      estado_anterior VARCHAR(50),
      estado_nuevo VARCHAR(50),
      usuario_id INTEGER,
      comentarios TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  const columnsRes = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'baja_movimientos'
  `);

  const columns = new Set(columnsRes.rows.map((row) => row.column_name));

  if (!columns.has('id_deposito')) {
    await client.query(`
      ALTER TABLE public.baja_movimientos
      ADD COLUMN IF NOT EXISTS id_deposito INTEGER
    `);
    columns.add('id_deposito');
  }

  return {
    createdColumn: columns.has('createdAt')
      ? '"createdAt"'
      : 'created_at',
  };
}

async function registrarBaja(user, body, file) {
  const client = await pool.connect();
  try {
    await ensureBajaMovimientosSchema(client);

    const { producto_id, cantidad = 1, motivo, id_deposito } = body;
    const cantidadNum = parseInt(cantidad, 10) || 1;
    const depositoId = parseInt(id_deposito, 10);

    if (!producto_id) {
      throw { status: 400, message: 'Falta producto_id' };
    }
    if (isNaN(depositoId)) {
      throw { status: 400, message: 'Falta id_deposito o es inválido' };
    }
    
    // Validar foto obligatoria
    if (!file) {
      throw { status: 400, message: 'La fotografía es obligatoria para justificar la baja (rotura, vencimiento, etc.)' };
    }

    const prodRes = await client.query(
      'SELECT id_producto, nombre FROM producto WHERE id_producto = $1',
      [producto_id]
    );
    if (prodRes.rowCount === 0) {
      throw { status: 404, message: 'Producto no encontrado' };
    }

    const stockDepRes = await client.query(
      'SELECT cantidad FROM stock_deposito WHERE id_deposito = $1 AND id_producto = $2',
      [depositoId, producto_id]
    );
    const stockDisponible = stockDepRes.rows[0]?.cantidad || 0;

    if (stockDisponible < cantidadNum) {
      throw { status: 400, message: `Stock insuficiente en el depósito origen. Disponible: ${stockDisponible}, solicitado para baja: ${cantidadNum}` };
    }

    await client.query('BEGIN');

    const fotoPath = `/uploads/${file.filename}`;

    const bajaRes = await client.query(
      'INSERT INTO baja_movimientos (id_producto, cantidad, motivo, foto_path, id_usuario, id_deposito, estado) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [producto_id, cantidadNum, motivo || null, fotoPath, user.sub, depositoId, 'pendiente']
    );

    await client.query(
      'INSERT INTO baja_status_history (baja_id, estado_anterior, estado_nuevo, usuario_id, comentarios) VALUES ($1, $2, $3, $4, $5)',
      [bajaRes.rows[0].id, null, 'pendiente', user.sub, 'Solicitud de baja creada']
    );

    await client.query('COMMIT');

    return { baja_id: bajaRes.rows[0].id, estado: 'pendiente' };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { }
    throw err;
  } finally {
    client.release();
  }
}

async function autorizarBaja(id_baja, user, accion) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Obtener la solicitud de baja
    const bajaRes = await client.query('SELECT * FROM baja_movimientos WHERE id = $1 FOR UPDATE', [id_baja]);
    if (bajaRes.rowCount === 0) {
      throw { status: 404, message: 'Solicitud de baja no encontrada' };
    }
    const baja = bajaRes.rows[0];

    if (baja.estado !== 'pendiente') {
      throw { status: 400, message: `La solicitud no está pendiente (estado actual: ${baja.estado})` };
    }

    if (accion === 'rechazar') {
      await client.query("UPDATE baja_movimientos SET estado = 'rechazada' WHERE id = $1", [id_baja]);
      await client.query(
        'INSERT INTO baja_status_history (baja_id, estado_anterior, estado_nuevo, usuario_id, comentarios) VALUES ($1, $2, $3, $4, $5)',
        [id_baja, 'pendiente', 'rechazada', user.sub, 'Solicitud rechazada']
      );
      await client.query('COMMIT');
      return { message: 'Baja rechazada' };
    }

    if (accion !== 'aprobar') {
      throw { status: 400, message: 'Acción inválida' };
    }

    // 2. Verificar que existe el deposito de desguace
    let depRes = await client.query("SELECT id_deposito FROM deposito WHERE nombre ILIKE '%desguace%' LIMIT 1");
    if (depRes.rowCount === 0) {
      depRes = await client.query("SELECT id_deposito FROM deposito WHERE id_deposito > 0 ORDER BY id_deposito LIMIT 1");
    }
    if (depRes.rowCount === 0) {
      throw { status: 500, message: 'No existe un depósito de desguace configurado en el sistema' };
    }
    const idDesguace = depRes.rows[0].id_deposito;

    // 3. Verificar stock nuevamente
    const stockDepRes = await client.query(
      'SELECT cantidad FROM stock_deposito WHERE id_deposito = $1 AND id_producto = $2',
      [baja.id_deposito, baja.id_producto]
    );
    const stockDisponible = stockDepRes.rows[0]?.cantidad || 0;
    if (stockDisponible < baja.cantidad) {
      throw { status: 400, message: `Stock insuficiente en el depósito origen. Disponible: ${stockDisponible}, solicitado: ${baja.cantidad}` };
    }

    // 4. Actualizar estado de la baja
    await client.query("UPDATE baja_movimientos SET estado = 'aprobada' WHERE id = $1", [id_baja]);

    // 5. Registrar los movimientos físicos
    // Egreso del deposito origen
    const movSalida = await client.query(
      `INSERT INTO movimiento_stock (id_producto, tipo, cantidad, estado_producto, id_usuario, motivo, id_deposito, id_deposito_destino, fecha_movimiento)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING id_movimiento`,
      [baja.id_producto, 'egreso', baja.cantidad, 'dañado', user.sub, `Aprobación Baja #${id_baja} (traslado a desguace): ${baja.motivo || ''}`, baja.id_deposito, idDesguace]
    );

    // Ingreso al deposito desguace
    const movEntrada = await client.query(
      `INSERT INTO movimiento_stock (id_producto, tipo, cantidad, estado_producto, id_usuario, motivo, id_deposito, fecha_movimiento)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id_movimiento`,
      [baja.id_producto, 'ingreso', baja.cantidad, 'dañado', user.sub, `Ingreso por Baja #${id_baja}: ${baja.motivo || ''}`, idDesguace]
    );

    // 6. Actualizar stock por depósito (el stock general total en producto NO cambia, porque sigue en el ministerio, solo que en desguace)
    await client.query(
      'UPDATE stock_deposito SET cantidad = cantidad - $1 WHERE id_deposito = $2 AND id_producto = $3',
      [baja.cantidad, baja.id_deposito, baja.id_producto]
    );

    // Sumar a desguace (upsert)
    await client.query(
      `INSERT INTO stock_deposito (id_deposito, id_producto, cantidad) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (id_deposito, id_producto) 
       DO UPDATE SET cantidad = stock_deposito.cantidad + $3`,
      [idDesguace, baja.id_producto, baja.cantidad]
    );

    await client.query(
      'INSERT INTO baja_status_history (baja_id, estado_anterior, estado_nuevo, usuario_id, comentarios) VALUES ($1, $2, $3, $4, $5)',
      [id_baja, 'pendiente', 'aprobada', user.sub, 'Solicitud aprobada y enviada a desguace']
    );

    await client.query('COMMIT');
    return { baja_id: id_baja, movimiento_salida: movSalida.rows[0].id_movimiento, movimiento_entrada: movEntrada.rows[0].id_movimiento };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { }
    throw err;
  } finally {
    client.release();
  }
}

async function listarBajas(queryParams) {
  const { id_deposito, producto_id, desde, hasta, limit = 50, offset = 0 } = queryParams;
  const bajaSchema = await ensureBajaMovimientosSchema();
  const createdExpr = bajaSchema.createdColumn ? `b.${bajaSchema.createdColumn}` : 'NOW()';

  let query = `
    SELECT 
      b.id,
      b.id_producto,
      p.nombre as producto_nombre,
      p.unidad_medida,
      b.cantidad,
      b.motivo,
      b.foto_path,
      b.id_usuario,
      u.nombre as usuario_nombre,
      b.id_deposito,
      d.nombre as deposito_nombre,
      b.estado,
      ${createdExpr} as created_at
    FROM baja_movimientos b
    LEFT JOIN producto p ON b.id_producto = p.id_producto
    LEFT JOIN usuario u ON b.id_usuario = u.id_usuario
    LEFT JOIN deposito d ON b.id_deposito = d.id_deposito
    WHERE 1 = 1
  `;
  const params = [];
  let paramIndex = 1;

  if (id_deposito) {
    query += ` AND b.id_deposito = $${paramIndex++}`;
    params.push(parseInt(id_deposito, 10));
  }

  if (producto_id) {
    query += ` AND b.id_producto = $${paramIndex++}`;
    params.push(parseInt(producto_id, 10));
  }

  if (desde) {
    query += ` AND ${createdExpr} >= $${paramIndex++}`;
    params.push(desde);
  }

  if (hasta) {
    query += ` AND ${createdExpr} <= $${paramIndex++}`;
    params.push(hasta);
  }

  query += ` ORDER BY ${createdExpr} DESC, b.id DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
  params.push(parseInt(limit), parseInt(offset));

  return await all(query, params);
}

async function obtenerHistorialBaja(id_baja) {
  return await all(`
    SELECT h.*, u.nombre as usuario_nombre
    FROM baja_status_history h
    LEFT JOIN usuario u ON h.usuario_id = u.id_usuario
    WHERE h.baja_id = $1
    ORDER BY h.created_at ASC
  `, [id_baja]);
}

module.exports = {
  listarMovimientos,
  obtenerMovimiento,
  crearMovimiento,
  crearLoteMovimientos,
  crearMovimientoDirecto,
  obtenerStatsResumen,
  registrarBaja,
  listarBajas,
  autorizarBaja,
  obtenerHistorialBaja
};
