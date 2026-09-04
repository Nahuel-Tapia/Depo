require('dotenv').config()
const { get } = require('../backend/src/db.pg')

async function testNextVal() {
  const nextVal = await get("SELECT nextval('pedido_id_pedido_seq') as val")
  console.log('Siguiente valor de pedido_id_pedido_seq:', nextVal?.val)
}

testNextVal().then(() => process.exit(0))
