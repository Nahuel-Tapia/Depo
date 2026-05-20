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
        AND cph.anio = (
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
        )
      ORDER BY cph.updated_at DESC NULLS LAST, cph.id_proveedor
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
        AND cph.anio = (
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
        )
      ORDER BY cph.updated_at DESC NULLS LAST, cph.id_proveedor
      LIMIT 1
    ) pr_lic ON m.id_proveedor IS NULL
    WHERE m.id_movimiento = ?
  `, [id]);
}

async function crearMovimiento(user, body) {
  if (user.role === "operador_escolar") {
    throw { status: 403, message: "No tenés permisos para realizar movimientos manuales" };
  }

  const { producto_id, tipo, cantidad, motivo } = body;

  if (!producto_id || !tipo || !cantidad) {
    throw { status: 400, message: "Faltan campos obligatorios (producto_id, tipo, cantidad)" };
  }

  if (!TIPOS_MOVIMIENTO.includes(tipo)) {
    throw { status: 400, message: `Tipo inválido. Valores válidos: ${TIPOS_MOVIMIENTO.join(", ")}` };
  }

  const cantidadNum = parseInt(cantidad);
  if (isNaN(cantidadNum) || cantidadNum <= 0) {
    throw { status: 400, message: "La cantidad debe ser un número mayor a 0" };
  }

  // Verificar que el producto existe
  const producto = await get("SELECT * FROM producto WHERE id_producto = ?", [producto_id]);
  if (!producto) {
    throw { status: 404, message: "Producto no encontrado" };
  }

  // Registrar movimiento
  const result = await run(
    "INSERT INTO movimiento_stock (id_producto, tipo, cantidad, id_usuario, motivo) VALUES (?, ?, ?, ?, ?)",
    [producto_id, tipo, cantidadNum, user.sub, motivo || null]
  );

  return result.lastID;
}

async function crearLoteMovimientos(user, body) {
  if (user.role === "operador_escolar") {
    throw { status: 403, message: "No tenés permisos para realizar movimientos manuales" };
  }

  const { tipo, motivo, movimientos } = body;

  if (!tipo || !movimientos || !Array.isArray(movimientos) || movimientos.length === 0) {
    throw { status: 400, message: "Faltan campos obligatorios (tipo, movimientos array)" };
  }

  if (!TIPOS_MOVIMIENTO.includes(tipo)) {
    throw { status: 400, message: `Tipo inválido. Valores válidos: ${TIPOS_MOVIMIENTO.join(", ")}` };
  }

  // Validar cada movimiento
  for (const mov of movimientos) {
    if (!mov.producto_id || !mov.cantidad) {
      throw { status: 400, message: "Cada movimiento debe tener producto_id y cantidad" };
    }
    const cantidadNum = parseInt(mov.cantidad);
    if (isNaN(cantidadNum) || cantidadNum <= 0) {
      throw { status: 400, message: "La cantidad debe ser un número mayor a 0" };
    }
    // Verificar que el producto existe
    const producto = await get("SELECT * FROM producto WHERE id_producto = ?", [mov.producto_id]);
    if (!producto) {
      throw { status: 404, message: `Producto con id ${mov.producto_id} no encontrado` };
    }
  }

  // Insertar movimientos
  const ids = [];
  for (const mov of movimientos) {
    const result = await run(
      "INSERT INTO movimiento_stock (id_producto, tipo, cantidad, id_usuario, motivo) VALUES (?, ?, ?, ?, ?)",
      [mov.producto_id, tipo, parseInt(mov.cantidad), user.sub, motivo || null]
    );
    ids.push(result.lastID);
  }

  return ids;
}

async function crearMovimientoDirecto(user, body) {
  if (user.role === "operador_escolar") {
    throw { status: 403, message: "No tenés permisos para realizar movimientos manuales" };
  }

  const { tipo, institucion_id, cargo_retira, proveedor_id, motivo, productos } = body;

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
    if (!prod.producto_id || !prod.cantidad || !prod.estado) {
      throw { status: 400, message: "Cada producto debe tener producto_id, cantidad y estado" };
    }
    const cantidadNum = parseInt(prod.cantidad);
    if (isNaN(cantidadNum) || cantidadNum <= 0) {
      throw { status: 400, message: "La cantidad debe ser un número mayor a 0" };
    }
    // Verificar que el producto existe
    const producto = await get("SELECT * FROM producto WHERE id_producto = ?", [prod.producto_id]);
    if (!producto) {
      throw { status: 404, message: `Producto con id ${prod.producto_id} no encontrado` };
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

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

      if (tipo === "egreso" && Number(producto.stock_actual) < cantidadNum) {
        throw {
          status: 400,
          message: `Stock insuficiente para ${producto.nombre}. Stock actual: ${producto.stock_actual}, solicitado: ${cantidadNum}`
        };
      }

      const movRes = await client.query(
        `INSERT INTO movimiento_stock
          (id_producto, tipo, cantidad, estado_producto, cargo_retira, id_institucion, id_proveedor, id_usuario, motivo, fecha_movimiento)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         RETURNING id_movimiento`,
        [
          prod.producto_id,
          tipo,
          cantidadNum,
          prod.estado,
          tipo === "egreso" ? cargo_retira : null,
          tipo === "egreso" ? institucion_id : null,
          tipo === "ingreso" ? proveedor_id : null,
          user.sub,
          motivo || null
        ]
      );

      if (tipo === "ingreso") {
        await client.query(
          "UPDATE producto SET stock_actual = COALESCE(stock_actual, 0) + $1 WHERE id_producto = $2",
          [cantidadNum, prod.producto_id]
        );
      } else if (tipo === "egreso") {
        await client.query(
          "UPDATE producto SET stock_actual = COALESCE(stock_actual, 0) - $1 WHERE id_producto = $2",
          [cantidadNum, prod.producto_id]
        );
      }

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

async function registrarBaja(user, body, file) {
  const client = await pool.connect();
  try {
    const chk = await client.query("SELECT to_regclass('public.baja_movimientos') as exists");
    console.log('baja_movimientos exists check:', chk.rows[0]);

    const { producto_id, cantidad = 1, motivo } = body;
    const cantidadNum = parseInt(cantidad, 10) || 1;

    if (!producto_id) {
      throw { status: 400, message: 'Falta producto_id' };
    }

    const prodRes = await client.query(
      'SELECT id_producto, nombre, COALESCE(stock_actual, 0) AS stock_actual FROM producto WHERE id_producto = $1',
      [producto_id]
    );
    if (prodRes.rowCount === 0) {
      throw { status: 404, message: 'Producto no encontrado' };
    }
    const producto = prodRes.rows[0];

    if (Number(producto.stock_actual) < cantidadNum) {
      throw { status: 400, message: 'Stock insuficiente para dar de baja' };
    }

    await client.query('BEGIN');

    const fotoPath = file ? `/uploads/${file.filename}` : null;

    const bajaRes = await client.query(
      'INSERT INTO baja_movimientos (id_producto, cantidad, motivo, foto_path, id_usuario) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [producto_id, cantidadNum, motivo || null, fotoPath, user.sub]
    );

    const movRes = await client.query(
      `INSERT INTO movimiento_stock (id_producto, tipo, cantidad, estado_producto, id_usuario, motivo, fecha_movimiento)
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id_movimiento`,
      [producto_id, 'ajuste', cantidadNum, 'dañado', user.sub, motivo ? `Baja: ${motivo}` : 'Baja de mercadería']
    );

    await client.query(
      'UPDATE producto SET stock_actual = COALESCE(stock_actual, 0) - $1 WHERE id_producto = $2',
      [cantidadNum, producto_id]
    );

    await client.query('COMMIT');

    return { baja_id: bajaRes.rows[0].id, movimiento_id: movRes.rows[0].id_movimiento };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  listarMovimientos,
  obtenerMovimiento,
  crearMovimiento,
  crearLoteMovimientos,
  crearMovimientoDirecto,
  obtenerStatsResumen,
  registrarBaja
};
