const { pool } = require("./backend/src/db.pg");

async function checkColumns() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'usuario'
    `);
    console.log("Columnas de 'usuario':");
    res.rows.forEach(row => {
      console.log(`- ${row.column_name} (${row.data_type})`);
    });

    const res2 = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'institucion'
    `);
    console.log("\nColumnas de 'institucion':");
    res2.rows.forEach(row => {
      console.log(`- ${row.column_name} (${row.data_type})`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkColumns();
