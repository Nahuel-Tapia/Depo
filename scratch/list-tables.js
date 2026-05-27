require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Pool } = require('pg');
const dbConfig = require('../backend/src/config/database');

const pool = new Pool(dbConfig);

async function main() {
  const res = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  console.log("Tables in database:", res.rows.map(r => r.table_name));
  pool.end();
}

main().catch(console.error);
