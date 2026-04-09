const express = require("express");
const { all, get } = require("../db.pg");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");

const router = express.Router();

router.use(authenticate);

// Dashboard resumen general
router.get("/stats", authorizePermissions(PERMISSIONS.DASHBOARD_VIEW), async (req, res) => {
  try {
    // Totales de productos y alertas de stock bajo
    const productosStats = await get(`
      SELECT 
        COUNT(*) as total_productos,
        SUM(CASE WHEN stock_actual <= stock_minimo AND stock_minimo > 0 THEN 1 ELSE 0 END) as stock_bajo,
        SUM(CASE WHEN stock_actual = 0 THEN 1 ELSE 0 END) as sin_stock
      FROM producto
    `);

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

    // Productos con stock bajo (lista)
    const stockBajo = await all(`
      SELECT 
        p.id_producto as id,
        p.nombre,
        p.stock_actual,
        p.stock_minimo,
        c.nombre as categoria
      FROM producto p
      LEFT JOIN categoria c ON p.id_categoria = c.id_categoria
      WHERE p.stock_actual <= p.stock_minimo AND p.stock_minimo > 0
      ORDER BY p.stock_actual ASC
      LIMIT 10
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

    return res.json({
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
      ultimos_movimientos: ultimosMovimientos,
    });
  } catch (err) {
    console.error("Error obteniendo stats del dashboard:", err);
    return res.status(500).json({ error: "No se pudo obtener el resumen" });
  }
});

module.exports = router;
