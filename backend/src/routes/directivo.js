const express = require("express");
const { all, get } = require("../db.pg");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

// GET /api/directivo/alertas - Obtener alertas para el directivo
router.get("/alertas", async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    // Obtener información del usuario directivo
    const usuario = await get("SELECT * FROM usuario WHERE id_usuario = ?", [userId]);
    if (!usuario || usuario.role !== 'directivo') {
      return res.status(403).json({ error: "Acceso denegado" });
    }

    const institucionId = usuario.id_institucion;
    if (!institucionId) {
      return res.status(400).json({ error: "El usuario no tiene institución asociada" });
    }

    // Obtener institución
    const institucion = await get(
      "SELECT id_institucion, nombre, cue FROM institucion WHERE id_institucion = ?",
      [institucionId]
    );

    // Obtener pedidos aprobados pendientes de retirar
    const pedidosAprobados = await all(
      `SELECT 
        p.id,
        p.estado,
        p.created_at,
        COUNT(pi.id) as cantidad_items
      FROM pedido p
      LEFT JOIN pedido_item pi ON p.id = pi.id_pedido
      WHERE p.id_institucion = ? AND p.estado = 'aprobado'
      GROUP BY p.id, p.estado, p.created_at
      ORDER BY p.created_at DESC`,
      [institucionId]
    );

    // Obtener movimientos de egreso recientes (últimos 15 días)
    const fecha15DiasAtras = new Date();
    fecha15DiasAtras.setDate(fecha15DiasAtras.getDate() - 15);
    
    const movimientosPendientes = await all(
      `SELECT 
        m.id_movimiento as id,
        m.tipo,
        m.cantidad,
        p.nombre as producto_nombre,
        p.unidad_medida,
        m.fecha_movimiento as fecha,
        m.motivo as notas
      FROM movimiento_stock m
      JOIN producto p ON m.id_producto = p.id_producto
      WHERE m.id_institucion = ? 
        AND m.tipo = 'egreso'
        AND m.fecha_movimiento >= ?
      ORDER BY m.fecha_movimiento DESC
      LIMIT 10`,
      [institucionId, fecha15DiasAtras.toISOString()]
    );

    // Obtener información importante: últimas 5 transacciones
    const ultimasTransacciones = await all(
      `SELECT 
        m.id_movimiento as id,
        m.tipo,
        m.cantidad,
        p.nombre as producto_nombre,
        p.unidad_medida,
        m.fecha_movimiento as fecha,
        u.nombre as usuario_nombre
      FROM movimiento_stock m
      JOIN producto p ON m.id_producto = p.id_producto
      LEFT JOIN usuario u ON m.id_usuario = u.id_usuario
      WHERE m.id_institucion = ?
      ORDER BY m.fecha_movimiento DESC
      LIMIT 5`,
      [institucionId]
    );

    return res.json({
      ok: true,
      institucion,
      alertas: {
        pedidosAprobados: {
          cantidad: pedidosAprobados.length,
          items: pedidosAprobados
        },
        movimientosPendientes: {
          cantidad: movimientosPendientes.length,
          items: movimientosPendientes
        }
      },
      ultimasTransacciones
    });
  } catch (err) {
    console.error("Error en GET /api/directivo/alertas:", err);
    return res.status(500).json({ error: "Error al obtener alertas" });
  }
});

module.exports = router;
