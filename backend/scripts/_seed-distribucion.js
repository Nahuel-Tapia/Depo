/**
 * Script de datos de prueba para Distribución por Zonas.
 *
 * Crea:
 *  - Dos pedidos adjudicados (uno por institución) con productos
 *  - Una planilla_pedido_anual adjudicada 2026 para la zona CAPITAL (zona_id=20)
 *  - Detalle: 2 instituciones, 2 productos cada una
 *  - Sin entregas registradas => pendiente total
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const cfg = require('../src/config/database');
const { Pool } = require('pg');
const pool = new Pool(cfg);

const ZONA_ID = 20;
const ANIO = 2026;
const INSTITUCIONES = [1469, 1481];  // EUSEBIO SEGUNDO ZAPATA, GRANADEROS DE SAN MARTIN
const PRODUCTOS = [5, 6];            // "aaa", "aaaaa"

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Limpiar planillas de prueba previas (las que creamos, con observaciones específicas)
    const prev = await client.query(
      "SELECT id FROM planilla_pedido_anual WHERE estado='adjudicada' AND observaciones='Planilla de prueba distribución zonal'"
    );
    const prevIds = prev.rows.map(r => r.id);
    if (prevIds.length > 0) {
      await client.query('DELETE FROM planilla_pedido_anual_detalle WHERE planilla_id = ANY($1::int[])', [prevIds]);
      await client.query('DELETE FROM planilla_pedido_anual WHERE id = ANY($1::int[])', [prevIds]);
      console.log(`Planillas previas de prueba eliminadas (${prevIds.length})`);
    }

    // 2. Limpiar entregas previas
    await client.query(
      'DELETE FROM entrega_anual WHERE anio = $1 AND id_institucion = ANY($2::int[]) AND id_producto = ANY($3::int[])',
      [ANIO, INSTITUCIONES, PRODUCTOS]
    );

    // 3. Crear pedidos de prueba para cada institución (si no existen ya)
    const pedidoIdsPorInst = {};
    for (const instId of INSTITUCIONES) {
      // Buscar pedido de prueba existente para esta inst
      const existing = await client.query(
        "SELECT id_pedido FROM pedido WHERE id_institucion=$1 AND observaciones_generales='PRUEBA_DISTRIBUCION_ZONAL' LIMIT 1",
        [instId]
      );
      let pedidoId;
      if (existing.rows.length > 0) {
        pedidoId = existing.rows[0].id_pedido;
      } else {
        const r = await client.query(
          `INSERT INTO pedido (id_institucion, observaciones_generales, estado, fecha_creacion)
           VALUES ($1, 'PRUEBA_DISTRIBUCION_ZONAL', 'finalizado', NOW())
           RETURNING id_pedido`,
          [instId]
        );
        pedidoId = r.rows[0].id_pedido;
        // Agregar detalle_pedido para cada producto
        for (const prodId of PRODUCTOS) {
          const cant = prodId === 5 ? 4 : 3;
          await client.query(
            'INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad_solicitada) VALUES ($1, $2, $3)',
            [pedidoId, prodId, cant]
          );
        }
      }
      pedidoIdsPorInst[instId] = pedidoId;
      console.log(`  Pedido inst=${instId} id=${pedidoId}`);
    }

    // 4. Obtener director_area_id de la zona
    const zonaRow = await client.query('SELECT director_area_id FROM zona WHERE id = $1', [ZONA_ID]);
    const directorAreaId = zonaRow.rows[0]?.director_area_id || null;

    // 5. Crear planilla adjudicada
    const planilla = await client.query(
      `INSERT INTO planilla_pedido_anual (director_area_id, anio, estado, observaciones, created_at, aceptada_at)
       VALUES ($1, $2, 'adjudicada', 'Planilla de prueba distribución zonal', NOW(), NOW())
       RETURNING id`,
      [directorAreaId, ANIO]
    );
    const planillaId = planilla.rows[0].id;
    console.log(`Planilla adjudicada creada: id=${planillaId}`);

    // 6. Crear detalle
    for (const instId of INSTITUCIONES) {
      const pedidoId = pedidoIdsPorInst[instId];
      for (const prodId of PRODUCTOS) {
        const cant = prodId === 5 ? 4 : 3;
        await client.query(
          `INSERT INTO planilla_pedido_anual_detalle
             (planilla_id, id_pedido, id_institucion, id_producto, cantidad)
           VALUES ($1, $2, $3, $4, $5)`,
          [planillaId, pedidoId, instId, prodId, cant]
        );
        console.log(`  Detalle: inst=${instId} prod=${prodId} cant=${cant}`);
      }
    }

    await client.query('COMMIT');
    console.log('\n✅ Datos de prueba insertados correctamente.');
    console.log('\n=== RESUMEN DEL ESCENARIO ===');
    console.log('  Zona: CAPITAL (id=20)');
    console.log('  Institución 1: EUSEBIO SEGUNDO ZAPATA (id=1469)');
    console.log('  Institución 2: GRANADEROS DE SAN MARTIN (id=1481)');
    console.log('  Producto "aaa"   (id=5): 4 unidades por institución (stock en depósito Central: 10)');
    console.log('  Producto "aaaaa" (id=6): 3 unidades por institución (stock en Cápsula: 27)');
    console.log('  Total a distribuir: 8 "aaa" + 6 "aaaaa"');
    console.log('  Entregas registradas: ninguna → todo pendiente');
    console.log('\n➡️  Recargá "Distribución a Escuelas" → debería aparecer la zona CAPITAL.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error:', e.message);
    console.error(e.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
