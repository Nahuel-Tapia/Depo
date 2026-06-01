const { all, get, pool } = require("../db.pg");

class RequestValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "RequestValidationError";
    this.status = status;
  }
}

function badRequest(message) {
  return new RequestValidationError(message, 400);
}

async function getDirectivoContext(userId) {
  const usuario = await get("SELECT * FROM usuario WHERE id_usuario = $1", [userId]);
  if (!usuario || usuario.role !== "directivo") {
    throw new RequestValidationError("Acceso denegado", 403);
  }
  if (!usuario.id_institucion) {
    throw new RequestValidationError("El usuario no tiene institución asociada", 400);
  }

  const institucion = await get(
    "SELECT id_institucion, nombre, cue FROM institucion WHERE id_institucion = $1",
    [usuario.id_institucion]
  );

  return { usuario, institucion };
}

async function getAlertas(userId) {
  const context = await getDirectivoContext(userId);
  const { institucion, usuario } = context;

  // Obtener pedidos aprobados con pendiente de retiro
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
    WHERE p.id_institucion = $1 AND p.estado = 'aprobado'
    GROUP BY p.id_pedido, p.estado, p.fecha_creacion, pe.total_entregado
    HAVING (SUM(dp.cantidad_solicitada) - COALESCE(pe.total_entregado, 0)) > 0
    ORDER BY p.fecha_creacion DESC`,
    [usuario.id_institucion]
  );

  const movimientosPendientes = await all(
    `SELECT
      CONCAT(p.id_pedido, '-', dp.id_producto) AS id,
      p.id_pedido,
      COALESCE(p.tipo, 'anual') AS tipo_pedido,
      dp.id_producto,
      pr.nombre AS producto_nombre,
      pr.unidad_medida,
      p.fecha_creacion AS fecha,
      dp.cantidad_solicitada,
      COALESCE(pe.total_entregado, 0) AS cantidad_entregada,
      GREATEST(dp.cantidad_solicitada - COALESCE(pe.total_entregado, 0), 0) AS cantidad
    FROM pedido p
    JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
    JOIN producto pr ON pr.id_producto = dp.id_producto
    LEFT JOIN (
      SELECT id_pedido, id_producto, SUM(cantidad_entregada) AS total_entregado
      FROM pedido_entrega
      GROUP BY id_pedido, id_producto
    ) pe ON pe.id_pedido = p.id_pedido AND pe.id_producto = dp.id_producto
    WHERE p.id_institucion = $1
      AND p.estado = 'aprobado'
      AND (
        (COALESCE(p.tipo, 'anual') = 'anual' AND p.aprobado_director_area = TRUE)
        OR COALESCE(p.tipo, 'anual') = 'refuerzo'
      )
      AND GREATEST(dp.cantidad_solicitada - COALESCE(pe.total_entregado, 0), 0) > 0
    ORDER BY p.fecha_creacion DESC, pr.nombre ASC
    LIMIT 20`,
    [usuario.id_institucion]
  );

  const ultimasTransacciones = await all(
    `SELECT
      m.id_movimiento AS id,
      m.tipo,
      m.cantidad,
      p.nombre as producto_nombre,
      p.unidad_medida,
      m.fecha_movimiento AS fecha,
      u.nombre AS usuario_nombre
    FROM movimiento_stock m
    JOIN producto p ON m.id_producto = p.id_producto
    LEFT JOIN usuario u ON m.id_usuario = u.id_usuario
    WHERE m.id_institucion = $1
    ORDER BY m.fecha_movimiento DESC
    LIMIT 5`,
    [usuario.id_institucion]
  );

  return {
    institucion,
    alertas: {
      pedidosAprobados: {
        cantidad: pedidosAprobados.length,
        items: pedidosAprobados,
      },
      movimientosPendientes: {
        cantidad: new Set(movimientosPendientes.map((item) => Number(item.id_pedido))).size,
        items: movimientosPendientes,
      },
    },
    ultimasTransacciones,
  };
}

async function getMiStock(userId) {
  const usuario = await get("SELECT id_institucion FROM usuario WHERE id_usuario = $1", [userId]);
  if (!usuario?.id_institucion) {
    throw new RequestValidationError("Usuario sin institución asociada", 400);
  }

  const inst = await get("SELECT kit_id FROM institucion WHERE id_institucion = $1", [usuario.id_institucion]);
  const kitId = Number(inst?.kit_id || 0);
  if (!kitId) {
    return { kit: null, items: [] };
  }

  const rows = await all(
    `WITH movimientos_clasificados AS (
       SELECT
         m.id_producto,
         m.cantidad,
         COALESCE(pd.tipo, pd_motivo.tipo, 'anual') AS tipo_pedido
       FROM movimiento_stock m
       LEFT JOIN pedido_entrega pe ON pe.id_movimiento = m.id_movimiento
       LEFT JOIN pedido pd ON pd.id_pedido = pe.id_pedido
       LEFT JOIN pedido pd_motivo ON pd_motivo.id_pedido = NULLIF(SUBSTRING(m.motivo FROM 'pedido[^#]*#([0-9]+)'), '')::int
       WHERE m.id_institucion = $1
         AND m.tipo = 'egreso'
     )
     SELECT d.id_producto AS producto_id, p.nombre AS producto_nombre, p.unidad_medida, d.cantidad AS cantidad_por_kit,
            COALESCE(ms.retirado_anual, 0) AS retirado_anual,
            COALESCE(ms.retirado_refuerzo, 0) AS retirado_refuerzo,
            COALESCE(ref_solicitado.total_solicitado, 0) AS pedido_refuerzo,
            COALESCE(ms.total_egresos, 0) AS total_egresos
     FROM producto_kit_detalle d
     LEFT JOIN producto p ON p.id_producto = d.id_producto
     LEFT JOIN (
       SELECT
         id_producto,
         SUM(cantidad) AS total_egresos,
         SUM(cantidad) FILTER (WHERE COALESCE(tipo_pedido, 'anual') = 'anual') AS retirado_anual,
         SUM(cantidad) FILTER (WHERE COALESCE(tipo_pedido, 'anual') = 'refuerzo') AS retirado_refuerzo
       FROM movimientos_clasificados
       GROUP BY id_producto
     ) ms ON ms.id_producto = d.id_producto
     LEFT JOIN (
       SELECT dp.id_producto, SUM(dp.cantidad_solicitada) AS total_solicitado
       FROM detalle_pedido dp
       JOIN pedido pd ON pd.id_pedido = dp.id_pedido
       WHERE pd.id_institucion = $2
         AND pd.estado::text IN ('aprobado', 'entregado', 'finalizado')
         AND COALESCE(pd.tipo, 'anual') = 'refuerzo'
       GROUP BY dp.id_producto
     ) ref_solicitado ON ref_solicitado.id_producto = d.id_producto
     WHERE d.kit_id = $3
     ORDER BY p.nombre ASC`,
    [usuario.id_institucion, usuario.id_institucion, kitId]
  );

  const items = rows.map((r) => {
    const cantidad_por_kit = Number(r.cantidad_por_kit || 0);
    const retirado_anual = Number(r.retirado_anual || 0);
    const retirado_refuerzo = Number(r.retirado_refuerzo || 0);
    const pedido_refuerzo = Number(r.pedido_refuerzo || 0);

    const necesario_anual = Math.max(0, cantidad_por_kit - retirado_anual);
    const pendiente_refuerzo = Math.max(0, pedido_refuerzo - retirado_refuerzo);
    const restante_total = necesario_anual + pendiente_refuerzo;

    return {
      producto_id: Number(r.producto_id),
      producto_nombre: r.producto_nombre,
      unidad_medida: r.unidad_medida,
      cantidad_por_kit,
      retirado_anual,
      retirado_refuerzo,
      pedido_refuerzo,
      restante: restante_total,
      total_retirado: retirado_anual + retirado_refuerzo,
    };
  });

  const kit = await get("SELECT id, nombre, tipo_escuela, cantidad_alumnos FROM producto_kit WHERE id = $1", [kitId]);

  return { kit: kit || null, items };
}

async function getHistorialRetiros(userId) {
  const context = await getDirectivoContext(userId);
  const rows = await all(
    `WITH movimientos_clasificados AS (
       SELECT
         m.id_movimiento,
         m.id_producto,
         p.nombre AS producto_nombre,
         p.unidad_medida,
         m.cantidad,
         m.fecha_movimiento,
         m.cargo_retira,
         m.motivo,
         pe.id_solicitud_retiro,
         COALESCE(pe.id_pedido, pd_motivo.id_pedido) AS id_pedido,
         COALESCE(pd.tipo, pd_motivo.tipo, 'anual') AS tipo_pedido
       FROM movimiento_stock m
       JOIN producto p ON p.id_producto = m.id_producto
       LEFT JOIN pedido_entrega pe ON pe.id_movimiento = m.id_movimiento
       LEFT JOIN pedido pd ON pd.id_pedido = pe.id_pedido
       LEFT JOIN pedido pd_motivo ON pd_motivo.id_pedido = NULLIF(SUBSTRING(m.motivo FROM 'pedido[^#]*#([0-9]+)'), '')::int
       WHERE m.id_institucion = $1
         AND m.tipo = 'egreso'
     )
     SELECT
       COALESCE(id_solicitud_retiro::text, 'mov-' || COALESCE(id_pedido::text, TO_CHAR(fecha_movimiento, 'YYYYMMDDHH24MISS'))) AS id,
       id_solicitud_retiro,
       id_pedido,
       tipo_pedido,
       MIN(fecha_movimiento) AS fecha_retiro,
       MAX(fecha_movimiento) AS fecha_entrega,
       COALESCE(NULLIF(MAX(cargo_retira), ''), 'Directivo') AS retira,
       JSON_AGG(
         JSON_BUILD_OBJECT(
           'producto_id', id_producto,
           'producto_nombre', producto_nombre,
           'unidad_medida', unidad_medida,
           'cantidad_entregada', cantidad
         )
         ORDER BY producto_nombre
       ) AS items
     FROM movimientos_clasificados
     GROUP BY id_solicitud_retiro, id_pedido, tipo_pedido, COALESCE(id_solicitud_retiro::text, 'mov-' || COALESCE(id_pedido::text, TO_CHAR(fecha_movimiento, 'YYYYMMDDHH24MISS')))
     ORDER BY MAX(fecha_movimiento) DESC
     LIMIT 80`,
    [context.usuario.id_institucion]
  );

  return rows.map((row) => ({
    id: row.id,
    id_solicitud_retiro: row.id_solicitud_retiro ? Number(row.id_solicitud_retiro) : null,
    id_pedido: row.id_pedido ? Number(row.id_pedido) : null,
    tipo_pedido: row.tipo_pedido || "anual",
    fecha_retiro: row.fecha_retiro,
    fecha_entrega: row.fecha_entrega,
    retira: row.retira || "Directivo",
    items: Array.isArray(row.items) ? row.items : [],
  }));
}

async function getDistribucionesPendientes(userId) {
  const context = await getDirectivoContext(userId);
  const institucionId = context.usuario.id_institucion;

  const rows = await all(
    `SELECT
       li.id AS lote_item_id,
       li.lote_id,
       l.anio,
       l.estado AS lote_estado,
       l.created_at,
       COALESCE(z.nombre, 'Zona sin nombre') AS zona_nombre,
       COALESCE(d.nombre, 'Depósito') AS deposito_nombre,
       li.id_producto,
       p.nombre AS producto_nombre,
       p.unidad_medida,
       li.cantidad_planificada,
       COALESCE(li.cantidad_recibida, 0) AS cantidad_recibida,
       COALESCE(li.cantidad_danada, 0) AS cantidad_danada,
       li.estado_recepcion,
       li.observaciones_directivo,
       li.reclamo_directivo,
       li.detalle_danio,
       COALESCE(li.coincide_esperado, TRUE) AS coincide_esperado
     FROM distribucion_lote_item li
     JOIN distribucion_lote l ON l.id = li.lote_id
     LEFT JOIN zona z ON z.id = l.zona_id
     LEFT JOIN deposito d ON d.id_deposito = l.id_deposito
     JOIN producto p ON p.id_producto = li.id_producto
     WHERE li.id_institucion = $1
       AND li.recibido_at IS NULL
     ORDER BY l.created_at DESC, p.nombre ASC`,
    [institucionId]
  );

  const loteItemIds = rows.map((row) => Number(row.lote_item_id)).filter((id) => Number.isInteger(id) && id > 0);
  const imagenesRows = loteItemIds.length > 0
    ? await all(
      `SELECT id, lote_item_id, nombre, mime_type, datos, created_at
       FROM distribucion_lote_item_imagen
       WHERE lote_item_id = ANY($1::int[])
       ORDER BY created_at DESC, id DESC`,
      [loteItemIds]
    )
    : [];

  const imagenesByItem = new Map();
  for (const img of imagenesRows) {
    const key = Number(img.lote_item_id);
    if (!imagenesByItem.has(key)) imagenesByItem.set(key, []);
    imagenesByItem.get(key).push({
      id: Number(img.id),
      nombre: img.nombre || null,
      mime_type: img.mime_type || "image/jpeg",
      datos: img.datos,
      created_at: img.created_at,
    });
  }

  const lotesMap = new Map();
  for (const row of rows) {
    const loteId = Number(row.lote_id);
    if (!lotesMap.has(loteId)) {
      lotesMap.set(loteId, {
        lote_id: loteId,
        anio: Number(row.anio),
        lote_estado: row.lote_estado,
        created_at: row.created_at,
        zona_nombre: row.zona_nombre,
        deposito_nombre: row.deposito_nombre,
        items: [],
      });
    }
    lotesMap.get(loteId).items.push({
      lote_item_id: Number(row.lote_item_id),
      id_producto: Number(row.id_producto),
      producto_nombre: row.producto_nombre,
      unidad_medida: row.unidad_medida,
      cantidad_planificada: Number(row.cantidad_planificada || 0),
      cantidad_recibida: Number(row.cantidad_recibida || 0),
      cantidad_danada: Number(row.cantidad_danada || 0),
      estado_recepcion: row.estado_recepcion,
      observaciones_directivo: row.observaciones_directivo || null,
      reclamo_directivo: row.reclamo_directivo || null,
      detalle_danio: row.detalle_danio || null,
      coincide_esperado: Boolean(row.coincide_esperado),
      imagenes: imagenesByItem.get(Number(row.lote_item_id)) || [],
    });
  }

  return Array.from(lotesMap.values());
}

async function getDistribucionesHistorial(userId, filters = {}) {
  const context = await getDirectivoContext(userId);
  const institucionId = context.usuario.id_institucion;

  let query = `
    SELECT
       li.id AS lote_item_id,
       li.lote_id,
       l.anio,
       l.estado AS lote_estado,
       l.created_at,
       COALESCE(z.nombre, 'Zona sin nombre') AS zona_nombre,
       COALESCE(d.nombre, 'Depósito') AS deposito_nombre,
       li.id_producto,
       p.nombre AS producto_nombre,
       p.unidad_medida,
       li.cantidad_planificada,
       COALESCE(li.cantidad_recibida, 0) AS cantidad_recibida,
       COALESCE(li.cantidad_danada, 0) AS cantidad_danada,
       li.estado_recepcion,
       li.observaciones_directivo,
       li.reclamo_directivo,
       li.detalle_danio,
       COALESCE(li.coincide_esperado, TRUE) AS coincide_esperado,
       li.recibido_at
     FROM distribucion_lote_item li
     JOIN distribucion_lote l ON l.id = li.lote_id
     LEFT JOIN zona z ON z.id = l.zona_id
     LEFT JOIN deposito d ON d.id_deposito = l.id_deposito
     JOIN producto p ON p.id_producto = li.id_producto
     WHERE li.id_institucion = $1
       AND li.recibido_at IS NOT NULL
  `;

  const params = [institucionId];

  if (filters.desde) {
    params.push(filters.desde);
    query += ` AND li.recibido_at >= $${params.length}`;
  }
  if (filters.hasta) {
    params.push(`${filters.hasta} 23:59:59`);
    query += ` AND li.recibido_at <= $${params.length}`;
  }

  query += ` ORDER BY li.recibido_at DESC, p.nombre ASC`;

  const rows = await all(query, params);

  const loteItemIds = rows.map((row) => Number(row.lote_item_id)).filter((id) => Number.isInteger(id) && id > 0);
  const imagenesRows = loteItemIds.length > 0
    ? await all(
      `SELECT id, lote_item_id, nombre, mime_type, datos, created_at
       FROM distribucion_lote_item_imagen
       WHERE lote_item_id = ANY($1::int[])
       ORDER BY created_at DESC, id DESC`,
      [loteItemIds]
    )
    : [];

  const imagenesByItem = new Map();
  for (const img of imagenesRows) {
    const key = Number(img.lote_item_id);
    if (!imagenesByItem.has(key)) imagenesByItem.set(key, []);
    imagenesByItem.get(key).push({
      id: Number(img.id),
      nombre: img.nombre || null,
      mime_type: img.mime_type || "image/jpeg",
      datos: img.datos,
      created_at: img.created_at,
    });
  }

  const lotesMap = new Map();
  for (const row of rows) {
    const loteId = Number(row.lote_id);
    if (!lotesMap.has(loteId)) {
      lotesMap.set(loteId, {
        lote_id: loteId,
        anio: Number(row.anio),
        lote_estado: row.lote_estado,
        created_at: row.created_at,
        zona_nombre: row.zona_nombre,
        deposito_nombre: row.deposito_nombre,
        recibido_at: row.recibido_at,
        items: [],
      });
    }
    lotesMap.get(loteId).items.push({
      lote_item_id: Number(row.lote_item_id),
      id_producto: Number(row.id_producto),
      producto_nombre: row.producto_nombre,
      unidad_medida: row.unidad_medida,
      cantidad_planificada: Number(row.cantidad_planificada || 0),
      cantidad_recibida: Number(row.cantidad_recibida || 0),
      cantidad_danada: Number(row.cantidad_danada || 0),
      estado_recepcion: row.estado_recepcion,
      observaciones_directivo: row.observaciones_directivo || null,
      reclamo_directivo: row.reclamo_directivo || null,
      detalle_danio: row.detalle_danio || null,
      coincide_esperado: Boolean(row.coincide_esperado),
      imagenes: imagenesByItem.get(Number(row.lote_item_id)) || [],
    });
  }

  return Array.from(lotesMap.values());
}

async function confirmarRecepcion(userId, loteId, items) {
  const context = await getDirectivoContext(userId);
  const institucionId = Number(context.usuario.id_institucion);

  if (!loteId || items.length === 0) {
    throw badRequest("Debe informar el lote y al menos un ítem");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const loteRows = await client.query(
      `SELECT li.id, li.id_producto, li.cantidad_planificada, p.nombre AS producto_nombre
       FROM distribucion_lote_item li
       JOIN producto p ON p.id_producto = li.id_producto
       WHERE li.lote_id = $1 AND li.id_institucion = $2
       FOR UPDATE`,
      [loteId, institucionId]
    );

    if (!loteRows.rowCount) {
      throw new RequestValidationError("No hay ítems pendientes para este lote/institución", 404);
    }

    const planificado = new Map(
      loteRows.rows.map((r) => [
        Number(r.id_producto),
        {
          lote_item_id: Number(r.id),
          cantidad_planificada: Number(r.cantidad_planificada || 0),
          producto_nombre: r.producto_nombre,
        },
      ])
    );

    for (const item of items) {
      const productoId = Number(item.id_producto);
      if (!planificado.has(productoId)) continue;

      const loteItemData = planificado.get(productoId);
      const cantidadPlanificada = Number(loteItemData.cantidad_planificada || 0);
      const cantidadRecibida = Math.max(0, Number(item.cantidad_recibida || 0));
      const cantidadDanada = Math.max(0, Number(item.cantidad_danada || 0));
      const observaciones = String(item.observaciones_directivo || "").trim();
      const reclamo = String(item.reclamo_directivo || "").trim();
      const detalleDanio = String(item.detalle_danio || "").trim();
      const coincideEsperado = item.coincide_esperado === false ? false : true;
      const imagenes = Array.isArray(item.imagenes) ? item.imagenes : [];

      const totalConfirmado = cantidadRecibida + cantidadDanada;

      if (totalConfirmado > cantidadPlanificada) {
        throw badRequest(`Cantidad inválida para producto ${productoId}: recibido + dañado supera lo planificado`);
      }

      // Validar obligatoriedad de observaciones y fotos al recibir mercadería
      if (cantidadRecibida > 0 || cantidadDanada > 0) {
        const prodName = loteItemData.producto_nombre || `Producto #${productoId}`;
        if (!observaciones) {
          throw badRequest(`Las observaciones son obligatorias para el producto "${prodName}".`);
        }
        if (imagenes.length === 0) {
          throw badRequest(`Debe adjuntar al menos una foto de evidencia para el producto "${prodName}".`);
        }
      }

      let estadoRecepcion = "pendiente";
      if (reclamo || cantidadDanada > 0 || !coincideEsperado) {
        estadoRecepcion = "reclamo";
      } else if (totalConfirmado >= cantidadPlanificada) {
        estadoRecepcion = "recibido";
      } else if (totalConfirmado > 0) {
        estadoRecepcion = "parcial";
      }

      await client.query(
        `UPDATE distribucion_lote_item
         SET cantidad_recibida = $1,
             cantidad_danada = $2,
             estado_recepcion = $3,
             observaciones_directivo = $4,
             reclamo_directivo = $5,
             detalle_danio = $6,
             coincide_esperado = $7,
             directivo_usuario_id = $8,
             recibido_at = NOW(),
             updated_at = NOW()
         WHERE lote_id = $9
           AND id_institucion = $10
           AND id_producto = $11`,
         [
           cantidadRecibida,
           cantidadDanada,
           estadoRecepcion,
           observaciones || null,
           reclamo || null,
           detalleDanio || null,
           coincideEsperado,
           userId,
           loteId,
           institucionId,
           productoId,
         ]
      );

      if (imagenes.length > 0) {
        await client.query(
          `DELETE FROM distribucion_lote_item_imagen
           WHERE lote_item_id = $1`,
          [loteItemData.lote_item_id]
        );

        for (const imagen of imagenes) {
          const mimeType = String(imagen?.mime_type || imagen?.mimeType || "").trim().toLowerCase();
          const datos = String(imagen?.datos || imagen?.data || "").trim();
          const nombre = String(imagen?.nombre || imagen?.name || "evidencia.jpg").trim().slice(0, 255);

          if (!datos) continue;
          if (!mimeType.startsWith("image/")) {
            throw badRequest(`Formato de imagen inválido para producto ${productoId}`);
          }

          await client.query(
            `INSERT INTO distribucion_lote_item_imagen
              (lote_item_id, id_institucion, id_producto, nombre, mime_type, datos, directivo_usuario_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              loteItemData.lote_item_id,
              institucionId,
              productoId,
              nombre || null,
              mimeType,
              datos,
              userId,
            ]
          );
        }
      }
    }

    const resumen = await client.query(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE estado_recepcion = 'recibido') AS recibidos,
         COUNT(*) FILTER (WHERE estado_recepcion = 'reclamo') AS reclamos,
         COUNT(*) FILTER (WHERE estado_recepcion = 'parcial') AS parciales,
         COUNT(*) FILTER (WHERE estado_recepcion = 'pendiente') AS pendientes
       FROM distribucion_lote_item
       WHERE lote_id = $1`,
      [loteId]
    );

    const s = resumen.rows[0] || {};
    const total = Number(s.total || 0);
    const recibidos = Number(s.recibidos || 0);
    const reclamos = Number(s.reclamos || 0);
    const parciales = Number(s.parciales || 0);

    let estadoLote = "en_transito";
    if (total > 0 && recibidos === total) {
      estadoLote = "recibido_total";
    } else if (reclamos > 0) {
      estadoLote = "con_reclamos";
    } else if (parciales > 0 || recibidos > 0) {
      estadoLote = "parcialmente_recibido";
    }

    await client.query(`UPDATE distribucion_lote SET estado = $1 WHERE id = $2`, [estadoLote, loteId]);

    await client.query("COMMIT");
    return { lote_id: loteId, estado: estadoLote };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function getDepositoInstitucion(userId) {
  const context = await getDirectivoContext(userId);
  const instId = Number(context.usuario.id_institucion);

  // Mercadería recibida por lotes de distribución (confirmada por el directivo)
  const recibidoLotes = await all(
    `SELECT
       li.id_producto AS producto_id,
       p.nombre AS producto_nombre,
       p.unidad_medida,
       SUM(COALESCE(li.cantidad_recibida, 0)) AS total_recibido_lote
     FROM distribucion_lote_item li
     JOIN producto p ON p.id_producto = li.id_producto
     WHERE li.id_institucion = $1
       AND li.recibido_at IS NOT NULL
       AND COALESCE(li.cantidad_recibida, 0) > 0
     GROUP BY li.id_producto, p.nombre, p.unidad_medida`,
    [instId]
  );

  // Mercadería recibida por retiros del depósito central (pedido_entrega)
  const recibidoRetiros = await all(
    `SELECT
       pe.id_producto AS producto_id,
       p.nombre AS producto_nombre,
       p.unidad_medida,
       SUM(COALESCE(pe.cantidad_entregada, 0)) AS total_recibido_retiro
     FROM pedido_entrega pe
     JOIN pedido pd ON pd.id_pedido = pe.id_pedido
     JOIN producto p ON p.id_producto = pe.id_producto
     WHERE pd.id_institucion = $1
     GROUP BY pe.id_producto, p.nombre, p.unidad_medida`,
    [instId]
  );

  // Consumos registrados por el directivo
  const consumos = await all(
    `SELECT
       id_producto AS producto_id,
       SUM(cantidad) AS total_consumido
     FROM consumo_institucion
     WHERE id_institucion = $1
     GROUP BY id_producto`,
    [instId]
  );

  // Merge todos los productos
  const productoMap = new Map();

  const ensureProducto = (pid, nombre, unidad) => {
    if (!productoMap.has(pid)) {
      productoMap.set(pid, {
        producto_id: pid,
        producto_nombre: nombre,
        unidad_medida: unidad,
        total_recibido: 0,
        total_consumido: 0,
      });
    }
  };

  for (const r of recibidoLotes) {
    const pid = Number(r.producto_id);
    ensureProducto(pid, r.producto_nombre, r.unidad_medida);
    productoMap.get(pid).total_recibido += Number(r.total_recibido_lote || 0);
  }

  for (const r of recibidoRetiros) {
    const pid = Number(r.producto_id);
    ensureProducto(pid, r.producto_nombre, r.unidad_medida);
    productoMap.get(pid).total_recibido += Number(r.total_recibido_retiro || 0);
  }

  for (const c of consumos) {
    const pid = Number(c.producto_id);
    if (productoMap.has(pid)) {
      productoMap.get(pid).total_consumido += Number(c.total_consumido || 0);
    }
  }

  const items = Array.from(productoMap.values())
    .map(item => ({
      ...item,
      stock_actual: Math.max(0, item.total_recibido - item.total_consumido),
    }))
    .filter(item => item.total_recibido > 0)
    .sort((a, b) => a.producto_nombre.localeCompare(b.producto_nombre));

  return { institucion: context.institucion, items };
}

async function getHistorialConsumos(userId, { limit = 50 } = {}) {
  const context = await getDirectivoContext(userId);
  const instId = Number(context.usuario.id_institucion);

  const rows = await all(
    `SELECT
       c.id_consumo AS id,
       c.id_producto AS producto_id,
       p.nombre AS producto_nombre,
       p.unidad_medida,
       c.cantidad,
       c.categoria,
       c.motivo,
       c.fecha,
       u.nombre AS usuario_nombre,
       u.apellido AS usuario_apellido
     FROM consumo_institucion c
     JOIN producto p ON p.id_producto = c.id_producto
     LEFT JOIN usuario u ON u.id_usuario = c.id_usuario
     WHERE c.id_institucion = $1
     ORDER BY c.fecha DESC
     LIMIT $2`,
    [instId, limit]
  );

  return rows.map(r => ({
    id: Number(r.id),
    producto_id: Number(r.producto_id),
    producto_nombre: r.producto_nombre,
    unidad_medida: r.unidad_medida,
    cantidad: Number(r.cantidad),
    categoria: r.categoria || null,
    motivo: r.motivo || null,
    fecha: r.fecha,
    usuario: r.usuario_nombre ? `${r.usuario_nombre} ${r.usuario_apellido || ''}`.trim() : 'Directivo',
  }));
}

async function registrarConsumo(userId, items) {
  const context = await getDirectivoContext(userId);
  const instId = Number(context.usuario.id_institucion);

  if (!Array.isArray(items) || items.length === 0) {
    throw badRequest('Debe informar al menos un ítem de consumo');
  }

  // Calcular stock actual por producto para validar
  const productoIds = items.map(i => Number(i.id_producto)).filter(Boolean);
  if (productoIds.length === 0) throw badRequest('IDs de producto inválidos');

  const recibidoLotes = await all(
    `SELECT id_producto, SUM(COALESCE(cantidad_recibida, 0)) AS total
     FROM distribucion_lote_item
     WHERE id_institucion = $1 AND recibido_at IS NOT NULL AND id_producto = ANY($2::int[])
     GROUP BY id_producto`,
    [instId, productoIds]
  );

  const recibidoRetiros = await all(
    `SELECT pe.id_producto, SUM(COALESCE(pe.cantidad_entregada, 0)) AS total
     FROM pedido_entrega pe
     JOIN pedido pd ON pd.id_pedido = pe.id_pedido
     WHERE pd.id_institucion = $1 AND pe.id_producto = ANY($2::int[])
     GROUP BY pe.id_producto`,
    [instId, productoIds]
  );

  const consumosActuales = await all(
    `SELECT id_producto, SUM(cantidad) AS total
     FROM consumo_institucion
     WHERE id_institucion = $1 AND id_producto = ANY($2::int[])
     GROUP BY id_producto`,
    [instId, productoIds]
  );

  const stockMap = new Map();
  for (const pid of productoIds) stockMap.set(pid, 0);
  for (const r of recibidoLotes) stockMap.set(Number(r.id_producto), (stockMap.get(Number(r.id_producto)) || 0) + Number(r.total));
  for (const r of recibidoRetiros) stockMap.set(Number(r.id_producto), (stockMap.get(Number(r.id_producto)) || 0) + Number(r.total));
  for (const r of consumosActuales) stockMap.set(Number(r.id_producto), (stockMap.get(Number(r.id_producto)) || 0) - Number(r.total));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of items) {
      const pid = Number(item.id_producto);
      const cantidad = Number(item.cantidad);
      if (!pid || cantidad <= 0) continue;

      const stockDisponible = stockMap.get(pid) || 0;
      if (cantidad > stockDisponible) {
        const prodRow = await get('SELECT nombre FROM producto WHERE id_producto = $1', [pid]);
        throw badRequest(`Stock insuficiente para "${prodRow?.nombre || `Producto #${pid}`}": disponible ${stockDisponible}, intentó consumir ${cantidad}`);
      }

      const categoria = String(item.categoria || '').trim().slice(0, 60) || null;
      const motivo = String(item.motivo || '').trim() || null;

      await client.query(
        `INSERT INTO consumo_institucion (id_institucion, id_producto, id_usuario, cantidad, categoria, motivo, fecha)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [instId, pid, userId, cantidad, categoria, motivo]
      );
    }
    await client.query('COMMIT');
    return { ok: true, registrados: items.length };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  RequestValidationError,
  getDirectivoContext,
  getAlertas,
  getMiStock,
  getHistorialRetiros,
  getDistribucionesPendientes,
  getDistribucionesHistorial,
  confirmarRecepcion,
  getDepositoInstitucion,
  getHistorialConsumos,
  registrarConsumo,
};
