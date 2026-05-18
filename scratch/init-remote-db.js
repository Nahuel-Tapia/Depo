const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = process.argv[2];

if (!connectionString) {
  console.error('Por favor, proporciona la DATABASE_URL como argumento.');
  console.error('Ejemplo: node scratch/init-remote-db.js "postgresql://usuario:password@host/db"');
  process.exit(1);
}

async function run() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Conectado exitosamente a la base de datos remota.');

    const sqlPath = path.join(__dirname, '..', 'backend', 'depo_stock_dump.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Ejecutando el volcado (depo_stock_dump.sql)...');
    await client.query(sql);
    console.log('¡Esquema creado correctamente!');
    
    // Crear admin por defecto si no existe
    console.log('Creando usuario administrador por defecto...');
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync("Admin123!", 10);
    
    // Check if table exists first (just in case)
    await client.query(`
      INSERT INTO usuario (nombre, apellido, dni, email, password, role, activo, created_at) 
      VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW())
      ON CONFLICT (email) DO NOTHING
    `, ["Administrador", "Inicial", "00000000", "admin@depo.local", hash, "admin"]);
    
    console.log('¡Administrador creado con éxito! (admin@depo.local / Admin123!)');

  } catch (err) {
    console.error('Error durante la inicialización:', err.message);
  } finally {
    await client.end();
  }
}

run();
