require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const { Pool } = require('pg');
const dbConfig = require('../src/config/database');

const pool = new Pool(dbConfig);

pool.query(`
  SELECT id_usuario, nombre, email, role, nivel_educativo, id_institucion, director_area_id, jurisdiccion 
  FROM usuario 
  WHERE role != 'admin' 
  ORDER BY role, id_usuario
`).then(r => {
  console.log('\n=== USUARIOS DE PRUEBA ===\n');
  console.log('ID | Email | Rol | Nivel Educativo | ID Inst | Director Area | Jurisdiccion');
  console.log('---|-------|-----|------------------|---------|---------------|-------------');
  r.rows.forEach(u => {
    console.log(`${u.id_usuario} | ${u.email} | ${u.role} | ${u.nivel_educativo||'NULL'} | ${u.id_institucion||'NULL'} | ${u.director_area_id||'NULL'} | ${u.jurisdiccion||'NULL'}`);
  });
  pool.end();
});