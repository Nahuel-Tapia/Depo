require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const dbConfig = require("../src/config/database");

const pool = new Pool(dbConfig);

async function main() {
  const email = "admin@depo.local";
  const password = "Admin123!";
  const hash = await bcrypt.hash(password, 10);

  const existingResult = await pool.query("SELECT id_usuario FROM usuario WHERE email = $1", [email]);
  const existing = existingResult.rows[0];

  if (existing) {
    await pool.query(
      "UPDATE usuario SET nombre = $1, apellido = $2, password = $3, role = 'admin', activo = TRUE WHERE id_usuario = $4",
      ["Administrador", "Inicial", hash, existing.id_usuario]
    );
    console.log("Admin actualizado.");
  } else {
    await pool.query(
      "INSERT INTO usuario (nombre, apellido, dni, email, password, role, activo, created_at) VALUES ($1, $2, $3, $4, $5, 'admin', TRUE, NOW())",
      ["Administrador", "Inicial", "00000000", email, hash]
    );
    console.log("Admin creado.");
  }

  console.log("Credenciales:");
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
}

main()
  .catch((err) => {
    console.error("No se pudo resetear admin", err);
    process.exitCode = 1;
  })
  .finally(() => {
    pool.end();
  });
