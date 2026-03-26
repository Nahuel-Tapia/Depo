/**
 * Script para crear la base de datos PostgreSQL
 * Ejecutar: npm run db:create
 */
require("dotenv").config();
const { Client } = require("pg");

const dbName = process.env.DB_NAME || "depo_stock";

async function createDatabase() {
  // Conectar a postgres (base por defecto) para crear la DB
  const client = new Client({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    database: "postgres",
  });

  try {
    await client.connect();
    console.log("Conectado a PostgreSQL...");

    // Verificar si la base de datos existe
    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );

    if (result.rows.length === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Base de datos "${dbName}" creada exitosamente.`);
    } else {
      console.log(`Base de datos "${dbName}" ya existe.`);
    }
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createDatabase();
