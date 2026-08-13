require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const { Pool } = require('pg')
const dbConfig = require('../src/config/database')

const pool = new Pool(dbConfig)

async function alterProductoExtendedFields() {
  const client = await pool.connect()
  try {
    console.log('Añadiendo nuevos campos a la tabla producto...')

    await client.query(`
      ALTER TABLE producto
      ADD COLUMN IF NOT EXISTS codigo_sku VARCHAR(100),
      ADD COLUMN IF NOT EXISTS marca VARCHAR(100),
      ADD COLUMN IF NOT EXISTS precio_unitario NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS ubicacion_estante VARCHAR(100),
      ADD COLUMN IF NOT EXISTS descripcion TEXT,
      ADD COLUMN IF NOT EXISTS es_perecedero BOOLEAN DEFAULT FALSE
    `)

    console.log('✅ Campos añadidos exitosamente a la tabla producto!')
  } catch (err) {
    console.error('Error modificando la tabla producto:', err)
  } finally {
    client.release()
    await pool.end()
  }
}

alterProductoExtendedFields()
