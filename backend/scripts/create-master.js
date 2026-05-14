const http = require("http");
const path = require("path");

// Load environment variables
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || 5432, 10),
  database: process.env.DB_NAME || "depo_stock",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres"
};

const pool = new Pool(dbConfig);

async function createMasterUser() {
  try {
    console.log("\n=== Crear usuario MASTER ===\n");
    
    const nombre = "Master";
    const email = "master@gmail.com";
    const password = "111111";
    const role = "master";

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if user already exists
    const existing = await pool.query(
      "SELECT id_usuario FROM usuario WHERE LOWER(email) = LOWER($1)",
      [email]
    );

    if (existing.rows.length > 0) {
      console.log("⚠️  El usuario master ya existe en la base de datos");
      console.log(`   Email: ${email}`);
      await pool.end();
      process.exit(0);
    }

    // Create the master user
    const result = await pool.query(
      `INSERT INTO usuario (nombre, email, password, role, activo) 
       VALUES ($1, $2, $3, $4, true) 
       RETURNING id_usuario, nombre, email, role`,
      [nombre, email, hashedPassword, role]
    );

    const user = result.rows[0];
    console.log("✅ Usuario MASTER creado exitosamente!\n");
    console.log("📋 Credenciales:");
    console.log(`   Email: ${email}`);
    console.log(`   Contraseña: ${password}`);
    console.log(`   Rol: ${role}`);
    console.log(`   ID: ${user.id_usuario}\n`);
    console.log("✨ El usuario master tiene acceso a todas las funcionalidades\n");

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("💥 Error:", err.message);
    await pool.end();
    process.exit(1);
  }
}

createMasterUser();
