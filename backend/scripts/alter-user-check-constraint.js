require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const { Pool } = require('pg')
const dbConfig = require('../src/config/database')

const pool = new Pool(dbConfig)

async function alterUserConstraint() {
  const client = await pool.connect()
  try {
    console.log('Modificando la restricción de roles de usuario...')

    // 1. Eliminar la restricción CHECK obsoleta si existe
    await client.query(`
      ALTER TABLE usuario 
      DROP CONSTRAINT IF EXISTS usuario_role_check;
    `)
    console.log('Restricción vieja eliminada.')

    // 2. Agregar la nueva restricción CHECK actualizada con todos los roles
    await client.query(`
      ALTER TABLE usuario
      ADD CONSTRAINT usuario_role_check CHECK (
        role IN (
          'admin', 
          'master', 
          'directivo', 
          'director_area', 
          'supervisor', 
          'operador', 
          'operador_escolar', 
          'control_ministerio', 
          'area_compras', 
          'secretario_administrativo', 
          'ministro_financiero', 
          'consulta'
        )
      );
    `)
    
    console.log('✅ Restricción usuario_role_check actualizada exitosamente en la base de datos!')
  } catch (err) {
    console.error('❌ Error alterando la tabla usuario:', err.message || err)
  } finally {
    client.release()
    await pool.end()
  }
}

alterUserConstraint()
