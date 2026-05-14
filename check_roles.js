const { Pool } = require("pg");

const pool = new Pool({
  host: "localhost",
  port: 5432,
  database: "depo_stock",
  user: "postgres",
  password: "postgres"
});

async function checkConstraints() {
  try {
    // Get the actual constraint definition using pg_get_constraintdef
    const res = await pool.query(`
      SELECT pg_get_constraintdef(oid)
      FROM pg_constraint
      WHERE conrelid = 'usuario'::regclass AND contype = 'c'
    `);
    console.log("Check constraints on usuario table:");
    console.log(res.rows);

    // Also get the valid roles
    const rolesRes = await pool.query(`SELECT DISTINCT role FROM usuario WHERE role IS NOT NULL ORDER BY role`);
    console.log("\nExisting roles in database:");
    console.log(rolesRes.rows.map(r => r.role));

    await pool.end();
  } catch (err) {
    console.error("Error:", err.message);
    await pool.end();
    process.exit(1);
  }
}

checkConstraints();
