const express = require("express");
const { all, get, run, pool } = require("../db.pg");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");

const router = express.Router();
router.use(authenticate);

// Crear tabla de control de entregas si no existe
async function ensureEntregasSchema() {
  await run(`
    CREATE TABLE IF NOT EXISTS pedido_entrega (
      id SERIAL PRIMARY KEY,
      id_pedido INT NOT NULL REFERENCES pedido(id_pedido) ON DELETE CASCADE,
      id_movimiento INT REFERENCES movimiento_stock(id_movimiento) ON DELETE SET NULL,
      id_producto INT NOT NULL REFERENCES producto(id_producto),
      cantidad_entregada INT NOT NULL,
      fecha_entrega TIMESTAMP DEFAULT NOW(),
      id_usuario INT REFERENCES usuario(id_usuario),
      observaciones TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

// GET /api/entregas/pedidos-disponibles - Obtener pedidos anuales aprobados disponibles para retirar
router.get("/pedidos-disponibles", authorizePermissions(PERMISSIONS.MOVIMIENTOS_CREATE), async (req, res) => {
  try {
    await ensureEntregasSchema();

    const rows = await all(`
      SELECT 
        p.id_pedido AS id,
        p.id_institucion,
        i.nombre AS institucion_nombre,
        p.estado,
        p.aprobado_director_area,
        p.fecha_creacion,
        u.nombre AS solicitante_nombre,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'producto_id', pr.id_producto,
              'producto_nombre', pr.nombre,
              'unidad_medida', pr.unidad_medida,
              'cantidad_solicitada', dp.cantidad_solicitada,
              'stock_actual', COALESCE(pr.stock_actual, 0)
            )
            ORDER BY pr.nombre
          ) FILTER (WHERE pr.id_producto IS NOT NULL),
          '[]'::json
        ) AS items
      FROM pedido p
      JOIN institucion i ON i.id_institucion = p.id_institucion
      JOIN usuario u ON u.id_usuario = p.id_usuario_solicitante
      JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
      JOIN producto pr ON pr.id_producto = dp.id_producto
      WHERE p.estado = 'aprobado'
        AND p.aprobado_director_area = TRUE
        AND COALESCE(p.tipo, 'anual') = 'anual'
      GROUP BY p.id_pedido, p.id_institucion, i.nombre, p.estado, 
               p.aprobado_director_area, p.fecha_creacion, u.nombre
      ORDER BY p.fecha_creacion DESC
    `);

    // Calcular cantidades ya entregadas por pedido
    const entregasRows = await all(`
      SELECT 
        id_pedido,
        id_producto,
        SUM(cantidad_entregada) AS total_entregado
      FROM pedido_entrega
      GROUP BY id_pedido, id_producto
    `);

    const entregasMap = new Map();
    for (const row of entregasRows) {
      const key = `${row.id_pedido}-${row.id_producto}`;
      entregasMap.set(key, Number(row.total_entregado));
    }

    // Procesar pedidos para agregar información de entregas
    const pedidos = rows.map(pedido => {
      const itemsConEntregas = pedido.items.map(item => {
        const key = `${pedido.id}-${item.producto_id}`;
        const entregado = entregasMap.get(key) || 0;
        const pendiente = item.cantidad_solicitada - entregado;
        
        return {
          ...item,
          cantidad_solicitada: Number(item.cantidad_solicitada),
          stock_actual: Number(item.stock_actual),
          cantidad_entregada: entregado,
          cantidad_pendiente: Math.max(0, pendiente),
          puede_entregar: pendiente > 0 && Number(item.stock_actual) >= Math.min(pendiente, Number(item.stock_actual))
        };
      });

      return {
        id: Number(pedido.id),
        id_institucion: Number(pedido.id_institucion),
        institucion_nombre: pedido.institucion_nombre,
        estado: pedido.estado,
        aprobado_director_area: pedido.aprobado_director_area,
        fecha_creacion: pedido.fecha_creacion,
        solicitante_nombre: pedido.solicitante_nombre,
        items: itemsConEntregas,
        tiene_pendientes: itemsConEntregas.some(item => item.cantidad_pendiente > 0)
      };
    });

    // Filtrar solo los que tienen items pendientes
    const pedidosConPendientes = pedidos.filter(p => p.tiene_pendientes);

    res.json({ pedidos: pedidosConPendientes });
  } catch (err) {
    console.error("Error al obtener pedidos disponibles:", err);
    res.status(500).json({ error: "No se pudieron obtener los pedidos disponibles" });
  }
});

// POST /api/entregas/retirar - Realizar egreso desde un pedido anual aprobado
router.post("/retirar", authorizePermissions(PERMISSIONS.MOVIMIENTOS_CREATE), async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureEntregasSchema();

    const { id_pedido, items, cargo_retira, observaciones } = req.body;

    if (!id_pedido || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Faltan campos obligatorios (id_pedido, items)" });
    }

    if (!cargo_retira) {
      return res.status(400).json({ error: "El cargo de quien retira es obligatorio" });
    }

    // Verificar que el pedido existe y está aprobado
    const pedido = await get(`
      SELECT p.id_pedido, p.id_institucion, p.estado, p.aprobado_director_area, i.nombre AS institucion_nombre
      FROM pedido p
      JOIN institucion i ON i.id_institucion = p.id_institucion
      WHERE p.id_pedido = $1
        AND p.estado = 'aprobado'
        AND p.aprobado_director_area = TRUE
        AND COALESCE(p.tipo, 'anual') = 'anual'
    `, [id_pedido]);

    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado o no está disponible para retirar" });
    }

    await client.query("BEGIN");

    const movimientosIds = [];
    const entregasData = [];

    for (const item of items) {
      const { producto_id, cantidad, estado_producto = 'nuevo' } = item;

      if (!producto_id || !cantidad || cantidad <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: `Item inválido: producto_id ${producto_id}, cantidad ${cantidad}` });
      }

      // Verificar stock actual
      const producto = await get(
        "SELECT id_producto, nombre, COALESCE(stock_actual, 0) AS stock_actual FROM producto WHERE id_producto = $1",
        [producto_id]
      );

      if (!producto) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: `Producto ${producto_id} no encontrado` });
      }

      if (Number(producto.stock_actual) < cantidad) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `Stock insuficiente para ${producto.nombre}. Stock: ${producto.stock_actual}, Solicitado: ${cantidad}`
        });
      }

      // Verificar cantidad pendiente en el pedido
      const detallePedido = await get(`
        SELECT cantidad_solicitada FROM detalle_pedido 
        WHERE id_pedido = $1 AND id_producto = $2
      `, [id_pedido, producto_id]);

      if (!detallePedido) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: `Producto ${producto.nombre} no pertenece a este pedido` });
      }

      // Calcular cuánto se ha entregado previamente
      const entregadoPrevio = await get(`
        SELECT COALESCE(SUM(cantidad_entregada), 0) AS total 
        FROM pedido_entrega 
        WHERE id_pedido = $1 AND id_producto = $2
      `, [id_pedido, producto_id]);

      const totalEntregado = Number(entregadoPrevio?.total || 0) + cantidad;
      const cantidadSolicitada = Number(detallePedido.cantidad_solicitada);

      if (totalEntregado > cantidadSolicitada) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `No se puede entregar más de lo solicitado para ${producto.nombre}. 
                  Solicitado: ${cantidadSolicitada}, Entregado previamente: ${entregadoPrevio?.total || 0}, 
                  Intenta entregar: ${cantidad}`
        });
      }

      // Crear movimiento de egreso
      const movResult = await client.query(`
        INSERT INTO movimiento_stock 
          (id_producto, tipo, cantidad, estado_producto, cargo_retira, id_institucion, id_usuario, motivo, fecha_movimiento)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING id_movimiento
      `, [
        producto_id,
        'egreso',
        cantidad,
        estado_producto,
        cargo_retira,
        pedido.id_institucion,
        req.user.sub,
        observaciones || `Retiro desde pedido anual #${id_pedido}`
      ]);

      const idMovimiento = movResult.rows[0].id_movimiento;
      movimientosIds.push(idMovimiento);

      // Actualizar stock
      await client.query(
        "UPDATE producto SET stock_actual = COALESCE(stock_actual, 0) - $1 WHERE id_producto = $2",
        [cantidad, producto_id]
      );

      // Registrar entrega
      const entregaResult = await client.query(`
        INSERT INTO pedido_entrega 
          (id_pedido, id_movimiento, id_producto, cantidad_entregada, id_usuario, observaciones)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [id_pedido, idMovimiento, producto_id, cantidad, req.user.sub, observaciones || null]);

      entregasData.push({
        id: entregaResult.rows[0].id,
        producto_id,
        cantidad
      });
    }

    // Verificar si el pedido quedó completamente entregado
    const itemsTotales = await all(`
      SELECT dp.id_producto, dp.cantidad_solicitada
      FROM detalle_pedido dp
      WHERE dp.id_pedido = $1
    `, [id_pedido]);

    let pedidoCompleto = true;
    for (const itemTotal of itemsTotales) {
      const entregado = await get(`
        SELECT COALESCE(SUM(cantidad_entregada), 0) AS total
        FROM pedido_entrega
        WHERE id_pedido = $1 AND id_producto = $2
      `, [id_pedido, itemTotal.id_producto]);

      if (Number(entregado?.total || 0) < Number(itemTotal.cantidad_solicitada)) {
        pedidoCompleto = false;
        break;
      }
    }

    // Si está completo, marcar pedido como finalizado
    if (pedidoCompleto) {
      await client.query(`
        UPDATE pedido 
        SET estado = 'finalizado' 
        WHERE id_pedido = $1
      `, [id_pedido]);
    }

    await client.query("COMMIT");

    res.status(201).json({
      ok: true,
      movimientos: movimientosIds,
      entregas: entregasData,
      pedido_completo: pedidoCompleto,
      mensaje: pedidoCompleto 
        ? `Pedido #${id_pedido} completado y marcado como finalizado` 
        : `Entrega registrada para pedido #${id_pedido}`
    });

  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) { /* ignore */ }
    console.error("Error al registrar entrega:", err);
    res.status(500).json({ error: "No se pudo registrar la entrega" });
  } finally {
    client.release();
  }
});

