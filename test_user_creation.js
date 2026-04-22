const { run, initDb, pool } = require('./backend/src/db.pg');
const bcrypt = require('bcryptjs');

async function test() {
  try {
    const password = await bcrypt.hash('Test1234!', 10);
    console.log('Intentando insertar usuario con rol area_compras...');
    
    // El error que el usuario reporta probablemente ocurre aquí o en la validación previa.
    // Vamos a forzar la inserción directamente en la DB para ver qué dice el motor.
    
    const sql = 'INSERT INTO usuario (nombre, apellido, email, dni, password, role, activo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    const params = ['Test', 'User', 'test_area_compras@example.com', '12345678', password, 'area_compras', true, new Date()];
    
    const result = await run(sql, params);
    console.log('Resultado:', result);
  } catch (error) {
    console.error('ERROR CAPTURADO:');
    console.error('Mensaje:', error.message);
    if (error.stack) console.error('Stack:', error.stack);
    if (error.detail) console.error('Detalle Postgres:', error.detail);
    if (error.code) console.error('Código Error:', error.code);
  } finally {
    process.exit();
  }
}

test();
