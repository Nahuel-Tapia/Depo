require('dotenv').config()
const { get, all, run } = require('../backend/src/db.pg')
const pedidoService = require('../backend/src/services/pedidoService')

async function test() {
  try {
    const users = await all("SELECT id_usuario, email, role, id_institucion FROM usuario LIMIT 10")
    console.log('Usuarios en BD:', users)

    const inst = await get("SELECT id_institucion, tipo_escuela FROM institucion LIMIT 1")
    console.log('Institucion en BD:', inst)

    if (!users.length || !inst) {
      console.log('Faltan datos de usuario o institución')
      return
    }

    // Pick or update a user with id_institucion
    const testUser = users[0]
    await run("UPDATE usuario SET id_institucion = ? WHERE id_usuario = ?", [inst.id_institucion, testUser.id_usuario])
    console.log(`Asignada institución ${inst.id_institucion} a usuario ${testUser.id_usuario} (${testUser.role})`)

    const prod = await get("SELECT id_producto FROM producto LIMIT 1")
    console.log('Producto en BD:', prod)

    // Test creating a pedido for a kit or product
    const kits = await all("SELECT id FROM kit_escuela LIMIT 5")
    console.log('Kits en BD:', kits)

    const userObj = { sub: testUser.id_usuario, role: testUser.role }

    // Test kit creation if kit exists
    if (kits.length > 0) {
      console.log('--> Probando creación de pedido con Kit ID:', kits[0].id)
      try {
        const resKit = await pedidoService.createPedido({
          kit_id: kits[0].id,
          cantidad: 1,
          tipo: 'anual',
          notas: 'Prueba Kit'
        }, userObj)
        console.log('✅ Pedido por Kit creado exitosamente:', resKit)
      } catch (e) {
        console.error('❌ Error en Pedido por Kit:', e)
      }
    }

    // Test product creation
    if (prod) {
      console.log('--> Probando creación de pedido con Producto ID:', prod.id_producto)
      try {
        const resProd = await pedidoService.createPedido({
          producto_id: prod.id_producto,
          cantidad: 2,
          tipo: 'refuerzo',
          notas: 'Prueba Producto'
        }, userObj)
        console.log('✅ Pedido por Producto creado exitosamente:', resProd)
      } catch (e) {
        console.error('❌ Error en Pedido por Producto:', e)
      }
    }

  } catch (err) {
    console.error('❌ ERROR GENERAL:', err)
  }
}

test()
