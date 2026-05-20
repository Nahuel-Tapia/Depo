const { all, get } = require("../db.pg");

async function hasTable(tableName) {
  const row = await get(`SELECT to_regclass($1) AS regclass`, [`public.${tableName}`]);
  return Boolean(row?.regclass);
}

async function getDashboardStats(user) {
  const userRole = user.role;

  // Rol directivo: solo datos básicos (sin info sensible de stock/movimientos)
  if (userRole === 'directivo') {
    return {
      productos: { total: 0, stock_bajo: 0, sin_stock: 0 },
      instituciones: { total: 0 },
      proveedores: { total: 0 },
      movimientos_mes: { total: 0, ingresos: 0, egresos: 0, ajustes: 0, devoluciones: 0 },
      stock_bajo: [],
      sin_stock_list: [],
      ultimos_movimientos: [],
      limited: true,
    };
  }

  // Totales de productos y alertas de stock bajo
  const tableExists = await hasTable('stock_deposito');
  let productosStats, stockBajo, sinStockList;

  if (tableExists) {
    productosStats = await get(`
      SELECT 
        COUNT(p.id_producto) as total_productos,
        SUM(CASE WHEN COALESCE(sd.stock_total, 0) <= p.stock_minimo AND p.stock_minimo > 0 THEN 1 ELSE 0 END) as stock_bajo,
        SUM(CASE WHEN COALESCE(sd.stock_total, 0) = 0 THEN 1 ELSE 0 END) as sin_stock
      FROM producto p
      LEFT JOIN (
        SELECT id_producto, SUM(cantidad) as stock_total 
        FROM stock_deposito 
        GROUP BY id_producto
      ) sd ON p.id_producto = sd.id_producto
    `);

    stockBajo = await all(`
      SELECT 
        p.id_producto as id,
        p.nombre as nombre,
        COALESCE(sd.stock_total, 0) as stock_actual,
        p.stock_minimo,
        c.nombre as categoria
      FROM producto p
      LEFT JOIN (
        SELECT id_producto, SUM(cantidad) as stock_total 
        FROM stock_deposito 
        GROUP BY id_producto
      ) sd ON p.id_producto = sd.id_producto
      LEFT JOIN categoria c ON p.id_categoria = c.id_categoria
      WHERE COALESCE(sd.stock_total, 0) <= p.stock_minimo AND p.stock_minimo > 0
      ORDER BY COALESCE(sd.stock_total, 0) ASC
      LIMIT 10
    `);

    sinStockList = await all(`
      SELECT
        p.id_producto as id,
        p.nombre as nombre,
        COALESCE(sd.stock_total, 0) as stock_actual,
        p.stock_minimo,
        c.nombre as categoria
      FROM producto p
      LEFT JOIN (
        SELECT id_producto, SUM(cantidad) as stock_total 
        FROM stock_deposito 
        GROUP BY id_producto
      ) sd ON p.id_producto = sd.id_producto
      LEFT JOIN categoria c ON p.id_categoria = c.id_categoria
      WHERE COALESCE(sd.stock_total, 0) = 0
      ORDER BY p.nombre ASC
      LIMIT 50
    `);
  } else {
    productosStats = await get(`
      SELECT 
        COUNT(*) as total_productos,
        SUM(CASE WHEN stock_actual <= stock_minimo AND stock_minimo > 0 THEN 1 ELSE 0 END) as stock_bajo,
        SUM(CASE WHEN stock_actual = 0 THEN 1 ELSE 0 END) as sin_stock
      FROM producto
    `);

    stockBajo = await all(`
      SELECT 
        p.id_producto as id,
        p.nombre as nombre,
        p.stock_actual,
        p.stock_minimo,
        c.nombre as categoria
      FROM producto p
      LEFT JOIN categoria c ON p.id_categoria = c.id_categoria
      WHERE p.stock_actual <= p.stock_minimo AND p.stock_minimo > 0
      ORDER BY p.stock_actual ASC
      LIMIT 10
    `);

    sinStockList = await all(`
      SELECT
        p.id_producto as id,
        p.nombre as nombre,
        p.stock_actual,
        p.stock_minimo,
        c.nombre as categoria
      FROM producto p
      LEFT JOIN categoria c ON p.id_categoria = c.id_categoria
      WHERE p.stock_actual = 0
      ORDER BY p.nombre ASC
      LIMIT 50
    `);
  }

  // Total instituciones
  const institucionesStats = await get(`
    SELECT COUNT(*) as total_instituciones FROM institucion
  `);

  // Total proveedores
  const proveedoresStats = await get(`
    SELECT COUNT(*) as total_proveedores FROM proveedor
  `);

  // Movimientos del mes actual
  const movimientosStats = await get(`
    SELECT 
      COUNT(*) as total_movimientos,
      SUM(CASE WHEN tipo = 'ingreso' THEN cantidad ELSE 0 END) as total_ingresos,
      SUM(CASE WHEN tipo = 'egreso' THEN cantidad ELSE 0 END) as total_egresos,
      SUM(CASE WHEN tipo = 'ajuste' THEN cantidad ELSE 0 END) as total_ajustes,
      SUM(CASE WHEN tipo = 'devolucion' THEN cantidad ELSE 0 END) as total_devoluciones
    FROM movimiento_stock
    WHERE fecha_movimiento >= date_trunc('month', CURRENT_DATE)
  `);

  // Últimos 8 movimientos
  const ultimosMovimientos = await all(`
    SELECT 
      m.id_movimiento as id,
      p.nombre as producto,
      m.tipo,
      m.cantidad,
      i.nombre as institucion,
      u.nombre as usuario,
      m.motivo,
      m.fecha_movimiento as fecha
    FROM movimiento_stock m
    LEFT JOIN producto p ON m.id_producto = p.id_producto
    LEFT JOIN usuario u ON m.id_usuario = u.id_usuario
    LEFT JOIN institucion i ON m.id_institucion = i.id_institucion
    ORDER BY m.fecha_movimiento DESC
    LIMIT 8
  `);

  return {
    productos: {
      total: parseInt(productosStats.total_productos) || 0,
      stock_bajo: parseInt(productosStats.stock_bajo) || 0,
      sin_stock: parseInt(productosStats.sin_stock) || 0,
    },
    instituciones: {
      total: parseInt(institucionesStats.total_instituciones) || 0,
    },
    proveedores: {
      total: parseInt(proveedoresStats.total_proveedores) || 0,
    },
    movimientos_mes: {
      total: parseInt(movimientosStats.total_movimientos) || 0,
      ingresos: parseInt(movimientosStats.total_ingresos) || 0,
      egresos: parseInt(movimientosStats.total_egresos) || 0,
      ajustes: parseInt(movimientosStats.total_ajustes) || 0,
      devoluciones: parseInt(movimientosStats.total_devoluciones) || 0,
    },
    stock_bajo: stockBajo,
    sin_stock_list: sinStockList,
    ultimos_movimientos: ultimosMovimientos,
  };
}

async function getMovimientosMes(queryParams) {
  const { tipo } = queryParams;
  
  let query = `
    SELECT 
      m.id_movimiento as id,
      p.nombre as producto,
      m.tipo,
      m.cantidad,
      i.nombre as institucion,
      u.nombre as usuario,
      m.motivo,
      m.fecha_movimiento as fecha
    FROM movimiento_stock m
    LEFT JOIN producto p ON m.id_producto = p.id_producto
    LEFT JOIN usuario u ON m.id_usuario = u.id_usuario
    LEFT JOIN institucion i ON m.id_institucion = i.id_institucion
    WHERE m.fecha_movimiento >= date_trunc('month', CURRENT_DATE)
  `;

  const params = [];
  if (tipo && tipo !== 'total') {
    query += ` AND m.tipo = $1`;
    params.push(tipo);
  }

  query += ` ORDER BY m.fecha_movimiento DESC`;

  return await all(query, params);
}

module.exports = {
  getDashboardStats,
  getMovimientosMes
};
