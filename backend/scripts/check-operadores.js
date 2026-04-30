require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const { Pool } = require("pg");
const dbConfig = require("../src/config/database");

const pool = new Pool(dbConfig);

async function main() {
  const r = await pool.query(`
    SELECT id_usuario, nombre, email, role, nivel_educativo
    FROM usuario
    WHERE role IN ('operador', 'consulta')
    ORDER BY role, id_usuario
  `);

  console.log("\n=== OPERADORES Y CONSULTAS ===");
  console.log("ID | Nombre | Email | Rol | Nivel");
  console.log("--|--------|-------|-----|------");
  r.rows.forEach(x => {
    console.log(`${x.id_usuario} | ${x.nombre} ${x.apellido || ''} | ${x.email} | ${x.role} | ${x.nivel_educativo || '-'}`);
  });

  await pool.end();
}

main().catch(console.error);