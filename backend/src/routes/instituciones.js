const express = require("express");
const { all, get, run } = require("../db.pg");
const { authenticate, authorizePermissions } = require("../middleware/auth");
const { PERMISSIONS } = require("../permissions");

const router = express.Router();

const NIVELES = ["inicial", "primario", "secundario", "superior", "especial", "adultos", "otro"];
const TIPOS = ["publica", "privada", "municipal"];

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

// Endpoint público para obtener instituciones por CUE (sin autenticación)
router.get("/public/cue/:cue", async (req, res) => {
  try {
    const { cue } = req.params;
    const cueNormalized = String(cue || "").replace(/\D/g, "");
    
    if (cueNormalized.length !== 9) {
      return res.status(400).json({ error: "CUE inválido" });
    }

    const instituciones = await all(`
      SELECT id_institucion as id, cue, nombre, nivel_educativo, activo
      FROM institucion WHERE cue = ? AND activo = TRUE
    `, [cueNormalized]);

    if (!instituciones || instituciones.length === 0) {
      return res.status(404).json({ error: "Institución no encontrada" });
    }

    return res.json({ 
      cue: cueNormalized,
      nombre: instituciones[0].nombre,
      modalidades: instituciones.map(i => ({
        id: i.id,
        nivel_educativo: i.nivel_educativo
      }))
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo buscar la institución" });
  }
});

// Endpoint público para listar instituciones (para dropdowns)
router.get("/public/list", async (req, res) => {
  try {
    const instituciones = await all(`
      SELECT id_institucion as id, nombre FROM institucion ORDER BY nombre ASC
    `);
    return res.json({ instituciones });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo listar instituciones" });
  }
});

router.use(authenticate);

// Listar todas las instituciones
router.get("/", authorizePermissions(PERMISSIONS.INSTITUCIONES_VIEW), async (req, res) => {
  try {
    const instituciones = await all(`
      SELECT
        i.id_institucion AS id,
        i.cue,
        i.nombre,
        i.nivel_educativo AS nivel,
        i.categoria AS tipo,
        i.limite_productos,
        i.activo,
        e.direccion,
        e.localidad,
        e.departamento
      FROM institucion i
      LEFT JOIN edificio e ON i.id_edificio = e.id_edificio
      ORDER BY i.nombre ASC
    `);
    return res.json({ instituciones });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo listar instituciones" });
  }
});

// Obtener una institución por ID
router.get("/:id", authorizePermissions(PERMISSIONS.INSTITUCIONES_VIEW), async (req, res) => {
  try {
    const { id } = req.params;
    const institucion = await get(`
      SELECT 
        i.id_institucion AS id,
        i.cue,
        i.nombre,
        i.nivel_educativo AS nivel,
        i.categoria AS tipo,
        i.limite_productos,
        i.activo,
        e.direccion,
        e.localidad,
        e.departamento
      FROM institucion i
      LEFT JOIN edificio e ON i.id_edificio = e.id_edificio
      WHERE i.id_institucion = ?
    `, [id]);

    if (!institucion) {
      return res.status(404).json({ error: "Institución no encontrada" });
    }

    // Obtener asignaciones de stock
    const asignaciones = await all(`
      SELECT 
        a.id, a.producto_id, p.nombre as producto_nombre, p.codigo as producto_codigo,
        a.cantidad_asignada, a.cantidad_entregada, a.periodo
      FROM asignaciones_stock a
      JOIN productos p ON a.producto_id = p.id
      WHERE a.institucion_id = ?
      ORDER BY a.periodo DESC, p.nombre ASC
    `, [id]);

    return res.json({ institucion, asignaciones });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo obtener la institución" });
  }
});

// Buscar instituciones por CUE (puede devolver múltiples modalidades)
router.get("/cue/:cue", authorizePermissions(PERMISSIONS.INSTITUCIONES_VIEW), async (req, res) => {
  try {
    const { cue } = req.params;
    const instituciones = await all(`
      SELECT 
        i.id_institucion AS id,
        i.cue,
        i.nombre,
        i.nivel_educativo AS nivel,
        i.categoria AS tipo,
        i.limite_productos,
        i.activo,
        e.direccion,
        e.localidad,
        e.departamento
      FROM institucion i
      LEFT JOIN edificio e ON i.id_edificio = e.id_edificio
      WHERE i.cue = ?
    `, [cue]);

    if (!instituciones || instituciones.length === 0) {
      return res.status(404).json({ error: "Institución no encontrada" });
    }

    return res.json({ instituciones });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo buscar la institución" });
  }
});

// Crear institución
router.post("/", authorizePermissions(PERMISSIONS.INSTITUCIONES_CREATE), async (req, res) => {
  try {
    const { 
      cue, nombre, direccion, localidad, departamento,
      telefono, email, nivel, tipo, matriculados, notas 
    } = req.body;

    if (!cue || !nombre) {
      return res.status(400).json({ error: "CUE y nombre son obligatorios" });
    }

    const cueNormalized = String(cue).replace(/\D/g, "");
    if (cueNormalized.length !== 9) {
      return res.status(400).json({ error: "CUE debe tener exactamente 9 dígitos" });
    }

    if (nivel && !NIVELES.includes(nivel)) {
      return res.status(400).json({ error: "Nivel inválido" });
    }

    if (tipo && !TIPOS.includes(tipo)) {
      return res.status(400).json({ error: "Tipo inválido" });
    }

    const existing = await get("SELECT id_institucion AS id FROM institucion WHERE cue = ? AND nivel_educativo = ?", [cueNormalized, nivel || null]);
    if (existing) {
      return res.status(409).json({ error: "Ya existe una institución con ese CUE y nivel educativo" });
    }

    const matriculadosNum = parseInt(matriculados, 10) || 0;
    const factor = calcularFactorAsignacion(matriculadosNum);

    const result = await run(`
      INSERT INTO institucion (
        cue, nombre, email, nivel, tipo, matriculados, factor_asignacion, notas
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      cueNormalized,
      nombre.trim(),
      email || null,
      nivel || null,
      tipo || "publica",
      matriculadosNum,
      factor,
      notas || null
    ]);

    // Auditoría
    await run(
      "INSERT INTO auditoria (usuario_id, entidad, accion, id_registro, cambios) VALUES (?, ?, ?, ?, ?)",
      [req.user.sub, "instituciones", "CREATE", result.lastID, JSON.stringify({ cue: cueNormalized, nombre, matriculados: matriculadosNum })]
    );

    return res.status(201).json({ 
      id: result.lastID,
      factor_asignacion: factor,
      message: "Institución creada correctamente"
    });
  } catch (err) {
    console.error(err);
    if (String(err.message).includes("UNIQUE")) {
      return res.status(409).json({ error: "Ya existe una institución con ese CUE" });
    }
    return res.status(500).json({ error: "No se pudo crear la institución" });
  }
});

// Actualizar institución
router.patch("/:id", authorizePermissions(PERMISSIONS.INSTITUCIONES_EDIT), async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      nombre, direccion, localidad, departamento,
      telefono, email, nivel, tipo, matriculados, notas, activo,
      limite_productos
    } = req.body;

    const institucion = await get("SELECT * FROM institucion WHERE id_institucion = ?", [id]);
    if (!institucion) {
      return res.status(404).json({ error: "Institución no encontrada" });
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
        return res.status(400).json({ error: "Nivel inválido" });
      }
      updates.push("nivel = ?");
      params.push(nivel);
      cambios.nivel = { antes: institucion.nivel, despues: nivel };
    }
    if (tipo !== undefined) {
      if (!TIPOS.includes(tipo)) {
        return res.status(400).json({ error: "Tipo inválido" });
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
      params.push(activo ? 1 : 0);
      cambios.activo = { antes: institucion.activo, despues: activo ? 1 : 0 };
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No hay campos para actualizar" });
    }

    updates.push("updated_at = NOW()");
    params.push(id);

    // Usar tabla institucion para UPDATE (no la vista)
    await run(`UPDATE institucion SET ${updates.join(", ")} WHERE id_institucion = ?`, params);

    // Auditoría
    await run(
      "INSERT INTO auditoria (usuario_id, entidad, accion, id_registro, cambios) VALUES (?, ?, ?, ?, ?)",
      [req.user.sub, "instituciones", "UPDATE", id, JSON.stringify(cambios)]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo actualizar la institución" });
  }
});

// Eliminar institución
router.delete("/:id", authorizePermissions(PERMISSIONS.INSTITUCIONES_DELETE), async (req, res) => {
  try {
    const { id } = req.params;

    const institucion = await get("SELECT * FROM institucion WHERE id_institucion = ?", [id]);
    if (!institucion) {
      return res.status(404).json({ error: "Institución no encontrada" });
    }

    // Eliminar asignaciones relacionadas  
    await run("DELETE FROM asignaciones_stock WHERE institucion_id = ?", [id]);
    
    // Usar tabla institucion para DELETE (no la vista)
    await run("DELETE FROM institucion WHERE id_institucion = ?", [id]);

    // Auditoría
    await run(
      "INSERT INTO auditoria (usuario_id, entidad, accion, id_registro, cambios) VALUES (?, ?, ?, ?, ?)",
      [req.user.sub, "instituciones", "DELETE", id, JSON.stringify({ institucion })]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo eliminar la institución" });
  }
});

// === ASIGNACIONES DE STOCK ===

// Obtener asignaciones de una institución
router.get("/:id/asignaciones", authorizePermissions(PERMISSIONS.INSTITUCIONES_VIEW), async (req, res) => {
  try {
    const { id } = req.params;
    const { periodo } = req.query;

    let sql = `
      SELECT 
        a.id, a.producto_id, p.nombre as producto_nombre, p.codigo as producto_codigo,
        p.tipo as producto_tipo, a.cantidad_asignada, a.cantidad_entregada, 
        (a.cantidad_asignada - a.cantidad_entregada) as pendiente,
        a.periodo, a.created_at
      FROM asignaciones_stock a
      JOIN productos p ON a.producto_id = p.id
      WHERE a.institucion_id = ?
    `;
    const params = [id];

    if (periodo) {
      sql += " AND a.periodo = ?";
      params.push(periodo);
    }

    sql += " ORDER BY a.periodo DESC, p.tipo, p.nombre";

    const asignaciones = await all(sql, params);
    return res.json({ asignaciones });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo obtener asignaciones" });
  }
});

// Asignar stock a institución
router.post("/:id/asignar", authorizePermissions(PERMISSIONS.INSTITUCIONES_ASIGNAR), async (req, res) => {
  try {
    const { id } = req.params;
    const { producto_id, cantidad, periodo } = req.body;

    if (!producto_id || !cantidad || !periodo) {
      return res.status(400).json({ error: "producto_id, cantidad y periodo son obligatorios" });
    }

    const institucion = await get("SELECT * FROM institucion WHERE id_institucion = ?", [id]);
    if (!institucion) {
      return res.status(404).json({ error: "Institución no encontrada" });
    }

    const producto = await get("SELECT * FROM productos WHERE id = ?", [producto_id]);
    if (!producto) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    // Calcular cantidad según matrícula si no se especifica
    const cantidadFinal = cantidad === "auto" 
      ? calcularCantidadAsignada(institucion.matriculados)
      : parseInt(cantidad, 10);

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

    return res.json({ 
      ok: true, 
      cantidad_asignada: cantidadFinal,
      message: `Asignados ${cantidadFinal} unidades de ${producto.nombre}`
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo asignar stock" });
  }
});

// Asignación masiva a todas las instituciones
router.post("/asignar-masivo", authorizePermissions(PERMISSIONS.INSTITUCIONES_ASIGNAR), async (req, res) => {
  try {
    const { producto_id, cantidad_base, periodo } = req.body;

    if (!producto_id || !cantidad_base || !periodo) {
      return res.status(400).json({ error: "producto_id, cantidad_base y periodo son obligatorios" });
    }

    const producto = await get("SELECT * FROM productos WHERE id = ?", [producto_id]);
    if (!producto) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    const instituciones = await all("SELECT id_institucion AS id, nombre, matriculados FROM institucion WHERE activo = TRUE");
    
    let asignados = 0;
    let totalUnidades = 0;

    for (const inst of instituciones) {
      const cantidad = calcularCantidadAsignada(inst.matriculados, parseInt(cantidad_base, 10));
      
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
      [req.user.sub, "asignaciones_stock", "ASIGNACION_MASIVA", producto_id, 
       JSON.stringify({ producto: producto.nombre, periodo, instituciones: asignados, total_unidades: totalUnidades })]
    );

    return res.json({ 
      ok: true,
      instituciones_asignadas: asignados,
      total_unidades: totalUnidades,
      message: `Stock asignado a ${asignados} instituciones (${totalUnidades} unidades totales)`
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo realizar asignación masiva" });
  }
});

// Registrar entrega de stock
router.post("/:id/entregar", authorizePermissions(PERMISSIONS.INSTITUCIONES_ASIGNAR), async (req, res) => {
  try {
    const { id } = req.params;
    const { asignacion_id, cantidad } = req.body;

    if (!asignacion_id || !cantidad) {
      return res.status(400).json({ error: "asignacion_id y cantidad son obligatorios" });
    }

    const asignacion = await get(`
      SELECT a.*, i.nombre as institucion_nombre, i.cue, p.nombre as producto_nombre, p.stock_actual
      FROM asignaciones_stock a
      JOIN instituciones i ON a.institucion_id = i.id
      JOIN productos p ON a.producto_id = p.id
      WHERE a.id = ? AND a.institucion_id = ?
    `, [asignacion_id, id]);

    if (!asignacion) {
      return res.status(404).json({ error: "Asignación no encontrada" });
    }

    const cantidadNum = parseInt(cantidad, 10);
    const pendiente = asignacion.cantidad_asignada - asignacion.cantidad_entregada;

    if (cantidadNum > pendiente) {
      return res.status(400).json({ error: `Solo hay ${pendiente} unidades pendientes de entregar` });
    }

    if (cantidadNum > asignacion.stock_actual) {
      return res.status(400).json({ error: `Stock insuficiente. Disponible: ${asignacion.stock_actual}` });
    }

    // Actualizar asignación
    await run(
      "UPDATE asignaciones_stock SET cantidad_entregada = cantidad_entregada + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [cantidadNum, asignacion_id]
    );

    // Registrar movimiento de salida
    await run(`
      INSERT INTO movimientos (producto_id, tipo, cantidad, usuario_id, motivo, cue)
      VALUES (?, 'salida', ?, ?, ?, ?)
    `, [asignacion.producto_id, cantidadNum, req.user.sub, 
        `Entrega a ${asignacion.institucion_nombre} - Periodo ${asignacion.periodo}`, asignacion.cue]);

    // Actualizar stock del producto
    await run(
      "UPDATE productos SET stock_actual = stock_actual - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [cantidadNum, asignacion.producto_id]
    );

    return res.json({ 
      ok: true,
      message: `Entregadas ${cantidadNum} unidades de ${asignacion.producto_nombre} a ${asignacion.institucion_nombre}`
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo registrar la entrega" });
  }
});

// Resumen de asignaciones por periodo
router.get("/resumen/:periodo", authorizePermissions(PERMISSIONS.INSTITUCIONES_VIEW), async (req, res) => {
  try {
    const { periodo } = req.params;

    const resumen = await all(`
      SELECT 
        p.id as producto_id,
        p.codigo,
        p.nombre as producto,
        p.tipo,
        p.stock_actual,
        SUM(a.cantidad_asignada) as total_asignado,
        SUM(a.cantidad_entregada) as total_entregado,
        SUM(a.cantidad_asignada - a.cantidad_entregada) as total_pendiente,
        COUNT(DISTINCT a.institucion_id) as instituciones
      FROM productos p
      LEFT JOIN asignaciones_stock a ON p.id = a.producto_id AND a.periodo = ?
      GROUP BY p.id
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

    return res.json({ periodo, resumen, instituciones });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "No se pudo obtener resumen" });
  }
});

module.exports = router;
