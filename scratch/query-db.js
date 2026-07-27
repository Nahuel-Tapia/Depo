const { Client } = require('pg');

async function run() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'depo_stock',
    user: 'postgres',
    password: 'postgres'
  });
  await client.connect();

  console.log('--- ALL TABLES ---');
  const res = await client.query(`
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);
  console.log(res.rows.map(r => r.tablename));

  await client.end();
}

run().catch(console.error);
