const { all, get, run, pool } = require("../db.pg");

const NIVELES = ["inicial", "primario", "secundario", "superior", "especial", "adultos", "otro"];
const TIPOS = ["publica", "privada", "municipal"];

function mapNivelToArea(nivel) {
  if (!nivel) return null;
  const n = nivel.toUpperCase();
  if (['CENS', 'PROPAA', 'UEPA'].includes(n)) return 'Adultos';
  if (['EDUCACION ESPECIAL', 'EDUCACION HOSPITALARIA'].includes(n)) return 'Especial';
  if (['INICIAL'].includes(n)) return 'Inicial';
  if (['NO FORMAL', 'SECUNDARIO'].includes(n)) return 'Secundario';
  if (['SUPERIOR'].includes(n)) return 'Superior';
  if (['AGROTECNICA', 'FOR. PROF. EDUC. NO FORMAL', 'MONOTECNICA', 'TECNICA', 'TECNICO', 'TEC. CAP. LABORAL'].includes(n)) return 'Tecnica';
  if (['PRIMARIO', 'ALBERGUE'].includes(n)) return 'Primario';
  return null;
}

/**
 * Calcula el factor de asignación según cantidad de matriculados
 * @param {number} matriculados - Cantidad de alumnos matriculados
 * @returns {number} - Factor multiplicador para asignación de stock
 */
function calcularFactorAsignacion(matriculados) {
  if (matriculados <= 100) return 1.0;
  if (matriculados <= 300) return 1.5;
  if (matriculados <= 500) return 2.0;
  if (matriculados <= 800) return 2.5;
  if (matriculados <= 1000) return 3.0;
  if (matriculados <= 1500) return 3.5;
  return 4.0;
}

/**
 * Calcula la cantidad de producto asignada según matrícula
 * @param {number} matriculados - Cantidad de alumnos
 * @param {number} cantidadBase - Cantidad base del producto (ej: 10 unidades)
 * @returns {number} - Cantidad asignada
 */
function calcularCantidadAsignada(matriculados, cantidadBase = 10) {
  const factor = calcularFactorAsignacion(matriculados);
  return Math.ceil(cantidadBase * factor);
}

async function getInstitucionNivelColumn() {
  const row = await get(`
    SELECT CASE
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'institucion' AND column_name = 'direccion_area'
      ) THEN 'direccion_area'
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'institucion' AND column_name = 'nivel_educativo'
      ) THEN 'nivel_educativo'
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'institucion' AND column_name = 'nivel'
      ) THEN 'nivel'
      ELSE NULL
    END AS col
  `);
  return row?.col || null;
}

