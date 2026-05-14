const { Pool } = require("pg");

const pool = new Pool({
  host: "localhost",
  port: 5432,
  database: "depo_stock",
  user: "postgres",
  password: "postgres"
});

async function addMasterRole() {
  try {
    console.log("Updating role constraint to include 'master'...");

    // First, drop the existing constraint
    await pool.query(`
      ALTER TABLE usuario DROP CONSTRAINT usuario_role_check
    `);
    console.log("✅ Old constraint dropped");

    // Add the new constraint with 'master' included
    await pool.query(`
      ALTER TABLE usuario ADD CONSTRAINT usuario_role_check CHECK (
        role IN ('admin', 'supervisor', 'director_area', 'directivo', 'operador', 'consulta', 'control_ministerio', 'area_compras', 'master')
      )
    `);
    console.log("✅ New constraint added with 'master' role");

    await pool.end();
  } catch (err) {
    console.error("❌ Error:", err.message);
    await pool.end();
    process.exit(1);
  }
}

addMasterRole();
