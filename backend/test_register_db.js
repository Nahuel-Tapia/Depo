const { run, get } = require("./src/db.pg");
const bcrypt = require("bcryptjs");

async function testRegister() {
  try {
    const nombre = "Test Directivo";
    const email = "test_directivo_" + Date.now() + "@example.com";
    const cue = "700025400"; // Usando uno que sabemos que existe
    const nivel_educativo = "INICIAL";
    const password = "password123";

    console.log("Buscando institución...");
    const institucion = await get(
      `SELECT id_institucion FROM institucion WHERE cue = ? AND nivel_educativo = ?`,
      [cue, nivel_educativo]
    );

    if (!institucion) {
      console.error("Institución no encontrada");
      process.exit(1);
    }

    console.log("Insertando usuario...");
    const hash = await bcrypt.hash(password, 10);
    const result = await run(
      "INSERT INTO usuario (nombre, email, dni, password, telefono, id_institucion, role, activo, nivel_educativo) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, ?)",
      [nombre, email, cue, hash, "12345678", institucion.id_institucion, "directivo", nivel_educativo]
    );

    console.log("Registro exitoso, ID:", result.lastID);
    process.exit(0);
  } catch (err) {
    console.error("ERROR CAPTURADO:");
    console.error(err);
    process.exit(1);
  }
}

testRegister();
