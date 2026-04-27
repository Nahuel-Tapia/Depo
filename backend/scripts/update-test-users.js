require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const { Pool } = require("pg");
const dbConfig = require("../src/config/database");

const pool = new Pool(dbConfig);

async function main() {
  await pool.query("BEGIN");

  // 1. Asignar nivel educativo al Director de Área
  await pool.query(
    `UPDATE usuario SET nivel_educativo = 'Primario', jurisdiccion = 'Capital' WHERE email = 'direc@gmail.com'`
  );

  // 2. Asignar nivel educativo a los supervisores (mismo nivel que el director)
  await pool.query(
    `UPDATE usuario SET nivel_educativo = 'Primario', director_area_id = (SELECT id_usuario FROM usuario WHERE email = 'direc@gmail.com') WHERE role = 'supervisor'`
  );

  // 3. Asignar niveles educativos a los usuarios de prueba
  await pool.query(`UPDATE usuario SET nivel_educativo = 'Primario' WHERE email = 'compras@depo.local'`);
  await pool.query(`UPDATE usuario SET nivel_educativo = 'Primario' WHERE email = 'consulta@depo.local'`);
  await pool.query(`UPDATE usuario SET nivel_educativo = 'Primario' WHERE email = 'operador@depo.local'`);
  await pool.query(`UPDATE usuario SET nivel_educativo = 'Primario' WHERE email = 'control.ministerio@test.local'`);
  
  await pool.query("COMMIT");

  const result = await pool.query(`
    SELECT id_usuario, email, role, nivel_educativo, id_institucion, director_area_id, jurisdiccion 
    FROM usuario 
    WHERE role != 'admin' 
    ORDER BY role, id_usuario
  `);

  console.log("\n=== USUARIOS DE PRUEBA ACTUALIZADOS ===\n");
  console.log("ID | Email | Rol | Nivel | ID Inst | Director Area | Jurisdiccion");
  console.log("---|-------|-----|-------|---------|---------------|-------------");
  result.rows.forEach(u => {
    console.log(`${u.id_usuario} | ${u.email} | ${u.role} | ${u.nivel_educativo||'NULL'} | ${u.id_institucion||'NULL'} | ${u.director_area_id||'NULL'} | ${u.jurisdiccion||'NULL'}`);
  });

  console.log("\n=== RESUMEN DE USUARIOS PARA TESTING ===");
  console.log("Clave para todos los usuarios: 111111");
  console.log("\n- admin@depo.local / Admin123!  (admin - NO TOCAR)");
  console.log("- direc@gmail.com / 111111     (director_area - Nivel Primario)");
  console.log("- directivo@gmail.com / 111111 (directivo - Escuela Sarmiento)");
  console.log("- sup1@gmail.com - sup6@gmail.com / 111111 (supervisores - Nivel Primario)");
  console.log("- compras@depo.local / 111111  (area_compras)");
  console.log("- consulta@depo.local / 111111 (consulta)");
  console.log("- operador@depo.local / 111111  (operador)");
  console.log("- control.ministerio@test.local / 111111 (control_ministerio)");

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});