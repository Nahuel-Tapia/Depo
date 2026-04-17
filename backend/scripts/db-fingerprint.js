require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') })
const { Pool } = require('pg')
const cfg = require('../src/config/database')

const pool = new Pool(cfg)

const BASE_TABLES = [
  'usuario',
  'institucion',
  'producto',
  'pedido',
  'detalle_pedido',
  'movimiento_stock',
  'auditoria',
  'supervisor_escuela_asignacion',
  'solicitud_informe_supervisor'
]

async function tableExists(table) {
  const res = await pool.query(`SELECT to_regclass($1) AS t`, [`public.${table}`])
  return Boolean(res.rows[0]?.t)
}

async function getColumns(table) {
  const res = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table]
  )
  return res.rows.map(r => r.column_name)
}

async function getPrimaryKeyColumns(table) {
  const res = await pool.query(
    `SELECT a.attname AS col
     FROM pg_index i
     JOIN pg_class c ON c.oid = i.indrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     JOIN unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) ON TRUE
     JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
     WHERE n.nspname = 'public'
       AND c.relname = $1
       AND i.indisprimary
     ORDER BY k.ord`,
    [table]
  )
  return res.rows.map(r => r.col)
}

async function tableFingerprint(table) {
  const exists = await tableExists(table)
  if (!exists) {
    return { exists: false }
  }

  const columns = await getColumns(table)
  const pkCols = await getPrimaryKeyColumns(table)
  const orderCols = pkCols.length > 0 ? pkCols : columns

  const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM "${table}"`)
  const total = countRes.rows[0].total

  const orderedJsonExpr = `jsonb_build_object(${columns
    .map(c => `'${c}', "${c}"`)
    .join(', ')})`

  const checksumQuery = `
    SELECT md5(
      COALESCE(
        string_agg(
          (${orderedJsonExpr})::text,
          '||' ORDER BY ${orderCols.map(c => `"${c}"`).join(', ')}
        ),
        ''
      )
    ) AS checksum
    FROM "${table}"
  `

  const checksumRes = await pool.query(checksumQuery)
  return {
    exists: true,
    rows: total,
    checksum: checksumRes.rows[0].checksum
  }
}

;(async () => {
  try {
    const dbName = process.env.DB_NAME || cfg.database || 'depo_stock'
    const result = {
      database: dbName,
      generatedAt: new Date().toISOString(),
      tables: {}
    }

    for (const table of BASE_TABLES) {
      result.tables[table] = await tableFingerprint(table)
    }

    console.log(JSON.stringify(result, null, 2))
  } catch (err) {
    console.error('Error generando fingerprint:', err)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
})()
