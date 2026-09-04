require('dotenv').config()
const { all } = require('../backend/src/db.pg')

async function main() {
  const cols = await all(`
    SELECT column_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'pedido'
  `)
  console.log('Columnas de pedido:', cols)
  process.exit(0)
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
