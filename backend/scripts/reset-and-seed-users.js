require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') })
const { Pool } = require('pg')
const bcrypt = require('bcryptjs')
const dbConfig = require('../src/config/database')

const pool = new Pool(dbConfig)

const USERS_TO_CREATE = [
  {
    nombre: 'Director',
    apellido: 'Area',
    dni: '90000001',
    email: 'direc@gmail.com',
    role: 'director_area'
  },
  {
    nombre: 'Supervisor',
    apellido: 'Uno',
    dni: '90000002',
    email: 'sup1@gmail.com',
    role: 'supervisor'
  },
  {
    nombre: 'Supervisor',
    apellido: 'Dos',
    dni: '90000003',
    email: 'sup2@gmail.com',
    role: 'supervisor'
  },
  {
    nombre: 'Supervisor',
    apellido: 'Tres',
    dni: '90000004',
    email: 'sup3@gmail.com',
    role: 'supervisor'
  },
  {
    nombre: 'Supervisor',
    apellido: 'Cuatro',
    dni: '90000005',
    email: 'sup4@gmail.com',
    role: 'supervisor'
  },
  {
    nombre: 'Supervisor',
    apellido: 'Cinco',
    dni: '90000006',
    email: 'sup5@gmail.com',
    role: 'supervisor'
  },
  {
    nombre: 'Supervisor',
    apellido: 'Seis',
    dni: '90000007',
    email: 'sup6@gmail.com',
    role: 'supervisor'
  }
]

async function ensureRoleConstraint(client) {
  const checks = await client.query(
    `SELECT conname, pg_get_constraintdef(c.oid) AS def
     FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public'
       AND t.relname = 'usuario'
       AND c.contype = 'c'
       AND pg_get_constraintdef(c.oid) ILIKE '%role%'`
  )

  for (const row of checks.rows) {
    await client.query(`ALTER TABLE usuario DROP CONSTRAINT IF EXISTS ${row.conname}`)
  }

  await client.query(`
    ALTER TABLE usuario
    ADD CONSTRAINT usuario_role_check
    CHECK (role IN ('admin', 'supervisor', 'director_area', 'directivo', 'operador', 'consulta', 'control_ministerio'))
  `)
}

async function deleteNonAdminUsers(client) {
  const keepRes = await client.query(
    `SELECT id_usuario
     FROM usuario
      WHERE role = 'admin' OR COALESCE(LOWER(email), '') = 'admin@depo.local'`
  )
  const keepIds = keepRes.rows.map(r => r.id_usuario)

  const deleteRes = await client.query(
    `SELECT id_usuario
     FROM usuario
      WHERE NOT (role = 'admin' OR COALESCE(LOWER(email), '') = 'admin@depo.local')`
  )
  const deleteIds = deleteRes.rows.map(r => r.id_usuario)

  if (deleteIds.length === 0) {
    console.log('No había usuarios no-admin para eliminar.')
    return { keepIds, deleted: 0 }
  }

  const fkRefs = await client.query(
    `SELECT tc.table_name, kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_schema = 'public'
       AND ccu.table_name = 'usuario'
       AND ccu.column_name = 'id_usuario'
       AND tc.table_name <> 'usuario'`
  )

  for (const ref of fkRefs.rows) {
    const tableName = ref.table_name
    const columnName = ref.column_name

    if (tableName === 'pedido') {
      await client.query(
        `DELETE FROM detalle_pedido
         WHERE id_pedido IN (
           SELECT id_pedido FROM pedido WHERE "${columnName}" = ANY($1::int[])
         )`,
        [deleteIds]
      )
    }

    const sql = `DELETE FROM "${tableName}" WHERE "${columnName}" = ANY($1::int[])`
    await client.query(sql, [deleteIds])
  }

  await client.query(`DELETE FROM usuario WHERE id_usuario = ANY($1::int[])`, [deleteIds])

  return { keepIds, deleted: deleteIds.length }
}

async function seedUsers(client) {
  const hash = await bcrypt.hash('111111', 10)

  for (const u of USERS_TO_CREATE) {
    await client.query(
      `INSERT INTO usuario (nombre, apellido, dni, email, password, telefono, id_institucion, role, activo, created_at)
       VALUES ($1, $2, $3, $4, $5, NULL, NULL, $6, TRUE, NOW())
       ON CONFLICT (email)
       DO UPDATE SET
         nombre = EXCLUDED.nombre,
         apellido = EXCLUDED.apellido,
         dni = EXCLUDED.dni,
         password = EXCLUDED.password,
         role = EXCLUDED.role,
         activo = TRUE`,
      [u.nombre, u.apellido, u.dni, u.email.toLowerCase(), hash, u.role]
    )
  }
}

async function main() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    await ensureRoleConstraint(client)
    const result = await deleteNonAdminUsers(client)
    await seedUsers(client)

    await client.query('COMMIT')

    const finalUsers = await pool.query(
      `SELECT id_usuario, nombre, apellido, email, role, activo
       FROM usuario
       ORDER BY id_usuario`
    )

    console.log('Usuarios no-admin eliminados:', result.deleted)
    console.log('Usuarios actuales:')
    for (const u of finalUsers.rows) {
      console.log(`- #${u.id_usuario} | ${u.nombre || ''} ${u.apellido || ''} | ${u.email || '-'} | ${u.role} | activo=${u.activo}`)
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((err) => {
  console.error('Error reseteando/creando usuarios:', err)
  process.exit(1)
})