// GET /api/entregas/historial/:id_pedido - Historial de entregas de un pedido
router.get("/historial/:id_pedido", authorizePermissions(PERMISSIONS.MOVIMIENTOS_VIEW), async (req, res) => {
  try {
    await ensureEntregasSchema();

    const { id_pedido } = req.params;

    const entregas = await all(`
      SELECT 
        pe.id,
        pe.id_pedido,
        pe.id_producto,
        p.nombre AS producto_nombre,
        p.unidad_medida,
        pe.cantidad_entregada,
        pe.fecha_entrega,
        pe.observaciones,
        u.nombre AS usuario_nombre,
        pe.id_movimiento,
        ms.cargo_retira,
        i.nombre AS institucion_nombre
      FROM pedido_entrega pe
      JOIN producto p ON p.id_producto = pe.id_producto
      LEFT JOIN usuario u ON u.id_usuario = pe.id_usuario
      LEFT JOIN movimiento_stock ms ON ms.id_movimiento = pe.id_movimiento
      LEFT JOIN institucion i ON i.id_institucion = ms.id_institucion
      WHERE pe.id_pedido = $1
      ORDER BY pe.fecha_entrega DESC
    `, [id_pedido]);

    res.json({ entregas });
  } catch (err) {
    console.error("Error al obtener historial de entregas:", err);
    res.status(500).json({ error: "No se pudo obtener el historial de entregas" });
  }
});

module.exports = router;