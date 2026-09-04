require('dotenv').config()
const { all } = require('../backend/src/db.pg')

async function main() {
  const tables = ['usuario', 'rol', 'producto', 'institucion', 'deposito', 'movimiento_stock', 'pedido', 'baja_stock']
  for (const t of tables) {
    try {
      const cols = await all(`SELECT column_name FROM information_schema.columns WHERE table_name = '${t}'`)
      console.log(`Tabla [${t}]:`, cols.map(c => c.column_name).join(', '))
    } catch (err) {
      console.error(`Tabla [${t}] error:`, err.message)
    }
  }
}

main()
