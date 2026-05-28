require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Pool } = require('pg');
const dbConfig = require('../backend/src/config/database');

const pool = new Pool(dbConfig);

async function main() {
  const tables = ['usuario', 'institucion', 'deposito', 'solicitud_retiro', 'distribucion_lote'];
  for (const table of tables) {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [table]);
    console.log(`\nColumns of table "${table}":`);
    res.rows.forEach(r => console.log(`- ${r.column_name} (${r.data_type})`));
  }
  pool.end();
}

main().catch(console.error);
