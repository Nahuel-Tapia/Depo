require('dotenv').config()
const { get, all, run } = require('../backend/src/db.pg')
const pedidoService = require('../backend/src/services/pedidoService')

async function debug() {
  try {
    let inst = await get("SELECT id_institucion FROM institucion LIMIT 1")
    if (!inst) {
      console.log('Creando institución de prueba...')
      const instRes = await run("INSERT INTO institucion (nombre, cue, tipo_escuela, departamento) VALUES ('Escuela Test 1', '700000001', 'normal', 'Capital')")
      inst = { id_institucion: instRes.lastID }
    }
    console.log('Institución usada:', inst)

    let user = await get("SELECT id_usuario, role FROM usuario WHERE id_usuario = 1")
    if (user) {
      await run("UPDATE usuario SET id_institucion = ? WHERE id_usuario = ?", [inst.id_institucion, user.id_usuario])
    }
    console.log('Usuario usado:', user)

    // Ensure a test product exists
    let prod = await get("SELECT id_producto FROM producto LIMIT 1")
    if (!prod) {
      console.log('Creando producto de prueba...')
      const pRes = await run("INSERT INTO producto (nombre, unidad_medida, stock_actual) VALUES ('Producto Test', 'unidad', 100)")
      prod = { id_producto: pRes.lastID }
    }
    console.log('Producto usado:', prod)

    // Ensure a kit_producto_anual rule exists for normal school type
    let kitRule = await get("SELECT * FROM kit_producto_anual WHERE tipo_escuela = 'normal' AND id_producto = ?", [prod.id_producto])
    if (!kitRule) {
      console.log('Creando regla de kit anual de prueba...')
      await run("INSERT INTO kit_producto_anual (tipo_escuela, id_producto, cantidad_base, alumnos_por_unidad, cantidad_por_unidad, activo) VALUES ('normal', ?, 10, 0, 0, true)", [prod.id_producto])
    }

    console.log('\n--- PROBANDO createPedido con producto_id ---')
    try {
      const res = await pedidoService.createPedido({
        producto_id: prod.id_producto,
        cantidad: 2,
        tipo: 'anual',
        notas: 'Prueba de creación'
      }, { sub: user.id_usuario, role: 'directivo' })
      console.log('✅ EXITO createPedido:', res)
    } catch (err) {
      console.error('❌ ERROR CAPTURADO EN createPedido:', err)
    }

  } catch (err) {
    console.error('❌ ERROR GRAVE EN DEBUG:', err)
  }
}

debug()
