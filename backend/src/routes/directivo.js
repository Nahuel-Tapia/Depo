const express = require("express");
const { all, get } = require("../db.pg");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

// GET /api/directivo/alertas - Obtener alertas para el directivo
router.get("/alertas", async (req, res) => {
  try {
    const userId = req.user?.sub;
    
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

    // Obtener pedidos aprobados que aún tengan items pendientes de retirar
    // Calculamos la diferencia entre lo solicitado y lo ya entregado (pedido_entrega)
    const pedidosAprobados = await all(
      `SELECT
        p.id_pedido AS id,
        p.estado,
        p.fecha_creacion AS created_at,
        SUM(dp.cantidad_solicitada) AS total_solicitado,
        COALESCE(pe.total_entregado, 0) AS total_entregado,
        (SUM(dp.cantidad_solicitada) - COALESCE(pe.total_entregado, 0)) AS cantidad_pendiente
      FROM pedido p
      LEFT JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
      LEFT JOIN (
        SELECT id_pedido, SUM(cantidad_entregada) AS total_entregado
        FROM pedido_entrega
        GROUP BY id_pedido
      ) pe ON pe.id_pedido = p.id_pedido
      WHERE p.id_institucion = ? AND p.estado = 'aprobado'
      GROUP BY p.id_pedido, p.estado, p.fecha_creacion, pe.total_entregado
      HAVING (SUM(dp.cantidad_solicitada) - COALESCE(pe.total_entregado, 0)) > 0
      ORDER BY p.fecha_creacion DESC`,
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

// GET /api/directivo/mi-stock - Mostrar el stock del kit asignado a la institución del directivo
router.get('/mi-stock', async (req, res) => {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ error: 'Usuario no autenticado' });

    const usuario = await get('SELECT id_institucion FROM usuario WHERE id_usuario = ?', [userId]);
    if (!usuario?.id_institucion) return res.status(400).json({ error: 'Usuario sin institución asociada' });

    // Obtener kit asignado a la institución
    const inst = await get('SELECT kit_id FROM institucion WHERE id_institucion = ?', [usuario.id_institucion]);
    const kitId = Number(inst?.kit_id || 0);
    if (!kitId) return res.json({ ok: true, kit: null, items: [] });

    // Calculamos separado: entregas de pedidos anuales aprobados por director, y entregas de refuerzos aprobados
    const rows = await all(
      `SELECT d.id_producto AS producto_id, p.nombre AS producto_nombre, p.unidad_medida, d.cantidad AS cantidad_por_kit,
              COALESCE(ms.total_egresos, 0) - COALESCE(ref.total_entregado, 0) AS retirado_anual,
              COALESCE(ref.total_entregado, 0) AS retirado_refuerzo,
              COALESCE(ref_solicitado.total_solicitado, 0) AS pedido_refuerzo,
              COALESCE(ms.total_egresos, 0) AS total_egresos
       FROM producto_kit_detalle d
       LEFT JOIN producto p ON p.id_producto = d.id_producto
       LEFT JOIN (
         SELECT m.id_producto, SUM(m.cantidad) AS total_egresos
         FROM movimiento_stock m
         WHERE m.id_institucion = ? AND m.tipo = 'egreso'
         GROUP BY m.id_producto
       ) ms ON ms.id_producto = d.id_producto
       LEFT JOIN (
         SELECT pe.id_producto, SUM(pe.cantidad_entregada) AS total_entregado
         FROM pedido_entrega pe
         JOIN pedido pd ON pd.id_pedido = pe.id_pedido
         WHERE pd.id_institucion = ?
           AND pd.estado = 'aprobado'
           AND COALESCE(pd.tipo, 'anual') = 'refuerzo'
         GROUP BY pe.id_producto
       ) ref ON ref.id_producto = d.id_producto
       LEFT JOIN (
         SELECT dp.id_producto, SUM(dp.cantidad_solicitada) AS total_solicitado
         FROM detalle_pedido dp
         JOIN pedido pd ON pd.id_pedido = dp.id_pedido
         WHERE pd.id_institucion = ?
           AND pd.estado = 'aprobado'
           AND COALESCE(pd.tipo, 'anual') = 'refuerzo'
         GROUP BY dp.id_producto
       ) ref_solicitado ON ref_solicitado.id_producto = d.id_producto
       WHERE d.kit_id = ?
       ORDER BY p.nombre ASC`,
      [usuario.id_institucion, usuario.id_institucion, usuario.id_institucion, kitId]
    );

    const items = rows.map(r => {
      const cantidad_por_kit = Number(r.cantidad_por_kit || 0)
      const retirado_anual = Number(r.retirado_anual || 0)
      const retirado_refuerzo = Number(r.retirado_refuerzo || 0)
      const pedido_refuerzo = Number(r.pedido_refuerzo || 0)

      const necesario_anual = Math.max(0, cantidad_por_kit - retirado_anual)
      const pendiente_refuerzo = Math.max(0, pedido_refuerzo - retirado_refuerzo)
      const restante_total = necesario_anual + pendiente_refuerzo

      return ({
        producto_id: Number(r.producto_id),
        producto_nombre: r.producto_nombre,
        unidad_medida: r.unidad_medida,
        cantidad_por_kit: cantidad_por_kit,
        retirado_anual: retirado_anual,
        retirado_refuerzo: retirado_refuerzo,
        pedido_refuerzo: pedido_refuerzo,
        restante: restante_total,
        total_retirado: retirado_anual + retirado_refuerzo
      })
    });

    const kit = await get('SELECT id, nombre, tipo_escuela, cantidad_alumnos FROM producto_kit WHERE id = ?', [kitId]);

    return res.json({ ok: true, kit: kit || null, items });
  } catch (err) {
    console.error('Error en GET /api/directivo/mi-stock:', err);
    return res.status(500).json({ error: 'Error al obtener Mi stock' });
  }
});
