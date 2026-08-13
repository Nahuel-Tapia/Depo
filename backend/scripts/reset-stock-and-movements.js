require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const { Pool } = require('pg')
const dbConfig = require('../src/config/database')

const pool = new Pool(dbConfig)

async function resetStockAndMovements() {
  const client = await pool.connect()
  try {
    console.log('Iniciando limpieza de movimientos y reset de stock...')
    await client.query('BEGIN')

    // 1. Vaciar tablas de movimientos y stock distribuido
    console.log('Vaciando tablas transaccionales de stock...')
    await client.query(`
      TRUNCATE 
        movimiento_stock, 
        stock_deposito, 
        baja_status_history, 
        baja_movimientos, 
        consumo_institucion, 
        pedido_entrega, 
        entrega_anual, 
        recepcion_licitacion, 
        remito_licitacion
      CASCADE;
    `)

    // 2. Resetear el stock general del catálogo de productos
    console.log('Reseteando stock general de productos a 0...')
    await client.query(`
      UPDATE producto 
      SET stock_actual = 0;
    `)

    await client.query('COMMIT')
    console.log('✅ Stock reseteado y movimientos limpiados con éxito!')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('❌ Error ejecutando la limpieza de stock:', err)
  } finally {
    client.release()
    await pool.end()
  }
}

resetStockAndMovements()
