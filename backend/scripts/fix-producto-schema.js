require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { Client } = require("pg");

async function run() {
  const dbClient = new Client({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    database: process.env.DB_NAME || "depo_stock",
  });

  try {
    await dbClient.connect();
    console.log("Conectado a la base de datos local para actualizar esquema de productos.");

    await dbClient.query(`
      ALTER TABLE producto ADD COLUMN IF NOT EXISTS codigo_sku VARCHAR(50);
      ALTER TABLE producto ADD COLUMN IF NOT EXISTS precio_unitario NUMERIC(10,2) DEFAULT 0;
      ALTER TABLE producto ADD COLUMN IF NOT EXISTS ubicacion_estante VARCHAR(100);
      ALTER TABLE producto ADD COLUMN IF NOT EXISTS descripcion TEXT;
      ALTER TABLE producto ADD COLUMN IF NOT EXISTS es_perecedero BOOLEAN DEFAULT FALSE;
      ALTER TABLE producto ADD COLUMN IF NOT EXISTS requiere_autorizacion BOOLEAN DEFAULT FALSE;
    `);

    console.log("✅ Esquema de productos actualizado correctamente.");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await dbClient.end();
  }
}

run();
