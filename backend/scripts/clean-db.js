require("dotenv").config();
const { Client } = require("pg");

async function clean() {
  const dbClient = new Client({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    database: process.env.DB_NAME || "depo_stock",
  });

  try {
    await dbClient.connect();
    console.log("Conectado a la base de datos.");
    
    console.log("Truncando tablas...");
    await dbClient.query(`
      TRUNCATE 
        producto, 
        pedido, 
        ingreso, 
        orden_dispensacion
      CASCADE;
    `);
    
    console.log("✅ Base de datos limpiada correctamente. Productos y movimientos eliminados.");
  } catch (err) {
    console.error("Error limpiando la base de datos:", err);
  } finally {
    await dbClient.end();
  }
}

clean();
