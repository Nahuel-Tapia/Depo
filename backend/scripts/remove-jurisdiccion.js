require('dotenv').config()
const { run } = require('../src/db.pg')

async function main() {
  console.log('Eliminando columna jurisdiccion de la base de datos PostgreSQL...')
  try {
    await run('ALTER TABLE usuario DROP COLUMN IF EXISTS jurisdiccion;')
    console.log('✅ Columna jurisdiccion eliminada de la tabla usuario.')
  } catch (err) {
    console.error('Error al eliminar de usuario:', err.message)
  }

  try {
    await run('ALTER TABLE institucion DROP COLUMN IF EXISTS jurisdiccion;')
    console.log('✅ Columna jurisdiccion eliminada de la tabla institucion (si existía).')
  } catch (err) {
    console.error('Error al eliminar de institucion:', err.message)
  }

  console.log('Operación completada exitosamente.')
  process.exit(0)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
