require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const dbConfig = require("../src/config/database");

const pool = new Pool(dbConfig);

const PLAYWRIGHT_USERS = [
  {
    nombre: "Director Area Test",
    email: "director.primario@test.local",
    password: "Test123!",
    role: "director_area",
    nivel_educativo: "primario",
    jurisdiccion: "Capital"
  },
  {
    nombre: "Supervisor Test",
    email: "supervisor.zona1@test.local",
    password: "Test123!",
    role: "supervisor",
    nivel_educativo: "primario",
    jurisdiccion: "Capital"
  },
  {
    nombre: "Directivo Test",
    email: "directivo.escuela1@test.local",
    password: "Test123!",
    role: "directivo",
    nivel_educativo: "primario",
    jurisdiccion: "Capital"
  },
  {
    nombre: "Compras Test",
    email: "compras@test.local",
    password: "Test123!",
    role: "area_compras",
    nivel_educativo: "primario",
    jurisdiccion: "Capital"
  },
  {
    nombre: "Operador Test",
    email: "operador@test.local",
    password: "Test123!",
    role: "operador",
    nivel_educativo: "primario",
    jurisdiccion: "Capital"
  },
  {
    nombre: "Operador Escolar Test",
    email: "opescolar@test.local",
    password: "Test123!",
    role: "operador_escolar",
    nivel_educativo: "primario",
    jurisdiccion: "Capital"
  },
  {
    nombre: "Control Test",
    email: "control@test.local",
    password: "Test123!",
    role: "control_ministerio",
    nivel_educativo: "primario",
    jurisdiccion: "Capital"
  },
  {
    nombre: "Consulta Test",
    email: "consulta@test.local",
    password: "Test123!",
    role: "consulta",
    nivel_educativo: "primario",
    jurisdiccion: "Capital"
  }
];

async function main() {
  console.log("=== Sembrando usuarios de Playwright en la Base de Datos ===");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get an institution ID
    const instRes = await client.query("SELECT id_institucion FROM institucion LIMIT 1");
    const instId = instRes.rows.length > 0 ? instRes.rows[0].id_institucion : null;

    // Hash password
    const passwordHash = await bcrypt.hash("Test123!", 10);

    let directorAreaId = null;

    for (const u of PLAYWRIGHT_USERS) {
      const res = await client.query(
        `INSERT INTO usuario (nombre, email, password, role, nivel_educativo, jurisdiccion, id_institucion, activo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)
         ON CONFLICT (email) DO UPDATE 
         SET password = $3, role = $4, nivel_educativo = $5, jurisdiccion = $6, id_institucion = $7, activo = true
         RETURNING id_usuario`,
        [u.nombre, u.email, passwordHash, u.role, u.nivel_educativo, u.jurisdiccion, u.role === 'directivo' ? instId : null]
      );

      if (u.role === 'director_area') {
        directorAreaId = res.rows[0].id_usuario;
      }
    }

    if (directorAreaId) {
      await client.query(
        `UPDATE usuario SET director_area_id = $1 WHERE email = 'supervisor.zona1@test.local'`,
        [directorAreaId]
      );
    }

    await client.query("COMMIT");
    console.log("✅ Todos los usuarios de Playwright fueron creados/actualizados exitosamente con la contraseña Test123!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error sembrando usuarios:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
