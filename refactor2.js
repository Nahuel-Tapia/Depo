const fs = require('fs');

const original = fs.readFileSync('backend/src/routes/pedidos.js', 'utf8');

const helpersEndIdx = original.indexOf('function canManageKits(req) {');
let helpersCode = original.substring(0, helpersEndIdx);

const startIdx = helpersCode.indexOf('const ESCUELA_TIPOS');
helpersCode = helpersCode.substring(startIdx);

const serviceLogic = `
// Business logic
async function listarKits(user, includeInactive) {
  await ensurePedidosSchema();

  let whereSql = "WHERE 1 = 1";
  const params = [];
  if (!includeInactive) {
    whereSql += " AND k.activo = TRUE";
  }

  if (user?.role === "directivo") {
    const usuario = await get(
      \`SELECT u.id_institucion, i.kit_id
       FROM usuario u
       JOIN institucion i ON i.id_institucion = u.id_institucion
       WHERE u.id_usuario = ?\`,
      [user.sub]
    );

    const kitAsignadoId = Number(usuario?.kit_id || 0);
    if (!kitAsignadoId) {
      return [];
    }

    whereSql += " AND k.id = ?";
    params.push(kitAsignadoId);
  }

  const rows = await all(
    \`SELECT k.id,
            k.nombre,
            k.tipo_escuela,
            k.descripcion,
            k.activo,
            k.created_at,
            k.updated_at,
            k.cantidad_alumnos,
            d.id_producto AS producto_id,
            p.nombre as producto_nombre,
            p.unidad_medida,
            d.cantidad
     FROM producto_kit k
     LEFT JOIN producto_kit_detalle d ON d.kit_id = k.id
     LEFT JOIN producto p ON p.id_producto = d.id_producto
     \${whereSql}
     ORDER BY k.nombre ASC, p.nombre ASC\`,
    params
  );

  return normalizeKitRows(rows);
}

async function createKit(data, userId) {
  const { nombre, descripcion, items } = data;
  const parsedItems = sanitizeKitItems(items);

  if (!nombre) throw { status: 400, message: "El nombre del kit es obligatorio." };
  if (parsedItems.error) throw { status: 400, message: parsedItems.error };

  const productoIds = parsedItems.items.map((item) => item.producto_id);
  const productos = await all(
    \`SELECT id_producto FROM producto WHERE id_producto = ANY($1::int[])\`,
    [productoIds]
  );
  if (productos.length !== productoIds.length) {
    throw { status: 400, message: "Uno o más productos seleccionados no existen." };
  }

  const client = await pool.connect();
  try {
    await ensurePedidosSchema();
    await client.query("BEGIN");
    const insertKit = await client.query(
      \`INSERT INTO producto_kit (nombre, tipo_escuela, descripcion, activo, created_by)
       VALUES ($1, $2, $3, TRUE, $4)
       RETURNING id\`,
      [nombre, "normal", descripcion, userId]
    );
    const kitId = Number(insertKit.rows[0].id);

    for (const item of parsedItems.items) {
      await client.query(
        \`INSERT INTO producto_kit_detalle (kit_id, id_producto, cantidad)
         VALUES ($1, $2, $3)\`,
        [kitId, item.producto_id, item.cantidad]
      );
    }

    await client.query("COMMIT");
    return await getKitById(kitId, { includeInactive: true });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function updateKit(id, data) {
  const { nombre, descripcion, activo, items } = data;
  const parsedItems = sanitizeKitItems(items);

  if (!nombre) throw { status: 400, message: "El nombre del kit es obligatorio." };
  if (parsedItems.error) throw { status: 400, message: parsedItems.error };

  const existing = await get(\`SELECT id FROM producto_kit WHERE id = ?\`, [id]);
  if (!existing) throw { status: 404, message: "Kit no encontrado." };

  const productoIds = parsedItems.items.map((item) => item.producto_id);
  const productos = await all(
    \`SELECT id_producto FROM producto WHERE id_producto = ANY($1::int[])\`,
    [productoIds]
  );
  if (productos.length !== productoIds.length) {
    throw { status: 400, message: "Uno o más productos seleccionados no existen." };
  }

  const client = await pool.connect();
  try {
    await ensurePedidosSchema();
    await client.query("BEGIN");
    const existingKit = await client.query(
      \`SELECT tipo_escuela FROM producto_kit WHERE id = $1\`,
      [id]
    );
    const tipoEscuela = existingKit.rows[0]?.tipo_escuela || "normal";
    await client.query(
      \`UPDATE producto_kit
       SET nombre = $1,
           tipo_escuela = $2,
           descripcion = $3,
           activo = $4,
           updated_at = NOW()
       WHERE id = $5\`,
      [nombre, tipoEscuela, descripcion, activo !== false, id]
    );
    await client.query(\`DELETE FROM producto_kit_detalle WHERE kit_id = $1\`, [id]);

    for (const item of parsedItems.items) {
      await client.query(
        \`INSERT INTO producto_kit_detalle (kit_id, id_producto, cantidad)
         VALUES ($1, $2, $3)\`,
        [id, item.producto_id, item.cantidad]
      );
    }

    await client.query("COMMIT");
    return await getKitById(id, { includeInactive: true });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function deleteKit(id) {
  await ensurePedidosSchema();
  const existing = await get(\`SELECT id FROM producto_kit WHERE id = ?\`, [id]);
  if (!existing) throw { status: 404, message: "Kit no encontrado." };

  await run(
    \`UPDATE producto_kit
     SET activo = FALSE,
         updated_at = NOW()
     WHERE id = ?\`,
    [id]
  );
}

async function listarPedidos(user) {
  await ensurePedidosSchema();

  let query = \`
    SELECT
      p.id_pedido as id,
      CASE WHEN p.estado::text = 'finalizado' THEN 'entregado' ELSE p.estado::text END as estado,
      p.observaciones_generales as notas,
      p.motivo_supervisor,
      p.respuesta_supervisor_tipo,
      COALESCE(p.tipo, 'anual') as tipo,
      p.fecha_creacion as created_at,
      p.id_institucion,
      COALESCE(p.requiere_licitacion, FALSE) as requiere_licitacion,
      COALESCE(p.estado_abastecimiento, 'stock_disponible') as estado_abastecimiento,
      p.aprobado_por_supervisor_id,
      p.fecha_aprobacion_supervisor,
      p.kit_id,
      p.kit_nombre,
      p.kit_cantidad,
      dp.id_producto as detalle_producto_id,
      pr.nombre as detalle_producto_nombre,
      pr.unidad_medida as detalle_unidad_medida,
      pr.stock_actual as detalle_stock_actual,
      COALESCE(dp.requiere_licitacion, FALSE) as detalle_requiere_licitacion,
      dp.stock_disponible_relevado as detalle_stock_disponible_relevado,
      dp.cantidad_solicitada as detalle_cantidad,
      p.aprobado_por_director_id,
      p.fecha_aprobacion_director,
      p.aprobado_director_area,
      u.nombre as usuario_nombre,
      i.nombre as institucion
    FROM pedido p
    LEFT JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
    JOIN producto pr ON dp.id_producto = pr.id_producto
    JOIN usuario u ON p.id_usuario_solicitante = u.id_usuario
    LEFT JOIN institucion i ON p.id_institucion = i.id_institucion
    WHERE 1 = 1
  \`;
  const params = [];

  if (user.role === "directivo") {
    query += " AND p.id_institucion = (SELECT id_institucion FROM usuario WHERE id_usuario = ?)";
    params.push(user.sub);
  }

  if (user.role === "director_area") {
    query += " AND LOWER(TRIM(i.nivel_educativo)) = LOWER(TRIM(?))";
    params.push(user.nivel_educativo || '');
  }

  query += " ORDER BY p.fecha_creacion DESC, pr.nombre ASC";
  const pedidoRows = await all(query, params);
  const grouped = groupPedidos(pedidoRows);

  for (const p of grouped) {
    if (p.tipo === 'anual' && p.estado === 'aprobado') {
      const anio = new Date(p.created_at).getFullYear();
      const lic = await get(\`SELECT estado FROM licitacion_publicada WHERE anio = ?\`, [anio]);
      const progreso = await get(\`
        SELECT 
          SUM(pad.cantidad) as total_pedida,
          COALESCE(SUM(ea.entregada), 0) as total_entregada
        FROM planilla_pedido_anual_detalle pad
        LEFT JOIN (
          SELECT id_institucion, id_producto, SUM(cantidad_entregada) as entregada
          FROM entrega_anual
          WHERE anio = $1
          GROUP BY id_institucion, id_producto
        ) ea ON ea.id_institucion = pad.id_institucion AND ea.id_producto = pad.id_producto
        WHERE pad.id_institucion = $2 
          AND pad.planilla_id IN (SELECT id FROM planilla_pedido_anual WHERE anio = $1)
      \`, [anio, p.id_institucion]);

      p.logistica = {
        estado_licitacion: lic?.estado || 'pendiente',
        total_pedida: progreso?.total_pedida || 0,
        total_entregada: progreso?.total_entregada || 0,
        porcentaje_entrega: progreso?.total_pedida > 0 
          ? Math.round((progreso.total_entregada / progreso.total_pedida) * 100) 
          : 0
      };
    }
  }

  return grouped;
}

async function getCuposAnuales(user, queryInstitucionId, queryAnio) {
  await ensurePedidosSchema();

  let institucionId = Number(queryInstitucionId || 0);

  if (user.role === "directivo") {
    const usuario = await get(
      "SELECT id_institucion FROM usuario WHERE id_usuario = ?",
      [user.sub]
    );
    institucionId = Number(usuario?.id_institucion || 0);
  }

  if (!Number.isInteger(institucionId) || institucionId <= 0) {
    throw { status: 400, message: "Institución inválida" };
  }

  const perfil = await getInstitucionPerfil(institucionId);
  if (!perfil) throw { status: 404, message: "Institución no encontrada" };

  const anio = Number(queryAnio || new Date().getFullYear());

  const productos = await all(
    \`SELECT p.id_producto AS id, p.nombre, p.unidad_medida,
            k.cantidad_base, k.alumnos_por_unidad, k.cantidad_por_unidad
     FROM kit_producto_anual k
     JOIN producto p ON p.id_producto = k.id_producto
     WHERE k.tipo_escuela = ?
       AND k.activo = TRUE
     ORDER BY p.nombre ASC\`,
    [perfil.tipo_escuela]
  );

  const consumoRows = await all(
    \`SELECT dp.id_producto, COALESCE(SUM(dp.cantidad_solicitada), 0) AS total
     FROM pedido p
     JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
     WHERE p.id_institucion = ?
       AND COALESCE(p.tipo, 'anual') = 'anual'
       AND EXTRACT(YEAR FROM p.fecha_creacion) = ?
       AND p.estado::text NOT IN ('rechazado', 'cancelado')
     GROUP BY dp.id_producto\`,
    [institucionId, anio]
  );

  const consumoByProducto = new Map(
    consumoRows.map((row) => [Number(row.id_producto), Number(row.total || 0)])
  );

  const cupos = productos.map((p) => {
    const regla = p.cantidad_base === null
      ? null
      : {
          cantidad_base: p.cantidad_base,
          alumnos_por_unidad: p.alumnos_por_unidad,
          cantidad_por_unidad: p.cantidad_por_unidad
        };

    const cuota = calcularCupoAnual(perfil.matriculados, regla);
    const solicitado = consumoByProducto.get(Number(p.id)) || 0;

    return {
      producto_id: p.id,
      producto_nombre: p.nombre,
      unidad_medida: p.unidad_medida,
      tipo_escuela: perfil.tipo_escuela,
      matriculados: perfil.matriculados,
      cuota_anual: cuota,
      solicitado_anual: solicitado,
      disponible_anual: cuota === null ? null : Math.max(0, cuota - solicitado),
      regla: regla ? {
        cantidad_base: Number(regla.cantidad_base || 0),
        alumnos_por_unidad: Number(regla.alumnos_por_unidad || 0),
        cantidad_por_unidad: Number(regla.cantidad_por_unidad || 0)
      } : null
    };
  });

  return {
    institucion_id: institucionId,
    tipo_escuela: perfil.tipo_escuela,
    matriculados: perfil.matriculados,
    anio,
    cupos
  };
}

async function getHistorialInstitucion(institucion, user) {
  return await all(
    \`
    SELECT
      ms.id_movimiento as id,
      ms.tipo,
      ms.cantidad,
      ms.fecha_movimiento as created_at,
      ms.id_institucion,
      ms.id_producto as producto_id,
      pr.nombre AS producto_nombre,
      pr.unidad_medida,
      ms.estado_producto,
      ms.cargo_retira,
      ms.motivo,
      u.nombre as usuario_nombre
    FROM movimiento_stock ms
    LEFT JOIN producto pr ON ms.id_producto = pr.id_producto
    LEFT JOIN usuario u ON ms.id_usuario = u.id_usuario
    JOIN institucion i ON ms.id_institucion = i.id_institucion
    WHERE ms.id_institucion = ?
      AND ms.tipo = 'egreso'
      AND (? != 'director_area' OR LOWER(TRIM(i.nivel_educativo)) = LOWER(TRIM(?)))
    ORDER BY ms.fecha_movimiento DESC, ms.id_movimiento DESC
    LIMIT 5
    \`,
    [institucion, user.role, user.nivel_educativo || '']
  );
}

async function getPedidoById(id, user) {
  const pedidoRows = await all(
    \`
    SELECT
      p.id_pedido as id,
      CASE WHEN p.estado::text = 'finalizado' THEN 'entregado' ELSE p.estado::text END as estado,
      p.observaciones_generales as notas,
      p.fecha_creacion as created_at,
      p.id_institucion,
      COALESCE(p.tipo, 'anual') as tipo,
      p.motivo_supervisor,
      p.respuesta_supervisor_tipo,
      p.aprobado_por_supervisor_id,
      p.fecha_aprobacion_supervisor,
      p.kit_id,
      p.kit_nombre,
      p.kit_cantidad,
      dp.id_producto as detalle_producto_id,
      pr.nombre as detalle_producto_nombre,
      pr.unidad_medida as detalle_unidad_medida,
      pr.stock_actual as detalle_stock_actual,
      dp.cantidad_solicitada as detalle_cantidad,
      u.nombre as usuario_nombre,
      i.nombre as institucion
    FROM pedido p
    JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
    JOIN producto pr ON dp.id_producto = pr.id_producto
    JOIN usuario u ON p.id_usuario_solicitante = u.id_usuario
    LEFT JOIN institucion i ON i.id_institucion = p.id_institucion
    WHERE p.id_pedido = ?
    ORDER BY pr.nombre ASC
    \`,
    [id]
  );

  const pedido = groupPedidos(pedidoRows)[0];
  if (!pedido) throw { status: 404, message: "Pedido no encontrado" };

  if (user.role === "directivo") {
    const userInstitution = await get(
      "SELECT id_institucion FROM usuario WHERE id_usuario = ?",
      [user.sub]
    );
    if (!userInstitution || pedido.id_institucion !== userInstitution.id_institucion) {
      throw { status: 403, message: "No tenés acceso a este pedido" };
    }
  }

  return pedido;
}

async function createPedido(data, user) {
  await ensurePedidosSchema();
  const { producto_id, kit_id, cantidad, notas, tipo, items } = data;
  const tipoValido = ['anual', 'refuerzo'].includes(tipo) ? tipo : 'anual';
  const cantidadSolicitada = Number(cantidad);

  const hasItemsArray = Array.isArray(items) && items.length > 0;

  if (!hasItemsArray) {
    if ((!producto_id && !kit_id) || !cantidadSolicitada || cantidadSolicitada <= 0) {
      throw { status: 400, message: "Debés seleccionar un kit o producto y una cantidad válida" };
    }
  } else if (tipoValido !== 'refuerzo') {
    throw { status: 400, message: "Los items múltiples solo están disponibles para solicitudes de refuerzo" };
  }

  const usuario = await get(
    "SELECT id_institucion FROM usuario WHERE id_usuario = ?",
    [user.sub]
  );

  if (!usuario || !usuario.id_institucion) {
    throw { status: 400, message: "Tu usuario no tiene institución asignada" };
  }

  const perfilInstitucion = await getInstitucionPerfil(usuario.id_institucion);
  if (!perfilInstitucion) {
    throw { status: 404, message: "Institución no encontrada" };
  }

  if (user.role === "directivo") {
    const pedidoBloqueante = await getPedidoActivoBloqueante(usuario.id_institucion);

    if (pedidoBloqueante) {
      throw {
        status: 409,
        message: "Tu institucion ya tiene una solicitud en revision. Vas a poder cargar otra cuando la anterior sea aprobada o rechazada.",
        detalle: {
          pedido_id: Number(pedidoBloqueante.id),
          estado: pedidoBloqueante.estado,
          tipo: pedidoBloqueante.tipo,
          respuesta_supervisor_tipo: pedidoBloqueante.respuesta_supervisor_tipo || null,
          motivo_supervisor: pedidoBloqueante.motivo_supervisor || null,
          created_at: pedidoBloqueante.created_at
        }
      };
    }
  }

  let kit = null;
  let detalleItems = [];
  let routingData = {
    detalleEvaluado: [],
    requiereLicitacion: false,
    estadoAbastecimiento: 'stock_disponible',
    itemsSinStock: []
  };

  if (hasItemsArray) {
    const parsedItems = items
      .map((item) => ({
        producto_id: Number(item?.producto_id),
        cantidad: Number(item?.cantidad)
      }))
      .filter((item) => Number.isInteger(item.producto_id) && item.producto_id > 0 && item.cantidad > 0);

    if (parsedItems.length === 0) {
      throw { status: 400, message: "Debés seleccionar al menos un producto con cantidad válida" };
    }

    const productoIds = [...new Set(parsedItems.map((item) => item.producto_id))];
    const productos = await all(
      \`SELECT id_producto AS id FROM producto WHERE id_producto = ANY($1::int[])\`,
      [productoIds]
    );
    if (productos.length !== productoIds.length) {
      throw { status: 404, message: "Uno o más productos no existen" };
    }

    for (const item of parsedItems) {
      const reglaKit = await getReglaKit(perfilInstitucion.tipo_escuela, item.producto_id);
      if (!reglaKit) {
        throw { status: 400, message: "Hay productos seleccionados que no forman parte del kit asignado a tu escuela." };
      }
    }

    detalleItems = parsedItems;
  } else if (kit_id) {
    kit = await getKitById(Number(kit_id));
    if (!kit) {
      throw { status: 404, message: "Kit no encontrado o inactivo." };
    }
    if (!kit.items.length) {
      throw { status: 400, message: "El kit seleccionado no tiene productos configurados." };
    }

    detalleItems = kit.items.map((item) => ({
      producto_id: item.producto_id,
      cantidad: Number(item.cantidad) * cantidadSolicitada
    }));
  } else {
    const producto = await get("SELECT id_producto as id FROM producto WHERE id_producto = ?", [producto_id]);
    if (!producto) {
      throw { status: 404, message: "Producto no encontrado" };
    }

    const reglaKit = await getReglaKit(perfilInstitucion.tipo_escuela, producto_id);
    if (!reglaKit) {
      throw { status: 400, message: "El producto seleccionado no forma parte del kit asignado a tu escuela." };
    }

    detalleItems = [{ producto_id: Number(producto_id), cantidad: cantidadSolicitada }];
  }

  if (tipoValido === 'refuerzo') {
    routingData = await evaluateRefuerzoRouting(detalleItems);
    detalleItems = routingData.detalleEvaluado;
  }

  const pedidoResult = await run(
    \`INSERT INTO pedido (
       id_usuario_solicitante,
       id_institucion,
       observaciones_generales,
       tipo,
       kit_id,
       kit_nombre,
       kit_cantidad,
       requiere_licitacion,
       estado_abastecimiento
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)\`,
    [
      user.sub,
      usuario.id_institucion,
      notas || null,
      tipoValido,
      kit?.id || null,
      kit?.nombre || null,
      kit ? cantidadSolicitada : null,
      routingData.requiereLicitacion,
      routingData.estadoAbastecimiento
    ]
  );

  for (const item of detalleItems) {
    const cantidadEntera = Math.round(Number(item.cantidad || 0));
    if (!Number.isFinite(cantidadEntera) || cantidadEntera <= 0) {
      throw { status: 400, message: "Cada ítem del pedido debe tener una cantidad entera mayor a cero" };
    }
    await run(
      \`INSERT INTO detalle_pedido (
         id_pedido,
         id_producto,
         cantidad_solicitada,
         observacion,
         requiere_licitacion,
         stock_disponible_relevado
       ) VALUES (?, ?, ?, ?, ?, ?)\`,
      [
        pedidoResult.lastID,
        item.producto_id,
        cantidadEntera,
        null,
        Boolean(item.requiere_licitacion),
        item.stock_disponible_relevado ?? null
      ]
    );
  }

  return {
    id: pedidoResult.lastID,
    estado: "pendiente",
    requiere_licitacion: routingData.requiereLicitacion,
    estado_abastecimiento: routingData.estadoAbastecimiento,
    items_sin_stock: routingData.itemsSinStock.map((item) => ({
      producto_id: item.producto_id,
      stock_disponible_relevado: item.stock_disponible_relevado
    }))
  };
}

async function updateEstadoPedido(id, data, user) {
  await ensurePedidosSchema();

  const { estado, motivo } = data;
  const estadosValidos = ["pendiente", "aprobado", "rechazado", "cancelado", "entregado", "aclaracion"];
  if (!estadosValidos.includes(estado)) throw { status: 400, message: "Estado inválido" };

  const pedido = await get(
    \`SELECT id_pedido as id, estado::text as estado_db, id_institucion, COALESCE(tipo, 'anual') as tipo FROM pedido WHERE id_pedido = ?\`,
    [id]
  );

  if (!pedido) throw { status: 404, message: "Pedido no encontrado" };

  const estadoEntregadoDb = await getEstadoEntregadoDb();
  const estadoObjetivoDb = estado === "entregado" ? estadoEntregadoDb : estado;
  const pedidoYaEntregado = pedido.estado_db === "entregado" || pedido.estado_db === "finalizado";
  const solicitaAclaracion = estado === "aclaracion";

  const transicionSupervisor = solicitaAclaracion || estadoObjetivoDb === "aprobado" || estadoObjetivoDb === "rechazado";

  if (transicionSupervisor) {
    const isSupervisorFlow = user.role === "supervisor" || user.role === "master";
    if (!isSupervisorFlow) throw { status: 403, message: "Solo un supervisor puede aprobar o rechazar pedidos" };

    if (user.role === "supervisor" && !(await supervisorHasAssignedInstitution(user.sub, pedido.id_institucion))) {
      throw { status: 403, message: "El pedido no pertenece a una escuela asignada a este supervisor" };
    }

    if (pedido.estado_db !== "pendiente") throw { status: 400, message: "Solo se pueden aprobar o rechazar pedidos pendientes" };

    const motivoSupervisor = String(motivo || "").trim() || null;
    const esPedidoAnual = (pedido.tipo || "anual") === "anual";

    if (!esPedidoAnual && estadoObjetivoDb === "aprobado") {
      const detalleRefuerzo = await all(\`SELECT id_producto, cantidad_solicitada AS cantidad FROM detalle_pedido WHERE id_pedido = ?\`, [id]);
      const routingRefuerzo = await evaluateRefuerzoRouting(
        detalleRefuerzo.map((item) => ({
          producto_id: Number(item.id_producto),
          cantidad: Number(item.cantidad || 0)
        }))
      );

      for (const item of routingRefuerzo.detalleEvaluado) {
        await run(
          \`UPDATE detalle_pedido SET requiere_licitacion = ?, stock_disponible_relevado = ? WHERE id_pedido = ? AND id_producto = ?\`,
          [item.requiere_licitacion, item.stock_disponible_relevado, id, item.producto_id]
        );
      }
      await run(
        \`UPDATE pedido SET requiere_licitacion = ?, estado_abastecimiento = ? WHERE id_pedido = ?\`,
        [routingRefuerzo.requiereLicitacion, routingRefuerzo.estadoAbastecimiento, id]
      );
    }

    if (solicitaAclaracion) {
      if (!motivoSupervisor) throw { status: 400, message: "Debés ingresar una aclaración para enviar la réplica." };

      await run(
        \`UPDATE pedido SET aprobado_por_supervisor_id = ?, fecha_aprobacion_supervisor = NOW(), motivo_supervisor = ?, respuesta_supervisor_tipo = 'aclaracion' WHERE id_pedido = ?\`,
        [user.sub, motivoSupervisor, id]
      );

      return { ok: true, estado: "pendiente", respuesta_supervisor_tipo: "aclaracion" };
    }

    const nuevoEstado = (estadoObjetivoDb === "aprobado" && esPedidoAnual) ? "pendiente_director" : estadoObjetivoDb;

    await run(
      \`UPDATE pedido SET estado = ?, aprobado_por_supervisor_id = ?, fecha_aprobacion_supervisor = NOW(), motivo_supervisor = ?, respuesta_supervisor_tipo = ? WHERE id_pedido = ?\`,
      [nuevoEstado, user.sub, estadoObjetivoDb === "rechazado" ? motivoSupervisor : null, estadoObjetivoDb === "rechazado" ? "rechazo" : "aprobacion", id]
    );

    const pedidoActualizado = await get(
      \`SELECT COALESCE(requiere_licitacion, FALSE) AS requiere_licitacion, COALESCE(estado_abastecimiento, 'stock_disponible') AS estado_abastecimiento FROM pedido WHERE id_pedido = ?\`,
      [id]
    );

    return { ok: true, estado: nuevoEstado, requiere_licitacion: Boolean(pedidoActualizado?.requiere_licitacion), estado_abastecimiento: pedidoActualizado?.estado_abastecimiento || 'stock_disponible' };
  }

  if (pedido.estado_db === estadoObjetivoDb) return { ok: true, unchanged: true };

  if (pedidoYaEntregado && estadoObjetivoDb !== estadoEntregadoDb) throw { status: 400, message: "El pedido ya fue entregado y su estado no puede revertirse" };
  if (estadoObjetivoDb === estadoEntregadoDb && pedido.estado_db !== "aprobado") throw { status: 400, message: "Solo se pueden entregar pedidos aprobados por supervisor" };

  if (estadoObjetivoDb === estadoEntregadoDb) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const detalleRes = await client.query(\`SELECT id_producto, cantidad_solicitada as cantidad FROM detalle_pedido WHERE id_pedido = $1\`, [id]);

      if (!detalleRes.rows.length) {
        await client.query("ROLLBACK");
        throw { status: 400, message: "El pedido no tiene productos para entregar" };
      }

      for (const item of detalleRes.rows) {
        const cantidad = Number(item.cantidad || 0);
        const updateStock = await client.query(
          \`UPDATE producto SET stock_actual = stock_actual - $1 WHERE id_producto = $2 AND stock_actual >= $1 RETURNING id_producto, stock_actual\`,
          [cantidad, item.id_producto]
        );

        if (!updateStock.rowCount) {
          const stockRow = await client.query(\`SELECT stock_actual FROM producto WHERE id_producto = $1\`, [item.id_producto]);
          const disponible = Number(stockRow.rows[0]?.stock_actual || 0);
          await client.query("ROLLBACK");
          throw { status: 400, message: \`Stock insuficiente para entregar pedido. Producto \${item.id_producto}: solicitado \${cantidad}, disponible \${disponible}\` };
        }

        await client.query(
          \`INSERT INTO movimiento_stock (id_producto, cantidad, tipo, id_institucion, id_usuario, motivo) VALUES ($1, $2, 'egreso', $3, $4, $5)\`,
          [item.id_producto, cantidad, pedido.id_institucion, user.sub, \`Entrega de pedido #\${id}\`]
        );
      }

      await client.query("UPDATE pedido SET estado = $1 WHERE id_pedido = $2", [estadoObjetivoDb, id]);
      await client.query("COMMIT");
      return { ok: true };
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }
  }

  await run("UPDATE pedido SET estado = ? WHERE id_pedido = ?", [estadoObjetivoDb, id]);
  return { ok: true };
}

async function cancelarPedido(id, user) {
  const pedido = await get("SELECT id_usuario_solicitante as usuario_id, estado FROM pedido WHERE id_pedido = ?", [id]);
  if (!pedido) throw { status: 404, message: "Pedido no encontrado" };
  if (user.role === "directivo" && pedido.usuario_id !== user.sub) throw { status: 403, message: "No podés cancelar este pedido" };
  if (pedido.estado !== "pendiente") throw { status: 400, message: "Solo se pueden cancelar pedidos pendientes" };

  await run("UPDATE pedido SET estado = 'cancelado' WHERE id_pedido = ?", [id]);
  return { ok: true };
}

async function aprobarDirector(id, data, user) {
  const { decision } = data;
  const pedido = await get(\`SELECT id_pedido, estado::text, id_institucion FROM pedido WHERE id_pedido = ?\`, [id]);
  if (!pedido) throw { status: 404, message: "Pedido no encontrado" };
  if (pedido.estado !== "pendiente_director") throw { status: 400, message: "Solo se pueden aprobar pedidos pendientes de aprobación del Director." };

  if (decision === 'rechazar') {
    await run(
      \`UPDATE pedido SET estado = 'rechazado', aprobado_director_area = FALSE, aprobado_por_director_id = ?, fecha_aprobacion_director = NOW() WHERE id_pedido = ?\`,
      [user.sub, id]
    );
    return { ok: true, estado: 'rechazado' };
  }

  await run(
    \`UPDATE pedido SET estado = 'aprobado', aprobado_director_area = TRUE, aprobado_por_director_id = ?, fecha_aprobacion_director = NOW() WHERE id_pedido = ?\`,
    [user.sub, id]
  );
  return { ok: true, estado: 'aprobado' };
}

module.exports = {
  listarKits,
  createKit,
  updateKit,
  deleteKit,
  listarPedidos,
  getCuposAnuales,
  getHistorialInstitucion,
  getPedidoById,
  createPedido,
  updateEstadoPedido,
  cancelarPedido,
  aprobarDirector
};
`;

