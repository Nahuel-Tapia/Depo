require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Pool } = require('pg');
const dbConfig = require('../backend/src/config/database');

const pool = new Pool(dbConfig);

async function main() {
  const userRes = await pool.query("SELECT * FROM usuario WHERE email = 'directivoadultos@gmail.com'");
  if (userRes.rows.length === 0) {
    console.log("User directivoadultos@gmail.com not found!");
    pool.end();
    return;
  }
  const user = userRes.rows[0];
  console.log("User:", {
    id_usuario: user.id_usuario,
    email: user.email,
    role: user.role,
    nivel_educativo: user.nivel_educativo,
    id_institucion: user.id_institucion
  });

  if (user.id_institucion) {
    const instRes = await pool.query("SELECT * FROM institucion WHERE id_institucion = $1", [user.id_institucion]);
    const inst = instRes.rows[0];
    console.log("Institution:", {
      id_institucion: inst.id_institucion,
      nombre: inst.nombre,
      cue: inst.cue,
      nivel_educativo: inst.nivel_educativo,
      kit_id: inst.kit_id
    });
    
    if (inst.kit_id) {
      const kitRes = await pool.query("SELECT * FROM producto_kit WHERE id = $1", [inst.kit_id]);
      console.log("Kit assigned:", kitRes.rows[0]);
    } else {
      console.log("No kit assigned to institution. Listing all kits in DB:");
      const kitsRes = await pool.query("SELECT * FROM producto_kit");
      console.log(kitsRes.rows);
    }
  }

  pool.end();
}

main().catch(console.error);
