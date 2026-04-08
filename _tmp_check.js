require("dotenv").config();
const { Pool } = require("pg");
const p = new Pool(require("./backend/src/config/database"));
async function fix() {
  const p2 = require('pg');
  const pool = new p2.Pool(require('./backend/src/config/database'));
  
  // Guardar definiciones de vistas
  const res = await pool.query("SELECT viewname, definition FROM pg_views WHERE schemaname='public' AND definition LIKE '%institucion%'");
  const views = res.rows;
  
  // Eliminar vistas temporalmente
  for (const v of views) {
    await pool.query(`DROP VIEW IF EXISTS ${v.viewname} CASCADE`);
    console.log(`Vista ${v.viewname} eliminada`);
  }
  
  // Alterar columna
  await pool.query("ALTER TABLE institucion ALTER COLUMN nombre TYPE VARCHAR(200)");
  console.log("Columna nombre ampliada a VARCHAR(200)");
  
  // Recrear vistas
  for (const v of views) {
    await pool.query(`CREATE VIEW ${v.viewname} AS ${v.definition}`);
    console.log(`Vista ${v.viewname} recreada`);
  }
  
  await pool.end();
}
fix().catch(e => { console.error(e.message); process.exit(1); });
