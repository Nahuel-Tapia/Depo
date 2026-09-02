require('dotenv').config()
const { all } = require('../backend/src/db.pg')

async function main() {
  console.log('=== INSPECCIONANDO USUARIOS Y SUS INSTITUCIONES EN SUPABASE ===')
  const users = await all(`
    SELECT u.id_usuario, u.nombre, u.apellido, u.email, u.role, u.id_institucion, u.nivel_educativo,
           i.nombre AS institucion_nombre, i.tipo_escuela
    FROM usuario u
    LEFT JOIN institucion i ON i.id_institucion = u.id_institucion
    ORDER BY u.id_usuario
  `)
  console.log('Usuarios encontrados (total', users.length, '):')
  console.dir(users, { depth: null })

  console.log('\n=== INSPECCIONANDO INSTITUCIONES ===')
  const insts = await all('SELECT id_institucion, nombre, cue, tipo_escuela, departamento FROM institucion ORDER BY id_institucion')
  console.log('Instituciones encontradas (total', insts.length, '):')
  console.dir(insts, { depth: null })

  console.log('\n=== INSPECCIONANDO ULTIMOS PEDIDOS EN SUPABASE ===')
  const pedidos = await all('SELECT id_pedido, id_usuario_solicitante, id_institucion, tipo, estado, observaciones_generales, fecha_creacion FROM pedido ORDER BY id_pedido DESC LIMIT 10')
  console.log('Pedidos recientes:', pedidos)

  process.exit(0)
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
