// Directly trace the POST /solicitudes handler step by step
process.chdir(__dirname + '/../backend');
require('dotenv').config();

const { pool, get, all, run } = require('../backend/src/db.pg');

function parsePositiveInt(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function normalizeRetiraTipo(value) {
  return String(value || '').trim().toLowerCase() === 'otro' ? 'otro' : 'directivo';
}

async function getRetiroAvailabilityRows(institucionId = null) {
  const params = [];
  let institucionSql = '';
  if (institucionId) {
    params.push(institucionId);
    institucionSql = `AND p.id_institucion = $${params.length}`;
  }
  return all(`
    SELECT
      p.id_pedido AS id_pedido,
      p.id_institucion,
      i.nombre AS institucion_nombre,
      i.cue,
      u.nombre AS solicitante_nombre,
      p.fecha_creacion,
      dp.id_producto,
      pr.nombre AS producto_nombre,
      pr.unidad_medida,
      COALESCE(pr.stock_actual, 0) AS stock_actual,
      dp.cantidad_solicitada,
      COALESCE(ent.total_entregado, 0) AS cantidad_entregada,
      COALESCE(res.total_reservado, 0) AS cantidad_reservada
    FROM pedido p
    JOIN institucion i ON i.id_institucion = p.id_institucion
    JOIN usuario u ON u.id_usuario = p.id_usuario_solicitante
    JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
    JOIN producto pr ON pr.id_producto = dp.id_producto
    LEFT JOIN (
      SELECT id_pedido, id_producto, SUM(cantidad_entregada) AS total_entregado
      FROM pedido_entrega
      GROUP BY id_pedido, id_producto
    ) ent ON ent.id_pedido = p.id_pedido AND ent.id_producto = dp.id_producto
    LEFT JOIN (
      SELECT sr.id_pedido, srd.id_producto, SUM(srd.cantidad_solicitada) AS total_reservado
      FROM solicitud_retiro sr
      JOIN solicitud_retiro_detalle srd ON srd.id_solicitud_retiro = sr.id
      WHERE sr.estado IN ('pendiente', 'aceptada')
      GROUP BY sr.id_pedido, srd.id_producto
    ) res ON res.id_pedido = p.id_pedido AND res.id_producto = dp.id_producto
    WHERE p.estado = 'aprobado'
      AND p.aprobado_director_area = TRUE
      AND COALESCE(p.tipo, 'anual') = 'anual'
      ${institucionSql}
    ORDER BY p.fecha_creacion DESC, pr.nombre ASC
  `, params);
}

function groupRetiroAvailability(rows = []) {
  const grouped = new Map();
  for (const row of rows) {
    const pedidoId = Number(row.id_pedido);
    if (!grouped.has(pedidoId)) {
      grouped.set(pedidoId, {
        id: pedidoId,
        id_institucion: Number(row.id_institucion),
        institucion_nombre: row.institucion_nombre,
        cue: row.cue || null,
        solicitante_nombre: row.solicitante_nombre,
        fecha_creacion: row.fecha_creacion,
        items: []
      });
    }
    const solicitado = Number(row.cantidad_solicitada || 0);
    const entregado = Number(row.cantidad_entregada || 0);
    const reservado = Number(row.cantidad_reservada || 0);
    const disponibleKit = Math.max(0, solicitado - entregado - reservado);
    const stockActual = Number(row.stock_actual || 0);
    grouped.get(pedidoId).items.push({
      producto_id: Number(row.id_producto),
      producto_nombre: row.producto_nombre,
      unidad_medida: row.unidad_medida || 'unidad',
      cantidad_solicitada: solicitado,
      cantidad_entregada: entregado,
      cantidad_reservada: reservado,
      cantidad_disponible_kit: disponibleKit,
      stock_actual: stockActual,
      cantidad_disponible: Math.min(disponibleKit, stockActual)
    });
  }
  return Array.from(grouped.values())
    .map(pedido => ({
      ...pedido,
      items: pedido.items.filter(item => item.cantidad_disponible_kit > 0)
    }))
    .filter(pedido => pedido.items.length > 0);
}

(async () => {
  try {
    const req = {
      user: { sub: 21, role: 'directivo' },
      body: {
        id_pedido: 3,
        fecha_retiro: '2026-05-20',
        retira_tipo: 'directivo',
        retira_nombre: null,
        retira_dni: null,
        observaciones: null,
        items: [{ producto_id: 3, cantidad: 1 }]
      }
    };

    // Step 1: role check
    if (req.user.role !== 'directivo') throw new Error('role check failed');
    console.log('Step 1: role check OK');

    // Step 2: extract and validate body
    const { id_pedido, fecha_retiro, retira_tipo, retira_nombre, retira_dni, observaciones, items } = req.body;
    const pedidoId = parsePositiveInt(id_pedido);
    const tipoRetira = normalizeRetiraTipo(retira_tipo);
    const fechaRetiro = String(fecha_retiro || '').trim();
    console.log('Step 2: pedidoId=', pedidoId, 'fechaRetiro=', fechaRetiro, 'tipoRetira=', tipoRetira);

    if (!pedidoId || !fechaRetiro || !Array.isArray(items) || items.length === 0)
      throw new Error('missing required fields');
    console.log('Step 2: validation OK');

    // Step 3: get usuario
    const usuario = await get('SELECT id_institucion, nombre FROM usuario WHERE id_usuario = ?', [req.user.sub]);
    console.log('Step 3: usuario=', usuario);
    if (!usuario?.id_institucion) throw new Error('no institution');

    // Step 4: get pedido
    const pedido = await get(`
      SELECT id_pedido, id_institucion FROM pedido
      WHERE id_pedido = ?
        AND id_institucion = ?
        AND estado = 'aprobado'
        AND aprobado_director_area = TRUE
        AND COALESCE(tipo, 'anual') = 'anual'
    `, [pedidoId, usuario.id_institucion]);
    console.log('Step 4: pedido=', pedido);
    if (!pedido) throw new Error('pedido not found');

    // Step 5: parsed items
    const parsedItems = items.map(item => ({
      producto_id: parsePositiveInt(item?.producto_id),
      cantidad: parsePositiveInt(item?.cantidad)
    }));
    console.log('Step 5: parsedItems=', parsedItems);

    // Step 6: availability check
    const availableRows = await getRetiroAvailabilityRows(usuario.id_institucion);
    const available = groupRetiroAvailability(availableRows);
    console.log('Step 6: available pedidos:', available.map(p => ({ id: p.id, items: p.items.length })));
    const pedidoDisponible = available.find(p => p.id === pedidoId);
    console.log('Step 6: pedidoDisponible=', pedidoDisponible ? 'FOUND' : 'NOT FOUND');
    if (!pedidoDisponible) throw new Error('pedido not available');

    const availableByProduct = new Map(pedidoDisponible.items.map(item => [item.producto_id, item]));
    for (const item of parsedItems) {
      const disponible = availableByProduct.get(item.producto_id);
      console.log(`Step 6: item ${item.producto_id} -> disponible:`, disponible);
    }

    // Step 7: insert
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      console.log('Step 7: BEGIN OK');

      const nombreRetira = tipoRetira === 'otro' ? String(retira_nombre || '').trim() : null;
      const dniRetira = tipoRetira === 'otro' ? String(retira_dni || '').trim() : null;

      const solicitudResult = await client.query(`
        INSERT INTO solicitud_retiro
          (id_pedido, id_institucion, id_usuario_solicitante, fecha_retiro, retira_tipo, retira_nombre, retira_dni, observaciones)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [
        pedidoId,
        usuario.id_institucion,
        req.user.sub,
        fechaRetiro,
        tipoRetira,
        nombreRetira,
        dniRetira,
        String(observaciones || '').trim() || null
      ]);
      const solicitudId = solicitudResult.rows[0].id;
      console.log('Step 7: inserted solicitud_retiro id=', solicitudId);

      for (const item of parsedItems) {
        await client.query(`
          INSERT INTO solicitud_retiro_detalle (id_solicitud_retiro, id_producto, cantidad_solicitada)
          VALUES ($1, $2, $3)
        `, [solicitudId, item.producto_id, item.cantidad]);
        console.log('Step 7: inserted detail for producto', item.producto_id);
      }

      await client.query('ROLLBACK');
      console.log('Step 7: ROLLBACK (test only) OK');
    } finally {
      client.release();
    }

    console.log('ALL STEPS PASSED');
  } catch (e) {
    console.error('FAILED AT:', e.message);
    console.error(e.stack);
  } finally {
    await pool.end();
  }
})();
