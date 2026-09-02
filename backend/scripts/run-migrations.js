require('dotenv').config()
const { initDb, closeDb } = require('../src/db.pg')
const { initDatabaseSchema } = require('../src/services/schemaManager')
const { ensureRbacSchemaAndSeed } = require('../src/services/rbac')

async function main() {
  console.log('--- Conectando a PostgreSQL (Supabase) ---')
  await initDb()

  console.log('--- Ejecutando ensureRbacSchemaAndSeed ---')
  // Force execution even if VERCEL env variable is set in local environment
  delete process.env.VERCEL
  await ensureRbacSchemaAndSeed()

  console.log('--- Ejecutando initDatabaseSchema ---')
  await initDatabaseSchema()

  console.log('✅ Migraciones y esquema verificados exitosamente en PostgreSQL Supabase.')
  await closeDb()
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Fatal error en migraciones:', err)
  process.exit(1)
})
