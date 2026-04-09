/**
 * Script de setup completo: crea la DB, ejecuta el SQL y crea el admin.
 * Ejecutar: npm run setup
 */
require("dotenv").config();
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const dbName = process.env.DB_NAME || "depo_stock";

async function setup() {
  // 1. Crear la base de datos si no existe
  const adminClient = new Client({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    database: "postgres",
  });

  try {
    await adminClient.connect();
    console.log("1/3 - Conectado a PostgreSQL...");

    const result = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );

    if (result.rows.length === 0) {
      await adminClient.query(`CREATE DATABASE "${dbName}"`);
      console.log(`     Base de datos "${dbName}" creada.`);
    } else {
      console.log(`     Base de datos "${dbName}" ya existe.`);
    }
  } catch (err) {
    console.error("Error creando la base de datos:", err.message);
    process.exit(1);
  } finally {
    await adminClient.end();
  }

  // 2. Ejecutar el archivo SQL
  const dbClient = new Client({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    database: dbName,
  });

  try {
    await dbClient.connect();
    console.log("2/3 - Ejecutando base_prueba.sql...");

    const sqlPath = path.join(__dirname, "..", "base_prueba.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");
    await dbClient.query(sql);
    console.log("     Tablas creadas correctamente.");
  } catch (err) {
    if (err.message.includes("already exists") || err.message.includes("ya existe")) {
      console.log("     Las tablas ya existen, se omite la creación.");
    } else {
      console.error("Error ejecutando SQL:", err.message);
      process.exit(1);
    }
  } finally {
    await dbClient.end();
  }

  // 3. Crear usuario admin
  console.log("3/3 - Creando usuario administrador...");
  require("./reset-admin");
}

setup();
