const { pool } = require('../backend/src/db.pg');

async function main() {
  console.log('--- REVISANDO ESTADOS DE LA BASE DE DATOS ---');
  
  // Ver solicitudes de retiro y sus estados
  const solsRes = await pool.query(`
    SELECT sr.id, sr.estado, sr.departamento_envio, sr.id_institucion, i.nombre as institucion_nombre, sr.solicitar_envio
    FROM solicitud_retiro sr
    JOIN institucion i ON i.id_institucion = sr.id_institucion
    ORDER BY sr.id DESC
    LIMIT 10
  `);
  
  console.log('\nÚltimas Solicitudes de Retiro:');
  solsRes.rows.forEach(r => {
    console.log(`- ID: ${r.id} | Estado: ${r.estado} | Depto: ${r.departamento_envio} | Inst: ${r.institucion_nombre} (ID: ${r.id_institucion}) | Solicitar Envío: ${r.solicitar_envio}`);
  });

  // Ver depósitos creados
  const depsRes = await pool.query(`
    SELECT id_deposito, nombre, tipo_deposito, id_institucion
    FROM deposito
    ORDER BY id_deposito ASC
  `);
  
  console.log('\nDepósitos:');
  depsRes.rows.forEach(r => {
    console.log(`- ID: ${r.id_deposito} | Nombre: ${r.nombre} | Tipo: ${r.tipo_deposito} | Inst ID: ${r.id_institucion}`);
  });

  // Ver usuarios y sus roles
  const usersRes = await pool.query(`
    SELECT id_usuario, email, role, id_institucion
    FROM usuario
    WHERE email IN ('directivo@gmail.com', 'operador@depo.local', 'compras@depo.local')
  `);
  
  console.log('\nUsuarios clave:');
  usersRes.rows.forEach(r => {
    console.log(`- ID: ${r.id_usuario} | Email: ${r.email} | Rol: ${r.role} | Inst ID: ${r.id_institucion}`);
  });
}

main().catch(console.error).finally(() => pool.end());
