const { pool } = require("./src/db.pg");

async function removeUniqueConstraint() {
  try {
    // Buscar el nombre de la restricción UNIQUE en la columna dni
    const res = await pool.query(`
      SELECT tc.constraint_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'UNIQUE' 
        AND tc.table_name = 'usuario' 
        AND kcu.column_name = 'dni'
    `);

    if (res.rows.length > 0) {
      const constraintName = res.rows[0].constraint_name;
      console.log(`Eliminando restricción: ${constraintName}`);
      await pool.query(`ALTER TABLE usuario DROP CONSTRAINT ${constraintName}`);
      console.log("Restricción eliminada con éxito.");
    } else {
      console.log("No se encontró ninguna restricción UNIQUE en la columna 'dni'.");
    }

    process.exit(0);
  } catch (err) {
    console.error("Error al modificar la tabla:", err);
    process.exit(1);
  }
}

removeUniqueConstraint();
