/**
 * Script para ejecutar alter_table.sql
 */
require("dotenv").config();
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const dbName = process.env.DB_NAME || "depo_stock";

async function alterDb() {
  const dbClient = new Client({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    database: dbName,
  });

  try {
    await dbClient.connect();
    console.log("Ejecutando alter_table.sql...");

    const sqlPath = path.join(__dirname, "..", "..", "alter_table.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");
    await dbClient.query(sql);
    console.log("Tablas alteradas correctamente.");
  } catch (err) {
    console.error("Error ejecutando ALTER SQL:", err.message);
    process.exit(1);
  } finally {
    await dbClient.end();
  }
}

alterDb();