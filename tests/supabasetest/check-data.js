/**
 * check-data.js
 *
 * Chequeos de DATOS sobre la base real de Supabase (no toca nada, solo lee):
 *
 *  1. Conteo de filas por tabla.
 *  2. Integridad referencial: para cada FK detectada en el esquema, busca
 *     filas "huérfanas" (valor no nulo que no existe en la tabla referenciada).
 *  3. (Opcional) Valores permitidos por columna: si le pasás un config con,
 *     por ejemplo, los estados válidos del state machine de DEPO
 *     (borrador, metodologia_cargada, escuelas_cargadas, validado,
 *     sede_confirmada, ejecutado), reporta filas con valores fuera de esa lista.
 *
 * Uso:
 *   DATABASE_URL="postgresql://user:pass@host:5432/postgres" \
 *   node check-data.js [--config ./data-checks.json]
 *
 * Formato de data-checks.json (opcional, ver data-checks.example.json):
 * {
 *   "allowedValues": [
 *     { "table": "solicitudes", "column": "estado",
 *       "values": ["borrador","metodologia_cargada","escuelas_cargadas","validado","sede_confirmada","ejecutado"] }
 *   ]
 * }
 */

require('dotenv').config();
const fs = require('fs');
const { Client } = require('pg');

const LIVE_SCHEMA = process.env.LIVE_SCHEMA || 'public';

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { config: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config') out.config = args[++i];
  }
  return out;
}

async function getTables(client) {
  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = $1 AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
    [LIVE_SCHEMA]
  );
  return rows.map((r) => r.table_name);
}

async function getForeignKeys(client) {
  const { rows } = await client.query(
    `SELECT
       tc.table_name AS child_table,
       kcu.column_name AS child_column,
       ccu.table_name AS parent_table,
       ccu.column_name AS parent_column
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = $1`,
    [LIVE_SCHEMA]
  );
  return rows;
}

async function countRows(client, table) {
  const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM "${LIVE_SCHEMA}"."${table}"`);
  return rows[0].n;
}

async function findOrphans(client, fk) {
  const sql = `
    SELECT COUNT(*)::int AS n
    FROM "${LIVE_SCHEMA}"."${fk.child_table}" c
    WHERE c."${fk.child_column}" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "${LIVE_SCHEMA}"."${fk.parent_table}" p
        WHERE p."${fk.parent_column}" = c."${fk.child_column}"
      )`;
  const { rows } = await client.query(sql);
  return rows[0].n;
}

async function findDisallowedValues(client, check) {
  const placeholders = check.values.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `
    SELECT "${check.column}" AS value, COUNT(*)::int AS n
    FROM "${LIVE_SCHEMA}"."${check.table}"
    WHERE "${check.column}" IS NOT NULL
      AND "${check.column}"::text NOT IN (${placeholders})
    GROUP BY "${check.column}"`;
  const { rows } = await client.query(sql, check.values);
  return rows;
}

async function main() {
  const { config } = parseArgs();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Falta DATABASE_URL en el entorno (.env o variable de entorno).');
    process.exit(1);
  }

  let dataChecks = { allowedValues: [] };
  if (config) {
    if (!fs.existsSync(config)) {
      console.error(`No existe el archivo de config: ${config}`);
      process.exit(1);
    }
    dataChecks = JSON.parse(fs.readFileSync(config, 'utf8'));
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  let hasIssues = false;

  try {
    const tables = await getTables(client);
    console.log(`=== CONTEO DE FILAS (schema "${LIVE_SCHEMA}") ===\n`);
    for (const t of tables) {
      const n = await countRows(client, t);
      console.log(`  ${t.padEnd(35, ' ')} ${n}`);
    }

    console.log(`\n=== INTEGRIDAD REFERENCIAL (FKs huérfanas) ===\n`);
    const fks = await getForeignKeys(client);
    if (fks.length === 0) {
      console.log('  No se detectaron foreign keys en el esquema.');
    }
    for (const fk of fks) {
      const orphans = await findOrphans(client, fk);
      const label = `${fk.child_table}.${fk.child_column} -> ${fk.parent_table}.${fk.parent_column}`;
      if (orphans > 0) {
        hasIssues = true;
        console.log(`  ❌ ${label}: ${orphans} fila(s) huérfana(s)`);
      } else {
        console.log(`  ✅ ${label}: OK`);
      }
    }

    if (dataChecks.allowedValues && dataChecks.allowedValues.length) {
      console.log(`\n=== VALORES PERMITIDOS (config) ===\n`);
      for (const check of dataChecks.allowedValues) {
        const bad = await findDisallowedValues(client, check);
        const label = `${check.table}.${check.column}`;
        if (bad.length === 0) {
          console.log(`  ✅ ${label}: todos los valores dentro de lo esperado`);
        } else {
          hasIssues = true;
          console.log(`  ❌ ${label}: valores fuera de lo esperado:`);
          bad.forEach((b) => console.log(`      "${b.value}" (${b.n} fila(s))`));
        }
      }
    }

    console.log('');
    console.log(hasIssues ? '❌ Se encontraron problemas de datos (ver arriba).' : '✅ No se encontraron problemas de datos en los chequeos realizados.');
    process.exit(hasIssues ? 1 : 0);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('\nError inesperado:', err);
  process.exit(1);
});
