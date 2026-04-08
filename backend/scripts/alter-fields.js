/**
 * Script para alterar los campos de tamaño en la tabla edificio
 */
require("dotenv").config();
const { Client } = require("pg");
const dbConfig = require("../src/config/database");

async function alterFields() {
  const client = new Client(dbConfig);

  try {
    await client.connect();
    console.log("Alterando campos de la tabla edificio...");

    const queries = [
      "ALTER TABLE edificio ALTER COLUMN calle TYPE VARCHAR(150);",
      "ALTER TABLE edificio ALTER COLUMN direccion TYPE VARCHAR(200);",
      "ALTER TABLE edificio ALTER COLUMN localidad TYPE VARCHAR(100);",
      "ALTER TABLE edificio ALTER COLUMN departamento TYPE VARCHAR(100);"
    ];

    for (const query of queries) {
      await client.query(query);
      console.log(`✓ ${query}`);
    }

    console.log("\n¡Campos alterados correctamente!");
  } catch (err) {
    if (err.message.includes("already")) {
      console.log("Los campos ya tienen el tamaño correcto.");
    } else {
      console.error("Error al alterar campos:", err.message);
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

alterFields();