const serviceFile = \`const { all, get, run, pool } = require("../db.pg");\n\n\${helpersCode}\n\${serviceLogic}\`;

const controllerFile = \`const pedidoService = require('../services/pedidoService');
const { isAdminLikeRole } = require("../middleware/auth");

function canManageKits(req) {
  return req.user?.role === "admin" || req.user?.role === "master" || req.user?.role === "director_area";
}

function requireKitManager(req, res, next) {
  if (!canManageKits(req)) {
    return res.status(403).json({ error: "No tenés permiso para gestionar kits." });
  }
  return next();
}

async function listarKits(req, res) {
  try {
    const includeInactive = canManageKits(req) && String(req.query.include_inactive || "") === "1";
    const kits = await pedidoService.listarKits(req.user, includeInactive);
    return res.json({ kits });
  } catch (err) {
    console.error("Error al listar kits:", err);
    return res.status(500).json({ error: "No se pudieron listar los kits" });
  }
}

async function createKit(req, res) {
  try {
    const kit = await pedidoService.createKit(req.body, req.user.sub);
    return res.status(201).json({ kit });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al crear kit:", err);
    return res.status(500).json({ error: "No se pudo crear el kit" });
  }
}

async function updateKit(req, res) {
  try {
    const kit = await pedidoService.updateKit(Number(req.params.id), req.body);
    return res.json({ kit });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al actualizar kit:", err);
    return res.status(500).json({ error: "No se pudo actualizar el kit" });
  }
}

async function deleteKit(req, res) {
  try {
    await pedidoService.deleteKit(Number(req.params.id));
    return res.json({ ok: true });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al eliminar kit:", err);
    return res.status(500).json({ error: "No se pudo eliminar el kit" });
  }
}

async function listarPedidos(req, res) {
  try {
    const pedidos = await pedidoService.listarPedidos(req.user);
    return res.json({ pedidos });
  } catch (err) {
    console.error("Error al listar pedidos:", err);
    return res.status(500).json({ error: "No se pudo listar pedidos" });
  }
}

async function getCuposAnuales(req, res) {
  try {
    const result = await pedidoService.getCuposAnuales(req.user, req.query.institucion_id, req.query.anio);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al obtener cupos anuales:", err);
    return res.status(500).json({ error: "No se pudieron obtener cupos anuales" });
  }
}

async function getHistorialInstitucion(req, res) {
  try {
    const pedidos = await pedidoService.getHistorialInstitucion(req.params.institucion, req.user);
    return res.json({ pedidos });
  } catch (err) {
    console.error("Error al obtener historial:", err);
    return res.status(500).json({ error: "No se pudo obtener historial" });
  }
}

async function getPedidoById(req, res) {
  try {
    const pedido = await pedidoService.getPedidoById(req.params.id, req.user);
    return res.json({ pedido });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al obtener pedido:", err);
    return res.status(500).json({ error: "No se pudo obtener pedido" });
  }
}

async function createPedido(req, res) {
  try {
    const result = await pedidoService.createPedido(req.body, req.user);
    return res.status(201).json(result);
  } catch (err) {
    if (err.status) {
      if (err.detalle) return res.status(err.status).json({ error: err.message, detalle: err.detalle });
      return res.status(err.status).json({ error: err.message });
    }
    console.error("Error al crear pedido:", err && err.stack ? err.stack : err, "user:", req.user && req.user.sub, "body:", req.body);
    return res.status(500).json({ error: "No se pudo crear pedido" });
  }
}

async function updateEstadoPedido(req, res) {
  try {
    const result = await pedidoService.updateEstadoPedido(req.params.id, req.body, req.user);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al actualizar pedido:", err);
    return res.status(500).json({ error: "No se pudo actualizar pedido" });
  }
}

async function cancelarPedido(req, res) {
  try {
    const result = await pedidoService.cancelarPedido(req.params.id, req.user);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al cancelar pedido:", err);
    return res.status(500).json({ error: "No se pudo cancelar pedido" });
  }
}

async function aprobarDirector(req, res) {
  try {
    if (req.user.role !== "director_area" && !isAdminLikeRole(req.user.role)) {
      return res.status(403).json({ error: "Solo el Director de Área puede realizar esta aprobación." });
    }
    const result = await pedidoService.aprobarDirector(req.params.id, req.body, req.user);
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Error al aprobar director:", err);
    return res.status(500).json({ error: "No se pudo procesar la aprobación del director." });
  }
}

module.exports = {
  requireKitManager,
  listarKits,
  createKit,
  updateKit,
  deleteKit,
  listarPedidos,
  getCuposAnuales,
  getHistorialInstitucion,
  getPedidoById,
  createPedido,
  updateEstadoPedido,
  cancelarPedido,
  aprobarDirector
};
\`;

const routeFile = \`const express = require("express");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");
const pedidoController = require("../controllers/pedidoController");

const router = express.Router();
router.use(authenticate);

router.get("/kits", authorizePermissions(PERMISSIONS.PEDIDOS_VIEW), pedidoController.listarKits);
router.post("/kits", authorizePermissions(PERMISSIONS.PEDIDOS_VIEW), pedidoController.requireKitManager, pedidoController.createKit);
router.put("/kits/:id(\\\\d+)", authorizePermissions(PERMISSIONS.PEDIDOS_VIEW), pedidoController.requireKitManager, pedidoController.updateKit);
router.delete("/kits/:id(\\\\d+)", authorizePermissions(PERMISSIONS.PEDIDOS_VIEW), pedidoController.requireKitManager, pedidoController.deleteKit);

router.get("/", authorizePermissions(PERMISSIONS.PEDIDOS_VIEW), pedidoController.listarPedidos);
router.get("/cupos-anuales", authorizePermissions(PERMISSIONS.PEDIDOS_VIEW), pedidoController.getCuposAnuales);
router.get("/institucion/:institucion", authorizePermissions(PERMISSIONS.PEDIDOS_MANAGE), pedidoController.getHistorialInstitucion);
router.get("/:id(\\\\d+)", authorizePermissions(PERMISSIONS.PEDIDOS_VIEW), pedidoController.getPedidoById);

router.post("/", authorizePermissions(PERMISSIONS.PEDIDOS_CREATE), pedidoController.createPedido);
router.patch("/:id/estado", authorizePermissions(PERMISSIONS.PEDIDOS_MANAGE), pedidoController.updateEstadoPedido);
router.patch("/:id/cancelar", authorizePermissions(PERMISSIONS.PEDIDOS_CREATE), pedidoController.cancelarPedido);
router.patch("/:id/aprobar-director", authorizePermissions(PERMISSIONS.SUPERVISION_MANAGE), pedidoController.aprobarDirector);

module.exports = router;
\`;

const fs2 = require('fs');
fs2.mkdirSync('backend/src/services', { recursive: true });
fs2.mkdirSync('backend/src/controllers', { recursive: true });

fs2.writeFileSync('backend/src/services/pedidoService.js', serviceFile);
fs2.writeFileSync('backend/src/controllers/pedidoController.js', controllerFile);
fs2.writeFileSync('backend/src/routes/pedidos.js', routeFile);

console.log('Success');
