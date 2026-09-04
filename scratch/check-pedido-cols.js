require('dotenv').config()
const { all } = require('../backend/src/db.pg')

async function main() {
  try {
    const cols = await all("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'pedido'")
    console.log('Columnas de pedido:', cols)

    const colsDetalle = await all("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'detalle_pedido'")
    console.log('Columnas de detalle_pedido:', colsDetalle)
  } catch (err) {
    console.error('Error:', err)
  }
}

main()
