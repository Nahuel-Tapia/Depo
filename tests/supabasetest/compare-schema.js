/**
 * compare-schema.js
 *
 * Compara el esquema REAL de Supabase (schema "public") contra el esquema
 * ESPERADO, generado ejecutando tus archivos .sql de migración dentro de
 * un schema temporal ("shadow schema") en la MISMA base de datos.
 *
 * Por qué así: en lugar de parsear el SQL a mano (frágil), dejamos que
 * Postgres lo interprete de verdad. Se crea un schema aislado, se corren
 * ahí los .sql, se compara information_schema entre ambos schemas, y al
 * final se borra el schema temporal. No toca datos ni tablas reales.
 *
 * Uso:
 *   DATABASE_URL="postgresql://user:pass@host:5432/postgres" \
 *   node compare-schema.js --migrations ./migrations
 *
 * Requisitos:
 *   - El usuario de la connection string debe poder CREATE SCHEMA / DROP SCHEMA.
 *     (Con el usuario "postgres" de Supabase alcanza. Si usás un usuario
 *     limitado, puede que necesites permisos extra o correr esto contra
 *     un usuario admin puntualmente.)
 *   - Tus .sql deben poder ejecutarse sin depender de que el schema se
 *     llame "public" a mano (si usan "public.tabla" explícito en vez de
 *     "tabla" a secas, ver la sección "CASOS ESPECIALES" más abajo).
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const SHADOW_SCHEMA = 'schema_check_tmp';
const LIVE_SCHEMA = process.env.LIVE_SCHEMA || 'public';

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { migrations: './migrations', keepShadow: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--migrations') out.migrations = args[++i];
    if (args[i] === '--keep-shadow') out.keepShadow = true;
  }
  return out;
}

function loadMigrationFiles(dir) {
  if (!fs.existsSync(dir)) {
    throw new Error(`No existe la carpeta de migraciones: ${dir}`);
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // orden alfabético: nombrá tus archivos tipo 001_..., 002_...
  if (files.length === 0) {
    throw new Error(`No se encontraron archivos .sql en: ${dir}`);
  }
  return files.map((f) => ({ name: f, sql: fs.readFileSync(path.join(dir, f), 'utf8') }));
}

async function main() {
  const { migrations, keepShadow } = parseArgs();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Falta DATABASE_URL en el entorno (.env o variable de entorno).');
    process.exit(1);
  }

  const files = loadMigrationFiles(migrations);
  console.log(`Migraciones encontradas (${files.length}):`);
  files.forEach((f) => console.log(`  - ${f.name}`));

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  let hadError = false;

  try {
    console.log(`\nCreando schema temporal "${SHADOW_SCHEMA}"...`);
    await client.query(`DROP SCHEMA IF EXISTS ${SHADOW_SCHEMA} CASCADE`);
    await client.query(`CREATE SCHEMA ${SHADOW_SCHEMA}`);
    await client.query(`SET search_path TO ${SHADOW_SCHEMA}`);

    for (const file of files) {
      try {
        const sanitizedSql = file.sql
          .replace(/\bpublic\./gi, `${SHADOW_SCHEMA}.`)
          .replace(/"public"\./gi, `"${SHADOW_SCHEMA}".`);
        await client.query(sanitizedSql);
      } catch (err) {
        hadError = true;
        console.error(`\n❌ Error ejecutando ${file.name}:`);
        console.error(`   ${err.message}`);
      }
    }

    if (hadError) {
      console.error('\nAlgunas migraciones fallaron al recrearse. El diff de abajo puede ser incompleto/incorrecto hasta que se resuelva.');
    }

    await client.query(`SET search_path TO ${LIVE_SCHEMA}`);

    const diff = await compareSchemas(client, LIVE_SCHEMA, SHADOW_SCHEMA);
    printReport(diff);

    if (!keepShadow) {
      await client.query(`DROP SCHEMA IF EXISTS ${SHADOW_SCHEMA} CASCADE`);
    } else {
      console.log(`\n(Se dejó el schema "${SHADOW_SCHEMA}" para inspección manual. Borralo con: DROP SCHEMA ${SHADOW_SCHEMA} CASCADE;)`);
    }

    process.exit(diff.hasDifferences || hadError ? 1 : 0);
  } finally {
    await client.end();
  }
}

async function getTables(client, schema) {
  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = $1 AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
    [schema]
  );
  return rows.map((r) => r.table_name);
}

async function getColumns(client, schema) {
  const { rows } = await client.query(
    `SELECT table_name, column_name, data_type, udt_name, is_nullable,
            column_default, character_maximum_length, numeric_precision, numeric_scale
     FROM information_schema.columns
     WHERE table_schema = $1
     ORDER BY table_name, ordinal_position`,
    [schema]
  );
  return rows;
}

async function getConstraints(client, schema) {
  const { rows } = await client.query(
    `SELECT tc.table_name, tc.constraint_name, tc.constraint_type,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
     FROM information_schema.table_constraints tc
     LEFT JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     LEFT JOIN information_schema.constraint_column_usage ccu
       ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
       AND tc.constraint_type = 'FOREIGN KEY'
     WHERE tc.table_schema = $1
     ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name`,
    [schema]
  );
  return rows;
}

async function getIndexes(client, schema) {
  const { rows } = await client.query(
    `SELECT tablename AS table_name, indexname AS index_name, indexdef
     FROM pg_indexes
     WHERE schemaname = $1
     ORDER BY tablename, indexname`,
    [schema]
  );
  return rows;
}

function normalizeIndexDef(def, schema) {
  // Reemplaza el nombre del schema en la definición para poder comparar
  // "CREATE INDEX x ON public.tabla ..." vs "CREATE INDEX x ON schema_check_tmp.tabla ..."
  return def.replace(new RegExp(`\\b${schema}\\.`, 'g'), '<schema>.');
}

async function compareSchemas(client, liveSchema, shadowSchema) {
  const [liveTables, shadowTables] = await Promise.all([
    getTables(client, liveSchema),
    getTables(client, shadowSchema),
  ]);
  const [liveCols, shadowCols] = await Promise.all([
    getColumns(client, liveSchema),
    getColumns(client, shadowSchema),
  ]);
  const [liveCons, shadowCons] = await Promise.all([
    getConstraints(client, liveSchema),
    getConstraints(client, shadowSchema),
  ]);
  const [liveIdx, shadowIdx] = await Promise.all([
    getIndexes(client, liveSchema),
    getIndexes(client, shadowSchema),
  ]);

  const report = {
    missingTables: [], // están en el esperado (shadow), no en real (live)
    extraTables: [], // están en real, no en el esperado
    columnDiffs: [], // por tabla: columnas faltantes/extra/con tipo distinto
    constraintDiffs: [],
    indexDiffs: [],
    hasDifferences: false,
  };

  const liveTableSet = new Set(liveTables);
  const shadowTableSet = new Set(shadowTables);

  for (const t of shadowTables) if (!liveTableSet.has(t)) report.missingTables.push(t);
  for (const t of liveTables) if (!shadowTableSet.has(t)) report.extraTables.push(t);

  const commonTables = shadowTables.filter((t) => liveTableSet.has(t));

  const colKey = (c) => `${c.table_name}.${c.column_name}`;
  const liveColMap = new Map(liveCols.map((c) => [colKey(c), c]));
  const shadowColMap = new Map(shadowCols.map((c) => [colKey(c), c]));

  for (const table of commonTables) {
    const liveNames = new Set(liveCols.filter((c) => c.table_name === table).map((c) => c.column_name));
    const shadowNames = new Set(shadowCols.filter((c) => c.table_name === table).map((c) => c.column_name));

    const missingCols = [...shadowNames].filter((c) => !liveNames.has(c));
    const extraCols = [...liveNames].filter((c) => !shadowNames.has(c));
    const typeMismatches = [];

    for (const colName of shadowNames) {
      if (!liveNames.has(colName)) continue;
      const a = liveColMap.get(`${table}.${colName}`);
      const b = shadowColMap.get(`${table}.${colName}`);
      const fields = ['data_type', 'udt_name', 'is_nullable', 'character_maximum_length', 'numeric_precision', 'numeric_scale'];
      const diffs = fields.filter((f) => String(a[f]) !== String(b[f]));
      if (diffs.length) {
        typeMismatches.push({
          column: colName,
          live: pick(a, fields),
          expected: pick(b, fields),
        });
      }
    }

    if (missingCols.length || extraCols.length || typeMismatches.length) {
      report.columnDiffs.push({ table, missingCols, extraCols, typeMismatches });
    }
  }

  // Constraints: comparamos por tabla + tipo + columnas involucradas (los nombres
  // de constraint pueden diferir aunque sean "la misma" restricción)
  const consFingerprint = (c) =>
    `${c.table_name}|${c.constraint_type}|${c.column_name || ''}|${c.foreign_table_name || ''}|${c.foreign_column_name || ''}`;

  const liveConsSet = new Set(liveCons.filter((c) => commonTables.includes(c.table_name)).map(consFingerprint));
  const shadowConsSet = new Set(shadowCons.filter((c) => commonTables.includes(c.table_name)).map(consFingerprint));

  for (const c of shadowCons.filter((c) => commonTables.includes(c.table_name))) {
    const fp = consFingerprint(c);
    if (!liveConsSet.has(fp)) {
      report.constraintDiffs.push({ type: 'missing_in_live', table: c.table_name, kind: c.constraint_type, column: c.column_name, fk: c.foreign_table_name ? `${c.foreign_table_name}.${c.foreign_column_name}` : null });
    }
  }
  for (const c of liveCons.filter((c) => commonTables.includes(c.table_name))) {
    const fp = consFingerprint(c);
    if (!shadowConsSet.has(fp)) {
      report.constraintDiffs.push({ type: 'extra_in_live', table: c.table_name, kind: c.constraint_type, column: c.column_name, fk: c.foreign_table_name ? `${c.foreign_table_name}.${c.foreign_column_name}` : null });
    }
  }

  // Índices: comparamos la definición normalizada (sacando el nombre del schema)
  const idxFingerprint = (i, schema) => `${i.table_name}|${normalizeIndexDef(i.indexdef, schema)}`;
  const liveIdxSet = new Set(liveIdx.filter((i) => commonTables.includes(i.table_name)).map((i) => idxFingerprint(i, liveSchema)));
  const shadowIdxSet = new Set(shadowIdx.filter((i) => commonTables.includes(i.table_name)).map((i) => idxFingerprint(i, shadowSchema)));

  for (const i of shadowIdx.filter((i) => commonTables.includes(i.table_name))) {
    if (!liveIdxSet.has(idxFingerprint(i, shadowSchema))) {
      report.indexDiffs.push({ type: 'missing_in_live', table: i.table_name, name: i.index_name, def: i.indexdef });
    }
  }
  for (const i of liveIdx.filter((i) => commonTables.includes(i.table_name))) {
    if (!shadowIdxSet.has(idxFingerprint(i, liveSchema))) {
      report.indexDiffs.push({ type: 'extra_in_live', table: i.table_name, name: i.index_name, def: i.indexdef });
    }
  }

  report.hasDifferences =
    report.missingTables.length > 0 ||
    report.extraTables.length > 0 ||
    report.columnDiffs.length > 0 ||
    report.constraintDiffs.length > 0 ||
    report.indexDiffs.length > 0;

  return report;
}

function pick(obj, fields) {
  const out = {};
  fields.forEach((f) => (out[f] = obj[f]));
  return out;
}

function printReport(diff) {
  console.log('\n=== RESULTADO DE LA COMPARACIÓN DE ESQUEMA ===\n');

  if (!diff.hasDifferences) {
    console.log('✅ El esquema de Supabase coincide 100% con lo que definen las migraciones.');
    return;
  }

  console.log('❌ Se encontraron diferencias:\n');

  if (diff.missingTables.length) {
    console.log(`Tablas que deberían existir y NO están en Supabase (${diff.missingTables.length}):`);
    diff.missingTables.forEach((t) => console.log(`  - ${t}`));
    console.log('');
  }

  if (diff.extraTables.length) {
    console.log(`Tablas que están en Supabase y NO figuran en las migraciones (${diff.extraTables.length}):`);
    diff.extraTables.forEach((t) => console.log(`  - ${t}`));
    console.log('');
  }

  if (diff.columnDiffs.length) {
    console.log('Diferencias de columnas por tabla:');
    diff.columnDiffs.forEach(({ table, missingCols, extraCols, typeMismatches }) => {
      console.log(`  Tabla: ${table}`);
      if (missingCols.length) console.log(`    Faltan en Supabase: ${missingCols.join(', ')}`);
      if (extraCols.length) console.log(`    Sobran en Supabase (no están en migraciones): ${extraCols.join(', ')}`);
      typeMismatches.forEach((m) => {
        console.log(`    Columna "${m.column}" difiere:`);
        console.log(`      Supabase:  ${JSON.stringify(m.live)}`);
        console.log(`      Esperado:  ${JSON.stringify(m.expected)}`);
      });
    });
    console.log('');
  }

  if (diff.constraintDiffs.length) {
    console.log('Diferencias de constraints (PK/FK/UNIQUE/CHECK):');
    diff.constraintDiffs.forEach((c) => {
      const dir = c.type === 'missing_in_live' ? 'FALTA en Supabase' : 'SOBRA en Supabase';
      const fk = c.fk ? ` -> ${c.fk}` : '';
      console.log(`  [${dir}] ${c.table}.${c.column || ''} (${c.kind})${fk}`);
    });
    console.log('');
  }

  if (diff.indexDiffs.length) {
    console.log('Diferencias de índices:');
    diff.indexDiffs.forEach((i) => {
      const dir = i.type === 'missing_in_live' ? 'FALTA en Supabase' : 'SOBRA en Supabase';
      console.log(`  [${dir}] ${i.table} :: ${i.name}`);
      console.log(`      ${i.def}`);
    });
  }
}

main().catch((err) => {
  console.error('\nError inesperado:', err);
  process.exit(1);
});
