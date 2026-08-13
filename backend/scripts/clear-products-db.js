require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const { Pool } = require('pg')
const dbConfig = require('../src/config/database')

const pool = new Pool(dbConfig)

async function clearProductsDB() {
  const client = await pool.connect()
  try {
    console.log('Limpiando base de datos de productos y relaciones...')
    await client.query('BEGIN')

    // Desvincular referencias
    const tableExists = async (table) => {
      const res = await client.query(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)",
        [table]
      )
      return res.rows[0].exists
    }

    if (await tableExists('institucion')) {
      await client.query('UPDATE institucion SET kit_id = NULL WHERE kit_id IS NOT NULL')
    }

    const tablesToDelete = [
      'despacho_productos',
      'bajas_inspeccion',
      'bajas',
      'pedido_entrega_detalle',
      'pedido_entrega',
      'solicitud_retiro_detalle',
      'solicitud_retiro',
      'planilla_pedido_anual_detalle',
      'detalle_pedido',
      'detalle_orden',
      'detalle_ingreso',
      'movimiento_stock',
      'movimientos',
      'ajustes',
      'asignaciones_stock',
      'limite_stock',
      'stock_deposito',
      'compra_precio_historico',
      'entrega_anual',
      'kit_producto_anual',
      'producto_kit_detalle',
      'producto_kit',
      'pedidos',
      'licitacion_items',
      'licitacion_adjudicacion_items',
      'licitacion_remito_items',
      'licitaciones'
    ]

    const existingTables = []
    for (const table of tablesToDelete) {
      if (await tableExists(table)) {
        existingTables.push(table)
      }
    }
    if (await tableExists('producto')) {
      existingTables.push('producto')
    }

    if (existingTables.length > 0) {
      console.log(`- Truncando tablas: ${existingTables.join(', ')}...`)
      await client.query(`TRUNCATE TABLE ${existingTables.join(', ')} RESTART IDENTITY CASCADE`)
    }

    await client.query('COMMIT')
    console.log('✅ Base de datos de productos limpiada con éxito!')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('Error limpiando base de datos de productos:', err)
  } finally {
    client.release()
    await pool.end()
  }
}

clearProductsDB()
