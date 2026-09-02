require('dotenv').config()
const { get, all } = require('../backend/src/db.pg')

async function checkSequences() {
  try {
    const pedidoMax = await get("SELECT MAX(id_pedido) as max_id FROM pedido")
    const seqValue = await get("SELECT last_value FROM pedido_id_pedido_seq").catch(() => null)
    console.log('Tabla pedido max id_pedido:', pedidoMax?.max_id)
    console.log('Secuencia pedido_id_pedido_seq last_value:', seqValue?.last_value)

    const detalleMax = await get("SELECT MAX(id_detalle_pedido) as max_id FROM detalle_pedido")
    const detalleSeqValue = await get("SELECT last_value FROM detalle_pedido_id_detalle_pedido_seq").catch(() => null)
    console.log('Tabla detalle_pedido max id_detalle_pedido:', detalleMax?.max_id)
    console.log('Secuencia detalle_pedido_id_detalle_pedido_seq last_value:', detalleSeqValue?.last_value)

    const userMax = await get("SELECT MAX(id_usuario) as max_id FROM usuario")
    const userSeqValue = await get("SELECT last_value FROM usuario_id_usuario_seq").catch(() => null)
    console.log('Tabla usuario max id_usuario:', userMax?.max_id)
    console.log('Secuencia usuario_id_usuario_seq last_value:', userSeqValue?.last_value)
  } catch (err) {
    console.error('Error al consultar secuencias:', err)
  }
}

checkSequences().then(() => process.exit(0))
