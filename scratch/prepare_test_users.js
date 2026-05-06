const { pool } = require('../backend/src/db.pg');
const bcrypt = require('bcryptjs');

async function createOrUpdateUser(email, nombre, role, nivel = null, instId = null) {
  const hash = bcrypt.hashSync('password123', 10);
  const res = await pool.query(
    `INSERT INTO usuario (nombre, apellido, dni, email, password, role, nivel_educativo, id_institucion, activo, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, NOW())
     ON CONFLICT (email) DO UPDATE SET 
        role = EXCLUDED.role, 
        nivel_educativo = EXCLUDED.nivel_educativo,
        id_institucion = EXCLUDED.id_institucion,
        password = EXCLUDED.password
     RETURNING id_usuario`,
    [nombre, 'Test', '11223344' + Math.floor(Math.random()*10), email, hash, role, nivel, instId]
  );
  return res.rows[0].id_usuario;
}

(async () => {
  try {
    // 1. Director Area
    await createOrUpdateUser('test_tecnica@depo.test', 'Director Tecnica', 'director_area', 'Tecnica');
    
    // 2. Supervisor
    await createOrUpdateUser('test_supervisor@depo.test', 'Supervisor Tecnica', 'supervisor', 'Tecnica');
    
    // 3. Directivo (from a school in Tecnica)
    const schoolRes = await pool.query("SELECT id_institucion FROM institucion WHERE direccion_area = 'Tecnica' LIMIT 1");
    if (schoolRes.rows.length > 0) {
      await createOrUpdateUser('test_directivo@depo.test', 'Directivo Escuela', 'directivo', 'Tecnica', schoolRes.rows[0].id_institucion);
      console.log('Directivo linked to school ID:', schoolRes.rows[0].id_institucion);
    }

    // 4. Area Compras
    await createOrUpdateUser('test_compras@depo.test', 'Compras User', 'area_compras');

    // 5. Operador
    await createOrUpdateUser('test_operador@depo.test', 'Operador Deposito', 'operador');

    console.log('Test users prepared successfully.');
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
})();