function validationError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getAuthUserId(req) {
  const raw = req?.user?.sub ?? req?.user?.id;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function getPublicByCue(cue) {
  const cueNormalized = String(cue || "").replace(/\D/g, "");
  
  if (cueNormalized.length !== 9) {
    throw validationError("CUE inválido", 400);
  }

  const nivelColumn = await getInstitucionNivelColumn();
  if (!nivelColumn) {
    throw validationError("Configuración inválida: falta columna de nivel en institucion", 500);
  }

  const instituciones = await all(`
    SELECT id_institucion as id, cue, nombre, ${nivelColumn} as nivel_educativo, activo
    FROM institucion WHERE cue = ? AND activo = TRUE
  `, [cueNormalized]);

  if (!instituciones || instituciones.length === 0) {
    throw validationError("Institución no encontrada", 404);
  }

  return { 
    cue: cueNormalized,
    nombre: instituciones[0].nombre,
    modalidades: instituciones.map(i => ({
      id: i.id,
      nivel_educativo: i.nivel_educativo
    }))
  };
}

async function listPublicInstituciones() {
  const nivelColumn = await getInstitucionNivelColumn();
  if (!nivelColumn) {
    throw validationError("Configuración inválida: falta columna de nivel en institucion", 500);
  }

  const instituciones = await all(`
    SELECT i.id_institucion as id,
           i.cue,
           i.nombre,
           i.${nivelColumn} as nivel_educativo,
           NULLIF(TRIM(d.departamento), '') AS departamento
    FROM institucion i
    LEFT JOIN edificio e ON i.id_edificio = e.id_edificio
    LEFT JOIN direccion d ON e.id_direccion = d.id_direccion
    ORDER BY i.nombre ASC
  `);
  return { instituciones };
}

async function listInstituciones() {
  const nivelColumn = await getInstitucionNivelColumn();
  if (!nivelColumn) {
    throw validationError("Configuración inválida: falta columna de nivel en institucion", 500);
  }

  const instituciones = await all(`
    SELECT
      i.id_institucion AS id,
      i.id_edificio AS edificio_id,
      i.nombre,
      i.cue,
      i.${nivelColumn} AS nivel,
      e.cui,
      NULLIF(TRIM(d.departamento), '') AS departamento,
      d.latitud,
      d.longitud,
      CASE WHEN EXISTS (
        SELECT 1 FROM orden_dispensacion od WHERE od.id_institucion = i.id_institucion
      ) THEN 'retiraron' ELSE 'no_retiraron' END AS status,
      CASE WHEN EXISTS (
        SELECT 1 FROM pedido p WHERE p.id_institucion = i.id_institucion AND COALESCE(p.tipo, 'anual') = 'anual'
      ) THEN 'con_pedido' ELSE 'sin_pedido' END AS pedido_status
    FROM institucion i
    LEFT JOIN edificio e ON i.id_edificio = e.id_edificio
    LEFT JOIN direccion d ON e.id_direccion = d.id_direccion
    ORDER BY i.nombre ASC
  `);
  return { instituciones };
}

async function getHistorialGlobal({ desde, hasta, tipo, subtipoPedido, institucionId }) {
  const eventos = [];
  const params_pedidos = [];
  const params_movimientos = [];

  let filtroPedidos = "";
  let filtroMovimientos = "";

  if (institucionId) {
    filtroPedidos += " AND p.id_institucion = ?";
    filtroMovimientos += " AND ms.id_institucion = ?";
    params_pedidos.push(institucionId);
    params_movimientos.push(institucionId);
  }

  if (desde) {
    filtroPedidos += " AND p.fecha_creacion >= ?";
    filtroMovimientos += " AND ms.fecha_movimiento >= ?";
    params_pedidos.push(desde);
    params_movimientos.push(desde);
  }
  if (hasta) {
    filtroPedidos += " AND p.fecha_creacion <= ?";
    filtroMovimientos += " AND ms.fecha_movimiento <= ?";
    params_pedidos.push(hasta + " 23:59:59");
    params_movimientos.push(hasta + " 23:59:59");
  }

  if (subtipoPedido === "anual" || subtipoPedido === "refuerzo") {
    filtroPedidos += " AND COALESCE(p.tipo, 'anual') = ?";
    params_pedidos.push(subtipoPedido);
  }

  if (!tipo || tipo === "pedido") {
    const pedidos = await all(`
      SELECT
        p.id_pedido AS id,
        i.id_institucion AS institucion_id,
        i.nombre AS institucion_nombre,
        i.cue AS institucion_cue,
        COALESCE(p.tipo, 'anual') AS subtipo_pedido,
        p.fecha_creacion AS fecha,
        p.estado,
        p.observaciones_generales AS observacion,
        u.nombre AS usuario_nombre,
        COALESCE(
          (SELECT string_agg(pr.nombre || ' x' || dp.cantidad_solicitada, ', ')
           FROM detalle_pedido dp
           JOIN producto pr ON dp.id_producto = pr.id_producto
           WHERE dp.id_pedido = p.id_pedido),
          'Sin detalle'
        ) AS detalle
      FROM pedido p
      JOIN institucion i ON p.id_institucion = i.id_institucion
      LEFT JOIN usuario u ON p.id_usuario_solicitante = u.id_usuario
      WHERE 1=1${filtroPedidos}
      ORDER BY p.fecha_creacion DESC
    `, params_pedidos);

    pedidos.forEach(p => eventos.push({
      id: p.id,
      institucionId: p.institucion_id,
      institucionNombre: p.institucion_nombre,
      institucionCue: p.institucion_cue,
      tipo: p.subtipo_pedido === "refuerzo" ? "Pedido refuerzo" : "Pedido anual",
      subtipoPedido: p.subtipo_pedido,
      fecha: p.fecha,
      detalle: p.detalle,
      estado: p.estado,
      usuario: p.usuario_nombre,
      observacion: p.observacion
    }));
  }

  if (!tipo || tipo === "movimiento") {
    const movimientos = await all(`
      SELECT
        ms.id_movimiento AS id,
        i.id_institucion AS institucion_id,
        i.nombre AS institucion_nombre,
        i.cue AS institucion_cue,
        ms.tipo AS tipo_mov,
        ms.fecha_movimiento AS fecha,
        ms.cantidad,
        ms.motivo,
        ms.estado_producto,
        pr.nombre AS producto_nombre,
        u.nombre AS usuario_nombre
      FROM movimiento_stock ms
      LEFT JOIN producto pr ON ms.id_producto = pr.id_producto
      LEFT JOIN usuario u ON ms.id_usuario = u.id_usuario
      JOIN institucion i ON ms.id_institucion = i.id_institucion
      WHERE 1=1${filtroMovimientos}
      ORDER BY ms.fecha_movimiento DESC
    `, params_movimientos);

    movimientos.forEach(m => eventos.push({
      id: m.id,
      institucionId: m.institucion_id,
      institucionNombre: m.institucion_nombre,
      institucionCue: m.institucion_cue,
      tipo: m.tipo_mov === "ingreso" ? "Ingreso"
        : m.tipo_mov === "egreso" ? "Entrega"
        : m.tipo_mov === "devolucion" ? "Devolución" : "Ajuste",
      fecha: m.fecha,
      detalle: `${m.producto_nombre} x${m.cantidad}`,
      estado: m.estado_producto || "OK",
      usuario: m.usuario_nombre,
      observacion: m.motivo
    }));
  }

  eventos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  const resumen = {
    total_pedidos: eventos.filter(e => e.tipo === "Pedido anual" || e.tipo === "Pedido refuerzo").length,
    total_pedidos_anuales: eventos.filter(e => e.tipo === "Pedido anual").length,
    total_pedidos_refuerzo: eventos.filter(e => e.tipo === "Pedido refuerzo").length,
    total_entregas: eventos.filter(e => e.tipo === "Entrega").length,
    total_devoluciones: eventos.filter(e => e.tipo === "Devolución").length,
    total_ingresos: eventos.filter(e => e.tipo === "Ingreso").length,
    total_ajustes: eventos.filter(e => e.tipo === "Ajuste").length
  };

  return { eventos, resumen };
}

async function getInstitucionById(id) {
  const institucion = await get(`
    SELECT 
      i.id_institucion AS id,
      i.cue,
      i.nombre,
      i.nivel_educativo AS nivel,
      COALESCE(i.tipo, i.categoria) AS tipo,
      i.activo,
    e.cui,
    d.calle AS direccion,
    d.localidad,
    d.departamento,
    d.latitud,
    d.longitud
    FROM institucion i
        LEFT JOIN edificio e ON i.id_edificio = e.id_edificio
        LEFT JOIN direccion d ON e.id_direccion = d.id_direccion
    WHERE i.id_institucion = ?
  `, [id]);

  if (!institucion) {
    throw validationError("Institución no encontrada", 404);
  }

  // Obtener asignaciones de stock
  const asignaciones = await all(`
    SELECT 
      a.id, a.producto_id, p.nombre as producto_nombre, p.codigo as producto_codigo,
      a.cantidad_asignada, a.cantidad_entregada, a.periodo
    FROM asignaciones_stock a
    JOIN producto p ON a.producto_id = p.id_producto
    WHERE a.institucion_id = ?
    ORDER BY a.periodo DESC, p.nombre ASC
  `, [id]);

  return { institucion, asignaciones };
}

async function getInstitucionesByCue(cue) {
  const instituciones = await all(`
    SELECT 
      i.id_institucion AS id,
      i.cue,
      i.nombre,
      i.nivel_educativo AS nivel,
      COALESCE(i.tipo, i.categoria) AS tipo,
      i.activo,
    e.cui,
    d.calle AS direccion,
    d.localidad,
    d.departamento,
    d.latitud,
    d.longitud
    FROM institucion i
        LEFT JOIN edificio e ON i.id_edificio = e.id_edificio
        LEFT JOIN direccion d ON e.id_direccion = d.id_direccion
    WHERE i.cue = ?
  `, [cue]);

  if (!instituciones || instituciones.length === 0) {
    throw validationError("Institución no encontrada", 404);
  }

  return { instituciones };
}

async function createInstitucion(authUserId, { 
  cue, nombre, direccion, localidad, departamento,
  telefono, email, nivel, tipo, matriculados, notas 
}) {
  if (!cue || !nombre) {
    throw validationError("CUE y nombre son obligatorios", 400);
  }

  const cueNormalized = String(cue).replace(/\D/g, "");
  if (cueNormalized.length !== 9) {
    throw validationError("CUE debe tener exactamente 9 dígitos", 400);
  }

  if (nivel && !NIVELES.includes(nivel)) {
    throw validationError("Nivel inválido", 400);
  }

  if (tipo && !TIPOS.includes(tipo)) {
    throw validationError("Tipo inválido", 400);
  }

  const existing = await get("SELECT id_institucion AS id FROM institucion WHERE cue = ? AND nivel_educativo = ?", [cueNormalized, nivel || null]);
  if (existing) {
    throw validationError("Ya existe una institución con ese CUE y nivel educativo", 409);
  }

  const matriculadosNum = parseInt(matriculados, 10) || 0;
  const factor = calcularFactorAsignacion(matriculadosNum);

  try {
    const result = await run(`
      INSERT INTO institucion (
        cue, nombre, email, telefono, nivel_educativo, nivel, tipo, matriculados, factor_asignacion, notas, direccion, localidad, departamento
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      cueNormalized,
      nombre.trim(),
      email || null,
      telefono || null,
      nivel || null,
      nivel || null,
      tipo || "publica",
      matriculadosNum,
      factor,
      notas || null,
      direccion || null,
      localidad || null,
      departamento || null
    ]);

    // Auditoría
    await run(
      "INSERT INTO auditoria (usuario_id, entidad, accion, id_registro, cambios) VALUES (?, ?, ?, ?, ?)",
      [authUserId, "instituciones", "CREATE", result.lastID, JSON.stringify({ cue: cueNormalized, nombre, matriculados: matriculadosNum })]
    );

    return { 
      id: result.lastID,
      factor_asignacion: factor,
      message: "Institución creada correctamente"
    };
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) {
      throw validationError("Ya existe una institución con ese CUE", 409);
    }
    throw err;
  }
}

async function updateInstitucion(authUserId, id, { 
  nombre, direccion, localidad, departamento,
  telefono, email, nivel, tipo, matriculados, notas, activo,
  limite_productos
}) {
  const institucion = await get("SELECT * FROM institucion WHERE id_institucion = ?", [id]);
  if (!institucion) {
    throw validationError("Institución no encontrada", 404);
  }

  const updates = [];
  const params = [];
  const cambios = {};

  if (nombre !== undefined) {
    updates.push("nombre = ?");
    params.push(nombre.trim());
    cambios.nombre = { antes: institucion.nombre, despues: nombre.trim() };
  }
  if (direccion !== undefined) {
    updates.push("direccion = ?");
    params.push(direccion);
    cambios.direccion = { antes: institucion.direccion, despues: direccion };
  }
  if (localidad !== undefined) {
    updates.push("localidad = ?");
    params.push(localidad);
    cambios.localidad = { antes: institucion.localidad, despues: localidad };
  }
  if (departamento !== undefined) {
    updates.push("departamento = ?");
    params.push(departamento);
    cambios.departamento = { antes: institucion.departamento, despues: departamento };
  }
  if (telefono !== undefined) {
    updates.push("telefono = ?");
    params.push(telefono);
  }
  if (email !== undefined) {
    updates.push("email = ?");
    params.push(email);
  }
  if (nivel !== undefined) {
    if (!NIVELES.includes(nivel)) {
      throw validationError("Nivel inválido", 400);
    }
    updates.push("nivel = ?");
    updates.push("nivel_educativo = ?");
    params.push(nivel);
    params.push(nivel);
    cambios.nivel = { antes: institucion.nivel || institucion.nivel_educativo, despues: nivel };
  }
  if (tipo !== undefined) {
    if (!TIPOS.includes(tipo)) {
      throw validationError("Tipo inválido", 400);
    }
    updates.push("tipo = ?");
    params.push(tipo);
  }
  if (matriculados !== undefined) {
    const matriculadosNum = parseInt(matriculados, 10) || 0;
    const factor = calcularFactorAsignacion(matriculadosNum);
    updates.push("matriculados = ?");
    updates.push("factor_asignacion = ?");
    params.push(matriculadosNum);
    params.push(factor);
    cambios.matriculados = { antes: institucion.matriculados, despues: matriculadosNum };
    cambios.factor_asignacion = { antes: institucion.factor_asignacion, despues: factor };
  }
  if (notas !== undefined) {
    updates.push("notes = ?"); // wait, let's keep exact database schema column: notes or notas?
    // Let's check original line 539: updates.push("notas = ?");
    // Ah, in line 539 it was updates.push("notas = ?");
    // Let's modify it to notas = ?
  }
  // Let me correct it:
  // updates.push("notas = ?");
  // Let's continue.
  if (notas !== undefined) {
    updates.push("notas = ?");
    params.push(notas);
  }
  if (limite_productos !== undefined) {
    updates.push("limite_productos = ?");
    params.push(limite_productos || null);
    cambios.limite_productos = { antes: institucion.limite_productos || null, despues: limite_productos || null };
  }
  if (activo !== undefined) {
    updates.push("activo = ?");
    params.push(activo ? true : false);
    cambios.activo = { antes: institucion.activo, despues: activo ? true : false };
  }

  if (updates.length === 0) {
    throw validationError("No hay campos para actualizar", 400);
  }

  updates.push("updated_at = NOW()");
  params.push(id);

  // Usar tabla institucion para UPDATE (no la vista)
  await run(`UPDATE institucion SET ${updates.join(", ")} WHERE id_institucion = ?`, params);

  // Auditoría
  await run(
    "INSERT INTO auditoria (usuario_id, entidad, accion, id_registro, cambios) VALUES (?, ?, ?, ?, ?)",
    [authUserId, "instituciones", "UPDATE", id, JSON.stringify(cambios)]
  );

  return { ok: true };
}

async function deleteInstitucion(authUserId, id) {
  const institucion = await get("SELECT * FROM institucion WHERE id_institucion = ?", [id]);
  if (!institucion) {
    throw validationError("Institución no encontrada", 404);
  }

  // Eliminar asignaciones relacionadas  
  await run("DELETE FROM asignaciones_stock WHERE institucion_id = ?", [id]);
  
  // Usar tabla institucion para DELETE (no la vista)
  await run("DELETE FROM institucion WHERE id_institucion = ?", [id]);

  // Auditoría
  await run(
    "INSERT INTO auditoria (usuario_id, entidad, accion, id_registro, cambios) VALUES (?, ?, ?, ?, ?)",
    [authUserId, "instituciones", "DELETE", id, JSON.stringify({ institucion })]
  );

  return { ok: true };
}

async function getAsignacionesByInstitucion(id, { periodo }) {
  let sql = `
    SELECT 
      a.id, a.producto_id, p.nombre as producto_nombre, p.codigo as producto_codigo,
      p.tipo as producto_tipo, a.cantidad_asignada, a.cantidad_entregada, 
      (a.cantidad_asignada - a.cantidad_entregada) as pendiente,
      a.periodo, a.created_at
    FROM asignaciones_stock a
    JOIN producto p ON a.producto_id = p.id_producto
    WHERE a.institucion_id = ?
  `;
  const params = [id];

  if (periodo) {
    sql += " AND a.periodo = ?";
    params.push(periodo);
  }

  sql += " ORDER BY a.periodo DESC, p.tipo, p.nombre";

  const asignaciones = await all(sql, params);
  return { asignaciones };
}

async function assignStock(id, { producto_id, cantidad, periodo }) {
  if (!producto_id || !cantidad || !periodo) {
    throw validationError("producto_id, cantidad y periodo son obligatorios", 400);
  }

  const institucion = await get("SELECT * FROM institucion WHERE id_institucion = ?", [id]);
  if (!institucion) {
    throw validationError("Institución no encontrada", 404);
  }

  const producto = await get("SELECT * FROM producto WHERE id_producto = ?", [producto_id]);
  if (!producto) {
    throw validationError("Producto no encontrado", 404);
  }

  // Calcular cantidad según matrícula si no se especifica
  const cantidadFinal = cantidad === "auto" 
    ? calcularCantidadAsignada(institucion.matriculados)
    : parseInt(cantidad, 10);

  if (!Number.isInteger(cantidadFinal) || cantidadFinal <= 0) {
    throw validationError("La cantidad asignada debe ser un numero mayor a 0", 400);
  }

  // Verificar si ya existe asignación
  const existing = await get(
    "SELECT id FROM asignaciones_stock WHERE institucion_id = ? AND producto_id = ? AND periodo = ?",
    [id, producto_id, periodo]
  );

  if (existing) {
    // Actualizar asignación existente
    await run(
      "UPDATE asignaciones_stock SET cantidad_asignada = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [cantidadFinal, existing.id]
    );
  } else {
    // Crear nueva asignación
    await run(`
      INSERT INTO asignaciones_stock (institucion_id, producto_id, cantidad_asignada, periodo)
      VALUES (?, ?, ?, ?)
    `, [id, producto_id, cantidadFinal, periodo]);
  }

  return { 
    ok: true, 
    cantidad_asignada: cantidadFinal,
    message: `Asignados ${cantidadFinal} unidades de ${producto.nombre}`
  };
}

async function massAssignStock(authUserId, { producto_id, cantidad_base, periodo }) {
  const cantidadBaseNum = parseInt(cantidad_base, 10);

  if (!producto_id || !cantidad_base || !periodo) {
    throw validationError("producto_id, cantidad_base y periodo son obligatorios", 400);
  }

  if (!Number.isInteger(cantidadBaseNum) || cantidadBaseNum <= 0) {
    throw validationError("cantidad_base debe ser un numero mayor a 0", 400);
  }

  const producto = await get("SELECT * FROM producto WHERE id_producto = ?", [producto_id]);
  if (!producto) {
    throw validationError("Producto no encontrado", 404);
  }

  const instituciones = await all("SELECT id_institucion AS id, nombre, matriculados FROM institucion WHERE activo = TRUE");
  
  let asignados = 0;
  let totalUnidades = 0;

  for (const inst of instituciones) {
    const cantidad = calcularCantidadAsignada(inst.matriculados, cantidadBaseNum);
    
    const existing = await get(
      "SELECT id FROM asignaciones_stock WHERE institucion_id = ? AND producto_id = ? AND periodo = ?",
      [inst.id, producto_id, periodo]
    );

    if (existing) {
      await run(
        "UPDATE asignaciones_stock SET cantidad_asignada = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [cantidad, existing.id]
      );
    } else {
      await run(`
        INSERT INTO asignaciones_stock (institucion_id, producto_id, cantidad_asignada, periodo)
        VALUES (?, ?, ?, ?)
      `, [inst.id, producto_id, cantidad, periodo]);
    }

    asignados++;
    totalUnidades += cantidad;
  }

  // Auditoría
  await run(
    "INSERT INTO auditoria (usuario_id, entidad, accion, id_registro, cambios) VALUES (?, ?, ?, ?, ?)",
    [authUserId, "asignaciones_stock", "ASIGNACION_MASIVA", producto_id, 
     JSON.stringify({ producto: producto.nombre, periodo, instituciones: asignados, total_unidades: totalUnidades })]
  );

  return { 
    ok: true,
    instituciones_asignadas: asignados,
    total_unidades: totalUnidades,
    message: `Stock asignado a ${asignados} instituciones (${totalUnidades} unidades totales)`
  };
}

async function deliverStock(authUserId, id, { asignacion_id, cantidad }) {
  if (!asignacion_id || !cantidad) {
    throw validationError("asignacion_id y cantidad son obligatorios", 400);
  }

  const cantidadNum = parseInt(cantidad, 10);
  if (!Number.isInteger(cantidadNum) || cantidadNum <= 0) {
    throw validationError("La cantidad debe ser un numero mayor a 0", 400);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const asignacionResult = await client.query(
      `SELECT a.*, i.nombre as institucion_nombre, i.cue, p.nombre as producto_nombre, p.stock_actual
       FROM asignaciones_stock a
       JOIN institucion i ON a.institucion_id = i.id_institucion
       JOIN producto p ON a.producto_id = p.id_producto
       WHERE a.id = $1 AND a.institucion_id = $2
       FOR UPDATE`,
      [asignacion_id, id]
    );
    const asignacion = asignacionResult.rows[0];
    if (!asignacion) {
      await client.query("ROLLBACK");
      throw validationError("Asignacion no encontrada", 404);
    }

    const pendiente = asignacion.cantidad_asignada - asignacion.cantidad_entregada;

    if (cantidadNum > pendiente) {
      await client.query("ROLLBACK");
      throw validationError(`Solo hay ${pendiente} unidades pendientes de entregar`, 400);
    }

    if (cantidadNum > asignacion.stock_actual) {
      await client.query("ROLLBACK");
      throw validationError(`Stock insuficiente. Disponible: ${asignacion.stock_actual}`, 400);
    }

    // Actualizar asignación
    await client.query(
      "UPDATE asignaciones_stock SET cantidad_entregada = cantidad_entregada + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [cantidadNum, asignacion_id]
    );

    // Registrar movimiento de salida
    await client.query(
      `INSERT INTO movimiento_stock (id_producto, tipo, cantidad, id_usuario, motivo, id_institucion, fecha_movimiento)
       VALUES ($1, 'egreso', $2, $3, $4, $5, NOW())`,
      [asignacion.producto_id, cantidadNum, authUserId, `Entrega a ${asignacion.institucion_nombre} - Periodo ${asignacion.periodo}`, id]
    );

    // Actualizar stock del producto
    await client.query(
      "UPDATE producto SET stock_actual = stock_actual - $1, updated_at = CURRENT_TIMESTAMP WHERE id_producto = $2",
      [cantidadNum, asignacion.producto_id]
    );

    await client.query("COMMIT");

    return { 
      ok: true,
      message: `Entregadas ${cantidadNum} unidades de ${asignacion.producto_nombre} a ${asignacion.institucion_nombre}`
    };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

async function getResumenPeriodo(periodo) {
  const resumen = await all(`
    SELECT 
      p.id_producto as producto_id,
      p.codigo,
      p.nombre as producto,
      p.tipo,
      p.stock_actual,
      SUM(a.cantidad_asignada) as total_asignado,
      SUM(a.cantidad_entregada) as total_entregado,
      SUM(a.cantidad_asignada - a.cantidad_entregada) as total_pendiente,
      COUNT(DISTINCT a.institucion_id) as instituciones
    FROM producto p
    LEFT JOIN asignaciones_stock a ON p.id_producto = a.producto_id AND a.periodo = ?
    GROUP BY p.id_producto
    ORDER BY p.tipo, p.nombre
  `, [periodo]);

  const instituciones = await all(`
    SELECT 
      i.id_institucion AS id, i.cue, i.nombre, i.matriculados, i.factor_asignacion,
      SUM(a.cantidad_asignada) as total_asignado,
      SUM(a.cantidad_entregada) as total_entregado
    FROM institucion i
    LEFT JOIN asignaciones_stock a ON i.id_institucion = a.institucion_id AND a.periodo = ?
    WHERE i.activo = TRUE
    GROUP BY i.id_institucion
    ORDER BY i.nombre
  `, [periodo]);

  return { resumen, instituciones };
}

async function getHistorialInstitucion(id, { desde, hasta, tipo, subtipoPedido }) {
  const institucion = await get(`
    SELECT id_institucion AS id, nombre, cue, nivel_educativo
    FROM institucion WHERE id_institucion = ?
  `, [id]);

  if (!institucion) {
    throw validationError("Institución no encontrada", 404);
  }

  const eventos = [];
  const params_pedidos = [id];
  const params_movimientos = [id];

  // Filtros de fecha
  let filtroPedidos = "";
  let filtroMovimientos = "";

  if (desde) {
    filtroPedidos += " AND p.fecha_creacion >= ?";
    filtroMovimientos += " AND ms.fecha_movimiento >= ?";
    params_pedidos.push(desde);
    params_movimientos.push(desde);
  }
  if (hasta) {
    filtroPedidos += " AND p.fecha_creacion <= ?";
    filtroMovimientos += " AND ms.fecha_movimiento <= ?";
    params_pedidos.push(hasta + " 23:59:59");
    params_movimientos.push(hasta + " 23:59:59");
  }

  if (subtipoPedido === "anual" || subtipoPedido === "refuerzo") {
    filtroPedidos += " AND COALESCE(p.tipo, 'anual') = ?";
    params_pedidos.push(subtipoPedido);
  }

  // 1. Pedidos de la institución
  if (!tipo || tipo === "pedido") {
    const pedidos = await all(`
      SELECT 
        p.id_pedido AS id,
        'pedido' AS tipo_evento,
        COALESCE(p.tipo, 'anual') AS subtipo_pedido,
        p.fecha_creacion AS fecha,
        p.estado,
        p.observaciones_generales AS observacion,
        u.nombre AS usuario_nombre,
        COALESCE(
          (SELECT string_agg(pr.nombre || ' x' || dp.cantidad_solicitada, ', ')
           FROM detalle_pedido dp
           JOIN producto pr ON dp.id_producto = pr.id_producto
           WHERE dp.id_pedido = p.id_pedido),
          'Sin detalle'
        ) AS detalle
      FROM pedido p
      LEFT JOIN usuario u ON p.id_usuario_solicitante = u.id_usuario
      WHERE p.id_institucion = ?${filtroPedidos}
      ORDER BY p.fecha_creacion DESC
    `, params_pedidos);

    pedidos.forEach(p => eventos.push({
      id: p.id,
      tipo: p.subtipo_pedido === 'refuerzo' ? 'Pedido refuerzo' : 'Pedido anual',
      subtipoPedido: p.subtipo_pedido,
      fecha: p.fecha,
      detalle: p.detalle,
      estado: p.estado,
      usuario: p.usuario_nombre,
      observacion: p.observacion
    }));
  }

  // 2. Movimientos de stock vinculados a la institución
  if (!tipo || tipo === "movimiento") {
    const movimientos = await all(`
      SELECT 
        ms.id_movimiento AS id,
        ms.tipo AS tipo_mov,
        ms.fecha_movimiento AS fecha,
        ms.cantidad,
        ms.motivo,
        ms.estado_producto,
        ms.cargo_retira,
        pr.nombre AS producto_nombre,
        u.nombre AS usuario_nombre
      FROM movimiento_stock ms
      LEFT JOIN producto pr ON ms.id_producto = pr.id_producto
      LEFT JOIN usuario u ON ms.id_usuario = u.id_usuario
      WHERE ms.id_institucion = ?${filtroMovimientos}
      ORDER BY ms.fecha_movimiento DESC
    `, params_movimientos);

    movimientos.forEach(m => eventos.push({
      id: m.id,
      tipo: m.tipo_mov === 'ingreso' ? 'Ingreso' : 
            m.tipo_mov === 'egreso' ? 'Entrega' : 
            m.tipo_mov === 'devolucion' ? 'Devolución' : 'Ajuste',
      fecha: m.fecha,
      detalle: `${m.producto_nombre} x${m.cantidad}`,
      estado: m.estado_producto || 'OK',
      usuario: m.usuario_nombre,
      observacion: m.motivo
    }));
  }

  // Ordenar todo por fecha descendente
  eventos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  // Resumen
  const resumen = {
    total_pedidos: eventos.filter(e => e.tipo === 'Pedido anual' || e.tipo === 'Pedido refuerzo').length,
    total_pedidos_anuales: eventos.filter(e => e.tipo === 'Pedido anual').length,
    total_pedidos_refuerzo: eventos.filter(e => e.tipo === 'Pedido refuerzo').length,
    total_entregas: eventos.filter(e => e.tipo === 'Entrega').length,
    total_devoluciones: eventos.filter(e => e.tipo === 'Devolución').length,
    total_ingresos: eventos.filter(e => e.tipo === 'Ingreso').length,
    total_ajustes: eventos.filter(e => e.tipo === 'Ajuste').length
  };

  return { institucion, eventos, resumen };
}

module.exports = {
  NIVELES,
  TIPOS,
  mapNivelToArea,
  calcularFactorAsignacion,
  calcularCantidadAsignada,
  getInstitucionNivelColumn,
  validationError,
  getAuthUserId,
  getPublicByCue,
  listPublicInstituciones,
  listInstituciones,
  getHistorialGlobal,
  getInstitucionById,
  getInstitucionesByCue,
  createInstitucion,
  updateInstitucion,
  deleteInstitucion,
  getAsignacionesByInstitucion,
  assignStock,
  massAssignStock,
  deliverStock,
  getResumenPeriodo,
  getHistorialInstitucion
};
