require('dotenv').config();
const { Client } = require('pg');
const dbConfig = require('../src/config/database');

const names = [
  'usuario',
  'institucion',
  'producto',
  'proveedor',
  'movimiento_stock',
  'auditoria',
  'ajustes',
  'asignaciones_stock',
  'pedidos',
  'movimientos',
  'users',
  'productos',
  'instituciones',
];

async function main() {
  const client = new Client(dbConfig);
  await client.connect();

  for (const n of names) {
    const result = await client.query(
      `SELECT c.relname, c.relkind
       FROM pg_class c
       JOIN pg_namespace ns ON ns.oid = c.relnamespace
       WHERE ns.nspname = $1 AND c.relname = $2
       LIMIT 1`,
      ['public', n]
    );

    if (!result.rows[0]) {
      console.log(`${n}: MISSING`);
      continue;
    }

    const kind = result.rows[0].relkind;
    const type = kind === 'v' ? 'VIEW' : kind === 'r' ? 'TABLE' : `KIND(${kind})`;
    console.log(`${n}: ${type}`);
  }

  await client.end();
}

main().catch((err) => {
  console.error('Error verificando objetos:', err.message);
  process.exit(1);
});
